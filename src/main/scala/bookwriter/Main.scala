package bookwriter

import zio.{ExitCode, UIO, ZIO, ZIOAppArgs, ZIOAppDefault}

object Main extends ZIOAppDefault {

  def run: ZIO[ZIOAppArgs, Any, ExitCode] =
    ZIO.succeed(sys.props.put("ygg.token.escalation.cap", "8192")) *>
      ZIO.serviceWithZIO[ZIOAppArgs] { appArgs =>
        Config.parse(appArgs.getArgs.toList) match {
          case Left(msg) =>
            ZIO.succeed(println(msg)).as(ExitCode.failure)
          case Right(cfg) =>
            (if (cfg.serve) bookwriter.web.BookServer.serveForever(cfg) else BookPipeline.run(cfg))
              .foldZIO(
                e => fail(cfg, e).as(ExitCode.failure),
                _ => ZIO.succeed(ExitCode.success)
              )
        }
      }

  private def fail(cfg: Config, t: Throwable): UIO[Unit] = ZIO.succeed {
    println(s"\nERROR: ${Option(t.getMessage).getOrElse(t.toString)}")
    if (cfg.debug) t.printStackTrace()
  }
}
