import type { Book } from '../../api/types'

export const FailedView = ({ book }: { book: Book }) => (
  <section className="panel failed">
    <h2>Generation failed</h2>
    <p className="error-text">{book.error ?? 'Unknown failure.'}</p>
  </section>
)
