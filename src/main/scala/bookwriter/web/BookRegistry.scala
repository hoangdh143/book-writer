package bookwriter.web

import bookwriter.Config
import zio.{Ref, UIO, IO, ZIO, Exit}

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
      case Some(s) => s.interrupt *> SessionStore.delete(id)
      case None    => ZIO.fail(s"no book with id '$id'")
    }
}

object BookRegistry {

  def make: UIO[BookRegistry] =
    for {
      ref      <- Ref.make(Map.empty[String, BookSession])
      persisted <- SessionStore.loadAll
      restored <- ZIO.foldLeft(persisted)(List.empty[BookSession]) { (acc, p) =>
        BookSession.restore(p).exit.flatMap {
          case Exit.Success(session) => ZIO.succeed(acc :+ session)
          case Exit.Failure(cause)   =>
            ZIO.succeed {
              println(s"  ! could not restore book '${p.id}': ${String.valueOf(cause.squash.getMessage)}")
              acc
            }
        }
      }
      _        <- ref.update(m => restored.map(s => s.id -> s).toMap ++ m)
      _        <- ZIO.succeed(
        if restored.nonEmpty then println(s"  restored ${restored.size} book session(s) from disk") else ()
      )
    } yield new BookRegistry(ref)
}
