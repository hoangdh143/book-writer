package bookwriter

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference
import zio.json.JsonCodec
import scala.jdk.CollectionConverters.*

final case class ChapterPlan(number: Int, title: String, synopsis: String) derives JsonCodec

final case class BookOutline(
  title: String,
  genre: String,
  premise: String,
  chapters: List[ChapterPlan]
) derives JsonCodec

final case class WrittenChapter(plan: ChapterPlan, text: String) derives JsonCodec {
  def wordCount: Int = text.split("\\s+").filter(_.nonEmpty).length
  def endingExcerpt(maxChars: Int = 700): String = {
    val lines = text.trim.linesIterator.toList
    val tail = lines.takeRight(4).mkString("\n")
    if (tail.length <= maxChars) tail else tail.substring(tail.length - maxChars)
  }
}

object Values {
  def asMap(input: Any): Map[String, Any] = input match {
    case m: Map[_, _] => m.asInstanceOf[Map[String, Any]]
    case _            => Map.empty
  }
  def str(m: Map[String, Any], key: String): String =
    m.get(key).map(v => String.valueOf(v)).getOrElse("").trim
  def int(m: Map[String, Any], key: String): Option[Int] = m.get(key).flatMap {
    case i: Int    => Some(i)
    case l: Long   => Some(l.toInt)
    case d: Double => Some(d.toInt)
    case s: String => s.trim.stripSuffix(".0").toIntOption
    case _         => None
  }
}

final class OutlineSink {
  private val meta = new AtomicReference[Option[(String, String, String)]](None)
  private val chapters = new ConcurrentHashMap[Int, ChapterPlan]()

  def reset(): Unit = {
    meta.set(None)
    chapters.clear()
  }

  def bookMeta(input: Any): String = {
    val m = Values.asMap(input)
    val title = Values.str(m, "title")
    val genre = Values.str(m, "genre")
    val premise = Values.str(m, "premise")
    if (title.isEmpty) "Error: 'title' is required and must be a non-empty string."
    else {
      meta.set(Some((title, genre, premise)))
      s"Recorded book meta: \"$title\" ($genre). Now record every chapter with record_chapter."
    }
  }

  def chapter(input: Any): String = {
    val m = Values.asMap(input)
    val numOpt = Values.int(m, "number")
    val title = Values.str(m, "title")
    val synopsis = Values.str(m, "synopsis")
    (numOpt, title) match {
      case (None, _)  => "Error: 'number' (integer) is required."
      case (_, "")    => "Error: 'title' is required and must be a non-empty string."
      case (Some(n), t) =>
        chapters.put(n, ChapterPlan(n, t, synopsis))
        s"Recorded chapter $n: $t."
    }
  }

  def outline(): Option[BookOutline] = meta.get().map { case (title, genre, premise) =>
    val list = chapters.values().iterator().asScala.toList.sortBy(_.number)
    BookOutline(title, genre, premise, list)
  }
}

final class EditorSink {
  private val foreword = new AtomicReference[String]("")
  private val blurb = new AtomicReference[String]("")

  def reset(): Unit = {
    foreword.set("")
    blurb.set("")
  }

  def recordForeword(input: Any): String = {
    val text = Values.str(Values.asMap(input), "text")
    if (text.isEmpty) "Error: 'text' is required and must be a non-empty string."
    else {
      foreword.set(text)
      s"Recorded foreword (${text.length} characters)."
    }
  }

  def recordBlurb(input: Any): String = {
    val text = Values.str(Values.asMap(input), "text")
    if (text.isEmpty) "Error: 'text' is required and must be a non-empty string."
    else {
      blurb.set(text)
      s"Recorded back-cover blurb (${text.length} characters)."
    }
  }

  def get: (String, String) = (foreword.get(), blurb.get())
}
