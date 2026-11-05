package bookwriter

import java.nio.file.Path
import java.nio.file.Paths

final case class Config(
  prompt: String,
  chapters: Int = 6,
  wordsPerChapter: Int = 1500,
  out: Path = Paths.get("output", "book.md"),
  concurrency: Int = 1,
  model: String = "deepseek-chat",
  apiKey: String = "",
  baseUrl: String = "https://api.deepseek.com/chat/completions",
  temperature: Double = 0.8,
  skipEditor: Boolean = false,
  scholar: Boolean = false,
  debug: Boolean = false,
  serve: Boolean = false
)

object Config {

  /** Target words per LLM call when writing a chapter; longer chapters are split
    * into consecutive segments chained with continuity, so chapter length is unlimited. */
  val wordsPerSegment: Int = 2000

  def segmentCount(wordsPerChapter: Int): Int =
    math.max(1, math.ceil(wordsPerChapter.toDouble / wordsPerSegment).toInt)

  private val defaultBaseUrl = "https://api.deepseek.com/chat/completions"

  private val localPrefixes = List(
    "http://localhost",
    "https://localhost",
    "http://127.0.0.1",
    "https://127.0.0.1",
    "http://[::1]",
    "https://[::1]"
  )

  /** Local endpoints (e.g. LM Studio) need no API key. */
  private def isLocalBaseUrl(url: String): Boolean = {
    val lowered = url.toLowerCase
    localPrefixes.exists(lowered.startsWith)
  }

  private def isWiroBaseUrl(url: String): Boolean =
    url.toLowerCase.startsWith("https://llm.wiro.ai/")

  private def keyEnvNameFor(baseUrl: String): String =
    if (isWiroBaseUrl(baseUrl)) "WIRO_API_KEY" else "DEEPSEEK_API_KEY"

  /** Wiro gets only its own key, so another provider's key is never sent to its gateway. */
  private def envKeyFor(baseUrl: String): String =
    if (isWiroBaseUrl(baseUrl)) sys.env.getOrElse("WIRO_API_KEY", "")
    else sys.env.getOrElse("DEEPSEEK_API_KEY", sys.env.getOrElse("OPENAI_API_KEY", ""))

  private val defaultLmStudioChatUrl = "http://localhost:1234/v1/chat/completions"

  /** The UI always asks for LM Studio on localhost; inside a container that has to mean the host. */
  private def routedBaseUrl(url: String): String =
    sys.env.get("LM_STUDIO_BASE_URL") match {
      case Some(base) if url == defaultLmStudioChatUrl => s"${base.stripSuffix("/")}/chat/completions"
      case _                                           => url
    }

  val usage: String =
    """
      |book-writer — generate a full book from a prompt, on loki-engine
      |
      |Usage:
      |  sbt "run [options] \"<book prompt>\""           # CLI mode: generate one book end to end
      |  sbt "run --serve"                               # server mode: REST API + web UI on :8080
      |
      |Options:
      |  --serve               Run the web server (UI + REST API) instead of the CLI pipeline
      |  --prompt <text>       The book topic / idea / premise. Or pass it as the only positional argument.
      |                        Falls back to env BOOK_PROMPT.
      |  --chapters <n>        Target number of chapters (default 6)
      |  --words <n>           Target words per chapter (default 1500; no upper limit — long
      |                        chapters are written in consecutive segments)
      |  --out <path>          Output markdown file (default output/book.md)
      |  --concurrency <n>     1 = chapters written sequentially with continuity (default);
      |                        >1 = chapters written concurrently (ZIO foreachPar)
      |  --model <name>        OpenAI-compatible model id (default deepseek-chat)
      |  --api-key <key>       API key; falls back to env DEEPSEEK_API_KEY or OPENAI_API_KEY
      |                        (WIRO_API_KEY when --base-url points at llm.wiro.ai).
  |                        Not required when --base-url points at a local endpoint (e.g. LM Studio)
      |  --base-url <url>      OpenAI-compatible chat-completions endpoint
      |                        (default https://api.deepseek.com/chat/completions)
      |  --temperature <t>     Sampling temperature (default 0.8)
      |  --no-editor           Skip the editor stage (foreword + back-cover blurb)
      |  --scholar             Scholar mode: produce a research paper with a bibliography,
      |                        inline citations, per-section fact cross-checking and a
      |                        peer-review pass before assembly
      |  --debug               Print stack traces on failure
      |
      |Examples:
      |  sbt "run --chapters 4 --words 900 \"A cozy mystery set in a lighthouse village\""
      |  sbt "run \"A practical guide to urban gardening for busy people\" --chapters 5"
      |  sbt "run --scholar \"The impact of transformer architectures on low-resource machine translation\""
      |  sbt "run --base-url https://llm.wiro.ai/v1/chat/completions --model qwen/qwen3-8-27b-uncensored \"A noir thriller\""
      |""".stripMargin

