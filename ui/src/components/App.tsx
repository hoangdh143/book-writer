import { BookPanel } from './BookPanel'
import { BookList } from './BookList'
import { CreateBookForm } from './CreateBookForm'

export const App = () => (
  <div className="app-layout">
    <aside className="sidebar">
      <h1 className="brand">book-writer</h1>
      <CreateBookForm />
      <BookList />
    </aside>
    <main className="content">
      <BookPanel />
    </main>
  </div>
)
