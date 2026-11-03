export const bookStatuses = [
  'planning',
  'toc_review',
  'generating',
  'chapter_review',
  'editing',
  'completed',
  'failed',
] as const

export type BookStatus = (typeof bookStatuses)[number]
export type ParsedStatus = BookStatus | 'unknown'

const knownStatuses: ReadonlySet<string> = new Set(bookStatuses)
const activeStatuses: ReadonlySet<ParsedStatus> = new Set<ParsedStatus>([
  'planning',
  'toc_review',
  'generating',
  'chapter_review',
  'editing',
])

export const parseStatus = (raw: string): ParsedStatus =>
  knownStatuses.has(raw) ? (raw as ParsedStatus) : 'unknown'

export const isActive = (status: ParsedStatus): boolean => activeStatuses.has(status)

export const pollInterval = (raw: string): number | false => (isActive(parseStatus(raw)) ? 1500 : false)

export const statusLabel: Record<ParsedStatus, string> = {
  planning: 'Planning',
  toc_review: 'TOC review',
  generating: 'Generating',
  chapter_review: 'Chapter review',
  editing: 'Editing',
  completed: 'Completed',
  failed: 'Failed',
  unknown: 'Unknown',
}
