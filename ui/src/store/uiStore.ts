import { create } from 'zustand'

interface UiStore {
  readonly selectedBookId: string | null
  readonly selectBook: (id: string | null) => void
  readonly clearSelectionIf: (id: string) => void
}

export const useUiStore = create<UiStore>()((set) => ({
  selectedBookId: null,
  selectBook: (id) => set({ selectedBookId: id }),
  clearSelectionIf: (id) =>
    set((state) => (state.selectedBookId === id ? { selectedBookId: null } : state)),
}))
