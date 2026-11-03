package bookwriter

object Briefs {

  def chapter(
    outline: BookOutline,
    idx: Int,
    prevEnding: Option[String],
    cfg: Config,
    notes: List[String] = Nil,
    revision: Option[String] = None
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
    val closing = if (idx == plan.length - 1) "\n\nThis is the final chapter: bring the book to a satisfying close and resolve the main arc." else ""
    val authorNotes = if (notes.isEmpty) "" else
      s"\n\nAUTHOR'S NOTES — the author asked that every chapter honor these directions:\n${notes.map(n => s"- $n").mkString("\n")}"
    val rewrite = revision.map { r =>
      s"\n\nREVISION REQUEST — the author reviewed a previous draft of this chapter and asked:\n\"\"\"\n$r\n\"\"\"\n" +
      "Rewrite the full chapter incorporating this feedback."
    }.getOrElse("")

    s"""Book: "${outline.title}" (genre: ${outline.genre})
Premise: ${outline.premise}

FULL CHAPTER PLAN:
$toc

YOUR ASSIGNMENT — write Chapter ${ch.number}: "${ch.title}" in full.
Chapter synopsis: ${ch.synopsis}$prev$ending$opening$closing$authorNotes$rewrite

Write only the chapter text now (markdown, about ${cfg.wordsPerChapter} words)."""
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
}
