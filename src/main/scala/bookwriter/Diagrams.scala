package bookwriter

import java.net.URI
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.time.Duration
import java.util.Base64
import scala.util.matching.Regex
import zio.{UIO, ZIO}

/** The assembled book after rendering, with the reason for each diagram left as source text. */
final case class RenderedDiagrams(markdown: String, rendered: Int, failures: List[String])

/** Replaces the diagram code blocks of an assembled book with embedded PNGs rendered by Kroki.
  * Chapter text keeps the source, so revisions never feed image data back to the model. */
object Diagrams {

  private val defaultUrl = "http://localhost:8000"
  private val parallelRenders = 4
  private val pngSignature = Array(0x89, 'P', 'N', 'G').map(_.toByte)

  private val block: Regex =
    """(?ms)^```(mermaid|graphviz)[ \t]*\r?$\n?(.*?)^```[ \t]*\r?$(?=(?:\s*\*Figure:\s*([^*\n]+)\*)?)""".r

  private val httpClient: HttpClient =
    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()

  def renderBook(markdown: String, enabled: Boolean): UIO[RenderedDiagrams] =
    if (enabled) render(markdown, sys.env.getOrElse("KROKI_URL", defaultUrl))
    else ZIO.succeed(RenderedDiagrams(markdown, 0, Nil))

  def render(markdown: String, krokiUrl: String): UIO[RenderedDiagrams] = {
    val blocks = block.findAllMatchIn(markdown).toList
    ZIO
      .foreachPar(blocks)(found => renderBlock(krokiUrl, found.group(1), found.group(2)))
      .withParallelism(parallelRenders)
      .map { results =>
        val images = blocks.zip(results).collect { case (found, Right(png)) => found -> png }
        val rebuilt = images.foldRight(markdown) { case ((found, png), text) =>
          text.substring(0, found.start) + imageMarkdown(found.group(3), png) + text.substring(found.end)
        }
        RenderedDiagrams(rebuilt, images.size, results.collect { case Left(reason) => reason })
      }
  }

  private def imageMarkdown(caption: String, png: Array[Byte]): String = {
    val alt = Option(caption).map(_.replaceAll("[\\[\\]\\r\\n]", " ").trim).filter(_.nonEmpty).getOrElse("Diagram")
    s"![$alt](data:image/png;base64,${Base64.getEncoder.encodeToString(png)})"
  }

  private def renderBlock(krokiUrl: String, kind: String, source: String): UIO[Either[String, Array[Byte]]] =
    ZIO
      .attemptBlocking {
        val request = HttpRequest.newBuilder()
          .uri(URI.create(s"${krokiUrl.stripSuffix("/")}/$kind/png"))
          .header("content-type", "text/plain")
          .timeout(Duration.ofMinutes(1))
          .POST(HttpRequest.BodyPublishers.ofString(source))
          .build()
        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray())
        if (response.statusCode() != 200)
          Left(s"HTTP ${response.statusCode()}: ${firstLine(new String(response.body(), "UTF-8"))}")
        else if (!response.body().startsWith(pngSignature)) Left("Kroki did not return a PNG")
        else Right(response.body())
      }
      .catchAll(error => ZIO.succeed(Left(firstLine(String.valueOf(error)))))

  private def firstLine(text: String): String =
    text.linesIterator.map(_.trim).find(_.nonEmpty).getOrElse("no details").take(160)
}
