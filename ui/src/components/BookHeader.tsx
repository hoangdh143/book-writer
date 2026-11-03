import type { Book } from '../api/types'
import { durationLabel, safeFilename } from '../domain/text'
import { useRemoveBook } from '../api/bookMutations'
import { StatusBadge } from './StatusBadge'
import { ErrorNotice } from './ErrorNotice'

export const BookHeader = ({ book }: { book: Book }) => {
  const remove = useRemoveBook()
  const title = book.outline?.title ?? book.prompt
  const elapsed = book.elapsedSeconds === null || book.elapsedSeconds === undefined
    ? ''
    : ` · ${durationLabel(book.elapsedSeconds)}`
  return (
    <header className="book-header">
      <div className="book-title-row">
        <h2 className="book-title">{title}</h2>
        <StatusBadge status={book.status} />
        <button className="danger" disabled={remove.isPending} onClick={() => remove.mutate(book.id)}>
          Delete
        </button>
      </div>
      <p className="book-meta">
        {book.model} · {book.writtenCount}/{book.totalChapters} chapters
        {elapsed}
      </p>
      <ErrorNotice error={remove.error} />
    </header>
  )
}

export const completedFilename = (book: Book): string => safeFilename(book.outline?.title ?? book.id)
