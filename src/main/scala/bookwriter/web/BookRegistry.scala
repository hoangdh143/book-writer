package bookwriter.web

import bookwriter.Config
import zio.{Ref, UIO, IO, ZIO}

final class BookRegistry private (ref: Ref[Map[String, BookSession]]) {

  def create(cfg: Config): UIO[BookSession] =
    for {
      session <- BookSession.make(cfg)
      _       <- ref.update(_.updated(session.id, session))
      _       <- session.start()
    } yield session

  def get(id: String): IO[String, BookSession] =
    ref.get.flatMap(m => ZIO.fromEither(m.get(id).toRight(s"no book with id '$id'")))

  def list: UIO[List[BookSession]] =
    ref.get.map(_.values.toList.sortBy(_.id).reverse)

  def remove(id: String): IO[String, Unit] =
    ref.modify { m =>
      m.get(id) match {
        case Some(s) => (Some(s), m.removed(id))
        case None    => (None, m)
      }
    }.flatMap {
      case Some(s) => s.interrupt
      case None    => ZIO.fail(s"no book with id '$id'")
    }
}

object BookRegistry {
  def make: UIO[BookRegistry] = Ref.make(Map.empty[String, BookSession]).map(new BookRegistry(_))
}

