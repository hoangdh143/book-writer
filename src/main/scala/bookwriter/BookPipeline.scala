package bookwriter

import zio.{UIO, ZIO}
import java.time.Duration
import loki.engine.app.GraphApp
import loki.engine.core.store.GraphStore
import loki.engine.core.nodes.{AgentNode, EventType}
import loki.engine.core.executor.{ExecutionContext, TraceEvent}

object BookPipeline {

  def run(cfg: Config): ZIO[Any, Throwable, Unit] =
    for {
      started <- ZIO.succeed(System.nanoTime())
      store   <- GraphStore.make
      outlineSink = new OutlineSink
      editorSink  = new EditorSink
      graph   <- BookGraph.build(store, cfg, outlineSink, editorSink)
      (app, architect, writer, editor, scholar, _) = graph
      _       <- ZIO.succeed(app.getExecutor.addEventHook(progressHook()))
      outline <- Stages.plan(app, architect, outlineSink, cfg)
      _       <- reportPlan(outline, cfg)
      result  <- scholar match {
        case Some(sg) if cfg.scholar => scholarRun(app, writer, sg, cfg, outline, started)
        case _                       => bookRun(app, writer, editor, editorSink, cfg, outline, started)
      }
    } yield result

  /** The classic 4-stage book pipeline. */
  private def bookRun(
    app: GraphApp,
    writer: AgentNode,
    editor: AgentNode,
    editorSink: EditorSink,
    cfg: Config,
    outline: BookOutline,
    started: Long
  ): ZIO[Any, Throwable, Unit] =
    for {
      _       <- banner("Stage 2/4 - Writing chapters (ChapterWriter)")
      chapters <-
        if (cfg.concurrency <= 1) writeSequential(app, writer, cfg, outline)
        else writeParallel(app, writer, cfg, outline)
      (foreword, blurb) <-
        if (cfg.skipEditor) ZIO.succeed(("", ""))
        else for {
          _  <- banner("Stage 3/4 - Editing (BookEditor)")
          fb <- editStage(app, editor, editorSink, outline, chapters, cfg)
        } yield fb
      _       <- banner("Stage 4/4 - Assembling the book")
      elapsed  = Duration.ofNanos(System.nanoTime() - started)
      md      <- renderedDiagrams(Assembler.markdown(outline, chapters, foreword, blurb, cfg, elapsed), cfg)
      paths    = Assembler.save(cfg, md, outline, chapters)
      _       <- ZIO.succeed(report(outline, chapters, paths))
    } yield ()

  private def renderedDiagrams(markdown: String, cfg: Config): UIO[String] =
    Diagrams.renderBook(markdown, cfg.diagrams).map { result =>
      if (cfg.diagrams) println(s"  Diagrams: ${result.rendered} rendered, ${result.failures.size} left as source")
      result.failures.foreach(reason => println(s"  ! diagram not rendered: $reason"))
      result.markdown
    }

  /** Scholar mode: bibliography, section writing with per-section fact cross-checking
    * (auto-repair of flagged claims), peer review with one revision round, then
    * assembly with references and a scholar report. */
  private def scholarRun(
    app: GraphApp,
    writer: AgentNode,
    sg: ScholarGraph,
    cfg: Config,
    outline: BookOutline,
    started: Long
  ): ZIO[Any, Throwable, Unit] = {
    val total = outline.chapters.size

    def writeAndCheck(idx: Int, prevEnding: Option[String]): ZIO[Any, Throwable, (WrittenChapter, List[Finding])] =
      for {
        draft <- Stages.writeChapter(app, writer, cfg, outline, idx, prevEnding, Nil, None, sg.refSink.references)
        wc     = WrittenChapter(outline.chapters(idx), draft.text)
        _     <- ZIO.succeed(println(s"    [fact-check] section ${wc.plan.number}: ${wc.plan.title}"))
        finalWcAndFindings <- checkAndRepair(app, writer, sg, cfg, outline, wc, sg.refSink.references)
      } yield finalWcAndFindings

    for {
      _    <- banner("Stage 2/5 - Compiling the bibliography (Bibliographer)")
      refs <- Stages.bibliography(app, sg.bibliographer, sg.refSink, outline, cfg)
      _    <- ZIO.succeed {
        println(s"  ${refs.size} references recorded:")
        refs.foreach(r => println(s"    [${r.number}] ${r.authors} (${r.year}). ${r.title}"))
      }
      _    <- banner(s"Stage 3/5 - Writing $total sections with fact cross-checking (SectionWriter + FactChecker)")
      written <- ZIO.foldLeft(List.range(0, total))(List.empty[(WrittenChapter, List[Finding])]) { (acc, idx) =>
        val plan = outline.chapters(idx)
        println(s"  - Section ${plan.number}: ${plan.title}")
        writeAndCheck(idx, acc.lastOption.map(_._1.endingExcerpt())).map(acc :+ _)
      }
      chapters = written.map(_._1)
      findings = written.flatMap(_._2)
      _    <- banner("Stage 4/5 - Peer review (PeerReviewer)")
      review0 <- Stages.peerReview(app, sg.reviewer, sg.reviewSink, outline, chapters, refs)
      _    <- ZIO.succeed(review0.foreach(r =>
        println(s"  Verdict: ${r.verdict} (score ${r.score}/10, ${r.issues.size} issue(s))")))
      (finalChapters, finalReview) <- review0.filter(_.needsRevision) match {
        case Some(report) => reviseAfterReview(app, writer, sg, cfg, outline, chapters, refs, report)
        case None         => ZIO.succeed((chapters, review0))
      }
      _    <- banner("Stage 5/5 - Assembling the paper")
      elapsed = Duration.ofNanos(System.nanoTime() - started)
      md     <- renderedDiagrams(Assembler.scholarMarkdown(outline, finalChapters, refs, findings, finalReview, cfg, elapsed), cfg)
      paths  <- ZIO.attempt(Assembler.save(cfg, md, outline, finalChapters, refs, findings, finalReview))
      _      <- ZIO.succeed(report(outline, finalChapters, paths))
    } yield ()
  }

