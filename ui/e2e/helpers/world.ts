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
  llmMaxConcurrency: number
  settingsSaved: Record<string, unknown> | undefined
  settingsError: string | undefined
  coverRequest: Record<string, unknown> | undefined
  coverError: string | undefined
  imageModelsFail: boolean
}

export const createWorld = (): World => ({
  createBook: undefined,
  createError: undefined,
  created: false,
  imageModelsFail: false,
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
  llmMaxConcurrency: 4,
  settingsSaved: undefined,
  settingsError: undefined,
  coverRequest: undefined,
  coverError: undefined,
})
