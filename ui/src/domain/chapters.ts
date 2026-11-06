import type { Book } from '../api/types'

export const pendingChapterNumber = (book: Book): number | undefined =>
  book.currentChapter ?? book.chapters.find((chapter) => chapter.state === 'awaiting_review')?.number

const chaptersIn = (book: Book, state: string): readonly number[] =>
  book.chapters.filter((chapter) => chapter.state === state).map((chapter) => chapter.number)

const chapterRange = (numbers: readonly number[], total: number): string =>
  numbers.length === 1
    ? `chapter ${numbers[0]} of ${total}`
    : `chapters ${numbers[0]}–${numbers[numbers.length - 1]} of ${total}`

export const generatingNote = (book: Book): string => {
  const current = book.currentChapter
  if (chaptersIn(book, 'preparing').length > 0) {
    return book.scholar === true ? 'Preparing the bibliography and consistency guide…' : 'Writing the story bible…'
  }
  const checking = chaptersIn(book, 'checking')
  if (checking.length > 0) return `Checking continuity of ${chapterRange(checking, book.totalChapters)}…`
  const writing = chaptersIn(book, 'writing')
  if (writing.length > 1) return `Writing ${chapterRange(writing, book.totalChapters)}…`
  return current == null
    ? `Writing ${book.totalChapters} chapters…`
    : `Writing chapter ${current} of ${book.totalChapters}…`
}

const chapterStateLabels: Readonly<Record<string, string>> = {
  pending: 'Queued',
  preparing: 'Queued',
  writing: 'Writing…',
  checking: 'Checking…',
  written: 'Written',
  awaiting_review: 'Ready for review',
}

export const chapterStateLabel = (state: string): string => chapterStateLabels[state] ?? state
