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
import { actionRow, button, panel, prose } from '../../domain/uiClasses'
import { CommentBox } from '../CommentBox'
import { ErrorPanel } from '../ErrorPanel'

export const ChapterReviewView = ({ book }: { book: Book }) => {
  const number = pendingChapterNumber(book)
  return number === undefined ? (
    <p className="text-sm text-slate-500">No chapter is awaiting review.</p>
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

  if (chapter.isPending) return <p className="text-sm text-slate-500">Loading chapter {number}…</p>
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
    <section className={`${panel} flex flex-col`}>
      <h2 className="text-base font-semibold text-slate-100">
        Chapter {text.number}: {text.title}
      </h2>
      <pre className={`${prose} mt-3`}>{text.text}</pre>
      <CommentBox
        label="Comment (optional to approve, required for revision)"
        value={comment}
        onChange={setComment}
      />
      <div className={actionRow}>
        <button
          className={button.primary}
          disabled={busy}
          onClick={() => approve.mutate(trimmedOrUndefined(comment))}
        >
          Approve chapter
        </button>
        <button
          className={button.primary}
          disabled={busy}
          onClick={() => approveRest.mutate(trimmedOrUndefined(comment))}
        >
          Approve — finish all remaining
        </button>
        <button
          className={button.secondary}
          disabled={busy || comment.trim() === ''}
          onClick={() => revise.mutate(comment.trim())}
        >
          Request revision
        </button>
      </div>
    </section>
  )
}
