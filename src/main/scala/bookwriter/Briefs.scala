package bookwriter

object Briefs {

  private def authorNotesBlock(notes: List[String]): String =
    if (notes.isEmpty) "" else
      s"\n\nAUTHOR'S NOTES — the author asked that every chapter honor these directions:\n${notes.map(n => s"- $n").mkString("\n")}"

  /** Numbered reference list shown to the scholar writer with every assignment. */
  private def referencesBlock(refs: List[Reference]): String =
    if (refs.isEmpty) "" else
      s"\n\nREFERENCE LIST (cite ONLY these, by bracketed number):\n${refs.map(_.format).mkString("\n")}"

  /** The idea as the author wrote it. Only the planners read it otherwise, so directions about
    * language or layout (a bilingual parallel text, say) would never reach the writer. */
  private def requestBlock(cfg: Config): String =
    if (cfg.prompt.trim.isEmpty) "" else
      s"""

THE AUTHOR'S REQUEST (the book idea as the author wrote it; follow every direction it gives about language,
format, layout or style in every paragraph you write):
\"\"\"
${cfg.prompt.trim}
\"\"\""""

  private def draftBlock(draft: Option[String]): String =
    draft.fold("") { d =>
      s"\n\nCURRENT DRAFT (revise this; keep whatever the request does not touch):\n\"\"\"\n${d.trim}\n\"\"\""
    }

  /** The last `n` words of `text` with its line breaks intact. The writer copies the layout of the
    * text it continues, so flattening it here made the continuation one unbroken paragraph. */
  private def lastWords(text: String, n: Int): String = {
    val starts = "\\S+".r.findAllMatchIn(text).map(_.start).toVector
    (if (starts.length <= n) text else text.substring(starts(starts.length - n))).trim
  }

  /** Repeated in the final instruction, where it is hardest to overlook. */
  private val formatReminder: String = ", in exactly the language and layout THE AUTHOR'S REQUEST asks for"

  /** Everything up to (and excluding) the final "write now" instruction. */
  private def chapterBody(
    outline: BookOutline,
    idx: Int,
    prevEnding: Option[String],
    cfg: Config,
    notes: List[String],
    revision: Option[String],
    withClosing: Boolean,
    refs: List[Reference] = Nil,
    memory: String = "",
    draft: Option[String] = None
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
    }.getOrElse("") + draftBlock(draft)

