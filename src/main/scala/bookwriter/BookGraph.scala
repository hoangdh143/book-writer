package bookwriter

import zio.{UIO, ZIO}
import loki.engine.app.{GraphApp, createAgent, createTool, createContext}
import loki.engine.backend.{LLMBackend, OpenAIBackend}
import loki.engine.core.nodes.{AgentNode, ExecutionPolicy, RetryPolicy}
import loki.engine.core.store.GraphStore

/** The extra scholar-mode agents plus their tool-call sinks, present only when
  * the run was started with scholar mode enabled. */
final case class ScholarGraph(
  bibliographer: AgentNode,
  factChecker: AgentNode,
  reviewer: AgentNode,
  refSink: ReferenceSink,
  factSink: FactCheckSink,
  reviewSink: ReviewSink
)

object BookGraph {

  val RefMeta = "bookwriter.tools.record_book_meta"
  val RefChapter = "bookwriter.tools.record_chapter"
  val RefBlurb = "bookwriter.tools.record_blurb"
  val RefForeword = "bookwriter.tools.record_foreword"
  val RefReference = "bookwriter.tools.record_reference"
  val RefFinding = "bookwriter.tools.record_finding"
  val RefReview = "bookwriter.tools.record_review"
  val RefBible = "bookwriter.tools.record_story_bible"
  val RefFacts = "bookwriter.tools.record_chapter_facts"
  val RefIssue = "bookwriter.tools.record_issue"

  private val apiPolicy = ExecutionPolicy(
    retryPolicy = RetryPolicy(maxAttempts = 4, backoffSeconds = 2.0, backoffMultiplier = 2.0)
  )

