import { useUiStore } from '../store/uiStore'
import { StatusBadge } from './StatusBadge'
import { ErrorPanel } from './ErrorPanel'
import { useBookList } from '../api/bookQueries'

export const BookList = () => {
  const list = useBookList()
  const selectedId = useUiStore((state) => state.selectedBookId)
  const selectBook = useUiStore((state) => state.selectBook)

  if (list.isPending) return <p className="text-sm text-slate-500">Loading books…</p>
  if (list.isError) {
    return <ErrorPanel title="Could not load books" error={list.error} onRetry={() => { void list.refetch() }} />
  }

  return (
    <nav className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Books</h2>
      {list.data.length === 0 ? (
        <p className="text-sm text-slate-500">No books yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.map((item) => (
            <li key={item.id}>
              <button
                className={`w-full rounded-xl border border-slate-700/70 bg-slate-800/50 p-3 text-left transition-colors hover:border-sky-700 ${
                  item.id === selectedId ? 'border-sky-600 ring-1 ring-sky-600' : ''
                }`}
                onClick={() => selectBook(item.id)}
              >
                <span className="block truncate text-sm font-medium text-slate-100">
                  {item.title ?? item.prompt}
                </span>
                <span className="mt-1.5 flex items-center justify-between gap-2">
                  <StatusBadge status={item.status} />
                  <span className="text-xs text-slate-500">
                    {item.writtenCount}/{item.totalChapters}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
