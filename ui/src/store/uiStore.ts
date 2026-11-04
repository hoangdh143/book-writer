import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface UiStore {
  readonly selectedBookId: string | null
  readonly selectBook: (id: string | null) => void
  readonly clearSelectionIf: (id: string) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      selectedBookId: null,
      selectBook: (id) => set({ selectedBookId: id }),
      clearSelectionIf: (id) =>
        set((state) => (state.selectedBookId === id ? { selectedBookId: null } : state)),
    }),
    {
      name: 'book-writer-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedBookId: state.selectedBookId }),
    },
  ),
)
