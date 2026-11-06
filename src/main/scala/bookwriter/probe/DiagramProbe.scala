package bookwriter.probe

import bookwriter.Diagrams
import zio._

/** Smoke test against a running Kroki: one block of each kind, plus one that must fail. */
object DiagramProbe extends ZIOAppDefault {

  private val sample =
    """Intro.
      |
      |```mermaid
      |graph TD; A-->B;
      |```
      |
      |*Figure: Two steps*
      |
      |```graphviz
      |digraph G { A -> B }
      |```
      |
      |```mermaid
      |this is not a diagram
      |```
      |
      |```scala
      |val untouched = 1
      |```
      |""".stripMargin

  def run: ZIO[ZIOAppArgs, Any, Any] =
    Diagrams.renderBook(sample, enabled = true).flatMap { result =>
      val shortened = result.markdown.replaceAll("base64,[A-Za-z0-9+/=]+", "base64,...")
      Console.printLine(s"rendered=${result.rendered} failures=${result.failures}\n$shortened")
    }
}
