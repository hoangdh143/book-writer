package bookwriter.web

import bookwriter.{BookOutline, ChapterPlan, Config, IllustrationConfig, WrittenChapter}

enum RunMode:
  case StepByStep, RunAll

  def label: String = this match
    case RunMode.StepByStep => "step"
    case RunMode.RunAll     => "all"

object RunMode:
  def parse(raw: String): Option[RunMode] = raw.trim.toLowerCase match
    case "all"  => Some(RunMode.RunAll)
    case "step" => Some(RunMode.StepByStep)
    case _      => None

sealed trait Gate
object Gate:
  final case class TocApprove(mode: RunMode, comment: Option[String], edits: Option[OutlineEdits]) extends Gate
  final case class TocRevise(comment: String) extends Gate
  final case class ChapterApprove(comment: Option[String]) extends Gate
  final case class ChapterApproveRest(comment: Option[String]) extends Gate
  final case class ChapterRevise(comment: String) extends Gate

sealed trait BookPhase:
  def status: String

object BookPhase:
  /** What the chapters in hand are going through; the chapter list shows it as their state. */
  val Preparing = "preparing"
  val Writing = "writing"
  val Checking = "checking"

  case object Planning                                              extends BookPhase { val status = "planning" }
  final case class TocReview(outline: BookOutline, revision: Int)   extends BookPhase { val status = "toc_review" }
  final case class Generating(
    outline: BookOutline,
    written: List[WrittenChapter],
    current: ChapterPlan,
    remaining: List[ChapterPlan],
    mode: RunMode,
    notes: List[String],
    alongside: List[ChapterPlan] = Nil,
    stage: String = BookPhase.Writing
  )                                                                 extends BookPhase { val status = "generating" }
  final case class ChapterReview(
    outline: BookOutline,
    written: List[WrittenChapter],
    pending: WrittenChapter,
    remaining: List[ChapterPlan],
    notes: List[String]
  )                                                                 extends BookPhase { val status = "chapter_review" }
  final case class Editing(outline: BookOutline, written: List[WrittenChapter])
                                                                    extends BookPhase { val status = "editing" }
  final case class Completed(
    outline: BookOutline,
    written: List[WrittenChapter],
    markdown: String,
    files: List[String],
    elapsedSeconds: Long
  )                                                                 extends BookPhase { val status = "completed" }
  final case class Failed(message: String, interrupted: String)     extends BookPhase { val status = "failed" }

object BookMapper {

  def outlineDto(outline: BookOutline): OutlineDto = OutlineDto(
    title = outline.title,
    genre = outline.genre,
    premise = outline.premise,
    chapters = outline.chapters.map(c => ChapterPlanDto(c.number, c.title, c.synopsis))
  )

  def chapterStatus(outline: BookOutline, phase: BookPhase): List[ChapterStatusDto] = {
    def stateOf(n: Int): Option[ChapterStatusDto] = phase match {
      case BookPhase.Completed(_, written, _, _, _) => done(n, written)
      case BookPhase.Editing(_, written)            => done(n, written)
      case BookPhase.ChapterReview(_, written, pending, _, _) =>
        if pending.plan.number == n then Some(review(pending))
        else done(n, written)
      case g: BookPhase.Generating =>
        if (g.current :: g.alongside).exists(_.number == n) then Some(ChapterStatusDto(n, "", "", g.stage))
        else done(n, g.written)
      case _ => None
    }
    def done(n: Int, written: List[WrittenChapter]): Option[ChapterStatusDto] =
      written.find(_.plan.number == n).map(wc => ChapterStatusDto(n, "", "", "written", Some(wc.wordCount)))
    def review(wc: WrittenChapter): ChapterStatusDto =
      ChapterStatusDto(wc.plan.number, "", "", "awaiting_review", Some(wc.wordCount))

    outline.chapters.map { plan =>
      stateOf(plan.number).getOrElse(ChapterStatusDto(plan.number, "", "", "pending"))
        .copy(title = plan.title, synopsis = plan.synopsis)
    }
  }

  private def illustrationSettings(c: IllustrationConfig): IllustrationSettingsDto =
    IllustrationSettingsDto(c.model, c.aspectRatio, c.resolution, c.quality, c.perChapter, c.style, c.useReference)

