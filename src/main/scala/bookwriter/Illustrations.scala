package bookwriter

import java.awt.Color
import java.awt.image.BufferedImage
import java.io.{ByteArrayInputStream, ByteArrayOutputStream}
import java.net.URI
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.time.Duration
import java.util.Base64
import javax.imageio.{IIOImage, ImageIO, ImageWriteParam}
import javax.imageio.stream.MemoryCacheImageOutputStream
import scala.util.Try
import scala.util.matching.Regex
import zio.json._
import zio.{Ref, UIO, ZIO}

/** How a book's illustrations are generated through OpenRouter. Unset choices use the model's default. */
final case class IllustrationConfig(
  apiKey: String,
  model: String,
  aspectRatio: Option[String] = None,
  resolution: Option[String] = None,
  quality: Option[String] = None,
  perChapter: Int = 1,
  style: String = "",
  useReference: Boolean = false
) derives JsonCodec

/** The assembled book with its illustrations embedded, and why any were left out. */
final case class RenderedIllustrations(markdown: String, rendered: Int, failures: List[String], costUsd: Double)

private final case class ImageUrl(url: String) derives JsonEncoder
private final case class ImageReference(`type`: String, image_url: ImageUrl) derives JsonEncoder

private final case class ImagesRequest(
  model: String,
  prompt: String,
  n: Int,
  aspect_ratio: Option[String],
  resolution: Option[String],
  quality: Option[String],
  input_references: Option[List[ImageReference]]
) derives JsonEncoder

private final case class ImagesData(b64_json: Option[String] = None, media_type: Option[String] = None) derives JsonDecoder
private final case class ImagesUsage(cost: Option[Double] = None) derives JsonDecoder
private final case class ImagesResponse(data: List[ImagesData] = Nil, usage: Option[ImagesUsage] = None) derives JsonDecoder

/** Replaces the illustration blocks of an assembled book with embedded images from OpenRouter.
  * Chapter text keeps the description, so a chapter revision costs nothing and never feeds image
  * data back to the model. An image that cannot be generated is left out and never stops the book. */
object Illustrations {

  private final case class Generated(mime: String, bytes: Array[Byte], costUsd: Double)
  private final case class Failure(reason: String, retryable: Boolean, billed: Boolean = false)

  private val defaultUrl = "https://openrouter.ai/api/v1/images"
  private val parallelImages = 3
  private val bookQuality = 0.88f
  private val referenceQuality = 0.8f
  private val referenceSide = 1024
  private val permanentStatuses = Set(400, 401, 402, 403, 404)
  private val embeddable = Set("image/png", "image/jpeg", "image/webp")

  private val block: Regex =
    """(?ms)^```illustration[ \t]*\r?$\n?(.*?)^```[ \t]*\r?$(\s*\*Figure:\s*([^*\n]+)\*)?""".r

  private val httpClient: HttpClient =
    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build()

  /** Drops blocks past the chapter's limit, so what the model writes cannot exceed what was agreed to spend. */
  def capped(chapter: String, perChapter: Int): String =
    block.findAllMatchIn(chapter).toList.drop(perChapter).foldRight(chapter) { (found, text) =>
      text.substring(0, found.start) + text.substring(found.end)
    }

  def renderBook(
    markdown: String,
    outline: BookOutline,
    config: Option[IllustrationConfig],
    progress: String => UIO[Unit]
  ): UIO[RenderedIllustrations] =
    config match {
      case None      => ZIO.succeed(RenderedIllustrations(markdown, 0, Nil, 0.0))
      case Some(cfg) => render(markdown, outline, cfg, sys.env.getOrElse("OPENROUTER_IMAGES_URL", defaultUrl), progress)
    }

