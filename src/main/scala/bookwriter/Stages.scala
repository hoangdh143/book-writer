package bookwriter

import zio.{UIO, ZIO}
import loki.engine.app.GraphApp
import loki.engine.core.executor.ExecutionContext
import loki.engine.core.nodes.AgentNode

final case class ChapterDraft(text: String, context: ExecutionContext)

object Stages {

  def plan(
    app: GraphApp,
    architect: AgentNode,
    sink: OutlineSink,
    cfg: Config,
    feedback: Option[String] = None
  ): ZIO[Any, Throwable, BookOutline] = {
    def attempt(query: String): ZIO[Any, Throwable, Option[BookOutline]] =
      ZIO.succeed(sink.reset()) *> app.run(architect.nodeId, query).map(_ => sink.outline())

    val brief = cfg.prompt + feedback.fold("")(f =>
      s"\n\nAUTHOR FEEDBACK — the author reviewed the previous outline and asked for this change:\n\"\"\"\n$f\n\"\"\""
    )

    ZIO.succeed(println("[trace] Stages.plan start")) *>
      attempt(brief).flatMap {
        case Some(o) if o.chapters.size >= 2 => ZIO.succeed { println("[trace] Stages.plan accepted first attempt"); normalize(o) }
        case _ =>
          ZIO.succeed(println("[trace] Stages.plan first attempt failed/incomplete; retrying")) *>
            attempt(brief + Prompts.architectRetryNote).flatMap {
              case Some(o) if o.chapters.size >= 2 => ZIO.succeed(normalize(o))
              case _                               => ZIO.fail(outlineFailure)
            }
      }
  }

  def normalize(o: BookOutline): BookOutline = {
    val chapters = o.chapters.sortBy(_.number).zipWithIndex.map { case (c, i) => c.copy(number = i + 1) }
    o.copy(title = if (o.title.isEmpty) "Untitled Book" else o.title, chapters = chapters)
  }

  def writeChapter(
    app: GraphApp,
    writer: AgentNode,
    cfg: Config,
    outline: BookOutline,
    idx: Int,
    prevEnding: Option[String],
    notes: List[String] = Nil,
    revision: Option[String] = None,
    refs: List[Reference] = Nil,
    memory: String = "",
    draft: Option[String] = None
  ): ZIO[Any, Throwable, ChapterDraft] = {
    val plan = outline.chapters(idx)
    val totalParts = Config.segmentCount(cfg.wordsPerChapter)

    def attempt(brief: String): ZIO[Any, Throwable, ChapterDraft] =
      app.run(writer.nodeId, brief).flatMap { ctx =>
        val text = ctx.outputs.get(writer.nodeId).map(responseText).getOrElse("")
        if (text.trim.isEmpty) ZIO.fail(new RuntimeException("empty chapter text"))
        else ZIO.succeed(ChapterDraft(text, ctx))
      }

    def withRetries(brief: String, left: Int): ZIO[Any, Throwable, ChapterDraft] =
      attempt(brief).catchAll { e =>
        if (left > 0) withRetries(brief, left - 1)
        else ZIO.fail(new RuntimeException(s"Chapter ${plan.number} '${plan.title}' failed: ${e.getMessage}", e))
      }

    if (totalParts <= 1)
      withRetries(Briefs.chapter(outline, idx, prevEnding, cfg, notes, revision, refs, memory, draft), 2)
    else
      withRetries(
        Briefs.chapterOpening(outline, idx, prevEnding, cfg, notes, revision, totalParts, refs, memory, draft), 2
      ).flatMap { opening =>
        ZIO.foldLeft((2 to totalParts).toList)(opening) { (soFar, part) =>
          val brief = Briefs.chapterContinuation(outline, idx, soFar.text, part, totalParts, cfg, notes, refs, memory, revision, draft)
          withRetries(brief, 2).map(next => ChapterDraft(s"${soFar.text}\n\n${next.text}", next.context))
        }
      }
  }

  def edit(
    app: GraphApp,
    editor: AgentNode,
    sink: EditorSink,
    outline: BookOutline,
    chapters: List[WrittenChapter],
    cfg: Config
  ): ZIO[Any, Throwable, (String, String)] = {
    def attempt(): ZIO[Any, Throwable, (String, String)] =
      ZIO.succeed(sink.reset()) *> app.run(editor.nodeId, Briefs.editorInput(outline, chapters, cfg)).map(_ => sink.get)

    attempt().flatMap {
      case (fw, bl) if fw.nonEmpty && bl.nonEmpty => ZIO.succeed((fw, bl))
      case _                                      => attempt()
    }
  }

  // ---- continuity stages ------------------------------------------------------

  /** Writes the shared guide from the approved outline, before any chapter exists. */
  def storyBible(
    app: GraphApp,
    continuity: ContinuityGraph,
    outline: BookOutline,
    cfg: Config,
    notes: List[String]
  ): ZIO[Any, Throwable, String] = {
    def attempt(): ZIO[Any, Throwable, String] =
      ZIO.succeed(continuity.bibleSink.reset()) *>
        app.run(continuity.bibleWriter.nodeId, Briefs.bibleInput(outline, cfg, notes)).map(_ => continuity.bibleSink.text)

    attempt().flatMap(text => if (text.nonEmpty) ZIO.succeed(text) else attempt())
      .filterOrFail(_.nonEmpty)(new RuntimeException("the model recorded no guide"))
  }

