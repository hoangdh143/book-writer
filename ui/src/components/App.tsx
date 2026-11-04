import { useState } from 'react'
import { button } from '../domain/uiClasses'
import { BookPanel } from './BookPanel'
import { BookList } from './BookList'
import { CreateBookForm } from './CreateBookForm/CreateBookForm'
import { SettingsPanel } from './SettingsPanel'

export const App = () => {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:p-6">
      <aside className="flex w-full shrink-0 flex-col gap-5 lg:w-96">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-wide text-sky-400">book-writer</h1>
          <button className={button.secondary} onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
        <CreateBookForm />
        <BookList />
      </aside>
      <main className="min-w-0 flex-1">
        <BookPanel />
      </main>
      {settingsOpen ? <SettingsPanel onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  )
}
