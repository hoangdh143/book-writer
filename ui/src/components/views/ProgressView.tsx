import type { Book } from '../../api/types'
import { ChapterGrid } from '../ChapterGrid'

export const ProgressView = ({ book, note }: { book: Book; note: string }) => (
  <section className="panel progress">
    <p className="note">{note}</p>
    <ChapterGrid chapters={book.chapters} />
  </section>
)
