import { useBook } from '../api/bookQueries'
import { BookHeader } from './BookHeader'
import { StatusSwitch } from './StatusSwitch'
import { EventsFeed } from './EventsFeed'
import { ErrorNotice } from './ErrorNotice'

export const BookDetail = ({ id }: { id: string }) => {
  const query = useBook(id)
  if (query.isPending) return <p className="note">Loading book…</p>
  if (query.isError) return <ErrorNotice error={query.error} />
  const book = query.data
  return (
    <section className="book-detail">
      <BookHeader book={book} />
      <StatusSwitch book={book} />
      <EventsFeed events={book.events} />
    </section>
  )
}
