import { FieldError } from './FieldError'

export interface FormValues {
  readonly prompt: string
  readonly chapters: string
  readonly wordsPerChapter: string
  readonly model: string
  readonly apiKey: string
}

export const initialValues: FormValues = {
  prompt: '',
  chapters: '6',
  wordsPerChapter: '1500',
  model: 'deepseek-chat',
  apiKey: '',
}

interface Props {
  readonly values: FormValues
  readonly errors: Record<string, string>
  readonly onPatch: (patch: Partial<FormValues>) => void
}

export const CreateBookFields = ({ values, errors, onPatch }: Props) => (
  <>
    <label className="field">
      Idea
      <textarea
        rows={3}
        value={values.prompt}
        placeholder="A cozy mystery set in a lighthouse village…"
        onChange={(event) => onPatch({ prompt: event.target.value })}
      />
    </label>
    <FieldError message={errors.prompt} />
    <div className="field-row">
      <label className="field">
        Chapters
        <input
          type="number"
          min={1}
          max={30}
          value={values.chapters}
          onChange={(event) => onPatch({ chapters: event.target.value })}
        />
      </label>
      <label className="field">
        Words / chapter
        <input
          type="number"
          min={200}
          max={5000}
          value={values.wordsPerChapter}
          onChange={(event) => onPatch({ wordsPerChapter: event.target.value })}
        />
      </label>
    </div>
    <FieldError message={errors.chapters ?? errors.wordsPerChapter} />
    <label className="field">
      Model
      <input value={values.model} onChange={(event) => onPatch({ model: event.target.value })} />
    </label>
    <label className="field">
      API key <span className="muted">(empty = server env)</span>
      <input
        type="password"
        value={values.apiKey}
        onChange={(event) => onPatch({ apiKey: event.target.value })}
      />
    </label>
  </>
)
