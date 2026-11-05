import type { OutlinePatch, DraftOutline } from '../../domain/tocEdits'
import { fieldLabel, growingText, input } from '../../domain/uiClasses'

interface Props {
  readonly draft: DraftOutline
  readonly onPatch: (patch: OutlinePatch) => void
}

export const OutlineFields = ({ draft, onPatch }: Props) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <label className={`${fieldLabel} sm:col-span-2`}>
      Title
      <input className={`${input} font-normal`} value={draft.title} onChange={(event) => onPatch({ title: event.target.value })} />
    </label>
    <label className={fieldLabel}>
      Genre
      <input className={`${input} font-normal`} value={draft.genre} onChange={(event) => onPatch({ genre: event.target.value })} />
    </label>
    <label className={`${fieldLabel} sm:col-span-3`}>
      Premise
      <textarea
        className={`${input} ${growingText} font-normal`}
        value={draft.premise}
        onChange={(event) => onPatch({ premise: event.target.value })}
      />
    </label>
  </div>
)
