import type { ChapterPatch, DraftOutline } from '../../domain/tocEdits'
import { input } from '../../domain/uiClasses'

interface Props {
  readonly draft: DraftOutline
  readonly onPatch: (number: number, patch: ChapterPatch) => void
}

export const ChapterPlanList = ({ draft, onPatch }: Props) => (
  <ol className="flex flex-col gap-2">
    {draft.chapters.map((chapter) => (
      <li
        key={chapter.number}
        className="flex items-start gap-3 rounded-xl border border-slate-700/70 bg-slate-900/40 p-3"
      >
        <span className="mt-1 min-w-6 text-right text-sm font-semibold text-sky-400">{chapter.number}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            className={input}
            value={chapter.title}
            aria-label={`Chapter ${chapter.number} title`}
            onChange={(event) => onPatch(chapter.number, { title: event.target.value })}
          />
          <textarea
            rows={2}
            className={input}
            value={chapter.synopsis}
            aria-label={`Chapter ${chapter.number} synopsis`}
            onChange={(event) => onPatch(chapter.number, { synopsis: event.target.value })}
          />
        </div>
      </li>
    ))}
  </ol>
)
