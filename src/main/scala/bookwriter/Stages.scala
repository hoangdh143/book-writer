package bookwriter

import zio.ZIO
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
    revision: Option[String] = None
  ): ZIO[Any, Throwable, ChapterDraft] = {
    val brief = Briefs.chapter(outline, idx, prevEnding, cfg, notes, revision)

    def once(): ZIO[Any, Throwable, ChapterDraft] =
      app.run(writer.nodeId, brief).flatMap { ctx =>
        val text = ctx.outputs.get(writer.nodeId).map(responseText).getOrElse("")
        if (text.trim.isEmpty) ZIO.fail(new RuntimeException("empty chapter text"))
        else ZIO.succeed(ChapterDraft(text, ctx))
      }

    def withRetries(left: Int): ZIO[Any, Throwable, ChapterDraft] =
      once().catchAll { e =>
        if (left > 0) withRetries(left - 1)
        else ZIO.fail(new RuntimeException(s"Chapter ${outline.chapters(idx).number} '${outline.chapters(idx).title}' failed: ${e.getMessage}", e))
      }

    withRetries(2)
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
