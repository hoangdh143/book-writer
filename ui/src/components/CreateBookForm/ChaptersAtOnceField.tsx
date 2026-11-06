import { fieldLabel, hint, input } from '../../domain/uiClasses'
import { FieldError } from '../FieldError'

interface Props {
  readonly value: string
  readonly error?: string
  readonly onChange: (value: string) => void
}

export const ChaptersAtOnceField = ({ value, error, onChange }: Props) => (
  <div className="flex flex-col gap-1.5">
    <label className={fieldLabel}>
      Chapters at once
      <input
        type="number"
        min={1}
        max={10}
        className={`${input} font-normal`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
    <FieldError message={error} />
    <p className={hint}>
      How many chapters to write at the same time when you’re not reviewing each one. Higher is faster.
      Chapters written together can’t see each other’s text, so each group is checked for contradictions and
      repaired before the next one starts. Use 1 for the best consistency.
    </p>
  </div>
)
