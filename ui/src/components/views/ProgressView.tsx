import type { Book } from '../../api/types'
import { panel } from '../../domain/uiClasses'
import { ChapterList } from '../ChapterList'

export const WorkingNote = ({ note }: { note: string }) => (
  <p aria-live="polite" className="flex items-center gap-2.5 text-sm text-sky-300">
    <span
      aria-hidden
      className="size-3.5 shrink-0 rounded-full border-2 border-sky-300/30 border-t-sky-300 motion-safe:animate-spin"
    />
    {note}
  </p>
)

const ProgressBar = ({ value, max }: { value: number; max: number }) =>
  max === 0 ? null : (
    <div
      role="progressbar"
      aria-label="Chapters written"
      aria-valuenow={value}
      aria-valuemax={max}
      className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800"
    >
      <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  )

export const ProgressView = ({ book, note }: { book: Book; note: string }) => (
  <section className={panel}>
    <WorkingNote note={note} />
    <ProgressBar value={book.writtenCount} max={book.totalChapters} />
    <ChapterList chapters={book.chapters} />
  </section>
)
