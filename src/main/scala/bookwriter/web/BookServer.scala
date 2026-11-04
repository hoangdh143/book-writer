package bookwriter.web

import bookwriter.Config
import zio.http.{Body, Method, Request, Response, Routes, Status, handler}
import zio.{UIO, ZIO}
import java.nio.file.{Files, Path, Paths}

object BookServer {

  private val uiDist: Path = Paths.get("ui", "dist").toAbsolutePath.normalize

  private val contentTypes: Map[String, String] = Map(
    "html" -> "text/html; charset=utf-8",
    "js"   -> "text/javascript; charset=utf-8",
    "css"  -> "text/css; charset=utf-8",
    "json" -> "application/json",
    "svg"  -> "image/svg+xml",
    "png"  -> "image/png",
    "ico"  -> "image/x-icon",
    "map"  -> "application/json",
    "woff2" -> "font/woff2"
  )

  def serveForever(cfg: Config): ZIO[Any, Throwable, Unit] =
    BookRegistry.make.flatMap { registry =>
      ZIO.succeed(println(
        s"""book-writer server ready
           |  UI  : http://localhost:8080/
           |  API : http://localhost:8080/api/books
           |  ui dist: $uiDist""".stripMargin
      )) *>
        zio.http.Server.serve(ModelRoutes.routes ++ apiRoutes(registry) ++ staticRoutes)
          .provide(zio.http.Server.default)
          .unit
    }

  def apiRoutes(registry: BookRegistry): Routes[Any, Response] = BookRoutes.routes(registry)

  private def staticRoutes: Routes[Any, Response] =
    Routes(zio.http.RoutePattern.any -> handler((_: zio.http.Path, req: Request) => serveStatic(req)))

  private def serveStatic(req: Request): ZIO[Any, Nothing, Response] = {
    val path = String.valueOf(req.path)
    val cleaned = if (path.startsWith("/")) path.drop(1) else path
    if (cleaned.startsWith("api/")) notFoundJson
    else resolveFile(cleaned).fold(serveIndex)(serveFile)
  }

  private def resolveFile(cleaned: String): Option[Path] = {
    val relative = if (cleaned.isEmpty || cleaned == "/") "index.html" else cleaned
    val candidate = uiDist.resolve(relative).normalize
    val inside = candidate.startsWith(uiDist)
    val safe = !relative.contains("..")
    if (inside && safe && Files.isRegularFile(candidate)) Some(candidate)
    else None
  }

  private def serveFile(path: Path): UIO[Response] =
    ZIO.attempt {
      val name = path.getFileName.toString
      val ext = name.lastIndexOf('.') match {
        case i if i >= 0 && i < name.length - 1 => name.substring(i + 1).toLowerCase
        case _                                  => ""
      }
      val contentType = contentTypes.getOrElse(ext, "application/octet-stream")
      Response(Status.Ok, zio.http.Headers("content-type" -> contentType), Body.fromCharSequence(Files.readString(path)))
    }.orDie

  private def serveIndex: UIO[Response] =
    serveFile(uiDist.resolve("index.html")).catchAllDefect { _ =>
      ZIO.succeed(Response(
        Status.NotFound,
        zio.http.Headers("content-type" -> "text/plain; charset=utf-8"),
        Body.fromCharSequence(
          "UI not found. Build it first: cd ui && npm install && npm run build (expected at ui/dist)."
        )
      ))
    }

  private def notFoundJson: UIO[Response] =
    ZIO.succeed(Response(
      Status.NotFound,
      zio.http.Headers("content-type" -> "application/json"),
      Body.fromCharSequence("{\"error\":\"not found\"}")
    ))
}
