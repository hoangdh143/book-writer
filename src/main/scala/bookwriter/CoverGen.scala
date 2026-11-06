package bookwriter

import zio.{IO, Task, ZIO}
import zio.json._
import java.net.URI
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.time.Duration
import java.util.Base64

/** A generated cover image ready for embedding (e.g. as an EPUB cover image). */
final case class CoverImage(mime: String, bytes: Array[Byte])

/** Endpoint settings for OpenAI-compatible image generation. Request-supplied values
  * win over IMAGE_* env vars, which win over the OpenAI defaults. */
final case class ImageSettings(
  baseUrl: String,
  apiKey: String,
  model: String,
  size: String
)

object ImageSettings {
  val defaultBaseUrl: String = "https://api.openai.com/v1/images/generations"
  val defaultModel: String = "gpt-image-2.6-sunburst"
  val defaultSize: String = "1024x1536"

  def fromEnv(
    baseUrl: Option[String] = None,
    apiKey: Option[String] = None,
    model: Option[String] = None,
    size: Option[String] = None
  ): ImageSettings =
    ImageSettings(
      baseUrl = baseUrl.orElse(sys.env.get("IMAGE_BASE_URL")).getOrElse(defaultBaseUrl).trim,
      apiKey = apiKey
        .orElse(sys.env.get("IMAGE_API_KEY"))
        .orElse(sys.env.get("OPENAI_API_KEY"))
        .getOrElse("")
        .trim,
      model = model.orElse(sys.env.get("IMAGE_MODEL")).getOrElse(defaultModel).trim,
      size = size.map(_.trim).filter(_.nonEmpty).getOrElse(defaultSize)
    )

  /** Local image endpoints need no API key, like local chat-completions endpoints. */
  def isLocal(url: String): Boolean = {
    val lowered = url.toLowerCase
    List("http://localhost", "http://127.0.0.1", "http://[::1]").exists(lowered.startsWith)
  }
}

enum CoverError:
  /** The book has no outline yet, so there is nothing to base a cover on. */
  case NoOutline(status: String)
  case MissingApiKey
  case Upstream(details: String)

  def message: String = this match
    case NoOutline(status) => s"book is $status; a cover can only be generated once the outline exists"
    case MissingApiKey     => "no image API key: pass imageApiKey or set IMAGE_API_KEY / OPENAI_API_KEY"
    case Upstream(m)       => m

/** Carries a CoverError through blocking code so `generate` can surface it typed. */
private[bookwriter] final case class CoverFailure(error: CoverError) extends RuntimeException(error.message)

private final case class ImageGenRequest(model: String, prompt: String, size: String, n: Int) derives JsonEncoder

private final case class ImageGenData(b64_json: Option[String] = None, url: Option[String] = None) derives JsonDecoder

private final case class ImageGenResponse(data: List[ImageGenData]) derives JsonDecoder

/** Calls an OpenAI-compatible images/generations endpoint and returns the image bytes. */
object CoverGen {

  import CoverError.Upstream

  private val httpClient: HttpClient =
    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build()

  def coverPrompt(outline: BookOutline): String = {
    val premise = if (outline.premise.length <= 300) outline.premise else outline.premise.take(300) + "..."
    s"""Professional book cover illustration for a ${outline.genre} book.
       |Premise: $premise
       |Full-bleed portrait cover artwork in the ${outline.genre} genre. Include the title
       |"${outline.title}" as large, legible cover text. Rich colors, striking composition,
       |no borders, no watermark.""".stripMargin
  }

  def generate(prompt: String, settings: ImageSettings): IO[CoverError, CoverImage] =
    if (settings.apiKey.isEmpty && !ImageSettings.isLocal(settings.baseUrl))
      ZIO.fail(CoverError.MissingApiKey)
    else
      request(prompt, settings)
        .catchAll {
          case CoverFailure(error) => ZIO.fail(error)
          case error               => ZIO.fail(CoverError.Upstream(String.valueOf(error)))
        }

  private def request(prompt: String, settings: ImageSettings): Task[CoverImage] =
    ZIO.attemptBlocking {
      val body = ImageGenRequest(model = settings.model, prompt = prompt, size = settings.size, n = 1).toJson
      val request = HttpRequest.newBuilder()
        .uri(URI.create(settings.baseUrl))
        .header("content-type", "application/json")
        .header("authorization", s"Bearer ${settings.apiKey}")
        .timeout(Duration.ofMinutes(3))
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build()
      val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
      if (response.statusCode() < 200 || response.statusCode() >= 300)
        throw CoverFailure(Upstream(s"image generation failed: HTTP ${response.statusCode()} ${clip(response.body(), 300)}"))
      coverOf(response.body())
    }

  private def fetchImage(url: String): Array[Byte] = {
    val response = httpClient.send(
      HttpRequest.newBuilder().uri(URI.create(url)).timeout(Duration.ofMinutes(3)).GET().build(),
      HttpResponse.BodyHandlers.ofByteArray()
    )
    if (response.statusCode() < 200 || response.statusCode() >= 300)
      throw CoverFailure(Upstream(s"could not fetch generated image: HTTP ${response.statusCode()}"))
    response.body()
  }

  /** Accepts either a base64 payload or a URL for the generated image. */
  private def coverOf(raw: String): CoverImage =
    raw.fromJson[ImageGenResponse] match {
      case Left(error) => throw CoverFailure(Upstream(s"invalid image response: $error"))
      case Right(parsed) =>
        parsed.data.headOption.flatMap(d => d.b64_json.orElse(d.url)) match {
          case None => throw CoverFailure(Upstream("image response contained no image"))
          case Some(payload) if looksLikeUrl(payload) =>
            CoverImage(mime = "image/png", bytes = fetchImage(payload))
          case Some(base64) =>
            try CoverImage(mime = "image/png", bytes = Base64.getDecoder.decode(base64.replaceAll("\\s", "")))
            catch {
              case _: IllegalArgumentException =>
                throw CoverFailure(Upstream("image response base64 payload was not decodable"))
            }
        }
    }

  private def looksLikeUrl(value: String): Boolean =
    value.startsWith("http://") || value.startsWith("https://")

  private def clip(s: String, max: Int): String =
    if (s.length <= max) s else s.take(max) + "..."
}