  private def render(
    markdown: String,
    outline: BookOutline,
    cfg: IllustrationConfig,
    url: String,
    progress: String => UIO[Unit]
  ): UIO[RenderedIllustrations] = {
    val blocks = block.findAllMatchIn(markdown).toList
    if (blocks.isEmpty) ZIO.succeed(RenderedIllustrations(markdown, 0, Nil, 0.0))
    else
      for {
        _       <- progress(s"Generating ${blocks.size} illustration(s) with ${cfg.model}")
        counter <- Ref.make(0)
        step     = (result: Either[String, Generated]) =>
                     counter.updateAndGet(_ + 1).flatMap(done => progress(s"Illustration $done of ${blocks.size} ${if (result.isRight) "ready" else "failed"}"))
        results <- generateAll(blocks.map(found => promptFor(found.group(1), outline, cfg.style)), cfg, url, step)
      } yield {
        val rebuilt = blocks.zip(results).foldRight(markdown) { case ((found, result), text) =>
          val replacement = result.fold(_ => "", image => imageMarkdown(found.group(3), image) + Option(found.group(2)).getOrElse(""))
          text.substring(0, found.start) + replacement + text.substring(found.end)
        }
        val images = results.collect { case Right(image) => image }
        RenderedIllustrations(rebuilt, images.size, results.collect { case Left(reason) => reason }, images.map(_.costUsd).sum)
      }
  }

  /** The first image that succeeds becomes the style reference for those after it, so the first ones run one at a time. */
  private def generateAll(
    prompts: List[String],
    cfg: IllustrationConfig,
    url: String,
    step: Either[String, Generated] => UIO[Unit]
  ): UIO[List[Either[String, Generated]]] = {
    def one(prompt: String, reference: Option[String]): UIO[Either[String, Generated]] =
      generate(prompt, reference, cfg, url).tap(step)

    prompts match {
      case Nil => ZIO.succeed(Nil)
      case _ if !cfg.useReference =>
        ZIO.foreachPar(prompts)(one(_, None)).withParallelism(parallelImages)
      case head :: rest =>
        one(head, None).flatMap {
          case first @ Right(image) =>
            val reference = referenceOf(image)
            ZIO.foreachPar(rest)(one(_, Some(reference))).withParallelism(parallelImages).map(first :: _)
          case failed =>
            generateAll(rest, cfg, url, step).map(failed :: _)
        }
    }
  }

  /** One retry, without the reference in case that is what the provider refused. */
  private def generate(prompt: String, reference: Option[String], cfg: IllustrationConfig, url: String): UIO[Either[String, Generated]] =
    attempt(prompt, reference, cfg, url).flatMap {
      case Left(failure) if failure.retryable || (reference.nonEmpty && !failure.billed) => attempt(prompt, None, cfg, url).map(_.left.map(_.reason))
      case result => ZIO.succeed(result.left.map(_.reason))
    }

  private def attempt(prompt: String, reference: Option[String], cfg: IllustrationConfig, url: String): UIO[Either[Failure, Generated]] =
    ZIO
      .attemptBlocking {
        val references = reference.map(data => List(ImageReference("image_url", ImageUrl(data))))
        val body = ImagesRequest(cfg.model, prompt, 1, cfg.aspectRatio, cfg.resolution, cfg.quality, references).toJson
        val request = HttpRequest.newBuilder()
          .uri(URI.create(url))
          .header("content-type", "application/json")
          .header("authorization", s"Bearer ${cfg.apiKey}")
          .timeout(Duration.ofMinutes(5))
          .POST(HttpRequest.BodyPublishers.ofString(body))
          .build()
        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        val status = response.statusCode()
        if (status < 200 || status >= 300)
          Left(Failure(s"HTTP $status: ${firstLine(response.body())}", !permanentStatuses(status)))
        else parsed(response.body())
      }
      .catchAll(error => ZIO.succeed(Left(Failure(firstLine(String.valueOf(error)), true))))

