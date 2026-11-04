import type { OutlinePatch, DraftOutline } from '../../domain/tocEdits'
import { fieldLabel, input } from '../../domain/uiClasses'

interface Props {
  readonly draft: DraftOutline
  readonly onPatch: (patch: OutlinePatch) => void
}

export const OutlineFields = ({ draft, onPatch }: Props) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <label className={`${fieldLabel} sm:col-span-2`}>
      Title
      <input className={input} value={draft.title} onChange={(event) => onPatch({ title: event.target.value })} />
    </label>
    <label className={fieldLabel}>
      Genre
      <input className={input} value={draft.genre} onChange={(event) => onPatch({ genre: event.target.value })} />
    </label>
    <label className={fieldLabel}>
      Premise
      <textarea
        rows={2}
        className={input}
        value={draft.premise}
        onChange={(event) => onPatch({ premise: event.target.value })}
      />
    </label>
  </div>
)
