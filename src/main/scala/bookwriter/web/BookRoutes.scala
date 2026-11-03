package bookwriter.web

import bookwriter.Config
import zio.http.{Body, Headers, Method, Request, Response, Routes, Status, handler, string}
import zio.json._
import zio.ZIO

object BookRoutes {

  private val jsonHeaders = Headers("content-type" -> "application/json")

  def routes(registry: BookRegistry): Routes[Any, Response] =
    Routes(
      Method.GET / "api" / "health" -> handler((_: Request) => ZIO.succeed(json(Status.Ok, HealthDto().toJson))),
      Method.GET / "api" / "analyze" -> handler((_: Request) => ZIO.succeed(json(Status.Ok, HealthDto().toJson))),
      Method.GET / "api" / "books" -> handler((_: Request) => listBooks(registry)),
      Method.POST / "api" / "books" -> handler((req: Request) => createBook(registry, req)),
      Method.GET / "api" / "books" / string("id") -> handler((id: String, _: Request) => withSession(registry, id)(_.dto.map(b => json(Status.Ok, b.toJson)))),
      Method.DELETE / "api" / "books" / string("id") -> handler((id: String, _: Request) => withSession(registry, id)(removeBook(registry, id))),
      Method.GET / "api" / "books" / string("id") / "markdown" -> handler((id: String, _: Request) => withSession(registry, id)(bookMarkdown)),
      Method.GET / "api" / "books" / string("id") / "chapters" / string("n") -> handler((id: String, n: String, _: Request) => withSession(registry, id)(chapterText(n))),
      Method.POST / "api" / "books" / string("id") / "toc" / "approve" -> handler((id: String, req: Request) => withSession(registry, id)(s => decode[TocApproveRequest](req).flatMap(body => action(s, s.approveToc(body))))),
      Method.POST / "api" / "books" / string("id") / "toc" / "revise" -> handler((id: String, req: Request) => withSession(registry, id)(s => decode[TocReviseRequest](req).flatMap(body => action(s, s.reviseToc(body))))),
      Method.POST / "api" / "books" / string("id") / "chapters" / "approve-rest" -> handler((id: String, req: Request) => withSession(registry, id)(s => decode[ApproveRestRequest](req).flatMap(body => action(s, s.approveRest(body.comment))))),
      Method.POST / "api" / "books" / string("id") / "chapters" / string("n") / "approve" -> handler((id: String, n: String, req: Request) => withSession(registry, id)(s => decode[ChapterApproveRequest](req).flatMap(body => chapterAction(s, n, _.approveChapter(_, body.comment))))),
      Method.POST / "api" / "books" / string("id") / "chapters" / string("n") / "revise" -> handler((id: String, n: String, req: Request) => withSession(registry, id)(s => decode[ChapterReviseRequest](req).flatMap(body => chapterAction(s, n, _.reviseChapter(_, body.comment)))))
    )

  // ---- handlers ---------------------------------------------------------------

  private def listBooks(registry: BookRegistry): ZIO[Any, Response, Response] =
    registry.list
      .flatMap(entries => ZIO.foreach(entries)(_.listItem))
      .map(items => json(Status.Ok, items.toJson))

  private def createBook(registry: BookRegistry, req: Request): ZIO[Any, Response, Response] =
    decode[CreateBookRequest](req).flatMap { body =>
      ZIO
        .fromEither(Config.fromRequest(body))
        .flatMap(cfg => registry.create(cfg).map(s => json(Status.Created, CreatedDto(s.id).toJson)))
        .catchAll(e => ZIO.fail(json(Status.BadRequest, ApiErrorDto(e).toJson)))
    }

  private def removeBook(registry: BookRegistry, id: String)(session: BookSession): ZIO[Any, Response, Response] =
    session.interrupt
      .zipRight(registry.remove(id))
      .map(_ => json(Status.Ok, OkDto().toJson))
      .catchAll(e => ZIO.fail(json(Status.NotFound, ApiErrorDto(e).toJson)))

  private def bookMarkdown(session: BookSession): ZIO[Any, Response, Response] =
    session.dto.flatMap { dto =>
      dto.markdown match {
        case Some(md) if dto.status == "completed" =>
          ZIO.succeed(Response(Status.Ok, Headers("content-type" -> "text/markdown"), Body.fromCharSequence(md)))
        case _ =>
          ZIO.fail(json(Status.Conflict, ApiErrorDto(s"book is ${dto.status}; markdown is only available when completed").toJson))
      }
    }

  private def chapterText(n: String)(session: BookSession): ZIO[Any, Response, Response] =
    chapterNumber(n).flatMap { num =>
      session.chapterText(num).map {
        case Some(t) => json(Status.Ok, t.toJson)
        case None    => json(Status.NotFound, ApiErrorDto(s"chapter $num has no text yet").toJson)
      }
    }

  private def chapterNumber(raw: String): ZIO[Any, Response, Int] =
    ZIO.fromEither(
      raw.trim.toIntOption.toRight(json(Status.BadRequest, ApiErrorDto(s"'$raw' is not a chapter number").toJson))
    )

  // ---- combinators ---------------------------------------------------------------

  private def action(session: BookSession, effect: zio.IO[String, Unit]): ZIO[Any, Response, Response] =
    effect
      .map(_ => json(Status.Ok, OkDto().toJson))
      .catchAll(e => ZIO.fail(json(Status.Conflict, ApiErrorDto(e).toJson)))

  private def chapterAction(
    session: BookSession,
    n: String,
    use: (BookSession, Int) => zio.IO[String, Unit]
  ): ZIO[Any, Response, Response] =
    chapterNumber(n).flatMap(num => action(session, use(session, num)))

  private def withSession(
    registry: BookRegistry,
    id: String
  )(use: BookSession => ZIO[Any, Response, Response]): ZIO[Any, Response, Response] =
    registry.get(id).flatMap(use).catchAll {
      case r: Response => ZIO.fail(r)
      case other       => ZIO.fail(json(Status.NotFound, ApiErrorDto(String.valueOf(other)).toJson))
    }

  private def decode[A: JsonDecoder](req: Request): ZIO[Any, Response, A] =
    req.body.asString
      .flatMap(raw => ZIO.fromEither(raw.fromJson[A]))
      .catchAll(e => ZIO.fail(json(Status.BadRequest, ApiErrorDto(s"invalid request: $e").toJson)))

  private def json(status: Status, body: String): Response =
    Response(status, jsonHeaders, Body.fromCharSequence(body))
}
