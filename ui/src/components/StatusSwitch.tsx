import type { Book } from '../api/types'
import { generatingNote, pendingChapterNumber } from '../domain/chapters'
import { parseStatus } from '../domain/bookStatus'
import { panel } from '../domain/uiClasses'
import { TocReviewView } from './views/TocReviewView'
import { ChapterReviewView } from './views/ChapterReviewView'
import { ProgressView } from './views/ProgressView'
import { CompletedView } from './views/CompletedView'
import { FailedView } from './views/FailedView'

const UnknownStatus = ({ status }: { status: string }) => (
  <section className={panel}>
    <p className="text-sm text-slate-400">Unknown status “{status}”.</p>
  </section>
)

const PlanningPanel = () => (
  <section className={`${panel} animate-pulse`}>
    <p className="text-sm text-slate-400">Planning the book — the architect is drafting a table of contents…</p>
  </section>
)

export const StatusSwitch = ({ book }: { book: Book }) => {
  switch (parseStatus(book.status)) {
    case 'planning':
      return <PlanningPanel />
    case 'toc_review':
      return book.outline == null ? (
        <UnknownStatus status={book.status} />
      ) : (
        <TocReviewView book={book} outline={book.outline} />
      )
    case 'generating':
      return <ProgressView book={book} note={generatingNote(book)} />
    case 'chapter_review':
      return pendingChapterNumber(book) === undefined ? (
        <ProgressView book={book} note="Waiting for the pending chapter…" />
      ) : (
        <ChapterReviewView book={book} />
      )
    case 'editing':
      return <ProgressView book={book} note="Writing the foreword and back-cover blurb…" />
    case 'completed':
      return <CompletedView book={book} />
    case 'failed':
      return <FailedView book={book} />
    case 'unknown':
      return <UnknownStatus status={book.status} />
  }
}
