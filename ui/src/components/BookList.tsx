import { useBookList } from '../api/bookQueries'
import { useUiStore } from '../store/uiStore'
import { StatusBadge } from './StatusBadge'
import { ErrorNotice } from './ErrorNotice'

export const BookList = () => {
  const list = useBookList()
  const selectedId = useUiStore((state) => state.selectedBookId)
  const selectBook = useUiStore((state) => state.selectBook)

  if (list.isPending) return <p className="note">Loading books…</p>
  if (list.isError) return <ErrorNotice error={list.error} />

  return (
    <nav className="book-list">
      <h2>Books</h2>
      {list.data.length === 0 ? (
        <p className="note">No books yet.</p>
      ) : (
        <ul>
          {list.data.map((item) => (
            <li key={item.id}>
              <button
                className={item.id === selectedId ? 'book-item selected' : 'book-item'}
                onClick={() => selectBook(item.id)}
              >
                <span className="list-title">{item.title ?? item.prompt}</span>
                <span className="list-side">
                  <StatusBadge status={item.status} />
                  <span className="list-progress">
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