  private def parsed(raw: String): Either[Failure, Generated] =
    for {
      response <- raw.fromJson[ImagesResponse].left.map(error => Failure(s"unreadable response: ${firstLine(error)}", true))
      image    <- response.data.headOption.toRight(Failure("the response held no image", true))
      payload  <- image.b64_json.toRight(Failure("the response held no image data", true))
      bytes    <- Try(Base64.getDecoder.decode(payload.replaceAll("\\s", ""))).toEither.left.map(_ => Failure("the image data was not base64", true))
      mime      = image.media_type.map(_.trim.toLowerCase).getOrElse(sniffedMime(bytes))
      _        <- Either.cond(embeddable(mime), (), Failure(s"$mime images cannot be embedded in a book", retryable = false, billed = true))
    } yield {
      val compact = jpegOf(bytes, bookQuality, None).filter(_.length < bytes.length)
      Generated(
        mime = compact.fold(mime)(_ => "image/jpeg"),
        bytes = compact.getOrElse(bytes),
        costUsd = response.usage.flatMap(_.cost).getOrElse(0.0)
      )
    }

  private def sniffedMime(bytes: Array[Byte]): String =
    if (bytes.startsWith(Array(0x89, 'P', 'N', 'G').map(_.toByte))) "image/png"
    else if (bytes.startsWith(Array(0xff, 0xd8).map(_.toByte))) "image/jpeg"
    else if (bytes.length > 12 && new String(bytes, 8, 4, "ISO-8859-1") == "WEBP") "image/webp"
    else "application/octet-stream"

  private def promptFor(description: String, outline: BookOutline, style: String): String = {
    val look = Option(style.trim).filter(_.nonEmpty).getOrElse(s"One consistent illustration style suited to a ${outline.genre} book.")
    s"""Book illustration.
       |Style: $look
       |Subject: ${description.trim}
       |No text, letters, numbers, captions, borders or watermark in the image.""".stripMargin
  }

  private def imageMarkdown(caption: String, image: Generated): String = {
    val alt = Option(caption).map(_.replaceAll("[\\[\\]\\r\\n]", " ").trim).filter(_.nonEmpty).getOrElse("Illustration")
    s"![$alt](${dataUrl(image.mime, image.bytes)})"
  }

  private def dataUrl(mime: String, bytes: Array[Byte]): String =
    s"data:$mime;base64,${Base64.getEncoder.encodeToString(bytes)}"

  private def referenceOf(image: Generated): String =
    jpegOf(image.bytes, referenceQuality, Some(referenceSide)).fold(dataUrl(image.mime, image.bytes))(dataUrl("image/jpeg", _))

  /** Books embed their images, so a large PNG would weigh down every load and export. Formats the JVM
    * cannot read (WebP) return None and stay as they are. */
  private def jpegOf(bytes: Array[Byte], quality: Float, maxSide: Option[Int]): Option[Array[Byte]] =
    Try(Option(ImageIO.read(new ByteArrayInputStream(bytes)))).toOption.flatten.flatMap { source =>
      Try {
        val scale = maxSide.fold(1.0)(side => math.min(1.0, side.toDouble / math.max(source.getWidth, source.getHeight)))
        val width = math.max(1, (source.getWidth * scale).round.toInt)
        val height = math.max(1, (source.getHeight * scale).round.toInt)
        val flat = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB)
        val graphics = flat.createGraphics()
        graphics.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR)
        graphics.drawImage(source, 0, 0, width, height, Color.WHITE, null)
        graphics.dispose()
        encodeJpeg(flat, quality)
      }.toOption
    }

  private def encodeJpeg(image: BufferedImage, quality: Float): Array[Byte] = {
    val writer = ImageIO.getImageWritersByFormatName("jpeg").next()
    val out = new ByteArrayOutputStream()
    val stream = new MemoryCacheImageOutputStream(out)
    try {
      val params = writer.getDefaultWriteParam
      params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT)
      params.setCompressionQuality(quality)
      writer.setOutput(stream)
      writer.write(null, new IIOImage(image, null, null), params)
      stream.flush()
      out.toByteArray
    } finally {
      stream.close()
      writer.dispose()
    }
  }

  private def firstLine(text: String): String =
    text.linesIterator.map(_.trim).find(_.nonEmpty).getOrElse("no details").take(200)
}
