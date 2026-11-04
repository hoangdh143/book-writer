import type { Book } from '../api/types'
import { durationLabel } from '../domain/text'
import { button } from '../domain/uiClasses'
import { useRemoveBook } from '../api/bookMutations'
import { StatusBadge } from './StatusBadge'

export const BookHeader = ({ book }: { book: Book }) => {
  const remove = useRemoveBook()
  const title = book.outline?.title ?? book.prompt
  const elapsed = book.elapsedSeconds == null ? '' : ` · ${durationLabel(book.elapsedSeconds)}`
  return (
    <header className="mb-4">
      <div className="flex items-center gap-3">
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold text-slate-100">{title}</h2>
        <StatusBadge status={book.status} />
        <button className={button.danger} disabled={remove.isPending} onClick={() => remove.mutate(book.id)}>
          Delete
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {book.model} · {book.writtenCount}/{book.totalChapters} chapters
        {elapsed}
      </p>
    </header>
  )
}