    s"""Book: "${outline.title}" (genre: ${outline.genre})
Premise: ${outline.premise}${requestBlock(cfg)}

FULL CHAPTER PLAN:
$toc

${memory}YOUR ASSIGNMENT — write Chapter ${ch.number}: "${ch.title}" in full.
Chapter synopsis: ${ch.synopsis}$prev$ending$opening$closing${authorNotesBlock(notes)}$rewrite${referencesBlock(refs)}"""
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
Premise: ${outline.premise}${requestBlock(cfg)}

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
    revision: Option[String] = None,
    refs: List[Reference] = Nil,
    memory: String = "",
    draft: Option[String] = None
  ): String =
    chapterBody(outline, idx, prevEnding, cfg, notes, revision, withClosing = true, refs = refs, memory = memory, draft = draft) +
      s"""

Write only the chapter text now (markdown, about ${cfg.wordsPerChapter} words)$formatReminder."""

  /** Part 1 of a multi-segment chapter: same framing, but the chapter continues in later calls. */
  def chapterOpening(
    outline: BookOutline,
    idx: Int,
    prevEnding: Option[String],
    cfg: Config,
    notes: List[String],
    revision: Option[String],
    totalParts: Int,
    refs: List[Reference] = Nil,
    memory: String = "",
    draft: Option[String] = None
  ): String =
    chapterBody(outline, idx, prevEnding, cfg, notes, revision, withClosing = false, refs = refs, memory = memory, draft = draft) +
      s"""

This chapter will be written in $totalParts consecutive parts, appended in order. You are writing Part 1 of
about ${Config.wordsPerSegment} words. Write only Part 1 now (markdown$formatReminder): open the chapter and stop at a natural
hand-off point (mid-scene is fine); do NOT conclude the chapter here."""

  /** Parts 2..N of a multi-segment chapter: continue seamlessly from the text so far. */
  def chapterContinuation(
    outline: BookOutline,
    idx: Int,
    soFar: String,
    part: Int,
    totalParts: Int,
    cfg: Config,
    notes: List[String] = Nil,
    refs: List[Reference] = Nil,
    memory: String = "",
    revision: Option[String] = None,
    draft: Option[String] = None
  ): String = {
    val ch = outline.chapters(idx)
    val rewrite = revision.fold("")(r => s"\n\nREVISION REQUEST — apply this to the whole chapter:\n\"\"\"\n$r\n\"\"\"") + draftBlock(draft)
    val tail = lastWords(soFar, 700)
    val lastPart = part == totalParts
    val closing =
      if (lastPart && idx == outline.chapters.length - 1)
        "\n\nThis part also ends the book: bring the story to a satisfying close and resolve the main arc."
      else if (lastPart)
        "\n\nThis is the final part of the chapter: conclude the chapter naturally."
      else ""
    val partTarget = math.max(100, math.min(Config.wordsPerSegment, cfg.wordsPerChapter - (part - 1) * Config.wordsPerSegment))

    s"""Book: "${outline.title}" (genre: ${outline.genre})
Premise: ${outline.premise}${requestBlock(cfg)}

${memory}YOUR ASSIGNMENT — continue Chapter ${ch.number}: "${ch.title}" (Part $part of $totalParts).
Chapter synopsis: ${ch.synopsis}${authorNotesBlock(notes)}$closing$rewrite${referencesBlock(refs)}

TEXT SO FAR (ends mid-chapter; continue EXACTLY from where it stops):
\"\"\"
... $tail
\"\"\"

Write ONLY the continuation now (markdown$formatReminder, about $partTarget more words toward the chapter's
${cfg.wordsPerChapter}-word target): pick up seamlessly where the text above stops. Do not repeat, restate or
re-summarize anything already written."""
  }

  // ---- continuity briefs ------------------------------------------------------

  def bibleInput(outline: BookOutline, cfg: Config, notes: List[String]): String =
    s"""Book: "${outline.title}" (genre: ${outline.genre})
Premise: ${outline.premise}

THE AUTHOR'S REQUEST:
${cfg.prompt}

APPROVED CHAPTER PLAN:
${outline.chapters.map(c => s"${c.number}. ${c.title} — ${c.synopsis}").mkString("\n")}${authorNotesBlock(notes)}

Write and record the guide now."""

  def continuityInput(
    outline: BookOutline,
    memory: String,
    before: Option[WrittenChapter],
    group: List[WrittenChapter],
    check: Boolean
  ): String = {
    val preceding = before.fold("") { wc =>
      s"THE CHAPTER BEFORE THIS GROUP (${wc.plan.number}. ${wc.plan.title}) ENDED WITH:\n\"\"\"\n${wc.endingExcerpt()}\n\"\"\"\n\n"
    }
    val chapters = group.map(c => s"## Chapter ${c.plan.number}: ${c.plan.title}\n\n${c.text.trim}").mkString("\n\n---\n\n")
    val numbers = group.map(_.plan.number).mkString(", ")
    val task =
      if (check) s"Call `record_chapter_facts` for chapters $numbers, and `record_issue` for every real contradiction."
      else s"Call `record_chapter_facts` for chapter $numbers. Do not call `record_issue` in this pass."
    s"""Book: "${outline.title}" (genre: ${outline.genre})

${memory}$preceding
CHAPTERS TO READ:
$chapters

$task"""
  }

  /** The revision request the writer sees when a chapter contradicts the guide or earlier chapters. */
  def continuityRevision(issues: List[ContinuityIssue]): String = {
    val lines = issues.map(i => s"- ${i.problem}${if (i.fix.isEmpty) "" else s" Fix: ${i.fix}"}").mkString("\n")
    s"""CONTINUITY REPORT — this chapter contradicts the guide or an earlier chapter. Fix exactly these problems:
$lines
Return the complete chapter. Keep every passage these problems do not touch as close to word for word as you can."""
  }

  // ---- scholar briefs ---------------------------------------------------------

  def bibliographerInput(outline: BookOutline, cfg: Config): String =
    s"""Paper: "${outline.title}" (field: ${outline.genre})

ABSTRACT:
${outline.premise}

SECTION PLAN:
${outline.chapters.map(c => s"${c.number}. ${c.title} — ${c.synopsis}").mkString("\n")}

Compile the reference list for this paper now."""

  def factCheckInput(outline: BookOutline, wc: WrittenChapter, refs: List[Reference]): String =
    s"""Paper: "${outline.title}" (field: ${outline.genre})
Section to check: ${wc.plan.number}. ${wc.plan.title}

REFERENCE LIST:
${if (refs.isEmpty) "(no references recorded)" else refs.map(_.format).mkString("\n")}

SECTION TEXT:
\"\"\"
${wc.text.trim}
\"\"\"

Cross-check every checkable claim in this section against the reference list now."""

  /** Turns fact-check findings into a revision request for the section writer. */
  def factCheckRevision(findings: List[Finding]): Option[String] = {
    val problems = findings.filter(f => f.isMajor || f.verdict == "contradicted" || f.verdict == "unsupported")
    if (problems.isEmpty) None
    else Some {
      val lines = problems.map { f =>
        s"- [${f.severity}] Claim: \"${f.claim.take(300)}\" (cited: ${if (f.citations.isEmpty) "none" else f.citations}) — ${f.verdict}. Fix: ${f.note}"
      }.mkString("\n")
      s"""FACT-CHECK REPORT — the fact checker flagged these problems in the previous draft. Fix all of them:
$lines
Keep everything that was correct unchanged where possible; repair or remove the flagged claims and re-cite properly."""
    }
  }

  def reviewerInput(outline: BookOutline, chapters: List[WrittenChapter], refs: List[Reference]): String = {
    val totalWords = chapters.map(_.wordCount).sum
    val body =
      if (totalWords <= 30000)
        chapters.map(c => s"## Section ${c.plan.number}: ${c.plan.title}\n\n${c.text}").mkString("\n\n---\n\n")
      else
        chapters.map { c =>
          val head = c.text.split("\\s+").take(250).mkString(" ")
          s"## Section ${c.plan.number}: ${c.plan.title}\n\n$head ..."
        }.mkString("\n\n---\n\n")

    s"""Paper: "${outline.title}" (field: ${outline.genre})

ABSTRACT:
${outline.premise}

REFERENCE LIST:
${if (refs.isEmpty) "(no references recorded)" else refs.map(_.format).mkString("\n")}

FULL TEXT:
$body

Review this paper now."""
  }

  /** The revision request the writer sees when the peer reviewer demands changes to one section. */
  def reviewRevision(issues: List[SectionIssue]): Option[String] = {
    val withComments = issues.filter(_.comment.trim.nonEmpty)
    if (withComments.isEmpty) None
    else Some {
      val lines = withComments.map(i => s"- [${i.severity}] ${i.comment}").mkString("\n")
      s"""PEER REVIEW — the reviewer flagged these problems in this section. Fix all of them:
$lines"""
    }
  }
}
