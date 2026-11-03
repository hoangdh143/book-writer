import type { OutlinePatch, DraftOutline } from '../../domain/tocEdits'

interface Props {
  readonly draft: DraftOutline
  readonly onPatch: (patch: OutlinePatch) => void
}

export const OutlineFields = ({ draft, onPatch }: Props) => (
  <div className="outline-fields">
    <label className="field">
      Title
      <input value={draft.title} onChange={(event) => onPatch({ title: event.target.value })} />
    </label>
    <div className="field-row">
      <label className="field">
        Genre
        <input value={draft.genre} onChange={(event) => onPatch({ genre: event.target.value })} />
      </label>
    </div>
    <label className="field">
      Premise
      <textarea
        rows={2}
        value={draft.premise}
        onChange={(event) => onPatch({ premise: event.target.value })}
      />
    </label>
  </div>
)
