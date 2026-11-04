import type { Book, BookListItem, ChapterStatus, ChapterText, Outline } from '../../src/api/types'

const chapterPlans: Outline = {
  title: 'The Lighthouse Mystery',
  genre: 'Cozy Mystery',
  premise: 'A retired keeper solves crimes in a fog-bound lighthouse village.',
  chapters: Array.from({ length: 6 }, (_, index) => ({
    number: index + 1,
    title: `Untitled chapter ${index + 1}`,
    synopsis: `Synopsis for chapter ${index + 1}.`,
  })),
}

const chapterStates = (states: readonly string[]): ChapterStatus[] =>
  chapterPlans.chapters.map((plan, index) => ({
    number: plan.number,
    title: plan.title,
    synopsis: plan.synopsis,
    state: states[index] ?? 'pending',
    wordCount: null,
  }))

const allPending = (): ChapterStatus[] => chapterStates(['pending', 'pending', 'pending', 'pending', 'pending', 'pending'])

const md = [
  '# The Lighthouse Mystery',
  '',
  'by the book-writer',
  '',
  'Einstein wrote $E = mc^2$ in 1905.',
  '',
  '$$',
  '\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}',
  '$$',
  '',
  '## Chapter 1: The Last Clear Night',
  '',
  'The fog rolled in over the rocks.',
  '',
  "## Chapter 2: The Keeper's Ledger",
  '',
  'A ledger of shipwrecks and secrets.',
].join('\n')

const baseBook: Book = {
  id: 'b1',
  prompt: 'The Lighthouse Mystery',
  model: 'deepseek-chat',
  status: 'planning',
  writtenCount: 0,
  totalChapters: 6,
  outline: null,
  chapters: [],
  currentChapter: null,
  mode: null,
  error: null,
  markdownFiles: [],
  markdown: null,
  events: [],
  elapsedSeconds: null,
}

export const makeBook = (overrides: Partial<Book>): Book => ({ ...baseBook, ...overrides })

export const planningBook: Book = makeBook({})

export const tocReviewBook: Book = makeBook({
  status: 'toc_review',
  outline: chapterPlans,
  chapters: allPending(),
})

export const tocReviewBookV2: Book = makeBook({
  status: 'toc_review',
  outline: { ...chapterPlans, title: 'The Floating Heist v2' },
  chapters: allPending(),
})

export const generatingBook: Book = makeBook({
  status: 'generating',
  outline: chapterPlans,
  currentChapter: 3,
  writtenCount: 2,
  chapters: chapterStates(['written', 'written', 'writing', 'pending', 'pending', 'pending']),
})

export const chapterReviewBook: Book = makeBook({
  status: 'chapter_review',
  outline: chapterPlans,
  currentChapter: 2,
  writtenCount: 1,
  chapters: chapterStates(['written', 'awaiting_review', 'pending', 'pending', 'pending', 'pending']),
})

export const completedBook: Book = makeBook({
  status: 'completed',
  outline: chapterPlans,
  writtenCount: 6,
  chapters: chapterStates(['written', 'written', 'written', 'written', 'written', 'written']),
  markdown: md,
  markdownFiles: ['output/books/b1/book.md'],
  elapsedSeconds: 3720,
})

export const chapterTextV1: ChapterText = {
  number: 2,
  title: "The Keeper's Ledger",
  text: 'The ledger smelled of salt and secrets.',
}

export const chapterTextV2: ChapterText = {
  number: 2,
  title: "The Keeper's Ledger",
  text: 'Storm-tossed rewrite of chapter two.',
}

export const titleOf = (book: Book): string => book.outline?.title ?? book.prompt

export const listItemFor = (book: Book): BookListItem => ({
  id: book.id,
  prompt: book.prompt,
  status: book.status,
  title: book.outline?.title ?? null,
  writtenCount: book.writtenCount,
  totalChapters: book.totalChapters,
})
