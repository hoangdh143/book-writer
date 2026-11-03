package bookwriter.probe

import bookwriter.Config
import bookwriter.web.BookRegistry
import zio._

object SessionProbe extends ZIOAppDefault {

  def run: ZIO[ZIOAppArgs, Any, Any] =
    for {
      _ <- probeForkJoin
      registry <- BookRegistry.make
      cfg = Config(
        prompt = "A graphic-novel style story about a courier navigating a city of rooftops",
        chapters = 2,
        wordsPerChapter = 400,
        apiKey = sys.env.getOrElse("DEEPSEEK_API_KEY", "")
      )
      session <- registry.create(cfg)
      _       <- ZIO.succeed(println(s"created ${session.id}"))
      _       <- poll(session.id, registry, 20)
      dto     <- registry.get(session.id).flatMap(_.dto)
      _       <- ZIO.succeed(println(s"final status: ${dto.status}"))
      _       <- ZIO.succeed(dto.events.foreach(e => println(s"  ${e.at} ${e.message}")))
    } yield ()

  private def probeForkJoin: UIO[Unit] =
    (ZIO.succeed(println("[iso] fiber alive, sleeping...")) *>
      ZIO.sleep(2.seconds) *>
      ZIO.succeed(println("[iso] fiber done")))
      .fork
      .flatMap(fiber => fiber.join) *>
      ZIO.succeed(println("[iso] await complete"))

  private def poll(id: String, registry: BookRegistry, times: Int): ZIO[Any, String | Throwable, Unit] =
    if (times <= 0) ZIO.unit
    else
      for {
        _   <- ZIO.sleep(6.seconds)
        dto <- registry.get(id).flatMap(_.dto)
        _   <- ZIO.succeed(println(s"[poll] ${dto.status} events=${dto.events.map(_.message).mkString(" | ")}"))
        _   <- if (dto.status == "planning") poll(id, registry, times - 1) else ZIO.unit
      } yield ()
}

