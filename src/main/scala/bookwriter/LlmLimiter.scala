package bookwriter

import loki.engine.backend.{LLMBackend, LLMResponse, ToolResult}
import zio.json._
import zio.{Promise, Ref, Semaphore, Task, UIO, Unsafe, ZIO}
import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path, Paths, StandardCopyOption}
import scala.collection.immutable.Queue
import scala.util.control.NonFatal

/** Holds a slot for the duration of each LLM call. Retries go back through `chat`,
  * so a call waiting out its retry backoff does not hold a slot. */
final class LimitedBackend(underlying: LLMBackend, gate: LlmGate) extends LLMBackend {

  def chat(
    model: String,
    system: String,
    messages: List[Map[String, Any]],
    tools: List[Map[String, Any]],
    maxTokens: Int = 8096
  ): Task[LLMResponse] =
    gate.withPermit(underlying.chat(model, system, messages, tools, maxTokens))

  def extendMessages(
    messages: List[Map[String, Any]],
    response: LLMResponse,
    toolResults: List[ToolResult]
  ): List[Map[String, Any]] =
    underlying.extendMessages(messages, response, toolResults)
}

/** A first-come, first-served semaphore whose limit can change while calls are running.
  * Lowering the limit lets in-flight calls finish; no new call starts until usage is under it. */
final class LlmGate private[bookwriter] (state: Ref[LlmGate.State]) {
  import LlmGate.{State, Turn}

  def limit: UIO[Int] = state.get.map(_.limit)

  def setLimit(limit: Int): UIO[Unit] =
    state.modify(s => wake(s.copy(limit = limit))).flatMap(grant)

  def withPermit[R, E, A](effect: ZIO[R, E, A]): ZIO[R, E, A] =
    ZIO.uninterruptibleMask { restore =>
      Promise.make[Nothing, Unit].flatMap { turn =>
        state.modify { s =>
          if (s.inUse < s.limit) (true, s.copy(inUse = s.inUse + 1))
          else (false, s.copy(waiting = s.waiting.enqueue(turn)))
        }.flatMap { granted =>
          if (granted) ZIO.unit else restore(turn.await).onInterrupt(leave(turn))
        } *> restore(effect).ensuring(release)
      }
    }

  private def release: UIO[Unit] =
    state.modify(s => wake(s.copy(inUse = s.inUse - 1))).flatMap(grant)

  /** An interrupted waiter gives back its slot if it was granted one at the same moment. */
  private def leave(turn: Turn): UIO[Unit] =
    state.modify { s =>
      if (s.waiting.contains(turn)) (Nil, s.copy(waiting = s.waiting.filterNot(_ == turn)))
      else wake(s.copy(inUse = s.inUse - 1))
    }.flatMap(grant)

  private def wake(s: State): (List[Turn], State) =
    if (s.inUse < s.limit && s.waiting.nonEmpty) {
      val (turn, rest) = s.waiting.dequeue
      val (more, next) = wake(s.copy(inUse = s.inUse + 1, waiting = rest))
      (turn :: more, next)
    } else (Nil, s)

  private def grant(turns: List[Turn]): UIO[Unit] =
    ZIO.foreachDiscard(turns)(_.succeed(()))
}

object LlmGate {
  private type Turn = Promise[Nothing, Unit]

  private[bookwriter] final case class State(limit: Int, inUse: Int, waiting: Queue[Turn])
}

final case class LlmSettings(llmMaxConcurrency: Int) derives JsonCodec

/** The limit shared by every book on the server, so extra books queue for a slot
  * instead of hitting provider rate limits. A value saved from the web app's Settings
  * wins over LLM_MAX_CONCURRENCY, which only sets the starting value. */
object LlmLimiter {

  val minLimit: Int = 1
  val maxLimit: Int = 100
  val defaultLimit: Int = 4

  private val settingsFile: Path = Paths.get("output", "settings.json")

  def validate(limit: Int): Either[String, Int] =
    if (limit < minLimit || limit > maxLimit) Left(s"llmMaxConcurrency must be in $minLimit..$maxLimit (got $limit)")
    else Right(limit)

  private def savedLimit: Option[Int] =
    try {
      if (!Files.exists(settingsFile)) None
      else
        new String(Files.readAllBytes(settingsFile), StandardCharsets.UTF_8)
          .fromJson[LlmSettings]
          .flatMap(s => validate(s.llmMaxConcurrency)) match {
          case Right(limit) => Some(limit)
          case Left(error) =>
            println(s"  ! ignoring $settingsFile: $error")
            None
        }
    } catch {
      case NonFatal(e) =>
        println(s"  ! could not read $settingsFile: ${e.getMessage}")
        None
    }

  private def envLimit: Option[Int] =
    sys.env.get("LLM_MAX_CONCURRENCY").flatMap { raw =>
      val parsed = raw.trim.toIntOption.toRight(s"not a number: '$raw'").flatMap(validate)
      parsed.left.foreach(error => println(s"  ! ignoring LLM_MAX_CONCURRENCY: $error"))
      parsed.toOption
    }

  val gate: LlmGate = Unsafe.unsafe { implicit unsafe =>
    val initial = savedLimit.orElse(envLimit).getOrElse(defaultLimit)
    new LlmGate(Ref.unsafe.make(LlmGate.State(initial, 0, Queue.empty)))
  }

  private val saving: Semaphore = Unsafe.unsafe(implicit unsafe => Semaphore.unsafe.make(1L))

  /** Saves first, so a limit that took effect is never lost on restart. */
  def save(limit: Int): Task[Unit] =
    saving.withPermit {
      ZIO.attemptBlocking {
        Files.createDirectories(settingsFile.getParent)
        val temp = settingsFile.resolveSibling("settings.json.tmp")
        Files.write(temp, LlmSettings(limit).toJson.getBytes(StandardCharsets.UTF_8))
        Files.move(temp, settingsFile, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
      } *> gate.setLimit(limit)
    }
}
