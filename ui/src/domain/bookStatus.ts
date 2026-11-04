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

export const badgeClass: Record<ParsedStatus, string> = {
  planning: 'border-sky-800 bg-sky-950/50 text-sky-300',
  generating: 'border-sky-800 bg-sky-950/50 text-sky-300',
  editing: 'border-sky-800 bg-sky-950/50 text-sky-300',
  toc_review: 'border-amber-800 bg-amber-950/50 text-amber-300',
  chapter_review: 'border-amber-800 bg-amber-950/50 text-amber-300',
  completed: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
  failed: 'border-red-800 bg-red-950/50 text-red-300',
  unknown: 'border-slate-700 bg-slate-900 text-slate-400',
}
