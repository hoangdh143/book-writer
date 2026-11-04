import type { ChapterStatus } from '../api/types'

const stateAccent: Record<string, string> = {
  pending: 'border-slate-600',
  writing: 'border-sky-500',
  written: 'border-emerald-600',
  awaiting_review: 'border-amber-500',
}

const wordLabel = (wordCount: number | null | undefined): string =>
  wordCount == null ? '' : ` · ${wordCount} words`

export const ChapterGrid = ({ chapters }: { chapters: readonly ChapterStatus[] }) =>
  chapters.length === 0 ? null : (
    <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
      {chapters.map((chapter) => (
        <li
          key={chapter.number}
          className={`rounded-lg border-l-4 bg-slate-800/60 p-2.5 ${stateAccent[chapter.state] ?? 'border-slate-600'}`}
        >
          <span className="block text-[11px] text-slate-500">Chapter {chapter.number}</span>
          <span className="block truncate text-[13px] text-slate-200">{chapter.title}</span>
          <span className="block text-[11px] text-slate-500">
            {chapter.state}
            {wordLabel(chapter.wordCount)}
          </span>
        </li>
      ))}
    </ul>
  )
