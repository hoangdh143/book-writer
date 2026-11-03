import { useUiStore } from '../store/uiStore'
import { BookDetail } from './BookDetail'

export const BookPanel = () => {
  const selectedId = useUiStore((state) => state.selectedBookId)
  return selectedId === null ? (
    <section className="empty-state">
      <p>Create a book to start the pipeline.</p>
      <p className="note">The writer pauses at the table of contents and before every chapter for your review.</p>
    </section>
  ) : (
    <BookDetail id={selectedId} />
  )
}
