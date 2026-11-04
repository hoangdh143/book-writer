import type { Book } from '../../api/types'

export const FailedView = ({ book }: { book: Book }) => (
  <section className="rounded-xl border border-red-900/60 bg-red-950/30 p-5">
    <h2 className="text-base font-semibold text-red-300">Generation failed</h2>
    <p className="mt-2 whitespace-pre-wrap text-sm text-red-200/90">{book.error ?? 'Unknown failure.'}</p>
  </section>
)
