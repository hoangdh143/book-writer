import type { ChapterStatus } from '../api/types'
import { chapterStateLabel } from '../domain/chapters'

const stateText: Record<string, string> = {
  writing: 'text-sky-300',
  checking: 'text-sky-300',
  written: 'text-emerald-300',
  awaiting_review: 'text-amber-300',
}

const wordLabel = (wordCount: number | null | undefined): string =>
  wordCount == null ? '' : ` · ${wordCount.toLocaleString()} words`

export const ChapterList = ({ chapters }: { chapters: readonly ChapterStatus[] }) =>
  chapters.length === 0 ? null : (
    <ol className="mt-4 divide-y divide-slate-800">
      {chapters.map((chapter) => (
        <li key={chapter.number} className="flex items-baseline gap-3 py-2.5 text-sm">
          <span className="w-5 shrink-0 text-right tabular-nums text-slate-500">{chapter.number}</span>
          <span className="min-w-0 flex-1 truncate text-slate-200">{chapter.title}</span>
          <span className={`shrink-0 text-xs ${stateText[chapter.state] ?? 'text-slate-500'}`}>
            {chapterStateLabel(chapter.state)}
            {wordLabel(chapter.wordCount)}
          </span>
        </li>
      ))}
    </ol>
  )
