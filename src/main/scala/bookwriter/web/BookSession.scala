package bookwriter.web

import bookwriter.{Assembler, BookGraph, BookOutline, ChapterDraft, ChapterPlan, Config, EditorSink, OutlineSink, Stages, WrittenChapter}
import zio.{Fiber, IO, Promise, Ref, UIO, ZIO}
import loki.engine.app.GraphApp
import loki.engine.core.executor.{ExecutionContext, TraceEvent}
import loki.engine.core.nodes.{AgentNode, EventType}
import java.time.Duration
import java.time.Instant

final case class SessionView(
  phase: BookPhase,
  gate: Option[Promise[Nothing, Gate]],
  events: List[(Instant, String)]
)

final case class TocOutcome(outline: BookOutline, mode: RunMode, notes: List[String])

object BookSession {

  def make(cfg: Config): UIO[BookSession] =
    for {
      id      <- ZIO.succeed(java.util.UUID.randomUUID().toString.take(8))
      session <- build(
                   id = id,
                   sessionCfg = cfg.copy(out = java.nio.file.Paths.get("output", "books", id, "book.md")),
                   phase = BookPhase.Planning,
                   events = Nil,
                   startedAt = Instant.now()
                 )
    } yield session

  /** Rebuilds a session persisted on disk. Gate phases get a live gate again, so
    * approving after a restart continues the real pipeline where it stopped. */
  def restore(persisted: PersistedSession): UIO[BookSession] =
    build(
      id = persisted.id,
      sessionCfg = persisted.cfg.toConfig(persisted.id),
      phase = SessionStore.fromPersisted(persisted.phase),
      events = persisted.events.map { case (atMs, message) => (Instant.ofEpochMilli(atMs), message) },
      startedAt = Instant.ofEpochMilli(persisted.startedAtMs)
    ).flatMap { session =>
      session.log("Session restored from disk") *> session.resume().as(session)
    }

  private def build(
    id: String,
    sessionCfg: Config,
    phase: BookPhase,
    events: List[(Instant, String)],
    startedAt: Instant
  ): UIO[BookSession] =
    for {
      store       <- loki.engine.core.store.GraphStore.make
      outlineSink = new OutlineSink
      editorSink  = new EditorSink
      graph       <- BookGraph.build(store, sessionCfg, outlineSink, editorSink)
      (app, architect, writer, editor) = graph
      stateRef    <- Ref.make(SessionView(phase, None, events))
      fiberRef    <- Ref.make[Option[Fiber[Nothing, Unit]]](None)
    } yield {
      val session = new BookSession(
        id = id,
        cfg = sessionCfg,
        app = app,
        architect = architect,
        writer = writer,
        editor = editor,
        outlineSink = outlineSink,
        editorSink = editorSink,
        stateRef = stateRef,
        fiberRef = fiberRef,
        startedAt = startedAt
      )
      app.getExecutor.addEventHook(session.eventHook)
      session
    }
}

