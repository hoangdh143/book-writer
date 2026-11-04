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
      (app, architect, writer, editor) = graph
      _       <- ZIO.succeed(app.getExecutor.addEventHook(progressHook()))
      _       <- banner("Stage 1/4 - Planning the book (BookArchitect)")
      outline <- Stages.plan(app, architect, outlineSink, cfg)
      _       <- reportPlan(outline, cfg)
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
      paths    = Assembler.save(cfg, Assembler.markdown(outline, chapters, foreword, blurb, cfg, elapsed), outline, chapters)
      _       <- ZIO.succeed(report(outline, chapters, paths))
    } yield ()

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
    println(s"\n  Title  : ${outline.title}")
    println(s"  Genre  : ${outline.genre}")
    if (outline.chapters.size != cfg.chapters)
      println(s"  ! note: the architect planned ${outline.chapters.size} chapters (requested ${cfg.chapters})")
    println("  Plan:")
    outline.chapters.foreach { c =>
      val dots = if (c.synopsis.length > 100) "..." else ""
      println(s"    ${c.number}. ${c.title} - ${c.synopsis.take(100)}$dots")
    }
  }

  private def report(outline: BookOutline, chapters: List[WrittenChapter], paths: List[java.nio.file.Path]): Unit = {
    val totalWords = chapters.map(_.wordCount).sum
    chapters.foreach(c => println(s"  Chapter ${c.plan.number}: ${c.plan.title} (${c.wordCount} words)"))
    println(s"\nBook complete: '${outline.title}' - ${totalWords} words in ${chapters.size} chapters.")
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
