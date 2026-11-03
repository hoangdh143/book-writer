import type { ChapterPatch, DraftOutline } from '../../domain/tocEdits'

interface Props {
  readonly draft: DraftOutline
  readonly onPatch: (number: number, patch: ChapterPatch) => void
}

export const ChapterPlanList = ({ draft, onPatch }: Props) => (
  <ol className="chapter-plans">
    {draft.chapters.map((chapter) => (
      <li key={chapter.number} className="chapter-plan">
        <span className="chapter-no">{chapter.number}</span>
        <div className="chapter-plan-fields">
          <input
            value={chapter.title}
            aria-label={`Chapter ${chapter.number} title`}
            onChange={(event) => onPatch(chapter.number, { title: event.target.value })}
          />
          <textarea
            rows={2}
            value={chapter.synopsis}
            aria-label={`Chapter ${chapter.number} synopsis`}
            onChange={(event) => onPatch(chapter.number, { synopsis: event.target.value })}
          />
        </div>
      </li>
    ))}
  </ol>
)
