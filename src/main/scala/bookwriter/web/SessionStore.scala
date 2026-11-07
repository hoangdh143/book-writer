package bookwriter.web

import bookwriter.{BookOutline, ChapterPlan, Config, ContinuityMemory, IllustrationConfig, Reference, WrittenChapter}
import zio.UIO
import zio.json.JsonCodec
import zio.json._
import scala.jdk.CollectionConverters.*
import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path, Paths}
import java.time.Instant

final case class PersistedConfig(
  prompt: String,
  chapters: Int,
  wordsPerChapter: Int,
  concurrency: Int,
  model: String,
  apiKey: String,
  baseUrl: String,
  temperature: Double,
  skipEditor: Boolean,
  scholar: Boolean = false,
  diagrams: Boolean = false,
  illustrations: Option[IllustrationConfig] = None
) derives JsonCodec {

  def toConfig(id: String): Config = Config(
    prompt = prompt,
    chapters = chapters,
    wordsPerChapter = wordsPerChapter,
    out = Paths.get("output", "books", id, "book.md"),
    concurrency = concurrency,
    model = model,
    apiKey = apiKey,
    baseUrl = baseUrl,
    temperature = temperature,
    skipEditor = skipEditor,
    scholar = scholar,
    diagrams = diagrams,
    illustrations = illustrations,
    serve = true
  )
}

sealed trait PersistedPhase derives JsonCodec

object PersistedPhase:
  final case class PPlanning() extends PersistedPhase derives JsonCodec
  final case class PTocReview(outline: BookOutline, revision: Int) extends PersistedPhase derives JsonCodec
  final case class PGenerating(
    outline: BookOutline,
    written: List[WrittenChapter],
    current: ChapterPlan,
    remaining: List[ChapterPlan],
    mode: String,
    notes: List[String],
    alongside: List[ChapterPlan] = Nil
  ) extends PersistedPhase derives JsonCodec
  final case class PChapterReview(
    outline: BookOutline,
    written: List[WrittenChapter],
    pending: WrittenChapter,
    remaining: List[ChapterPlan],
    notes: List[String]
  ) extends PersistedPhase derives JsonCodec
  final case class PEditing(outline: BookOutline, written: List[WrittenChapter]) extends PersistedPhase derives JsonCodec
  final case class PCompleted(
    outline: BookOutline,
    written: List[WrittenChapter],
    markdown: String,
    files: List[String],
    elapsedSeconds: Long
  ) extends PersistedPhase derives JsonCodec
  final case class PFailed(message: String, interrupted: String) extends PersistedPhase derives JsonCodec

final case class PersistedSession(
  version: Int,
  id: String,
  cfg: PersistedConfig,
  phase: PersistedPhase,
  events: List[(Long, String)],
  startedAtMs: Long,
  references: List[Reference] = Nil,
  continuity: ContinuityMemory = ContinuityMemory()
) derives JsonCodec

object SessionStore:

  private val root: Path = Paths.get("output", "books")

  private def file(id: String): Path = root.resolve(id).resolve("session.json")

  def snapshot(
    id: String,
    cfg: Config,
    phase: BookPhase,
    events: List[(Instant, String)],
    startedAt: Instant,
    references: List[Reference],
    continuity: ContinuityMemory
  ): PersistedSession =
    val persistedCfg = PersistedConfig(
      prompt = cfg.prompt,
      chapters = cfg.chapters,
      wordsPerChapter = cfg.wordsPerChapter,
      concurrency = cfg.concurrency,
      model = cfg.model,
      apiKey = cfg.apiKey,
      baseUrl = cfg.baseUrl,
      temperature = cfg.temperature,
      skipEditor = cfg.skipEditor,
      scholar = cfg.scholar,
      diagrams = cfg.diagrams,
      illustrations = cfg.illustrations
    )
    PersistedSession(
      version = 1,
      id = id,
      cfg = persistedCfg,
      phase = toPersisted(phase),
      events = events.map { case (at, msg) => (at.toEpochMilli, msg) },
      startedAtMs = startedAt.toEpochMilli,
      references = references,
      continuity = continuity
    )

  def toPersisted(phase: BookPhase): PersistedPhase = phase match
    case BookPhase.Planning                                 => PersistedPhase.PPlanning()
    case BookPhase.TocReview(outline, revision)             => PersistedPhase.PTocReview(outline, revision)
    case g: BookPhase.Generating                            =>
      PersistedPhase.PGenerating(g.outline, g.written, g.current, g.remaining, g.mode.label, g.notes, g.alongside)
    case BookPhase.ChapterReview(o, w, pending, r, notes)   =>
      PersistedPhase.PChapterReview(o, w, pending, r, notes)
    case BookPhase.Editing(o, w)                            => PersistedPhase.PEditing(o, w)
    case BookPhase.Completed(o, w, md, files, secs)         => PersistedPhase.PCompleted(o, w, md, files, secs)
    case BookPhase.Failed(message, interrupted)             => PersistedPhase.PFailed(message, interrupted)

  def fromPersisted(persisted: PersistedPhase): BookPhase = persisted match
    case PersistedPhase.PPlanning()                                        => BookPhase.Planning
    case PersistedPhase.PTocReview(outline, revision)                      => BookPhase.TocReview(outline, revision)
    case PersistedPhase.PGenerating(o, w, c, r, mode, notes, alongside)    =>
      BookPhase.Generating(o, w, c, r, RunMode.parse(mode).getOrElse(RunMode.RunAll), notes, alongside)
    case PersistedPhase.PChapterReview(o, w, pending, r, notes)            =>
      BookPhase.ChapterReview(o, w, pending, r, notes)
    case PersistedPhase.PEditing(o, w)                                     => BookPhase.Editing(o, w)
    case PersistedPhase.PCompleted(o, w, md, files, secs)                  => BookPhase.Completed(o, w, md, files, secs)
    case PersistedPhase.PFailed(message, interrupted)                      => BookPhase.Failed(message, interrupted)

  def save(session: PersistedSession): UIO[Unit] =
    zio.ZIO
      .attempt {
        Files.createDirectories(root.resolve(session.id))
        Files.writeString(file(session.id), session.toJson, StandardCharsets.UTF_8)
      }
      .unit
      .catchAll { e =>
        zio.ZIO.succeed(println(s"  ! could not persist book '${session.id}': ${String.valueOf(e.getMessage)}"))
      }

  def loadAll: UIO[List[PersistedSession]] =
    zio.ZIO.attempt {
      if (!Files.isDirectory(root)) Nil
      else
        val dirs = Files.list(root).iterator().asScala.toList.filter(Files.isDirectory(_))
        dirs.flatMap { dir =>
          val f = dir.resolve("session.json")
          if (!Files.isRegularFile(f)) None
          else
            Files.readString(f, StandardCharsets.UTF_8).fromJson[PersistedSession] match
              case Right(session) => Some(session)
              case Left(error)    =>
                println(s"  ! skipping unreadable session '${dir.getFileName}': $error")
                None
        }.sortBy(_.startedAtMs)
    }.orElse(zio.ZIO.succeed(Nil))

  def delete(id: String): UIO[Unit] =
    zio.ZIO.attempt(Files.deleteIfExists(file(id))).unit.catchAll(_ => zio.ZIO.unit)
