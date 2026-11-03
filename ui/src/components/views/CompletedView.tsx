import type { Book } from '../../api/types'
import { MarkdownBlock } from '../MarkdownBlock'
import { completedFilename } from '../BookHeader'

export const CompletedView = ({ book }: { book: Book }) => (
  <section className="panel completed">
    <h2>Book complete</h2>
    {book.markdownFiles.length === 0 ? null : (
      <p className="note">Saved: {book.markdownFiles.join(', ')}</p>
    )}
    {book.markdown == null ? (
      <p className="note">No markdown available.</p>
    ) : (
      <MarkdownBlock markdown={book.markdown} filename={completedFilename(book)} />
    )}
  </section>
)
