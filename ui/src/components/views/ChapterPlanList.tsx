import type { ChapterPatch, DraftOutline } from '../../domain/tocEdits'
import { growingText, inlineInput } from '../../domain/uiClasses'

interface Props {
  readonly draft: DraftOutline
  readonly onPatch: (number: number, patch: ChapterPatch) => void
}

export const ChapterPlanList = ({ draft, onPatch }: Props) => (
  <ol className="divide-y divide-slate-800 border-y border-slate-800">
    {draft.chapters.map((chapter) => (
      <li key={chapter.number} className="flex items-start gap-2 py-3">
        <span className="mt-2 w-6 shrink-0 text-right text-sm tabular-nums text-slate-500">{chapter.number}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <input
            className={`${inlineInput} font-medium`}
            value={chapter.title}
            aria-label={`Chapter ${chapter.number} title`}
            onChange={(event) => onPatch(chapter.number, { title: event.target.value })}
          />
          <textarea
            rows={1}
            className={`${inlineInput} ${growingText} text-slate-300`}
            value={chapter.synopsis}
            aria-label={`Chapter ${chapter.number} synopsis`}
            onChange={(event) => onPatch(chapter.number, { synopsis: event.target.value })}
          />
        </div>
      </li>
    ))}
  </ol>
)