  /** Reads a group of chapters into ledger entries and, when `check` is set, contradictions.
    * Oversized groups are read in slices. This never fails: the caller keeps the drafts. */
  def continuityPass(
    app: GraphApp,
    continuity: ContinuityGraph,
    outline: BookOutline,
    memory: ContinuityMemory,
    done: List[WrittenChapter],
    group: List[WrittenChapter],
    check: Boolean,
    scholar: Boolean
  ): UIO[ContinuityReport] = {
    def read(slice: List[WrittenChapter], guide: String, before: Option[WrittenChapter]): ZIO[Any, Throwable, ContinuityReport] = {
      val numbers = slice.map(_.plan.number).toSet
      val input = Briefs.continuityInput(outline, guide, before, slice, check)
      ZIO.succeed(continuity.sink.reset()) *> app.run(continuity.editor.nodeId, input).map { _ =>
        ContinuityReport(
          entries = continuity.sink.ledger.filter(e => numbers(e.chapter)),
          issues = if (check) continuity.sink.issues.filter(i => numbers(i.chapter)) else Nil
        )
      }
    }

    def readWithRetry(slice: List[WrittenChapter], guide: String, before: Option[WrittenChapter]): UIO[ContinuityReport] =
      read(slice, guide, before)
        .flatMap(report => if (report.entries.nonEmpty) ZIO.succeed(report) else read(slice, guide, before))
        .catchAll(e => ZIO.succeed(ContinuityReport(failure = Some(String.valueOf(e.getMessage)))))
        .map(report => if (report.entries.isEmpty && report.failure.isEmpty) report.copy(failure = Some("the model recorded nothing")) else report)

    ZIO.foldLeft(continuitySlices(group))((done, memory, ContinuityReport())) { case ((seen, known, total), slice) =>
      readWithRetry(slice, known.forWriter(seen, scholar), seen.lastOption).map { report =>
        val merged = ContinuityReport(total.entries ++ report.entries, total.issues ++ report.issues, total.failure.orElse(report.failure))
        (seen ++ slice, known.withEntries(report.entries), merged)
      }
    }.map(_._3)
  }

  private val maxContinuityWords = 30000

  private def continuitySlices(group: List[WrittenChapter]): List[List[WrittenChapter]] =
    group.foldLeft(List.empty[List[WrittenChapter]]) { (slices, wc) =>
      slices match {
        case head :: tail if head.map(_.wordCount).sum + wc.wordCount <= maxContinuityWords => (head :+ wc) :: tail
        case _                                                                               => List(wc) :: slices
      }
    }.reverse

  // ---- scholar stages ---------------------------------------------------------

  /** Stage S1: the Bibliographer compiles the paper's reference list. */
  def bibliography(
    app: GraphApp,
    bibliographer: AgentNode,
    sink: ReferenceSink,
    outline: BookOutline,
    cfg: Config
  ): ZIO[Any, Throwable, List[Reference]] = {
    def attempt(): ZIO[Any, Throwable, List[Reference]] =
      ZIO.succeed(sink.reset()) *> app.run(bibliographer.nodeId, Briefs.bibliographerInput(outline, cfg)).map(_ => sink.references)

    attempt().flatMap {
      case refs if refs.nonEmpty => ZIO.succeed(refs)
      case _                     => attempt()
    }.filterOrElse(_.nonEmpty)(ZIO.fail(new RuntimeException(
      "Bibliographer recorded no references after 2 attempts. Check that the model supports tool calling."
    )))
  }

  /** Stage S2: the FactChecker cross-checks one section's claims against the references. */
  def factCheck(
    app: GraphApp,
    checker: AgentNode,
    sink: FactCheckSink,
    outline: BookOutline,
    wc: WrittenChapter,
    refs: List[Reference]
  ): ZIO[Any, Throwable, List[Finding]] = {
    def attempt(): ZIO[Any, Throwable, List[Finding]] =
      ZIO.succeed(sink.reset()) *> app.run(checker.nodeId, Briefs.factCheckInput(outline, wc, refs)).map(_ => sink.findings)

    attempt().flatMap {
      case fs if fs.nonEmpty => ZIO.succeed(fs)
      case _                 => attempt()
    }.catchAll(_ => ZIO.succeed(Nil))
  }

  /** Stage S3: the PeerReviewer reviews the finished paper. */
  def peerReview(
    app: GraphApp,
    reviewer: AgentNode,
    sink: ReviewSink,
    outline: BookOutline,
    chapters: List[WrittenChapter],
    refs: List[Reference]
  ): ZIO[Any, Throwable, Option[ReviewReport]] = {
    def attempt(): ZIO[Any, Throwable, Option[ReviewReport]] =
      ZIO.succeed(sink.reset()) *> app.run(reviewer.nodeId, Briefs.reviewerInput(outline, chapters, refs)).map(_ => sink.get)

    attempt().flatMap {
      case Some(report) => ZIO.succeed(Some(report))
      case None         => attempt()
    }.catchAll(_ => ZIO.succeed(None))
  }

  def responseText(output: Any): String = {
    val v = output match {
      case Some(x) => x
      case other   => other
    }
    v match {
      case m: Map[_, _] => m.asInstanceOf[Map[String, Any]].get("text").map(_.toString).getOrElse("")
      case s: String    => s
      case _            => ""
    }
  }

  private def outlineFailure: Throwable =
    new RuntimeException(
      "BookArchitect failed to record a valid outline after 2 attempts. " +
      "Check that the model supports tool calling and the API key/endpoint are correct."
    )
}
