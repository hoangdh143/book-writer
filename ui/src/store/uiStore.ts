import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface UiStore {
  readonly selectedBookId: string | null
  readonly settingsOpen: boolean
  readonly selectBook: (id: string | null) => void
  readonly clearSelectionIf: (id: string) => void
  readonly setSettingsOpen: (open: boolean) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      selectedBookId: null,
      settingsOpen: false,
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
