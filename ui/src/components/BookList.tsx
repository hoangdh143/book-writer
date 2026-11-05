import { useUiStore } from '../store/uiStore'
import { StatusLine } from './StatusBadge'
import { ErrorPanel } from './ErrorPanel'
import { useBookList } from '../api/bookQueries'

export const BookList = () => {
  const list = useBookList()
  const selectedId = useUiStore((state) => state.selectedBookId)
  const selectBook = useUiStore((state) => state.selectBook)

  if (list.isPending) return <p className="text-sm text-slate-400">Loading books…</p>
  if (list.isError) {
    return <ErrorPanel title="Could not load books" error={list.error} onRetry={() => { void list.refetch() }} />
  }

  return (
    <nav aria-label="Books" className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1 max-lg:max-h-44">
      {list.data.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-400">No books yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.data.map((item) => (
            <li key={item.id}>
              <button
                aria-current={item.id === selectedId ? 'true' : undefined}
                className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  item.id === selectedId ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                }`}
                onClick={() => selectBook(item.id)}
              >
                <span className="block truncate text-sm font-medium text-slate-100">
                  {item.title ?? item.prompt}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-400">
                  <StatusLine status={item.status} />
                  <span className="tabular-nums">
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
