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

export const needsReview = (status: ParsedStatus): boolean =>
  status === 'toc_review' || status === 'chapter_review'

export const pollInterval = (raw: string): number | false => (isActive(parseStatus(raw)) ? 1500 : false)

export const statusLabel: Record<ParsedStatus, string> = {
  planning: 'Planning',
  toc_review: 'Review outline',
  generating: 'Generating',
  chapter_review: 'Review chapter',
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

export const dotClass: Record<ParsedStatus, string> = {
  planning: 'bg-sky-400',
  generating: 'bg-sky-400',
  editing: 'bg-sky-400',
  toc_review: 'bg-amber-400',
  chapter_review: 'bg-amber-400',
  completed: 'bg-emerald-400',
  failed: 'bg-red-400',
  unknown: 'bg-slate-500',
}

export const pipelineSteps = ['Outline', 'Chapters', 'Finishing', 'Done'] as const

const stepsCompleted: Partial<Record<ParsedStatus, number>> = {
  planning: 0,
  toc_review: 0,
  generating: 1,
  chapter_review: 1,
  editing: 2,
  completed: pipelineSteps.length,
}

/** How many pipeline steps are finished; undefined when the book is off the normal path. */
export const completedSteps = (status: ParsedStatus): number | undefined => stepsCompleted[status]
