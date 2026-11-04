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
      |                        >1 = chapters written in parallel via loki BatchExecutor
      |  --model <name>        OpenAI-compatible model id (default deepseek-chat)
      |  --api-key <key>       API key; falls back to env DEEPSEEK_API_KEY or OPENAI_API_KEY.
  |                        Not required when --base-url points at a local endpoint (e.g. LM Studio)
      |  --base-url <url>      OpenAI-compatible chat-completions endpoint
      |                        (default https://api.deepseek.com/chat/completions)
      |  --temperature <t>     Sampling temperature (default 0.8)
      |  --no-editor           Skip the editor stage (foreword + back-cover blurb)
      |  --debug               Print stack traces on failure
      |
      |Examples:
      |  sbt "run --chapters 4 --words 900 \"A cozy mystery set in a lighthouse village\""
      |  sbt "run \"A practical guide to urban gardening for busy people\" --chapters 5"
      |""".stripMargin

  def fromRequest(req: bookwriter.web.CreateBookRequest): Either[String, Config] = {
    val envKey = sys.env.getOrElse("DEEPSEEK_API_KEY", sys.env.getOrElse("OPENAI_API_KEY", ""))
    val apiKey = req.apiKey.getOrElse(envKey)
    val baseUrl = req.baseUrl.getOrElse(defaultBaseUrl)
    val chapters = req.chapters.getOrElse(6)
    val words = req.wordsPerChapter.getOrElse(1500)
    val concurrency = req.concurrency.getOrElse(1)
    val temperature = req.temperature.getOrElse(0.8)
    def inRange(name: String, v: Int, min: Int, max: Int): Either[String, Unit] =
      if (v < min || v > max) Left(s"$name must be in $min..$max (got $v)") else Right(())
    for {
      _ <- inRange("chapters", chapters, 1, 30)
      _ <- if (words < 200) Left(s"wordsPerChapter must be at least 200 (got $words)") else Right(())
      _ <- inRange("concurrency", concurrency, 1, 10)
      _ <- if (temperature < 0.0 || temperature > 2.0) Left("temperature must be in 0.0..2.0") else Right(())
      _ <- if (req.prompt.trim.isEmpty) Left("prompt must not be empty") else Right(())
      _ <- if (apiKey.isEmpty && !isLocalBaseUrl(baseUrl)) Left("no API key: pass apiKey or set DEEPSEEK_API_KEY") else Right(())
    } yield Config(
      prompt = req.prompt.trim,
      chapters = chapters,
      wordsPerChapter = words,
      out = Paths.get("output", "session", "book.md"),
      concurrency = concurrency,
      model = req.model.getOrElse("deepseek-chat"),
      apiKey = apiKey,
      baseUrl = baseUrl,
      temperature = temperature,
      skipEditor = req.skipEditor.getOrElse(false)
    )
  }

  def parse(args: List[String]): Either[String, Config] = {
    val envKey = sys.env.getOrElse("DEEPSEEK_API_KEY", sys.env.getOrElse("OPENAI_API_KEY", ""))
    val envPrompt = sys.env.getOrElse("BOOK_PROMPT", "")

    def intOf(s: String): Option[Int] = s.trim.toIntOption

    def dblOf(s: String): Option[Double] =
      try Some(s.trim.toDouble) catch { case _: NumberFormatException => None }

    def loop(rest: List[String], cfg: Config, positional: List[String]): Either[String, Config] = rest match {
      case Nil =>
        val prompt = Seq(cfg.prompt, positional.mkString(" ").trim, envPrompt).find(_.nonEmpty).getOrElse("")
        val next = cfg.copy(prompt = prompt, apiKey = if (cfg.apiKey.nonEmpty) cfg.apiKey else envKey)
        if (next.serve) Right(next)
        else if (prompt.isEmpty) Left(usage)
        else if (next.apiKey.isEmpty && !isLocalBaseUrl(next.baseUrl))
          Left("No API key found. Pass --api-key or set DEEPSEEK_API_KEY.\n" + usage)
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
      case "--debug" :: t            => loop(t, cfg.copy(debug = true), positional)
      case "--serve" :: t            => loop(t, cfg.copy(serve = true), positional)
      case other :: t                => Left(s"Unknown argument: $other\n$usage")
    }

    loop(args, Config(prompt = "", apiKey = ""), Nil)
  }
}
