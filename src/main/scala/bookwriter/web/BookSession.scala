package bookwriter.web

import bookwriter.{Assembler, BookGraph, BookOutline, Briefs, ChapterPlan, Config, ContinuityGraph, ContinuityIssue, ContinuityMemory, ContinuityReport, CoverError, CoverGen, CoverImage, Diagrams, EditorSink, Finding, IllustrationConfig, Illustrations, OutlineSink, Reference, ReviewReport, ScholarGraph, Stages, WrittenChapter}
import zio.{Fiber, IO, Promise, Ref, UIO, ZIO}
import loki.engine.app.GraphApp
import loki.engine.core.executor.{ExecutionContext, TraceEvent}
import loki.engine.core.nodes.{AgentNode, EventType}
import java.time.Duration
import java.time.Instant

final case class SessionView(
  phase: BookPhase,
  gate: Option[Promise[Nothing, Gate]],
  events: List[(Instant, String)],
  idea: String
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
      session.setReferences(persisted.references) *> session.setContinuity(persisted.continuity) *> session.log("Session restored from disk") *> session.resume().as(session)
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
      graph       <- BookGraph.build(store, sessionCfg, outlineSink, editorSink, Some(bookwriter.LlmLimiter.gate))
      (app, architect, writer, editor, scholar, continuity) = graph
      stateRef    <- Ref.make(SessionView(phase, None, events, sessionCfg.prompt))
      fiberRef    <- Ref.make[Option[Fiber[Nothing, Unit]]](None)
       refsRef     <- Ref.make[List[Reference]](Nil)
       findingsRef <- Ref.make[List[Finding]](Nil)
       reviewRef   <- Ref.make[Option[ReviewReport]](None)
       coverRef    <- Ref.make[Option[CoverImage]](None)
       coverMutex  <- zio.Semaphore.make(1L)
       memoryRef   <- Ref.make(ContinuityMemory())
    } yield {
      val session = new BookSession(
        id = id,
        cfg = sessionCfg,
        app = app,
        architect = architect,
        writer = writer,
        editor = editor,
        scholar = scholar,
        continuity = continuity,
        memoryRef = memoryRef,
        outlineSink = outlineSink,
        editorSink = editorSink,
        stateRef = stateRef,
        fiberRef = fiberRef,
        refsRef = refsRef,
        findingsRef = findingsRef,
        reviewRef = reviewRef,
        coverRef = coverRef,
        coverMutex = coverMutex,
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
  scholar: Option[ScholarGraph],
  continuity: ContinuityGraph,
  memoryRef: Ref[ContinuityMemory],
  outlineSink: OutlineSink,
  editorSink: EditorSink,
  stateRef: Ref[SessionView],
  fiberRef: Ref[Option[Fiber[Nothing, Unit]]],
  refsRef: Ref[List[Reference]],
  findingsRef: Ref[List[Finding]],
  reviewRef: Ref[Option[ReviewReport]],
  coverRef: Ref[Option[CoverImage]],
  coverMutex: zio.Semaphore,
  startedAt: Instant
) {

  def view: UIO[SessionView] = stateRef.get

  def dto: UIO[BookDto] =
    stateRef.get.zipWith(memoryRef.get) { (v, memory) =>
      val events = v.events.reverse.map { case (at, m) => EventDto(at.toString, m) }
      BookMapper.bookDto(id, withIdea(v), v.phase, events, memory.bible)
    }

  def listItem: UIO[BookListItemDto] =
    stateRef.get.map(v => BookMapper.listItem(id, withIdea(v), v.phase))

  def chapterText(n: Int): UIO[Option[ChapterTextDto]] =
    stateRef.get.map(v => BookMapper.chapterText(v.phase, n))

  def cover: UIO[Option[CoverImage]] = coverRef.get

  /** Returns the cached cover, or generates one from the current outline and caches it.
    * The mutex keeps concurrent requests from generating two covers. */
  def ensureCover(generate: String => IO[CoverError, CoverImage]): IO[CoverError, CoverImage] =
    coverRef.get.flatMap {
      case Some(cached) => ZIO.succeed(cached)
      case None         =>
        coverMutex.withPermit {
          coverRef.get.flatMap {
            case Some(cached) => ZIO.succeed(cached)
            case None         =>
              stateRef.get.flatMap { v =>
                BookMapper.outlineOf(v.phase) match {
                  case None          => ZIO.fail(CoverError.NoOutline(v.phase.status))
                  case Some(outline) =>
                    log("Generating the cover image") *>
                      generate(CoverGen.coverPrompt(outline)).tap { _ =>
                        log("Cover image generated")
                      }.tapError { error =>
                        log(s"Cover generation failed (${clip(error.message, 80)})")
                      }
                  }
              }.tap(cover => coverRef.set(Some(cover)))
          }
        }
    }

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
        case BookPhase.Planning | _: BookPhase.Generating | BookPhase.Editing(_, _) =>
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
      _       <- preparing(outcome)
      _       <- if (cfg.scholar) bibliographyStage(outcome.outline) else ZIO.unit
      _       <- bibleStage(outcome.outline, outcome.notes)
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
      .zip(parseIdea(req.prompt))
      .flatMap { case (mode, idea) =>
        withGate(isTocReview, Gate.TocApprove(mode, req.comment, req.edits), "the TOC is not awaiting approval", idea)
      }

  def reviseToc(req: TocReviseRequest): IO[String, Unit] =
    parseIdea(req.prompt).flatMap {
      case None if req.comment.trim.isEmpty => ZIO.fail("a revision needs feedback or a changed book idea")
      case idea => withGate(isTocReview, Gate.TocRevise(req.comment.trim), "the TOC is not awaiting approval", idea)
    }

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

  private def parseIdea(raw: Option[String]): IO[String, Option[String]] =
    raw.map(_.trim) match {
      case Some("") => ZIO.fail("the book idea must not be empty")
      case idea     => ZIO.succeed(idea)
    }

  private def withGate(expected: BookPhase => Boolean, build: Gate, reject: String, idea: Option[String] = None): IO[String, Unit] =
    stateRef.modify { s =>
      s.gate match {
        case Some(p) if expected(s.phase) => (Right(p), s.copy(gate = None, idea = idea.getOrElse(s.idea)))
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
        persist *>
          log(if (comment.isEmpty) "Revising outline from the changed book idea" else s"Revising outline: ${clip(comment, 80)}") *>
          currentCfg
            .flatMap(current => Stages.plan(app, architect, outlineSink, current, Some(comment).filter(_.nonEmpty)))
            .flatMap(rev => tocLoop(rev, revision + 1))
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
      case _ if mode == RunMode.RunAll && cfg.concurrency > 1 =>
        chapterBatch(outline, done, remaining, notes)
      case plan :: rest =>
        val idx = plan.number - 1
        val prevEnding = done.lastOption.map(_.endingExcerpt())
        for {
          _     <- setPhase(BookPhase.Generating(outline, done, plan, rest, mode, notes))
          refs  <- refsRef.get
          memory <- writerMemory(done)
          draft <- Stages.writeChapter(app, writer, cfg, outline, idx, prevEnding, notes, None, refs, memory)
          wc     = WrittenChapter(plan, draft.text)
          refined <- scholarRefine(outline, done, wc)
          next  <- nextAfterWrite(outline, done, refined, rest, mode, notes)
        } yield next
    }

  /** Writes the next chapters together, up to the book's concurrency, then checks them against
    * the guide and each other before the next group starts. Fact checks and the continuity
    * editor each share one sink, so they run one at a time. */
  private def chapterBatch(
    outline: BookOutline,
    done: List[WrittenChapter],
    remaining: List[ChapterPlan],
    notes: List[String]
  ): ZIO[Any, Throwable, List[WrittenChapter]] = {
    val (batch, rest) = remaining.splitAt(cfg.concurrency)
    val prevEnding = done.lastOption.map(_.endingExcerpt())
    for {
      _      <- setPhase(BookPhase.Generating(outline, done, batch.head, rest, RunMode.RunAll, notes, batch.tail))
      refs   <- refsRef.get
      memory <- writerMemory(done)
      drafts <- ZIO
                  .foreachPar(batch) { plan =>
                    val ending = if (plan == batch.head) prevEnding else None
                    Stages.writeChapter(app, writer, cfg, outline, plan.number - 1, ending, notes, None, refs, memory)
                      .tap(_ => log(s"Chapter ${plan.number} drafted"))
                      .map(draft => plan -> draft)
                  }
                  .withParallelism(cfg.concurrency)
      refined <- ZIO.foreach(drafts) { case (plan, draft) =>
                   scholarRefine(outline, done, WrittenChapter(plan, draft.text))
                 }
      _      <- setPhase(BookPhase.Generating(outline, done, batch.head, rest, RunMode.RunAll, notes, batch.tail, BookPhase.Checking))
      written <- groupCheck(outline, done, refined, notes, refs)
      next   <- chapterLoop(outline, done ++ written, rest, RunMode.RunAll, notes)
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
    if (mode == RunMode.RunAll) recordLedger(outline, done, wc) *> chapterLoop(outline, done :+ wc, remaining, mode, notes)
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
          recordLedger(outline, done, wc) *>
          chapterLoop(outline, done :+ wc, remaining, RunMode.StepByStep, notes ++ comment.toList)
      case Gate.ChapterApproveRest(comment) =>
        log("Remaining chapters pre-approved") *>
          recordLedger(outline, done, wc) *>
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
      refs  <- refsRef.get
      memory <- writerMemory(done)
      draft <- Stages.writeChapter(app, writer, cfg, outline, idx, prevEnding, notes, Some(comment), refs, memory, Some(wc.text))
      wc2    = WrittenChapter(wc.plan, draft.text)
      next  <- reviewGate(outline, done, wc2, remaining, notes)
    } yield next
  }

  // ---- continuity stages ------------------------------------------------------

  def setContinuity(memory: ContinuityMemory): UIO[Unit] = memoryRef.set(memory)

  private def writerMemory(written: List[WrittenChapter]): UIO[String] =
    memoryRef.get.map(_.forWriter(written, cfg.scholar))

  /** Shows the book as being prepared, so the approved outline no longer looks like it awaits review. */
  private def preparing(outcome: TocOutcome): UIO[Unit] =
    outcome.outline.chapters match {
      case first :: rest =>
        setPhase(BookPhase.Generating(outcome.outline, Nil, first, rest, outcome.mode, outcome.notes, Nil, BookPhase.Preparing))
      case Nil => ZIO.unit
    }

  /** Decides the shared details before any chapter exists. Without a guide the book still gets
    * the outline and the ledger, so a failure here does not stop it. */
  private def bibleStage(outline: BookOutline, notes: List[String]): UIO[Unit] =
    log(s"Writing the ${guideName}") *>
      currentCfg.flatMap(current => Stages.storyBible(app, continuity, outline, current, notes)).foldZIO(
        e => log(s"Could not write the $guideName (${clip(e.getMessage, 80)}); continuing with the outline only"),
        bible => memoryRef.update(_.copy(bible = bible)) *> persist *> log(s"${guideName.capitalize} ready")
      )

  private def guideName: String = if (cfg.scholar) "consistency guide" else "story bible"

  private def applyReport(report: ContinuityReport, chapters: String): UIO[Unit] =
    memoryRef.update(_.withEntries(report.entries)) *> persist *>
      report.failure.fold(ZIO.unit: UIO[Unit]) { reason =>
        log(s"Could not read chapter(s) $chapters for the ledger (${clip(reason, 80)}); later chapters get its synopsis and ending")
      }

  /** Records a chapter that is final: approved in review, or written without review. */
  private def recordLedger(outline: BookOutline, done: List[WrittenChapter], wc: WrittenChapter): UIO[Unit] =
    memoryRef.get
      .flatMap(memory => Stages.continuityPass(app, continuity, outline, memory, done, List(wc), check = false, cfg.scholar))
      .flatMap(applyReport(_, wc.plan.number.toString))

  /** Reads a drafted group, repairs what contradicts the guide or an earlier chapter (one round),
    * and records what the final text established. Any failure keeps the drafts and the book. */
  private def groupCheck(
    outline: BookOutline,
    done: List[WrittenChapter],
    group: List[WrittenChapter],
    notes: List[String],
    refs: List[bookwriter.Reference]
  ): UIO[List[WrittenChapter]] = {
    val numbers = group.map(_.plan.number).mkString(", ")
    for {
      _      <- log(s"Checking continuity of chapter(s) $numbers")
      memory <- memoryRef.get
      report <- Stages.continuityPass(app, continuity, outline, memory, done, group, check = true, cfg.scholar)
      _      <- applyReport(report, numbers)
      fixed  <- repairIssues(outline, done, group, report.issues, notes, refs)
      _      <- report.failure.fold(log(s"Chapter(s) $numbers: ${report.issues.size} continuity issue(s) found"))(_ => ZIO.unit)
    } yield fixed
  }

  private def repairIssues(
    outline: BookOutline,
    done: List[WrittenChapter],
    group: List[WrittenChapter],
    issues: List[ContinuityIssue],
    notes: List[String],
    refs: List[bookwriter.Reference]
  ): UIO[List[WrittenChapter]] =
    if (issues.isEmpty) ZIO.succeed(group)
    else
      for {
        _      <- ZIO.foreachDiscard(issues)(i => log(s"Continuity issue in chapter ${i.chapter}: ${clip(i.problem, 140)}"))
        memory <- memoryRef.get
        byChapter = issues.groupBy(_.chapter)
        repaired <- ZIO
                      .foreachPar(group.zipWithIndex) { case (wc, position) =>
                        byChapter.get(wc.plan.number) match {
                          case None         => ZIO.succeed(wc -> false)
                          case Some(found)  =>
                            val before = memory.forWriter(done ++ group.take(position), cfg.scholar)
                            repairChapter(outline, wc, found, notes, refs, before)
                        }
                      }
                      .withParallelism(cfg.concurrency)
        changed = repaired.collect { case (wc, true) => wc }
        _ <- ZIO.foldLeft(changed)(()) { (_, wc) =>
               val earlier = done ++ repaired.map(_._1).filter(_.plan.number < wc.plan.number)
               recordLedger(outline, earlier, wc)
             }
      } yield repaired.map(_._1)

  /** A reply much shorter than the draft is a patch or a summary, not the chapter, so the draft stays. */
  private def repairChapter(
    outline: BookOutline,
    wc: WrittenChapter,
    issues: List[ContinuityIssue],
    notes: List[String],
    refs: List[bookwriter.Reference],
    memory: String
  ): UIO[(WrittenChapter, Boolean)] = {
    val number = wc.plan.number
    Stages
      .writeChapter(app, writer, cfg, outline, number - 1, None, notes, Some(Briefs.continuityRevision(issues)), refs, memory, Some(wc.text))
      .map(draft => WrittenChapter(wc.plan, draft.text))
      .foldZIO(
        e => log(s"Could not repair chapter $number (${clip(e.getMessage, 80)}); keeping the draft").as(wc -> false),
        fixed =>
          if (fixed.wordCount * 2 < wc.wordCount)
            log(s"Repair of chapter $number came back too short; keeping the draft").as(wc -> false)
          else log(s"Repaired chapter $number").as(fixed -> true)
      )
  }

  // ---- scholar stages ---------------------------------------------------------

  def setReferences(refs: List[Reference]): UIO[Unit] = refsRef.set(refs)

  /** Stage S1: the Bibliographer compiles the reference list right after TOC approval. */
  private def bibliographyStage(outline: BookOutline): UIO[Unit] =
    scholar match {
      case None => ZIO.unit
      case Some(sg) =>
        log("Compiling the bibliography") *>
          Stages.bibliography(app, sg.bibliographer, sg.refSink, outline, cfg)
            .flatMap { refs =>
              refsRef.set(refs) *> persist *> log(s"Bibliography complete: ${refs.size} references")
            }
            .catchAll(e => log(s"Bibliography failed (${clip(e.getMessage, 80)}); continuing without references"))
    }

  /** Stage S2: per-section fact cross-check with one automatic repair round when the
    * FactChecker flags major problems. Accumulates findings for the final report. */
  private def scholarRefine(outline: BookOutline, done: List[WrittenChapter], wc: WrittenChapter): ZIO[Any, Throwable, WrittenChapter] =
    scholar match {
      case None => ZIO.succeed(wc)
      case Some(sg) =>
        refsRef.get.flatMap { refs =>
          findingsRef.update(_.filterNot(_.section == wc.plan.number)) *>
            log(s"Fact-checking section ${wc.plan.number}") *>
            Stages.factCheck(app, sg.factChecker, sg.factSink, outline, wc, refs).flatMap { findings =>
              val problems = findings.filter(f => f.isMajor || f.verdict == "contradicted" || f.verdict == "unsupported")
              if (problems.isEmpty)
                findingsRef.update(_ ++ findings).as(wc)
              else
                Briefs.factCheckRevision(findings) match {
                  case None => findingsRef.update(_ ++ findings).as(wc)
                  case Some(revision) =>
                    log(s"Fact-check found ${problems.size} problem(s); repairing section ${wc.plan.number}") *>
                      writerMemory(done).flatMap(memory => Stages.writeChapter(app, writer, cfg, outline, wc.plan.number - 1, None, Nil, Some(revision), refs, memory, Some(wc.text)))
                        .flatMap { draft =>
                          val repaired = WrittenChapter(wc.plan, draft.text)
                          Stages.factCheck(app, sg.factChecker, sg.factSink, outline, repaired, refs)
                            .flatMap { recheck =>
                              findingsRef.update(_ ++ recheck).as(repaired)
                            }
                        }
                }
            }
        }.catchAll { e =>
          log(s"Fact-check failed for section ${wc.plan.number} (${clip(e.getMessage, 80)}); keeping draft") *>
            ZIO.succeed(wc)
        }
    }

  /** Stage S3: the PeerReviewer reviews the finished paper (in place of the book editor). */
  private def reviewStage(outline: BookOutline, written: List[WrittenChapter]): UIO[Unit] =
    scholar match {
      case None => ZIO.unit
      case Some(sg) =>
        refsRef.get.flatMap { refs =>
          log("Peer review") *>
            Stages.peerReview(app, sg.reviewer, sg.reviewSink, outline, written, refs)
              .flatMap { report =>
                reviewRef.set(report) *>
                  log(report.fold("Peer review failed; continuing without review report")(
                    r => s"Review verdict: ${r.verdict} (score ${r.score}/10, ${r.issues.size} issue(s))"))
              }
        }.catchAll(_ => ZIO.unit)
    }

  private def editStage(outline: BookOutline, written: List[WrittenChapter]): UIO[(String, String)] =
    setPhase(BookPhase.Editing(outline, written)) *>
      (if (cfg.scholar) reviewStage(outline, written).as(("", ""))
       else if (cfg.skipEditor) ZIO.succeed(("", ""))
       else
         log("Writing foreword and blurb") *>
           Stages.edit(app, editor, editorSink, outline, written, cfg).catchAll { e =>
             log(s"Editor stage failed (${clip(e.getMessage, 80)}); completing without front matter") *> ZIO.succeed(("", ""))
           })

  private def finish(outline: BookOutline, written: List[WrittenChapter], foreword: String, blurb: String): UIO[Unit] = {
    val elapsed = Duration.ofSeconds(Duration.between(startedAt, Instant.now()).getSeconds)
    for {
      refs     <- refsRef.get
      findings <- findingsRef.get
      review   <- reviewRef.get
      limited   = cfg.illustrations.fold(written)(c => written.map(w => w.copy(text = Illustrations.capped(w.text, c.perChapter))))
      assembled =
        if (cfg.scholar) Assembler.scholarMarkdown(outline, limited, refs, findings, review, cfg, elapsed)
        else Assembler.markdown(outline, limited, foreword, blurb, cfg, elapsed)
      diagrams <- Diagrams.renderBook(assembled, cfg.diagrams)
      _        <- logDiagrams(diagrams).when(cfg.diagrams)
      pictures <- Illustrations.renderBook(diagrams.markdown, outline, cfg.illustrations, log)
      _        <- logIllustrations(pictures).when(cfg.illustrations.nonEmpty)
      md        = pictures.markdown
      files <- ZIO.attempt(
        if (cfg.scholar) Assembler.save(cfg, md, outline, written, refs, findings, review)
        else Assembler.save(cfg, md, outline, written)
      ).orElseSucceed(Nil)
      paths  = files.map(_.toString)
      _     <- setPhase(BookPhase.Completed(outline, written, md, paths, elapsed.getSeconds))
      _     <- log(s"${if (cfg.scholar) "Paper" else "Book"} complete: ${outline.title} (${written.map(_.wordCount).sum} words)")
    } yield ()
  }

  private def logIllustrations(pictures: bookwriter.RenderedIllustrations): UIO[Unit] =
    log(f"Added ${pictures.rendered} illustration(s), costing $$${pictures.costUsd}%.2f as reported by OpenRouter") *>
      (pictures.failures.headOption match {
        case Some(reason) =>
          log(s"${pictures.failures.size} illustration(s) were left out (${clip(reason, 200)})")
        case None => ZIO.unit
      })

  private def logDiagrams(diagrams: bookwriter.RenderedDiagrams): UIO[Unit] =
    log(s"Rendered ${diagrams.rendered} diagram(s)") *>
      (diagrams.failures.headOption match {
        case Some(reason) =>
          log(s"${diagrams.failures.size} diagram(s) stayed as source text (${clip(reason, 80)})")
        case None => ZIO.unit
      })

  private def fail(e: Throwable): UIO[Unit] =
    stateRef.get.flatMap { v =>
      setPhase(BookPhase.Failed(e.getMessage, v.phase.status)) *> log(s"Failed: ${clip(e.getMessage, 160)}")
    }

  // ---- helpers ---------------------------------------------------------------

  /** The book idea can change during outline review, so it lives in the session state. */
  private def withIdea(v: SessionView): Config = cfg.copy(prompt = v.idea)

  private def currentCfg: UIO[Config] = stateRef.get.map(withIdea)

  private def setPhase(phase: BookPhase): UIO[Unit] =
    stateRef.update(_.copy(phase = phase)) *> persist

  /** Checkpoints the session to disk (output/books/<id>/session.json) so the book
    * list, chapters and review gates survive server restarts. */
  def persist: UIO[Unit] =
    refsRef.get.zip(memoryRef.get).flatMap { case (refs, memory) =>
      stateRef.get.flatMap { v =>
        SessionStore.save(SessionStore.snapshot(id, withIdea(v), v.phase, v.events, startedAt, refs, memory))
      }
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
}
