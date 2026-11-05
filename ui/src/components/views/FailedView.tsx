import type { Book } from '../../api/types'
import { button } from '../../domain/uiClasses'
import { useUiStore } from '../../store/uiStore'

export const FailedView = ({ book }: { book: Book }) => {
  const selectBook = useUiStore((state) => state.selectBook)
  return (
    <section className="rounded-xl border border-red-900/60 bg-red-950/30 p-5">
      <h3 className="text-base font-semibold text-red-300">Generation failed</h3>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-red-200/90">{book.error ?? 'Unknown failure.'}</p>
      <button className={`${button.secondary} mt-4`} onClick={() => selectBook(null)}>
        Start a new book
      </button>
    </section>
  )
}
