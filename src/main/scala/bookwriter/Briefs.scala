package bookwriter

object Briefs {

  private def authorNotesBlock(notes: List[String]): String =
    if (notes.isEmpty) "" else
      s"\n\nAUTHOR'S NOTES — the author asked that every chapter honor these directions:\n${notes.map(n => s"- $n").mkString("\n")}"

  /** Everything up to (and excluding) the final "write now" instruction. */
  private def chapterBody(
    outline: BookOutline,
    idx: Int,
    prevEnding: Option[String],
    cfg: Config,
    notes: List[String],
    revision: Option[String],
    withClosing: Boolean
  ): String = {
    val plan = outline.chapters
    val ch = plan(idx)
    val toc = plan.map(c => s"${c.number}. ${c.title} — ${c.synopsis}").mkString("\n")
    val prev = if (idx > 0) {
      val p = plan(idx - 1)
      s"\n\nPrevious chapter (${p.number}. ${p.title}): ${p.synopsis}"
    } else ""
    val ending = prevEnding.map { e =>
      s"\n\nCONTINUITY — the previous chapter ended with this passage:\n\"\"\"\n$e\n\"\"\"\n" +
      "Continue seamlessly from it; do not restate or repeat it."
    }.getOrElse("")
    val opening = if (idx == 0) "\n\nThis is the opening chapter: begin the book with a strong, engaging opening that hooks the reader." else ""
    val closing = if (withClosing && idx == plan.length - 1) "\n\nThis is the final chapter: bring the book to a satisfying close and resolve the main arc." else ""
    val rewrite = revision.map { r =>
      s"\n\nREVISION REQUEST — the author reviewed a previous draft of this chapter and asked:\n\"\"\"\n$r\n\"\"\"\n" +
      "Rewrite the full chapter incorporating this feedback."
    }.getOrElse("")

    s"""Book: "${outline.title}" (genre: ${outline.genre})
Premise: ${outline.premise}

FULL CHAPTER PLAN:
$toc

YOUR ASSIGNMENT — write Chapter ${ch.number}: "${ch.title}" in full.
Chapter synopsis: ${ch.synopsis}$prev$ending$opening$closing${authorNotesBlock(notes)}$rewrite"""
  }

  def editorInput(outline: BookOutline, chapters: List[WrittenChapter], cfg: Config): String = {
    val toc = chapters.map(c => s"${c.plan.number}. ${c.plan.title}").mkString("\n")
    val totalWords = chapters.map(_.wordCount).sum
    val manuscript =
      if (totalWords <= 30000)
        chapters.map(c => s"## Chapter ${c.plan.number}: ${c.plan.title}\n\n${c.text}").mkString("\n\n---\n\n")
      else
        chapters.map { c =>
          val head = c.text.split("\\s+").take(250).mkString(" ")
          s"## Chapter ${c.plan.number}: ${c.plan.title}\n\n$head ..."
        }.mkString("\n\n---\n\n")

    s"""Book: "${outline.title}" (genre: ${outline.genre})
Premise: ${outline.premise}

TABLE OF CONTENTS:
$toc

MANUSCRIPT:
$manuscript"""
  }

  def chapter(
    outline: BookOutline,
    idx: Int,
    prevEnding: Option[String],
    cfg: Config,
    notes: List[String] = Nil,
    revision: Option[String] = None
  ): String =
    chapterBody(outline, idx, prevEnding, cfg, notes, revision, withClosing = true) +
      s"""

Write only the chapter text now (markdown, about ${cfg.wordsPerChapter} words)."""

  /** Part 1 of a multi-segment chapter: same framing, but the chapter continues in later calls. */
  def chapterOpening(
    outline: BookOutline,
    idx: Int,
    prevEnding: Option[String],
    cfg: Config,
    notes: List[String],
    revision: Option[String],
    totalParts: Int
  ): String =
    chapterBody(outline, idx, prevEnding, cfg, notes, revision, withClosing = false) +
      s"""

This chapter will be written in $totalParts consecutive parts, appended in order. You are writing Part 1 of
about ${Config.wordsPerSegment} words. Write only Part 1 now (markdown): open the chapter and stop at a natural
hand-off point (mid-scene is fine); do NOT conclude the chapter here."""

  /** Parts 2..N of a multi-segment chapter: continue seamlessly from the text so far. */
  def chapterContinuation(
    outline: BookOutline,
    idx: Int,
    soFar: String,
    part: Int,
    totalParts: Int,
    cfg: Config,
    notes: List[String] = Nil
  ): String = {
    val ch = outline.chapters(idx)
    val tail = soFar.split("\\s+").filter(_.nonEmpty).takeRight(700).mkString(" ")
    val lastPart = part == totalParts
    val closing =
      if (lastPart && idx == outline.chapters.length - 1)
        "\n\nThis part also ends the book: bring the story to a satisfying close and resolve the main arc."
      else if (lastPart)
        "\n\nThis is the final part of the chapter: conclude the chapter naturally."
      else ""
    val partTarget = math.max(100, math.min(Config.wordsPerSegment, cfg.wordsPerChapter - (part - 1) * Config.wordsPerSegment))

    s"""Book: "${outline.title}" (genre: ${outline.genre})
Premise: ${outline.premise}

YOUR ASSIGNMENT — continue Chapter ${ch.number}: "${ch.title}" (Part $part of $totalParts).
Chapter synopsis: ${ch.synopsis}${authorNotesBlock(notes)}$closing

TEXT SO FAR (ends mid-chapter; continue EXACTLY from where it stops):
\"\"\"
... $tail
\"\"\"

Write ONLY the continuation now (markdown, about $partTarget more words toward the chapter's
${cfg.wordsPerChapter}-word target): pick up seamlessly where the text above stops. Do not repeat, restate or
re-summarize anything already written."""
  }
}
