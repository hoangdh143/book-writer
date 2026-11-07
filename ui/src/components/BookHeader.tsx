import { useState } from 'react'
import type { Book } from '../api/types'
import { durationLabel } from '../domain/text'
import { button, hint, pageHeading } from '../domain/uiClasses'
import { useRemoveBook } from '../api/bookMutations'
import { useLiveModels } from '../api/liveModels'
import { duplicateValues } from '../domain/duplicateBook'
import { useUiStore } from '../store/uiStore'
import { PipelineSteps } from './PipelineSteps'
import { StatusBadge } from './StatusBadge'

const DeleteControl = ({ id }: { id: string }) => {
  const remove = useRemoveBook()
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <button className={button.quiet} onClick={() => setConfirming(true)}>
        Delete
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className={hint}>This can’t be undone.</span>
      <button className={button.secondary} disabled={remove.isPending} onClick={() => setConfirming(false)}>
        Cancel
      </button>
      <button className={button.danger} disabled={remove.isPending} onClick={() => remove.mutate(id)}>
        Delete book
      </button>
    </div>
  )
}

const DuplicateControl = ({ book }: { book: Book }) => {
  const duplicateBook = useUiStore((state) => state.duplicateBook)
  const live = useLiveModels()
  return (
    <button
      className={button.quiet}
      title="Open a new book with the same idea and settings"
      onClick={() =>
        duplicateBook({ from: book.outline?.title ?? book.prompt, values: duplicateValues(book, live.presets) })
      }
    >
      Duplicate
    </button>
  )
}

export const BookHeader = ({ book }: { book: Book }) => {
  const title = book.outline?.title ?? book.prompt
  const elapsed = book.elapsedSeconds == null ? '' : ` · ${durationLabel(book.elapsedSeconds)}`
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className={`${pageHeading} line-clamp-2 min-w-0 flex-1 basis-64`}>{title}</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {book.status === 'completed' ? <DuplicateControl book={book} /> : null}
          <DeleteControl id={book.id} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge status={book.status} />
        {book.scholar && (
          <span
            className="inline-block whitespace-nowrap rounded-full border border-indigo-400/40 bg-indigo-400/10 px-2.5 py-0.5 text-xs font-medium text-indigo-300"
            title="Scholar mode: bibliography, fact cross-checking and peer review"
          >
            Scholar
          </span>
        )}
        <p className={hint}>
          {book.model} · {book.writtenCount} of {book.totalChapters} chapters
          {elapsed}
        </p>
      </div>
      <PipelineSteps status={book.status} />
    </header>
  )
}