  /** Fact-checks a section; when major problems are found, repairs it once with the
    * findings and re-checks the repaired text. Returns the final text + final findings. */
  private def checkAndRepair(
    app: GraphApp,
    writer: AgentNode,
    sg: ScholarGraph,
    cfg: Config,
    outline: BookOutline,
    wc: WrittenChapter,
    refs: List[Reference]
  ): ZIO[Any, Throwable, (WrittenChapter, List[Finding])] =
    Stages.factCheck(app, sg.factChecker, sg.factSink, outline, wc, refs).flatMap { findings =>
      val problems = findings.filter(f => f.isMajor || f.verdict == "contradicted" || f.verdict == "unsupported")
      if (problems.isEmpty) ZIO.succeed((wc, findings))
      else
        Briefs.factCheckRevision(findings) match {
          case None => ZIO.succeed((wc, findings))
          case Some(revision) =>
            ZIO.succeed(println(s"    [fact-check] ${problems.size} problem(s); revising section ${wc.plan.number}")) *>
              Stages.writeChapter(app, writer, cfg, outline, wc.plan.number - 1, None, Nil, Some(revision), refs)
                .flatMap { draft =>
                  val repaired = WrittenChapter(wc.plan, draft.text)
                  Stages.factCheck(app, sg.factChecker, sg.factSink, outline, repaired, refs)
                    .map(fs => (repaired, fs))
                }
        }
    }

  /** One revision round: rewrites every section the reviewer flagged with major issues,
    * then re-reviews. The verdict is not re-litigated a second time. */
  private def reviseAfterReview(
    app: GraphApp,
    writer: AgentNode,
    sg: ScholarGraph,
    cfg: Config,
    outline: BookOutline,
    chapters: List[WrittenChapter],
    refs: List[Reference],
    report: ReviewReport
  ): ZIO[Any, Throwable, (List[WrittenChapter], Option[ReviewReport])] = {
    val flagged = report.majorIssues.map(_.section).filter(n => n >= 1 && n <= chapters.size).distinct
    if (flagged.isEmpty) ZIO.succeed((chapters, Some(report)))
    else
      ZIO.succeed(println(s"  Revising ${flagged.size} flagged section(s): ${flagged.mkString(", ")}")) *>
        ZIO.foldLeft(flagged)(chapters) { (acc, n) =>
          val idx = n - 1
          val wc = acc(idx)
          val issues = report.issues.filter(i => i.section == n && i.severity.equalsIgnoreCase("major"))
          Briefs.reviewRevision(issues) match {
            case None         => ZIO.succeed(acc)
            case Some(revision) =>
              Stages.writeChapter(app, writer, cfg, outline, idx, None, Nil, Some(revision), refs)
                .map(draft => acc.updated(idx, WrittenChapter(wc.plan, draft.text)))
          }
        }
        .flatMap { revised =>
          ZIO.succeed(println("  Re-reviewing the revised paper")) *>
            Stages.peerReview(app, sg.reviewer, sg.reviewSink, outline, revised, refs).map(r => (revised, r.orElse(Some(report))))
        }
  }

