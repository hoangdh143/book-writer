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
      Higher is faster, but chapters written together can’t read each other, so they share only the
      outline. Applies once you stop reviewing chapter by chapter, which always writes one at a time.
      Concurrent LLM calls in Settings still applies.
    </p>
  </div>
)