  def build(
    store: GraphStore,
    cfg: Config,
    outlineSink: OutlineSink,
    editorSink: EditorSink,
    llmGate: Option[LlmGate] = None
  ): UIO[(GraphApp, AgentNode, AgentNode, AgentNode, Option[ScholarGraph], ContinuityGraph)] = {
    val openAi = new OpenAIBackend(
      baseUrl = cfg.baseUrl,
      apiKey = cfg.apiKey,
      temperature = Some(cfg.temperature)
    )
    val backend: LLMBackend = llmGate.fold[LLMBackend](openAi)(new LimitedBackend(openAi, _))
    val app = new GraphApp(store, backend = Some(backend))

    app.registerTool(RefMeta, (input: Any) => outlineSink.bookMeta(input))
    app.registerTool(RefChapter, (input: Any) => outlineSink.chapter(input))
    app.registerTool(RefForeword, (input: Any) => editorSink.recordForeword(input))
    app.registerTool(RefBlurb, (input: Any) => editorSink.recordBlurb(input))

    val bibleSink = new BibleSink
    val continuitySink = new ContinuitySink
    app.registerTool(RefBible, (input: Any) => bibleSink.record(input))
    app.registerTool(RefFacts, (input: Any) => continuitySink.recordFacts(input))
    app.registerTool(RefIssue, (input: Any) => continuitySink.recordIssue(input))

    val architect = createAgent(
      name = if (cfg.scholar) "ResearchArchitect" else "BookArchitect",
      description =
        if (cfg.scholar) "Designs the research paper: title, field, abstract and the full section-by-section outline"
        else "Designs the book: title, genre, premise and the full chapter-by-chapter outline",
      model = cfg.model,
      systemPrompt = Prompts.architectPrompt(cfg),
      maxIterations = 16,
      maxTokens = 4096
    ).copy(executionPolicy = apiPolicy)

    val writer = createAgent(
      name = if (cfg.scholar) "SectionWriter" else "ChapterWriter",
      description =
        if (cfg.scholar) "Writes one section of the paper with inline citations from the reference list"
        else "Writes one full chapter of the book",
      model = cfg.model,
      systemPrompt = Prompts.writerPrompt(cfg),
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

    val bibleWriter = createAgent(
      name = "StoryBibleWriter",
      description = "Decides the shared details every writer must follow before any chapter is written",
      model = cfg.model,
      systemPrompt = Prompts.storyBibleWriter(cfg),
      maxIterations = 6,
      maxTokens = 4096
    ).copy(executionPolicy = apiPolicy)

    val continuityEditor = createAgent(
      name = "ContinuityEditor",
      description = "Records what finished chapters established and reports contradictions between them",
      model = cfg.model,
      systemPrompt = Prompts.continuityEditor(cfg),
      maxIterations = 32,
      maxTokens = 4096
    ).copy(executionPolicy = apiPolicy)

    val bibleTool = createTool(
      name = "record_story_bible",
      callableRef = RefBible,
      description = "Record the shared guide. Call exactly once.",
      inputSchema = Map(
        "type" -> "object",
        "properties" -> Map(
          "text" -> Map("type" -> "string", "description" -> "The whole guide, as markdown")
        ),
        "required" -> List("text")
      )
    )

    val factsTool = createTool(
      name = "record_chapter_facts",
      callableRef = RefFacts,
      description = "Record what one chapter established. Call once per chapter.",
      inputSchema = Map(
        "type" -> "object",
        "properties" -> Map(
          "chapter" -> Map("type" -> "integer", "description" -> "Chapter number"),
          "summary" -> Map("type" -> "string", "description" -> "2-3 sentences, including how the chapter ends"),
          "facts" -> Map(
            "type" -> "string",
            "description" -> "Up to 10 short, specific statements later chapters must respect, one per line"
          )
        ),
        "required" -> List("chapter", "summary", "facts")
      )
    )

    val issueTool = createTool(
      name = "record_issue",
      callableRef = RefIssue,
      description = "Record one contradiction a reader would notice. Call once per contradiction.",
      inputSchema = Map(
        "type" -> "object",
        "properties" -> Map(
          "chapter" -> Map("type" -> "integer", "description" -> "The chapter that must change"),
          "problem" -> Map("type" -> "string", "description" -> "What conflicts, quoting both sides"),
          "fix" -> Map("type" -> "string", "description" -> "The smallest change that resolves it")
        ),
        "required" -> List("chapter", "problem", "fix")
      )
    )

    val styleGuide = createContext(
      name = "Craft guidelines",
      content = Prompts.styleGuide,
      description = "Prose quality rules shared by writers and the editor"
    )

    // ---- scholar-mode agents (only built when the run is a research paper) ----

    def scholarGraph: UIO[ScholarGraph] = {
      val refSink = new ReferenceSink
      val factSink = new FactCheckSink
      val reviewSink = new ReviewSink
      app.registerTool(RefReference, (input: Any) => refSink.record(input))
      app.registerTool(RefFinding, (input: Any) => factSink.record(input, section = 0))
      app.registerTool(RefReview, (input: Any) => reviewSink.record(input))

      val bibliographer = createAgent(
        name = "Bibliographer",
        description = "Compiles the paper's numbered reference list of real, verifiable sources",
        model = cfg.model,
        systemPrompt = Prompts.bibliographer,
        maxIterations = 30,
        maxTokens = 4096
      ).copy(executionPolicy = apiPolicy)

      val factChecker = createAgent(
        name = "FactChecker",
        description = "Cross-checks a section's factual claims against the paper's references",
        model = cfg.model,
        systemPrompt = Prompts.factChecker,
        maxIterations = 24,
        maxTokens = 4096
      ).copy(executionPolicy = apiPolicy)

      val reviewer = createAgent(
        name = "PeerReviewer",
        description = "Peer-reviews the finished paper: score, verdict and per-section issues",
        model = cfg.model,
        systemPrompt = Prompts.reviewer,
        maxIterations = 8,
        maxTokens = 4096
      ).copy(executionPolicy = apiPolicy)

      val referenceTool = createTool(
        name = "record_reference",
        callableRef = RefReference,
        description = "Record one bibliography entry. Call once per source, in citation order.",
        inputSchema = Map(
          "type" -> "object",
          "properties" -> Map(
            "number"  -> Map("type" -> "integer", "description" -> "Citation number, 1-based, in order"),
            "authors" -> Map("type" -> "string", "description" -> "Real authors, e.g. \"A. Vaswani, N. Shazeer, et al.\""),
            "year"    -> Map("type" -> "string", "description" -> "Publication year, e.g. \"2017\""),
            "title"   -> Map("type" -> "string", "description" -> "Exact title of the work"),
            "venue"   -> Map("type" -> "string", "description" -> "Journal, conference or publisher"),
            "url"     -> Map("type" -> "string", "description" -> "DOI link if confident, otherwise empty")
          ),
          "required" -> List("authors", "year", "title")
        )
      )

      val findingTool = createTool(
        name = "record_finding",
        callableRef = RefFinding,
        description = "Record the cross-check result for one claim of the section. One call per claim.",
        inputSchema = Map(
          "type" -> "object",
          "properties" -> Map(
            "section"   -> Map("type" -> "integer", "description" -> "Section number under review"),
            "claim"     -> Map("type" -> "string", "description" -> "The factual claim being checked"),
            "citations" -> Map("type" -> "string", "description" -> "Reference numbers cited for it, e.g. \"[2]\" or \"[1, 4]\""),
            "verdict"   -> Map("type" -> "string", "description" -> "supported | unsupported | contradicted | unverifiable"),
            "severity"  -> Map("type" -> "string", "description" -> "minor | major"),
            "note"      -> Map("type" -> "string", "description" -> "One sentence: why this verdict, and how to fix it")
          ),
          "required" -> List("claim", "verdict", "severity", "note")
        )
      )

      val reviewTool = createTool(
        name = "record_review",
        callableRef = RefReview,
        description = "Record the peer-review verdict. Call exactly once.",
        inputSchema = Map(
          "type" -> "object",
          "properties" -> Map(
            "score"   -> Map("type" -> "integer", "description" -> "Overall quality, 1-10"),
            "verdict" -> Map("type" -> "string", "description" -> "\"accept\" or \"revise\""),
            "summary" -> Map("type" -> "string", "description" -> "3-6 sentences: strengths, weaknesses, top improvement"),
            "issues" -> Map(
              "type" -> "array",
              "description" -> "Concrete problems, one entry each (may be empty)",
              "items" -> Map(
                "type" -> "object",
                "properties" -> Map(
                  "section" -> Map("type" -> "integer", "description" -> "Section number the issue is in"),
                  "severity" -> Map("type" -> "string", "description" -> "minor | major"),
                  "comment" -> Map("type" -> "string", "description" -> "The problem and the required fix")
                ),
                "required" -> List("section", "severity", "comment")
              )
            )
          ),
          "required" -> List("score", "verdict", "summary", "issues")
        )
      )

      for {
        _ <- app.addAgent("Bibliographer", bibliographer)
        _ <- app.addAgent("FactChecker", factChecker)
        _ <- app.addAgent("PeerReviewer", reviewer)
        _ <- app.addTool("record_reference", referenceTool)
        _ <- app.addTool("record_finding", findingTool)
        _ <- app.addTool("record_review", reviewTool)
        _ <- app.connectTool(bibliographer, referenceTool)
        _ <- app.connectTool(factChecker, findingTool)
        _ <- app.connectTool(reviewer, reviewTool)
        _ <- app.connectContext(reviewer, styleGuide, weight = Some(0.4))
      } yield ScholarGraph(bibliographer, factChecker, reviewer, refSink, factSink, reviewSink)
    }

    for {
      _          <- app.addAgent("BookArchitect", architect)
      _          <- app.addAgent("ChapterWriter", writer)
      _          <- app.addAgent("BookEditor", editor)
      _          <- app.addTool("record_book_meta", metaTool)
      _          <- app.addTool("record_chapter", chapterTool)
      _          <- app.addTool("record_blurb", blurbTool)
      _          <- app.addTool("record_foreword", forewordTool)
      _          <- app.addAgent("StoryBibleWriter", bibleWriter)
      _          <- app.addAgent("ContinuityEditor", continuityEditor)
      _          <- app.addTool("record_story_bible", bibleTool)
      _          <- app.addTool("record_chapter_facts", factsTool)
      _          <- app.addTool("record_issue", issueTool)
      _          <- app.connectTool(bibleWriter, bibleTool)
      _          <- app.connectTool(continuityEditor, factsTool)
      _          <- app.connectTool(continuityEditor, issueTool)
      _          <- app.addContext("craft-guidelines", styleGuide)
      _          <- app.connectTool(architect, metaTool)
      _          <- app.connectTool(architect, chapterTool)
      _          <- app.connectTool(editor, blurbTool)
      _          <- app.connectTool(editor, forewordTool)
      _          <- app.connectContext(writer, styleGuide, weight = Some(0.9))
      _          <- app.connectContext(editor, styleGuide, weight = Some(0.6))
      _          <- app.delegate(architect, writer)
      _          <- app.delegate(writer, editor)
      scholar    <- if (cfg.scholar) scholarGraph.map(Some(_)) else ZIO.succeed(None)
    } yield (app, architect, writer, editor, scholar, ContinuityGraph(bibleWriter, continuityEditor, bibleSink, continuitySink))
  }
}
