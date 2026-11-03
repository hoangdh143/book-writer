package bookwriter

import zio.UIO
import loki.engine.app.{GraphApp, createAgent, createTool, createContext}
import loki.engine.backend.OpenAIBackend
import loki.engine.core.nodes.{AgentNode, ExecutionPolicy, RetryPolicy}
import loki.engine.core.store.GraphStore

object BookGraph {

  val RefMeta = "bookwriter.tools.record_book_meta"
  val RefChapter = "bookwriter.tools.record_chapter"
  val RefBlurb = "bookwriter.tools.record_blurb"
  val RefForeword = "bookwriter.tools.record_foreword"

  private val apiPolicy = ExecutionPolicy(
    retryPolicy = RetryPolicy(maxAttempts = 4, backoffSeconds = 2.0, backoffMultiplier = 2.0)
  )

  def build(
    store: GraphStore,
    cfg: Config,
    outlineSink: OutlineSink,
    editorSink: EditorSink
  ): UIO[(GraphApp, AgentNode, AgentNode, AgentNode)] = {
    val backend = new OpenAIBackend(
      baseUrl = cfg.baseUrl,
      apiKey = cfg.apiKey,
      temperature = Some(cfg.temperature)
    )
    val app = new GraphApp(store, backend = Some(backend))

    app.registerTool(RefMeta, (input: Any) => outlineSink.bookMeta(input))
    app.registerTool(RefChapter, (input: Any) => outlineSink.chapter(input))
    app.registerTool(RefForeword, (input: Any) => editorSink.recordForeword(input))
    app.registerTool(RefBlurb, (input: Any) => editorSink.recordBlurb(input))

    val architect = createAgent(
      name = "BookArchitect",
      description = "Designs the book: title, genre, premise and the full chapter-by-chapter outline",
      model = cfg.model,
      systemPrompt = Prompts.architect(cfg),
      maxIterations = 16,
      maxTokens = 4096
    ).copy(executionPolicy = apiPolicy)

    val writer = createAgent(
      name = "ChapterWriter",
      description = "Writes one full chapter of the book",
      model = cfg.model,
      systemPrompt = Prompts.chapterWriter(cfg),
      maxIterations = 6,
      maxTokens = 8096
    ).copy(executionPolicy = apiPolicy)

    val editor = createAgent(
      name = "BookEditor",
      description = "Writes the back-cover blurb and the foreword for the finished manuscript",
      model = cfg.model,
      systemPrompt = Prompts.editor(cfg),
      maxIterations = 8,
      maxTokens = 2048
    ).copy(executionPolicy = apiPolicy)

    val metaTool = createTool(
      name = "record_book_meta",
      callableRef = RefMeta,
      description = "Record the book's title, genre and premise. Call exactly once.",
      inputSchema = Map(
        "type" -> "object",
        "properties" -> Map(
          "title"   -> Map("type" -> "string", "description" -> "Book title"),
          "genre"   -> Map("type" -> "string", "description" -> "Genre or category"),
          "premise" -> Map("type" -> "string", "description" -> "3-5 sentence synopsis of the whole book")
        ),
        "required" -> List("title", "genre", "premise")
      )
    )

    val chapterTool = createTool(
      name = "record_chapter",
      callableRef = RefChapter,
      description = "Record one chapter of the outline. Call once per chapter, in reading order.",
      inputSchema = Map(
        "type" -> "object",
        "properties" -> Map(
          "number"   -> Map("type" -> "integer", "description" -> "Chapter number, 1-based"),
          "title"    -> Map("type" -> "string", "description" -> "Chapter title"),
          "synopsis" -> Map("type" -> "string", "description" -> "3-6 sentence chapter synopsis")
        ),
        "required" -> List("number", "title", "synopsis")
      )
    )

    val blurbTool = createTool(
      name = "record_blurb",
      callableRef = RefBlurb,
      description = "Record the back-cover blurb. Call exactly once.",
      inputSchema = Map(
        "type" -> "object",
        "properties" -> Map(
          "text" -> Map("type" -> "string", "description" -> "The blurb text")
        ),
        "required" -> List("text")
      )
    )

    val forewordTool = createTool(
      name = "record_foreword",
      callableRef = RefForeword,
      description = "Record the foreword. Call exactly once.",
      inputSchema = Map(
        "type" -> "object",
        "properties" -> Map(
          "text" -> Map("type" -> "string", "description" -> "The foreword text, markdown, no heading")
        ),
        "required" -> List("text")
      )
    )

    val styleGuide = createContext(
      name = "Craft guidelines",
      content = Prompts.styleGuide,
      description = "Prose quality rules shared by writers and the editor"
    )

    for {
      _          <- app.addAgent("BookArchitect", architect)
      _          <- app.addAgent("ChapterWriter", writer)
      _          <- app.addAgent("BookEditor", editor)
      _          <- app.addTool("record_book_meta", metaTool)
      _          <- app.addTool("record_chapter", chapterTool)
      _          <- app.addTool("record_blurb", blurbTool)
      _          <- app.addTool("record_foreword", forewordTool)
      _          <- app.addContext("craft-guidelines", styleGuide)
      _          <- app.connectTool(architect, metaTool)
      _          <- app.connectTool(architect, chapterTool)
      _          <- app.connectTool(editor, blurbTool)
      _          <- app.connectTool(editor, forewordTool)
      _          <- app.connectContext(writer, styleGuide, weight = Some(0.9))
      _          <- app.connectContext(editor, styleGuide, weight = Some(0.6))
      _          <- app.delegate(architect, writer)
      _          <- app.delegate(writer, editor)
    } yield (app, architect, writer, editor)
  }
}