  def bookDto(id: String, cfg: Config, phase: BookPhase, events: List[EventDto], storyBible: String = ""): BookDto = {
    val outline = outlineOf(phase)
    val written = writtenOf(phase)
    val chapters = outline.toList.flatMap(o => chapterStatus(o, phase))
    BookDto(
      id = id,
      prompt = cfg.prompt,
      model = cfg.model,
      status = phase.status,
      scholar = Some(cfg.scholar),
      writtenCount = written.size,
      totalChapters = outline.map(_.chapters.size).getOrElse(cfg.chapters),
      storyBible = Some(storyBible).filter(_.nonEmpty),
      settings = Some(BookSettingsDto(cfg.chapters, cfg.wordsPerChapter, cfg.concurrency, cfg.baseUrl, cfg.diagrams, cfg.illustrations.map(illustrationSettings))),
      outline = outline.map(outlineDto),
      chapters = chapters,
      currentChapter = currentOf(phase),
      mode = modeOf(phase),
      error = phase match { case BookPhase.Failed(m, _) => Some(m); case _ => None },
      markdownFiles = phase match { case BookPhase.Completed(_, _, _, files, _) => files; case _ => Nil },
      markdown = phase match { case BookPhase.Completed(_, _, md, _, _) => Some(md); case _ => None },
      events = events,
      elapsedSeconds = phase match { case BookPhase.Completed(_, _, _, _, s) => Some(s); case _ => None }
    )
  }

  def listItem(id: String, cfg: Config, phase: BookPhase): BookListItemDto = {
    val outline = outlineOf(phase)
    val written = writtenOf(phase)
    BookListItemDto(
      id = id,
      prompt = cfg.prompt,
      status = phase.status,
      title = outline.map(_.title),
      scholar = Some(cfg.scholar),
      writtenCount = written.size,
      totalChapters = outline.map(_.chapters.size).getOrElse(cfg.chapters)
    )
  }

  def chapterText(phase: BookPhase, n: Int): Option[ChapterTextDto] = phase match {
    case BookPhase.Completed(_, written, _, _, _)       => fromWritten(written, n)
    case BookPhase.Editing(_, written)                  => fromWritten(written, n)
    case BookPhase.ChapterReview(_, written, pending, _, _) =>
      if pending.plan.number == n then Some(ChapterTextDto(n, pending.plan.title, pending.text))
      else fromWritten(written, n)
    case g: BookPhase.Generating                        => fromWritten(g.written, n)
    case _                                              => None
  }

  private def fromWritten(written: List[WrittenChapter], n: Int): Option[ChapterTextDto] =
    written.find(_.plan.number == n).map(wc => ChapterTextDto(n, wc.plan.title, wc.text))

  def outlineOf(phase: BookPhase): Option[BookOutline] = phase match {
    case BookPhase.Planning                        => None
    case BookPhase.TocReview(o, _)                 => Some(o)
    case g: BookPhase.Generating                   => Some(g.outline)
    case BookPhase.ChapterReview(o, _, _, _, _)    => Some(o)
    case BookPhase.Editing(o, _)                   => Some(o)
    case BookPhase.Completed(o, _, _, _, _)        => Some(o)
    case BookPhase.Failed(_, _)                    => None
  }

  private def writtenOf(phase: BookPhase): List[WrittenChapter] = phase match {
    case g: BookPhase.Generating                      => g.written
    case BookPhase.ChapterReview(_, written, _, _, _) => written
    case BookPhase.Editing(_, written)                => written
    case BookPhase.Completed(_, written, _, _, _)     => written
    case _                                            => Nil
  }

  private def currentOf(phase: BookPhase): Option[Int] = phase match {
    case g: BookPhase.Generating                      => Some(g.current.number)
    case BookPhase.ChapterReview(_, _, pending, _, _) => Some(pending.plan.number)
    case _                                            => None
  }

  private def modeOf(phase: BookPhase): Option[String] = phase match {
    case g: BookPhase.Generating                   => Some(g.mode.label)
    case _                                         => None
  }
}
