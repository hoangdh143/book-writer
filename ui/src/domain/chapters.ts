import type { Book } from '../api/types'

export const pendingChapterNumber = (book: Book): number | undefined =>
  book.currentChapter ?? book.chapters.find((chapter) => chapter.state === 'awaiting_review')?.number

export const generatingNote = (book: Book): string => {
  const current = book.currentChapter
  return current == null
    ? `Writing ${book.totalChapters} chapters…`
    : `Writing chapter ${current} of ${book.totalChapters}…`
}
