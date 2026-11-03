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
import { CommentBox } from '../CommentBox'
import { ErrorNotice } from '../ErrorNotice'

export const ChapterReviewView = ({ book }: { book: Book }) => {
  const number = pendingChapterNumber(book)
  return number === undefined ? (
    <p className="note">No chapter is awaiting review.</p>
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
  const error = approve.error ?? revise.error ?? approveRest.error

  if (chapter.isPending) return <p className="note">Loading chapter {number}…</p>
  if (chapter.isError) return <ErrorNotice error={chapter.error} />

  const text = chapter.data
  return (
    <section className="panel chapter-review">
      <h2>
        Chapter {text.number}: {text.title}
      </h2>
      <pre className="chapter-text">{text.text}</pre>
      <CommentBox
        label="Comment (optional to approve, required for revision)"
        value={comment}
        onChange={setComment}
      />
      <div className="action-row">
        <button
          className="primary"
          disabled={busy}
          onClick={() => approve.mutate(trimmedOrUndefined(comment))}
        >
          Approve chapter
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => approveRest.mutate(trimmedOrUndefined(comment))}
        >
          Approve — finish all remaining
        </button>
        <button
          disabled={busy || comment.trim() === ''}
          onClick={() => revise.mutate(comment.trim())}
        >
          Request revision
        </button>
      </div>
      <ErrorNotice error={error} />
    </section>
  )
}