final class BookSession private[web] (
  val id: String,
  val cfg: Config,
  app: GraphApp,
  architect: AgentNode,
  writer: AgentNode,
  editor: AgentNode,
  outlineSink: OutlineSink,
  editorSink: EditorSink,
  stateRef: Ref[SessionView],
  fiberRef: Ref[Option[Fiber[Nothing, Unit]]],
  startedAt: Instant
) {

  def view: UIO[SessionView] = stateRef.get

  def dto: UIO[BookDto] =
    stateRef.get.map { v =>
      val events = v.events.reverse.map { case (at, m) => EventDto(at.toString, m) }
      BookMapper.bookDto(id, cfg, v.phase, events)
    }

  def listItem: UIO[BookListItemDto] =
    stateRef.get.map(v => BookMapper.listItem(id, cfg, v.phase))

  def chapterText(n: Int): UIO[Option[ChapterTextDto]] =
    stateRef.get.map(v => BookMapper.chapterText(v.phase, n))

  def start(): UIO[Unit] =
    persist *> sessionProcess.forkDaemon.flatMap(fiber => fiberRef.set(Some(fiber)))

  /** Continues a restored session: gate phases re-open their gate and wait for the
    * user; mid-flight phases are closed out as interrupted failures. */
  def resume(): UIO[Unit] =
    stateRef.get.flatMap { v =>
      v.phase match {
        case BookPhase.TocReview(outline, revision) =>
          runResumed(tocLoop(outline, revision).flatMap(afterToc))
        case BookPhase.ChapterReview(outline, done, pending, remaining, notes) =>
          runResumed(reviewGate(outline, done, pending, remaining, notes).flatMap { written =>
            editStage(outline, written).flatMap { case (foreword, blurb) =>
              finish(outline, written, foreword, blurb)
            }
          })
        case BookPhase.Planning | BookPhase.Generating(_, _, _, _, _, _) | BookPhase.Editing(_, _) =>
          setPhase(BookPhase.Failed("Session was interrupted by a server restart", v.phase.status))
        case _ => ZIO.unit
      }
    }

  private def runResumed(effect: ZIO[Any, Throwable, Unit]): UIO[Unit] =
    eventDrainer.forever.fork.flatMap { drainer =>
      effect.catchAll(fail).catchAllDefect(fail).zipRight(drainer.interrupt.unit) *> drainEvents
    }.forkDaemon.flatMap(fiber => fiberRef.set(Some(fiber)))

  private def sessionProcess: UIO[Unit] =
    (for {
      _       <- log("Planning the book")
      outline <- Stages.plan(app, architect, outlineSink, cfg)
      outcome <- tocLoop(outline, 0)
      _       <- afterToc(outcome)
    } yield ()).catchAll(fail).catchAllDefect(fail)

  private def afterToc(outcome: TocOutcome): ZIO[Any, Throwable, Unit] =
    for {
      written <- chapterLoop(outcome.outline, Nil, outcome.outline.chapters, outcome.mode, outcome.notes)
      front   <- editStage(outcome.outline, written)
      _       <- finish(outcome.outline, written, front._1, front._2)
    } yield ()

  private def eventDrainer: UIO[Unit] =
    ZIO.succeed(Option(pendingEvents.poll())).flatMap {
      case Some(message) => log(message)
      case None          => ZIO.sleep(Duration.ofMillis(50))
    }

  private def drainEvents: UIO[Unit] =
    ZIO.succeed(Option(pendingEvents.poll())).flatMap {
      case Some(message) => log(message) *> drainEvents
      case None          => ZIO.unit
    }

  def interrupt: UIO[Unit] =
    fiberRef.get.flatMap {
      case Some(fiber) => fiber.interrupt.unit
      case None        => ZIO.unit
    }

  // ---- user actions ---------------------------------------------------------

  def approveToc(req: TocApproveRequest): IO[String, Unit] =
    ZIO
      .fromOption(RunMode.parse(req.mode))
      .mapError(_ => "mode must be \"all\" or \"step\"")
      .flatMap(mode => withGate(isTocReview, Gate.TocApprove(mode, req.comment, req.edits), "the TOC is not awaiting approval"))

  def reviseToc(req: TocReviseRequest): IO[String, Unit] =
    withGate(isTocReview, Gate.TocRevise(req.comment.trim), "the TOC is not awaiting approval")

  def approveChapter(n: Int, comment: Option[String]): IO[String, Unit] =
    withGate(isReviewing(n), Gate.ChapterApprove(comment), s"chapter $n is not awaiting review")

  def reviseChapter(n: Int, comment: String): IO[String, Unit] =
    withGate(isReviewing(n), Gate.ChapterRevise(comment.trim), s"chapter $n is not awaiting review")

  def approveRest(comment: Option[String]): IO[String, Unit] =
    withGate(isAnyReview, Gate.ChapterApproveRest(comment), "no chapter is awaiting review")

  // ---- executor progress hook -------------------------------------------------

  private val pendingEvents = new java.util.concurrent.ConcurrentLinkedQueue[String]()

  def eventHook(event: TraceEvent, ctx: ExecutionContext): Any = {
    describe(event).foreach(message => pendingEvents.add(message))
    ()
  }

  private def describe(event: TraceEvent): Option[String] = event.eventType match {
    case EventType.AgentStart => Some(s"${event.nodeName} started")
    case EventType.AgentEnd   => Some(s"${event.nodeName} finished ${event.durationMs.map(ms => f"(${ms / 1000.0}%.1fs)").getOrElse("")}")
    case EventType.ToolCall if event.nodeName.startsWith("record_") =>
      val input = event.payload.get("input").map(_.toString).getOrElse("")
      Some(s"${event.nodeName} ${clip(input, 90)}")
    case EventType.Retry => Some(s"retry: ${String.valueOf(event.payload.getOrElse("reason", ""))}")
    case _               => None
  }

  // ---- gate plumbing ---------------------------------------------------------

  private def isTocReview(phase: BookPhase): Boolean =
    phase.isInstanceOf[BookPhase.TocReview]

  private def isReviewing(n: Int)(phase: BookPhase): Boolean = phase match {
    case r: BookPhase.ChapterReview => r.pending.plan.number == n
    case _                          => false
  }

  private def isAnyReview(phase: BookPhase): Boolean =
    phase.isInstanceOf[BookPhase.ChapterReview]

  private def withGate(expected: BookPhase => Boolean, build: Gate, reject: String): IO[String, Unit] =
    stateRef.modify { s =>
      s.gate match {
        case Some(p) if expected(s.phase) => (Right(p), s.copy(gate = None))
        case _                            => (Left(reject), s)
      }
    }.flatMap {
      case Right(p) => p.succeed(build).unit
      case Left(m)  => ZIO.fail(m)
    }

  private def openGate(phase: BookPhase): UIO[Gate] =
    Promise.make[Nothing, Gate].flatMap { p =>
      stateRef.update(_.copy(phase = phase, gate = Some(p))) *> persist *> p.await <* stateRef.update(_.copy(gate = None))
    }

  // ---- pipeline --------------------------------------------------------------

  private def tocLoop(outline: BookOutline, revision: Int): ZIO[Any, Throwable, TocOutcome] =
    openGate(BookPhase.TocReview(outline, revision)).flatMap {
      case Gate.TocRevise(comment) =>
        log(s"Revising outline: ${clip(comment, 80)}") *>
          Stages.plan(app, architect, outlineSink, cfg, Some(comment)).flatMap(rev => tocLoop(rev, revision + 1))
      case Gate.TocApprove(mode, comment, edits) =>
        log(s"Outline approved (${mode.label} mode)") *>
          ZIO.succeed(TocOutcome(applyEdits(edits, outline), mode, comment.toList))
      case _ =>
        tocLoop(outline, revision)
    }

  private def chapterLoop(
    outline: BookOutline,
    done: List[WrittenChapter],
    remaining: List[ChapterPlan],
    mode: RunMode,
    notes: List[String]
  ): ZIO[Any, Throwable, List[WrittenChapter]] =
    remaining match {
      case Nil => ZIO.succeed(done)
      case plan :: rest =>
        val idx = plan.number - 1
        val prevEnding = done.lastOption.map(_.endingExcerpt())
        for {
          _     <- setPhase(BookPhase.Generating(outline, done, plan, rest, mode, notes))
          draft <- Stages.writeChapter(app, writer, cfg, outline, idx, prevEnding, notes, None)
          wc     = WrittenChapter(plan, draft.text)
          _     <- attachContinuity(draft)
          next  <- nextAfterWrite(outline, done, wc, rest, mode, notes)
        } yield next
    }

  private def nextAfterWrite(
    outline: BookOutline,
    done: List[WrittenChapter],
    wc: WrittenChapter,
    remaining: List[ChapterPlan],
    mode: RunMode,
    notes: List[String]
  ): ZIO[Any, Throwable, List[WrittenChapter]] =
    if (mode == RunMode.RunAll) chapterLoop(outline, done :+ wc, remaining, mode, notes)
    else reviewGate(outline, done, wc, remaining, notes)

  private def reviewGate(
    outline: BookOutline,
    done: List[WrittenChapter],
    wc: WrittenChapter,
    remaining: List[ChapterPlan],
    notes: List[String]
  ): ZIO[Any, Throwable, List[WrittenChapter]] =
    openGate(BookPhase.ChapterReview(outline, done, wc, remaining, notes)).flatMap {
      case Gate.ChapterRevise(comment) =>
        log(s"Revision requested for chapter ${wc.plan.number}: ${clip(comment, 80)}") *>
          rewriteWithFeedback(outline, done, wc, remaining, notes, comment)
      case Gate.ChapterApprove(comment) =>
        log(s"Chapter ${wc.plan.number} approved") *>
          chapterLoop(outline, done :+ wc, remaining, RunMode.StepByStep, notes ++ comment.toList)
      case Gate.ChapterApproveRest(comment) =>
        log("Remaining chapters pre-approved") *>
          chapterLoop(outline, done :+ wc, remaining, RunMode.RunAll, notes ++ comment.toList)
      case _ =>
        reviewGate(outline, done, wc, remaining, notes)
    }

  private def rewriteWithFeedback(
    outline: BookOutline,
    done: List[WrittenChapter],
    wc: WrittenChapter,
    remaining: List[ChapterPlan],
    notes: List[String],
    comment: String
  ): ZIO[Any, Throwable, List[WrittenChapter]] = {
    val idx = wc.plan.number - 1
    val prevEnding = done.lastOption.map(_.endingExcerpt())
    for {
      draft <- Stages.writeChapter(app, writer, cfg, outline, idx, prevEnding, notes, Some(comment))
      wc2    = WrittenChapter(wc.plan, draft.text)
      next  <- reviewGate(outline, done, wc2, remaining, notes)
    } yield next
  }

  private def editStage(outline: BookOutline, written: List[WrittenChapter]): UIO[(String, String)] =
    setPhase(BookPhase.Editing(outline, written)) *>
      (if (cfg.skipEditor) ZIO.succeed(("", ""))
       else
         log("Writing foreword and blurb") *>
           Stages.edit(app, editor, editorSink, outline, written, cfg).catchAll { e =>
             log(s"Editor stage failed (${clip(e.getMessage, 80)}); completing without front matter") *> ZIO.succeed(("", ""))
           })

  private def finish(outline: BookOutline, written: List[WrittenChapter], foreword: String, blurb: String): UIO[Unit] = {
    val elapsed = Duration.ofSeconds(Duration.between(startedAt, Instant.now()).getSeconds)
    val md = Assembler.markdown(outline, written, foreword, blurb, cfg, elapsed)
    for {
      files <- ZIO.attempt(Assembler.save(cfg, md, outline, written)).orElseSucceed(Nil)
      paths  = files.map(_.toString)
      _     <- setPhase(BookPhase.Completed(outline, written, md, paths, elapsed.getSeconds))
      _     <- log(s"Book complete: ${outline.title} (${written.map(_.wordCount).sum} words)")
    } yield ()
  }

  private def fail(e: Throwable): UIO[Unit] =
    stateRef.get.flatMap { v =>
      setPhase(BookPhase.Failed(e.getMessage, v.phase.status)) *> log(s"Failed: ${clip(e.getMessage, 160)}")
    }

  // ---- helpers ---------------------------------------------------------------

  private def setPhase(phase: BookPhase): UIO[Unit] =
    stateRef.update(_.copy(phase = phase)) *> persist

  /** Checkpoints the session to disk (output/books/<id>/session.json) so the book
    * list, chapters and review gates survive server restarts. */
  def persist: UIO[Unit] =
    stateRef.get.flatMap { v =>
      SessionStore.save(SessionStore.snapshot(id, cfg, v.phase, v.events, startedAt))
    }

  private def log(message: String): UIO[Unit] =
    stateRef.update { v =>
      v.copy(events = ((Instant.now(), message) :: v.events).take(80))
    }

  private def clip(s: String, max: Int): String =
    if (s == null) "" else if (s.length <= max) s else s.take(max) + "..."

  private def applyEdits(edits: Option[OutlineEdits], outline: BookOutline): BookOutline =
    edits.fold(outline) { e =>
      val plans = e.chapters.fold(outline.chapters)(applyChapterEdits(outline, _))
      BookOutline(
        title = e.title.getOrElse(outline.title),
        genre = e.genre.getOrElse(outline.genre),
        premise = e.premise.getOrElse(outline.premise),
        chapters = plans
      )
    }

  private def applyChapterEdits(outline: BookOutline, list: List[ChapterEdit]): List[ChapterPlan] =
    list.map { ce =>
      val base = outline.chapters.find(_.number == ce.number)
      base.fold(ChapterPlan(ce.number, ce.title.getOrElse(""), ce.synopsis.getOrElse(""))) { b =>
        b.copy(title = ce.title.getOrElse(b.title), synopsis = ce.synopsis.getOrElse(b.synopsis))
      }
    }.sortBy(_.number).zipWithIndex.map { case (c, i) => c.copy(number = i + 1) }

  private def attachContinuity(draft: ChapterDraft): UIO[Unit] =
    if (cfg.concurrency > 1) ZIO.unit
    else
      app.getExecutor
        .materialiseOutput(writer, draft.text, draft.context)
        .flatMap(node => app.connectContext(writer, node, weight = Some(0.95)).unit)
        .catchAll(_ => ZIO.unit)
}
