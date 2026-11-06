import { useEffect } from 'react'
import type { Book } from '../api/types'
import { ApiError } from '../api/client'
import { useBook } from '../api/bookQueries'
import { useUiStore } from '../store/uiStore'
import { useCompletedCache } from '../store/completedCache'
import { BookHeader } from './BookHeader'
import { StatusSwitch } from './StatusSwitch'
import { StoryBible } from './StoryBible'
import { EventsFeed } from './EventsFeed'
import { ErrorPanel } from './ErrorPanel'

const networkHelp =
  'The app cannot reach the server. Start it with sbt "run --serve" (port 8080), then press Try again.'

const BookView = ({ book }: { book: Book }) => (
  <section>
    <BookHeader book={book} />
    <StatusSwitch book={book} />
    <StoryBible book={book} />
    <EventsFeed events={book.events} />
  </section>
)

const SavedCopyPanel = ({
  title,
  message,
  error,
  onBack,
  onRetry,
  cached,
}: {
  title: string
  message: string
  error: unknown
  onBack: () => void
  onRetry?: () => void
  cached: Book
}) => (
  <section className="flex flex-col gap-6">
    <ErrorPanel tone="notice" title={title} message={message} error={error} onBack={onBack} onRetry={onRetry} />
    <BookView book={cached} />
  </section>
)

export const BookDetail = ({ id }: { id: string }) => {
  const query = useBook(id)
  const selectBook = useUiStore((state) => state.selectBook)
  const cached = useCompletedCache((state) => state.books[id])
  const saveCompleted = useCompletedCache((state) => state.save)

  useEffect(() => {
    const book = query.data
    if (book !== undefined && book.status === 'completed') saveCompleted(book)
  }, [query.data, saveCompleted])

  if (query.isPending) return <p className="text-sm text-slate-400">Loading book…</p>

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    const back = () => selectBook(null)
    const retry = () => {
      void query.refetch()
    }
    if (notFound && cached !== undefined) {
      return (
        <SavedCopyPanel
          title="Not on the server — showing your saved copy"
          message="This book is no longer on the server. The completed copy below is saved in this browser, so you can still read and download it."
          error={query.error}
          onBack={back}
          cached={cached}
        />
      )
    }
    if (notFound) {
      return <ErrorPanel title="Book not found" error={query.error} onBack={back} />
    }
    if (cached !== undefined) {
      return (
        <SavedCopyPanel
          title="Reconnecting — showing your saved copy"
          message="The server is unreachable. The completed copy below is saved in this browser, so you can still read and download it."
          error={query.error}
          onBack={back}
          onRetry={retry}
          cached={cached}
        />
      )
    }
    return query.error instanceof TypeError ? (
      <ErrorPanel title="Cannot reach the server" message={networkHelp} error={query.error} onRetry={retry} />
    ) : (
      <ErrorPanel title="Could not load the book" error={query.error} onRetry={retry} />
    )
  }

  const book = query.data
  return <BookView book={book} />
}
