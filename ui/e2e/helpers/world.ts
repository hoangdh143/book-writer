import type { Download } from '@playwright/test'
import type { Book, BookListItem, ChapterText } from '../../src/api/types'

export interface World {
  createBook: Record<string, unknown> | undefined
  createError: string | undefined
  created: boolean
  listItem: BookListItem | undefined
  tocApprove: Record<string, unknown> | undefined
  tocRevise: Record<string, unknown> | undefined
  chapterApprove: Record<string, unknown> | undefined
  chapterRevise: Record<string, unknown> | undefined
  approveRest: Record<string, unknown> | undefined
  detailQueue: Book[]
  detailStatus: number
  detailError: string
  offline: boolean
  chapterText: ChapterText
  download: Download | undefined
}

export const createWorld = (): World => ({
  createBook: undefined,
  createError: undefined,
  created: false,
  listItem: undefined,
  tocApprove: undefined,
  tocRevise: undefined,
  chapterApprove: undefined,
  chapterRevise: undefined,
  approveRest: undefined,
  detailQueue: [],
  detailStatus: 200,
  detailError: 'request failed',
  offline: false,
  chapterText: { number: 0, title: '', text: '' },
  download: undefined,
})
