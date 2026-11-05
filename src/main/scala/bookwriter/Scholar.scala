package bookwriter

import java.util.concurrent.atomic.AtomicReference
import zio.json.JsonCodec

/** One entry of the paper's bibliography, recorded by the Bibliographer agent. */
final case class Reference(
  number: Int,
  authors: String,
  year: String,
  title: String,
  venue: String,
  url: String
) derives JsonCodec {

  def format: String = {
    val where = if (venue.isEmpty) "" else s". $venue"
    val link  = if (url.isEmpty) "" else s" $url"
    val who   = if (authors.isEmpty) "[unknown authors]" else authors
    val when  = if (year.isEmpty) "n.d." else year
    s"[$number] $who ($when). *$title*$where.$link"
  }
}

object Reference:
  def fromMap(input: Any): Reference = {
    val m = Values.asMap(input)
    Reference(
      number = Values.int(m, "number").getOrElse(0),
      authors = Values.str(m, "authors"),
      year = Values.str(m, "year"),
      title = Values.str(m, "title"),
      venue = Values.str(m, "venue"),
      url = Values.str(m, "url")
    )
  }

/** Result of cross-checking one claim of one section against the bibliography. */
final case class Finding(
  section: Int,
  claim: String,
  citations: String,
  verdict: String,
  severity: String,
  note: String
) derives JsonCodec {

  def isMajor: Boolean = severity.equalsIgnoreCase("major")
}

object Finding:
  def fromMap(input: Any, section: Int): Finding = {
    val m = Values.asMap(input)
    Finding(
      section = Values.int(m, "section").getOrElse(section),
      claim = Values.str(m, "claim"),
      citations = Values.str(m, "citations"),
      verdict = Values.str(m, "verdict").toLowerCase,
      severity = Values.str(m, "severity").toLowerCase match {
        case "critical" => "major"
        case other      => if (other.isEmpty) "minor" else other
      },
      note = Values.str(m, "note")
    )
  }

/** One issue raised by the peer reviewer against one section. */
final case class SectionIssue(section: Int, severity: String, comment: String) derives JsonCodec

final case class ReviewReport(
  score: Int,
  verdict: String,
  summary: String,
  issues: List[SectionIssue]
) derives JsonCodec {

  def needsRevision: Boolean = verdict.equalsIgnoreCase("revise")
  def majorIssues: List[SectionIssue] = issues.filter(_.severity.equalsIgnoreCase("major"))
}

/** Collects bibliography entries via the `record_reference` tool call. */
final class ReferenceSink {
  private val refs = new AtomicReference[Vector[Reference]](Vector.empty)

  def reset(): Unit = refs.set(Vector.empty)

  def record(input: Any): String = {
    val r = Reference.fromMap(input)
    if r.title.isEmpty then "Error: 'title' is required and must be a non-empty string."
    else {
      val n = if (r.number > 0) r.number else refs.get().length + 1
      refs.set(refs.get() :+ r.copy(number = n))
      s"Recorded reference [$n]: ${r.title}."
    }
  }

  def references: List[Reference] = refs.get().toList.sortBy(_.number).zipWithIndex.map {
    case (r, i) => if (r.number > 0) r else r.copy(number = i + 1)
  }
}

/** Collects fact-check findings via the `record_finding` tool call. */
final class FactCheckSink {
  private val items = new AtomicReference[Vector[Finding]](Vector.empty)

  def reset(): Unit = items.set(Vector.empty)

  def record(input: Any, section: Int): String = {
    val f = Finding.fromMap(input, section)
    items.set(items.get() :+ f)
    s"Recorded finding (${f.severity}, ${f.verdict}) for section ${f.section}."
  }

  def findings: List[Finding] = items.get().toList
}

/** Collects the peer-review verdict via the `record_review` tool call. */
final class ReviewSink {
  private val report = new AtomicReference[Option[ReviewReport]](None)

  def reset(): Unit = report.set(None)

  def record(input: Any): String = {
    val m = Values.asMap(input)
    val score = Values.int(m, "score").getOrElse(0)
    val verdict = Values.str(m, "verdict").toLowerCase match {
      case "accept"  => "accept"
      case "revise"  => "revise"
      case other     => if (other.isEmpty) "" else other
    }
    val summary = Values.str(m, "summary")
    val issues = Values.asMap(m).get("issues").toList.flatMap {
      case list: List[?] =>
        list.map { raw =>
          val im = Values.asMap(raw)
          SectionIssue(
            section = Values.int(im, "section").getOrElse(0),
            severity = (Values.str(im, "severity").toLowerCase match {
              case "critical" => "major"
              case other      => if (other.isEmpty) "minor" else other
            }),
            comment = Values.str(im, "comment")
          )
        }
      case _ => Nil
    }
    if (verdict.isEmpty) "Error: 'verdict' must be \"accept\" or \"revise\"."
    else {
      report.set(Some(ReviewReport(score, verdict, summary, issues)))
      s"Recorded review: $verdict (score $score, ${issues.size} issue(s))."
    }
  }

  def get: Option[ReviewReport] = report.get()
}
