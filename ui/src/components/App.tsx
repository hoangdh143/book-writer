import { button } from '../domain/uiClasses'
import { useUiStore } from '../store/uiStore'
import { BookPanel } from './BookPanel'
import { BookList } from './BookList'
import { SettingsPanel } from './SettingsPanel'

export const App = () => {
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen)
  const selectBook = useUiStore((state) => state.selectBook)

  return (
    <div className="lg:flex lg:min-h-screen">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-slate-800 bg-slate-900/40 p-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold text-slate-50">Book Writer</h1>
          <button className={button.quiet} onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
        <button className={button.primary} onClick={() => selectBook(null)}>
          New book
        </button>
        <BookList />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-3xl">
          <BookPanel />
        </div>
      </main>
      {settingsOpen ? <SettingsPanel onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  )
}
