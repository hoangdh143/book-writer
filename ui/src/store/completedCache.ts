import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Book } from '../api/types'

interface CompletedCache {
  readonly books: Record<string, Book>
  readonly save: (book: Book) => void
}

export const useCompletedCache = create<CompletedCache>()(
  persist(
    (set) => ({
      books: {},
      save: (book) => set((state) => ({ books: { ...state.books, [book.id]: book } })),
    }),
    {
      name: 'book-writer-completed-books',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ books: state.books }),
    },
  ),
)
