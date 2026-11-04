package bookwriter.web

import zio.http.{Body, Headers, Method, Request, Response, Routes, Status, handler}
import zio.json._
import zio.ZIO
import java.net.URI
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.time.Duration

object ModelRoutes {

  private val jsonHeaders = Headers("content-type" -> "application/json")

  private val lmStudioBase =
    sys.env.getOrElse("LM_STUDIO_BASE_URL", "http://localhost:1234/v1").stripSuffix("/")

  private case class LmStudioModel(id: String) derives JsonCodec
  private case class LmStudioModelsResponse(data: List[LmStudioModel]) derives JsonCodec

  private val httpClient: HttpClient =
    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()

  def routes: Routes[Any, Response] =
    Routes(
      Method.GET / "api" / "models" / "lmstudio" -> handler((_: Request) => listLmStudio)
    )

  private def listLmStudio: ZIO[Any, Nothing, Response] =
    fetchModels
      .map(models => json(Status.Ok, LmStudioModelsDto(models.map(m => LmStudioModelDto(m.id))).toJson))
      .catchAll(e => ZIO.succeed(json(Status.ServiceUnavailable, ApiErrorDto(unreachableMessage(e)).toJson)))

  private def unreachableMessage(e: Throwable): String =
    s"LM Studio not reachable at $lmStudioBase (${Option(e.getMessage).getOrElse(e.toString)})"

  private def fetchModels: ZIO[Any, Throwable, List[LmStudioModel]] =
    ZIO.attemptBlocking {
      val request = HttpRequest.newBuilder()
        .uri(URI.create(s"$lmStudioBase/models"))
        .timeout(Duration.ofSeconds(3))
        .GET()
        .build()
      val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
      if (response.statusCode() != 200) throw new RuntimeException(s"HTTP ${response.statusCode()}")
      parse(response.body())
    }

  private def parse(raw: String): List[LmStudioModel] =
    raw.fromJson[LmStudioModelsResponse] match {
      case Left(err)     => throw new RuntimeException(s"invalid model list: $err")
      case Right(parsed) => parsed.data
    }

  private def json(status: Status, body: String): Response =
    Response(status, jsonHeaders, Body.fromCharSequence(body))
}
