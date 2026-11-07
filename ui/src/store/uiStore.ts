import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { FormValues } from '../components/CreateBookForm/CreateBookFields'

export interface BookCopy {
  readonly from: string
  readonly values: FormValues
}

interface UiStore {
  readonly selectedBookId: string | null
  readonly settingsOpen: boolean
  readonly bookCopy: BookCopy | null
  readonly duplicateBook: (copy: BookCopy) => void
  readonly clearBookCopy: () => void
  readonly selectBook: (id: string | null) => void
  readonly clearSelectionIf: (id: string) => void
  readonly setSettingsOpen: (open: boolean) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      selectedBookId: null,
      settingsOpen: false,
      bookCopy: null,
      duplicateBook: (copy) => set({ bookCopy: copy, selectedBookId: null }),
      clearBookCopy: () => set({ bookCopy: null }),
      selectBook: (id) => set({ selectedBookId: id }),
      clearSelectionIf: (id) =>
        set((state) => (state.selectedBookId === id ? { selectedBookId: null } : state)),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
    }),
    {
      name: 'book-writer-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedBookId: state.selectedBookId }),
    },
  ),
)
