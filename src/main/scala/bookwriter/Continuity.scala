package bookwriter

import java.util.concurrent.atomic.AtomicReference
import loki.engine.core.nodes.AgentNode
import zio.json.JsonCodec

/** What one finished chapter established, as read back from its final text. */
final case class LedgerEntry(chapter: Int, summary: String, facts: List[String]) derives JsonCodec

/** A contradiction found in a group of chapters. It names the chapter that has to change. */
final case class ContinuityIssue(chapter: Int, problem: String, fix: String) derives JsonCodec

/** The result of reading a group of chapters. A failed read leaves the drafts as they are. */
final case class ContinuityReport(
  entries: List[LedgerEntry] = Nil,
  issues: List[ContinuityIssue] = Nil,
  failure: Option[String] = None
)

/** The shared facts every writing call receives, so consistency no longer depends on which
  * earlier chapters happen to fit in the engine's context selection. Saved with the session. */
final case class ContinuityMemory(bible: String = "", ledger: List[LedgerEntry] = Nil) derives JsonCodec {

  def withEntries(entries: List[LedgerEntry]): ContinuityMemory = {
    val replaced = entries.map(_.chapter).toSet
    copy(ledger = (ledger.filterNot(e => replaced(e.chapter)) ++ entries).sortBy(_.chapter))
  }

  /** The block added to a writing call. Only chapters in `written` are described, so a draft
    * that was revised or rejected never reaches later chapters. */
  def forWriter(written: List[WrittenChapter], scholar: Boolean): String = {
    val guide = ContinuityMemory.clip(bible, ContinuityMemory.maxBibleWords)
    val name = if (scholar) "CONSISTENCY GUIDE" else "STORY BIBLE"
    val guideBlock =
      if (guide.isEmpty) ""
      else s"$name (authoritative; follow it exactly):\n\"\"\"\n$guide\n\"\"\"\n\n"
    val entries = written.sortBy(_.plan.number).map(wc => wc -> entryFor(wc))
    val soFar = ContinuityMemory.ledgerLines(entries)
    val soFarName = if (scholar) "THE PAPER SO FAR" else "THE STORY SO FAR"
    val soFarBlock =
      if (soFar.isEmpty) ""
      else s"$soFarName (what the finished chapters actually established; never contradict it):\n$soFar\n\n"
    guideBlock + soFarBlock
  }

  private def entryFor(wc: WrittenChapter): LedgerEntry =
    ledger.find(_.chapter == wc.plan.number).getOrElse(
      LedgerEntry(wc.plan.number, s"${wc.plan.synopsis} It ended: ${wc.endingExcerpt(300)}", Nil)
    )
}

object ContinuityMemory {
  private val maxBibleWords = 2500
  private val maxLedgerWords = 3000

  private def words(text: String): Int = text.split("\\s+").count(_.nonEmpty)

  private def clip(text: String, maxWords: Int): String = {
    val trimmed = text.trim
    if (words(trimmed) <= maxWords) trimmed
    else trimmed.split("(?<=\\s)").filter(_.trim.nonEmpty).take(maxWords).mkString.trim + " ..."
  }

  /** Keeps the newest chapters in full. Over budget, older chapters keep only their summary. */
  private def ledgerLines(entries: List[(WrittenChapter, LedgerEntry)]): String = {
    val kept = entries.foldRight((maxLedgerWords, List.empty[String])) { case ((wc, entry), (left, lines)) =>
      val summary = s"Chapter ${entry.chapter} (${wc.plan.title}): ${entry.summary}"
      val full = (summary :: entry.facts.map(fact => s"- $fact")).mkString("\n")
      if (words(full) <= left) (left - words(full), full :: lines)
      else if (words(summary) <= left) (left - words(summary), summary :: lines)
      else (left, lines)
    }
    kept._2.mkString("\n")
  }
}

/** Collects the story bible via the `record_story_bible` tool call. */
final class BibleSink {
  private val bible = new AtomicReference[String]("")

  def reset(): Unit = bible.set("")

  def record(input: Any): String = {
    val text = Values.str(Values.asMap(input), "text")
    if (text.isEmpty) "Error: 'text' is required and must be a non-empty string."
    else {
      bible.set(text)
      s"Recorded the guide (${text.length} characters)."
    }
  }

  def text: String = bible.get()
}

/** Collects what the ContinuityEditor reads from a group of chapters. */
final class ContinuitySink {
  private val entries = new AtomicReference[Vector[LedgerEntry]](Vector.empty)
  private val problems = new AtomicReference[Vector[ContinuityIssue]](Vector.empty)

  def reset(): Unit = {
    entries.set(Vector.empty)
    problems.set(Vector.empty)
  }

  def recordFacts(input: Any): String = {
    val m = Values.asMap(input)
    val summary = Values.str(m, "summary")
    val facts = m.get("facts").toList.flatMap {
      case list: List[?] => list.map(item => String.valueOf(item).trim)
      case other         => String.valueOf(other).linesIterator.map(_.trim.stripPrefix("- ")).toList
    }.filter(_.nonEmpty)
    Values.int(m, "chapter") match {
      case None                     => "Error: 'chapter' (integer) is required."
      case Some(_) if summary.isEmpty => "Error: 'summary' is required and must be a non-empty string."
      case Some(n)                  =>
        entries.updateAndGet(_.filterNot(_.chapter == n) :+ LedgerEntry(n, summary, facts))
        s"Recorded chapter $n (${facts.size} fact(s))."
    }
  }

  def recordIssue(input: Any): String = {
    val m = Values.asMap(input)
    val problem = Values.str(m, "problem")
    val fix = Values.str(m, "fix")
    Values.int(m, "chapter") match {
      case None                     => "Error: 'chapter' (integer) is required."
      case Some(_) if problem.isEmpty => "Error: 'problem' is required and must be a non-empty string."
      case Some(n)                  =>
        problems.updateAndGet(_ :+ ContinuityIssue(n, problem, fix))
        s"Recorded an issue for chapter $n."
    }
  }

  def ledger: List[LedgerEntry] = entries.get().toList
  def issues: List[ContinuityIssue] = problems.get().toList
}

/** The agents that keep a book consistent, plus their tool-call sinks. */
final case class ContinuityGraph(
  bibleWriter: AgentNode,
  editor: AgentNode,
  bibleSink: BibleSink,
  sink: ContinuitySink
)
