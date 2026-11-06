import type { Book } from '../api/types'

export const pendingChapterNumber = (book: Book): number | undefined =>
  book.currentChapter ?? book.chapters.find((chapter) => chapter.state === 'awaiting_review')?.number

export const generatingNote = (book: Book): string => {
  const current = book.currentChapter
  const writing = book.chapters.filter((chapter) => chapter.state === 'writing').map((chapter) => chapter.number)
  if (writing.length > 1) {
    return `Writing chapters ${writing[0]}–${writing[writing.length - 1]} of ${book.totalChapters}…`
  }
  return current == null
    ? `Writing ${book.totalChapters} chapters…`
    : `Writing chapter ${current} of ${book.totalChapters}…`
}

const chapterStateLabels: Readonly<Record<string, string>> = {
  pending: 'Queued',
  writing: 'Writing…',
  written: 'Written',
  awaiting_review: 'Ready for review',
}

export const chapterStateLabel = (state: string): string => chapterStateLabels[state] ?? state
