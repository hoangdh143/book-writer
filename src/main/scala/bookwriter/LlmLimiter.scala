package bookwriter

import loki.engine.backend.{LLMBackend, LLMResponse, ToolResult}
import zio.{Semaphore, Task, Unsafe}

/** Holds a permit for the duration of each LLM call. Retries go back through `chat`,
  * so a call waiting out its retry backoff does not hold a permit. */
final class LimitedBackend(underlying: LLMBackend, permits: Semaphore) extends LLMBackend {

  def chat(
    model: String,
    system: String,
    messages: List[Map[String, Any]],
    tools: List[Map[String, Any]],
    maxTokens: Int = 8096
  ): Task[LLMResponse] =
    permits.withPermit(underlying.chat(model, system, messages, tools, maxTokens))

  def extendMessages(
    messages: List[Map[String, Any]],
    response: LLMResponse,
    toolResults: List[ToolResult]
  ): List[Map[String, Any]] =
    underlying.extendMessages(messages, response, toolResults)
}

/** The limit shared by every book on the server, so extra books queue for a slot
  * instead of hitting provider rate limits. */
object LlmLimiter {

  val defaultMax: Int = 4

  val max: Int = sys.env.get("LLM_MAX_CONCURRENCY").fold(defaultMax) { raw =>
    raw.trim.toIntOption.filter(_ >= 1).getOrElse {
      println(s"  ! LLM_MAX_CONCURRENCY must be a positive integer (got '$raw'); using $defaultMax")
      defaultMax
    }
  }

  val shared: Semaphore = Unsafe.unsafe(implicit unsafe => Semaphore.unsafe.make(max.toLong))
}