  private def banner(text: String): UIO[Unit] = ZIO.succeed {
    println()
    println("=" * 70)
    println(text)
    println("=" * 70)
  }

  private def progressHook(): (TraceEvent, ExecutionContext) => Any = (e, _) =>
    e.eventType match {
      case EventType.AgentStart => println(s"    [start] ${e.nodeName}")
      case EventType.AgentEnd =>
        val secs = e.durationMs.map(ms => f"${ms / 1000.0}%.1fs").getOrElse("")
        println(s"    [done]  ${e.nodeName} $secs")
      case EventType.ToolCall if e.nodeName.startsWith("record_") =>
        val input = e.payload.get("input").map(_.toString).getOrElse("")
        println(s"    [tool]  ${e.nodeName} ${input.take(100)}")
      case EventType.Retry =>
        println(s"    [retry] ${e.payload.getOrElse("reason", "")}")
      case _ => ()
    }

  private def reportPlan(outline: BookOutline, cfg: Config): UIO[Unit] = ZIO.succeed {
    val noun = if (cfg.scholar) "sections" else "chapters"
    println(s"\n  Title  : ${outline.title}")
    println(s"  Genre  : ${outline.genre}")
    if (outline.chapters.size != cfg.chapters)
      println(s"  ! note: the architect planned ${outline.chapters.size} $noun (requested ${cfg.chapters})")
    println("  Plan:")
    outline.chapters.foreach { c =>
      val dots = if (c.synopsis.length > 100) "..." else ""
      println(s"    ${c.number}. ${c.title} - ${c.synopsis.take(100)}$dots")
    }
  }

  private def report(outline: BookOutline, chapters: List[WrittenChapter], paths: List[java.nio.file.Path]): Unit = {
    val totalWords = chapters.map(_.wordCount).sum
    chapters.foreach(c => println(s"  Chapter ${c.plan.number}: ${c.plan.title} (${c.wordCount} words)"))
    println(s"\nDone: '${outline.title}' - ${totalWords} words in ${chapters.size} chapters.")
    println("Files written:")
    paths.foreach(p => println(s"  $p"))
  }

  private def writeSequential(
    app: GraphApp,
    writer: AgentNode,
    cfg: Config,
    outline: BookOutline
  ): ZIO[Any, Throwable, List[WrittenChapter]] = {
    val executor = app.getExecutor

    def produce(idx: Int, prevEnding: Option[String]): ZIO[Any, Throwable, ChapterDraft] =
      Stages.writeChapter(app, writer, cfg, outline, idx, prevEnding)

    ZIO.foldLeft(List.range(0, outline.chapters.size))(List.empty[WrittenChapter]) { (acc, idx) =>
      val plan = outline.chapters(idx)
      println(s"  - Chapter ${plan.number}: ${plan.title}")
      produce(idx, acc.lastOption.map(_.endingExcerpt())).flatMap { draft =>
        for {
          materialised <- executor.materialiseOutput(writer, draft.text, draft.context)
          _            <- app.connectContext(writer, materialised, weight = Some(0.95))
        } yield acc :+ WrittenChapter(plan, draft.text)
      }
    }
  }

  /** Chapters written concurrently with native ZIO parallelism; each chapter may itself
    * consist of several consecutive segments, so chapter length is unlimited. */
  private def writeParallel(
    app: GraphApp,
    writer: AgentNode,
    cfg: Config,
    outline: BookOutline
  ): ZIO[Any, Throwable, List[WrittenChapter]] =
    ZIO
      .foreachPar(outline.chapters) { plan =>
        ZIO.succeed(println(s"  - Chapter ${plan.number}: ${plan.title}")) *>
          Stages.writeChapter(app, writer, cfg, outline, plan.number - 1, None)
            .map(draft => WrittenChapter(plan, draft.text))
      }
      .withParallelism(cfg.concurrency)

  private def editStage(
    app: GraphApp,
    editor: AgentNode,
    editorSink: EditorSink,
    outline: BookOutline,
    chapters: List[WrittenChapter],
    cfg: Config
  ): ZIO[Any, Throwable, (String, String)] =
    Stages.edit(app, editor, editorSink, outline, chapters, cfg).catchAll { e =>
      ZIO.succeed {
        println(s"  ! editor stage failed (${e.getMessage}); continuing without front matter")
        ("", "")
      }
    }
}
