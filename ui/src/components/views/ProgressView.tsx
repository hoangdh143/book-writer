import type { Book } from '../../api/types'
import { ChapterGrid } from '../ChapterGrid'

export const ProgressView = ({ book, note }: { book: Book; note: string }) => (
  <section className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-4 shadow-sm">
    <p className="animate-pulse text-sm text-sky-300">{note}</p>
    <ChapterGrid chapters={book.chapters} />
  </section>
)
