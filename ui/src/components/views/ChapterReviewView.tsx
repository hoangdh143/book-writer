import { useState } from 'react'
import type { Book } from '../../api/types'
import {
  useApproveRest,
  useChapterApprove,
  useChapterRevise,
} from '../../api/bookMutations'
import { useChapter } from '../../api/bookQueries'
import { pendingChapterNumber } from '../../domain/chapters'
import { trimmedOrUndefined } from '../../domain/text'
import { button, hint, sectionHeading } from '../../domain/uiClasses'
import { ErrorPanel } from '../ErrorPanel'
import { Manuscript } from '../Manuscript'
import { ReviewBar } from '../ReviewBar'

export const ChapterReviewView = ({ book }: { book: Book }) => {
  const number = pendingChapterNumber(book)
  return number === undefined ? (
    <p className="text-sm text-slate-400">No chapter is awaiting review.</p>
  ) : (
    <PendingChapterReview book={book} number={number} />
  )
}

const PendingChapterReview = ({ book, number }: { book: Book; number: number }) => {
  const chapter = useChapter(book.id, number)
  const [comment, setComment] = useState('')
  const approve = useChapterApprove(book.id, number)
  const revise = useChapterRevise(book.id, number)
  const approveRest = useApproveRest(book.id)
  const busy = approve.isPending || revise.isPending || approveRest.isPending

  if (chapter.isPending) return <p className="text-sm text-slate-400">Loading chapter {number}…</p>
  if (chapter.isError) {
    return (
      <ErrorPanel
        title={`Could not load chapter ${number}`}
        error={chapter.error}
        onRetry={() => {
          void chapter.refetch()
        }}
      />
    )
  }

  const text = chapter.data
  return (
    <section className="flex flex-col">
      <p className={hint}>
        Chapter {text.number} of {book.totalChapters}
      </p>
      <h3 className={`${sectionHeading} mb-5`}>{text.title}</h3>
      <Manuscript markdown={text.text} />
      <ReviewBar comment={comment} onComment={setComment}>
        <button
          className={button.quiet}
          disabled={busy || comment.trim() === ''}
          onClick={() => revise.mutate(comment.trim())}
        >
          Request revision
        </button>
        <button
          className={button.secondary}
          disabled={busy}
          onClick={() => approveRest.mutate(trimmedOrUndefined(comment))}
        >
          Approve and write the rest
        </button>
        <button
          className={button.primary}
          disabled={busy}
          onClick={() => approve.mutate(trimmedOrUndefined(comment))}
        >
          Approve chapter
        </button>
      </ReviewBar>
    </section>
  )
}
