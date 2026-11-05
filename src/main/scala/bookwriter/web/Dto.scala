package bookwriter.web

import zio.json.JsonCodec

// ---- requests ---------------------------------------------------------------

final case class CreateBookRequest(
  prompt: String,
  chapters: Option[Int] = None,
  wordsPerChapter: Option[Int] = None,
  concurrency: Option[Int] = None,
  model: Option[String] = None,
  baseUrl: Option[String] = None,
  apiKey: Option[String] = None,
  temperature: Option[Double] = None,
  skipEditor: Option[Boolean] = None,
  scholar: Option[Boolean] = None
) derives JsonCodec

final case class ChapterEdit(
  number: Int,
  title: Option[String] = None,
  synopsis: Option[String] = None
) derives JsonCodec

final case class OutlineEdits(
  title: Option[String] = None,
  genre: Option[String] = None,
  premise: Option[String] = None,
  chapters: Option[List[ChapterEdit]] = None
) derives JsonCodec

final case class TocApproveRequest(
  mode: String,
  comment: Option[String] = None,
  edits: Option[OutlineEdits] = None
) derives JsonCodec

final case class TocReviseRequest(comment: String) derives JsonCodec

final case class ChapterApproveRequest(comment: Option[String] = None) derives JsonCodec

final case class ChapterReviseRequest(comment: String) derives JsonCodec

final case class ApproveRestRequest(comment: Option[String] = None) derives JsonCodec

// ---- responses ---------------------------------------------------------------

final case class ChapterPlanDto(
  number: Int,
  title: String,
  synopsis: String
) derives JsonCodec

final case class OutlineDto(
  title: String,
  genre: String,
  premise: String,
  chapters: List[ChapterPlanDto]
) derives JsonCodec

final case class ChapterStatusDto(
  number: Int,
  title: String,
  synopsis: String,
  state: String,
  wordCount: Option[Int] = None
) derives JsonCodec

final case class EventDto(at: String, message: String) derives JsonCodec

final case class BookDto(
  id: String,
  prompt: String,
  model: String,
  status: String,
  writtenCount: Int,
  totalChapters: Int,
  scholar: Option[Boolean] = None,
  outline: Option[OutlineDto] = None,
  chapters: List[ChapterStatusDto] = Nil,
  currentChapter: Option[Int] = None,
  mode: Option[String] = None,
  error: Option[String] = None,
  markdownFiles: List[String] = Nil,
  markdown: Option[String] = None,
  events: List[EventDto] = Nil,
  elapsedSeconds: Option[Long] = None
) derives JsonCodec

final case class ChapterTextDto(number: Int, title: String, text: String) derives JsonCodec

final case class BookListItemDto(
  id: String,
  prompt: String,
  status: String,
  title: Option[String] = None,
  scholar: Option[Boolean] = None,
  writtenCount: Int = 0,
  totalChapters: Int = 0
) derives JsonCodec

final case class CreatedDto(id: String) derives JsonCodec

final case class OkDto(ok: Boolean = true) derives JsonCodec

final case class HealthDto(ok: Boolean = true, app: String = "book-writer") derives JsonCodec

final case class ApiErrorDto(error: String) derives JsonCodec

final case class LmStudioModelDto(id: String) derives JsonCodec

final case class LmStudioModelsDto(data: List[LmStudioModelDto]) derives JsonCodec
