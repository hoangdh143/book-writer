export type TocMode = 'all' | 'step'

export interface ChapterEditInput {
  readonly number: number
  readonly title?: string
  readonly synopsis?: string
}

export interface OutlineEditsInput {
  readonly title?: string
  readonly genre?: string
  readonly premise?: string
  readonly chapters?: readonly ChapterEditInput[]
}

export interface TocApproveInput {
  readonly mode: TocMode
  readonly comment?: string
  readonly edits?: OutlineEditsInput
}

export interface CreateBookInput {
  readonly prompt: string
  readonly chapters?: number
  readonly wordsPerChapter?: number
  readonly model?: string
  readonly baseUrl?: string
  readonly apiKey?: string
  readonly scholar?: boolean
}
