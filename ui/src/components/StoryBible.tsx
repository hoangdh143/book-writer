import type { Book } from '../api/types'

/** Read-only, and shown as plain text so model output can never add markup to the page. */
export const StoryBible = ({ book }: { book: Book }) =>
  book.storyBible == null ? null : (
    <details className="mt-6 rounded-lg border border-slate-800 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-200">
        {book.scholar === true ? 'Consistency guide' : 'Story bible'}
      </summary>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">{book.storyBible}</p>
    </details>
  )
