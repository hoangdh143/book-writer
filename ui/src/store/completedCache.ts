import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import type { Book } from '../api/types'

const largestSavedImage = 100_000

/** Browser storage holds a few megabytes across all books, so large illustrations stay on the server. */
export const withoutLargeImages = (markdown: string): string =>
  markdown.replace(/!\[([^\]]*)\]\(data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)\)/g, (image, alt: string, payload: string) =>
    payload.length > largestSavedImage ? `*[Illustration not in the saved copy: ${alt}]*` : image,
  )

const savedCopy = (book: Book): Book =>
  book.markdown == null ? book : { ...book, markdown: withoutLargeImages(book.markdown) }

interface CompletedCache {
  readonly books: Record<string, Book>
  readonly save: (book: Book) => void
}

/** The saved copies are a convenience, so a full browser storage must never break the page. */
const bestEffortStorage = (): StateStorage => ({
  getItem: (key) => localStorage.getItem(key),
  removeItem: (key) => localStorage.removeItem(key),
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // keep the previous saved copies
    }
  },
})

export const useCompletedCache = create<CompletedCache>()(
  persist(
    (set) => ({
      books: {},
      save: (book) => set((state) => ({ books: { ...state.books, [book.id]: savedCopy(book) } })),
    }),
    {
      name: 'book-writer-completed-books',
      storage: createJSONStorage(bestEffortStorage),
      partialize: (state) => ({ books: state.books }),
    },
  ),
)
