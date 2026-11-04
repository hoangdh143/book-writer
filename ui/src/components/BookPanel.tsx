import { useUiStore } from '../store/uiStore'
import { BookDetail } from './BookDetail'

export const BookPanel = () => {
  const selectedId = useUiStore((state) => state.selectedBookId)
  return selectedId === null ? (
    <section className="mt-8 rounded-xl border border-dashed border-slate-700 p-10 text-center">
      <p className="text-slate-300">Create a book to start the pipeline.</p>
      <p className="mt-1 text-sm text-slate-500">
        The writer pauses at the table of contents and before every chapter for your review.
      </p>
    </section>
  ) : (
    <BookDetail id={selectedId} />
  )
}