  def fromRequest(req: bookwriter.web.CreateBookRequest): Either[String, Config] = {
    val baseUrl = req.baseUrl.getOrElse(defaultBaseUrl)
    val apiKey = req.apiKey.getOrElse(envKeyFor(baseUrl))
    val chapters = req.chapters.getOrElse(6)
    val words = req.wordsPerChapter.getOrElse(1500)
    val concurrency = req.concurrency.getOrElse(1)
    val temperature = req.temperature.getOrElse(0.8)
    def inRange(name: String, v: Int, min: Int, max: Int): Either[String, Unit] =
      if (v < min || v > max) Left(s"$name must be in $min..$max (got $v)") else Right(())
    for {
      _ <- inRange("chapters", chapters, 1, 30)
      _ <- if (words < 200) Left(s"wordsPerChapter must be at least 200 (got $words)") else Right(())
      _ <- if (concurrency != 1) Left(s"concurrency must be 1 (got $concurrency): the server writes chapters one at a time; parallel chapters are CLI-only (--concurrency)") else Right(())
      _ <- if (temperature < 0.0 || temperature > 2.0) Left("temperature must be in 0.0..2.0") else Right(())
      _ <- if (req.prompt.trim.isEmpty) Left("prompt must not be empty") else Right(())
      _ <- if (apiKey.isEmpty && !isLocalBaseUrl(baseUrl)) Left(s"no API key: pass apiKey or set ${keyEnvNameFor(baseUrl)}") else Right(())
    } yield Config(
      prompt = req.prompt.trim,
      chapters = chapters,
      wordsPerChapter = words,
      out = Paths.get("output", "session", "book.md"),
      concurrency = concurrency,
      model = req.model.getOrElse("deepseek-chat"),
      apiKey = apiKey,
      baseUrl = routedBaseUrl(baseUrl),
      temperature = temperature,
      skipEditor = req.skipEditor.getOrElse(false),
      scholar = req.scholar.getOrElse(false)
    )
  }

  def parse(args: List[String]): Either[String, Config] = {
    val envPrompt = sys.env.getOrElse("BOOK_PROMPT", "")

    def intOf(s: String): Option[Int] = s.trim.toIntOption

    def dblOf(s: String): Option[Double] =
      try Some(s.trim.toDouble) catch { case _: NumberFormatException => None }

    def loop(rest: List[String], cfg: Config, positional: List[String]): Either[String, Config] = rest match {
      case Nil =>
        val prompt = Seq(cfg.prompt, positional.mkString(" ").trim, envPrompt).find(_.nonEmpty).getOrElse("")
        val next = cfg.copy(prompt = prompt, apiKey = if (cfg.apiKey.nonEmpty) cfg.apiKey else envKeyFor(cfg.baseUrl))
        if (next.serve) Right(next)
        else if (prompt.isEmpty) Left(usage)
        else if (next.apiKey.isEmpty && !isLocalBaseUrl(next.baseUrl))
          Left(s"No API key found. Pass --api-key or set ${keyEnvNameFor(next.baseUrl)}.\n" + usage)
        else Right(next)
      case "--prompt" :: v :: t      => loop(t, cfg.copy(prompt = v), positional)
      case "--chapters" :: v :: t    => intOf(v) match {
        case Some(n) if n >= 1 && n <= 30 => loop(t, cfg.copy(chapters = n), positional)
        case _ => Left(s"--chapters must be an integer in 1..30 (got '$v')")
      }
      case "--words" :: v :: t       => intOf(v) match {
        case Some(n) if n >= 200 => loop(t, cfg.copy(wordsPerChapter = n), positional)
        case _ => Left(s"--words must be an integer of at least 200 (got '$v')")
      }
      case "--out" :: v :: t         => loop(t, cfg.copy(out = Paths.get(v)), positional)
      case "--concurrency" :: v :: t => intOf(v) match {
        case Some(n) if n >= 1 && n <= 10 => loop(t, cfg.copy(concurrency = n), positional)
        case _ => Left(s"--concurrency must be an integer in 1..10 (got '$v')")
      }
      case "--model" :: v :: t       => loop(t, cfg.copy(model = v), positional)
      case "--api-key" :: v :: t     => loop(t, cfg.copy(apiKey = v), positional)
      case "--base-url" :: v :: t    => loop(t, cfg.copy(baseUrl = v), positional)
      case "--temperature" :: v :: t => dblOf(v) match {
        case Some(d) if d >= 0.0 && d <= 2.0 => loop(t, cfg.copy(temperature = d), positional)
        case _ => Left(s"--temperature must be a number in 0.0..2.0 (got '$v')")
      }
      case "--no-editor" :: t        => loop(t, cfg.copy(skipEditor = true), positional)
      case "--scholar" :: t          => loop(t, cfg.copy(scholar = true), positional)
      case "--debug" :: t            => loop(t, cfg.copy(debug = true), positional)
      case "--serve" :: t            => loop(t, cfg.copy(serve = true), positional)
      case other :: t                => Left(s"Unknown argument: $other\n$usage")
    }

    loop(args, Config(prompt = "", apiKey = ""), Nil)
  }
}
