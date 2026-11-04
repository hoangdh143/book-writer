import { fieldLabel, input } from '../../domain/uiClasses'
import { FieldError } from '../FieldError'
import { ModelFields } from './ModelFields'

export interface FormValues {
  readonly prompt: string
  readonly chapters: string
  readonly wordsPerChapter: string
  readonly apiKey: string
  readonly modelId: string
  readonly customModel: string
  readonly customBaseUrl: string
}

export const initialValues: FormValues = {
  prompt: '',
  chapters: '6',
  wordsPerChapter: '1500',
  apiKey: '',
  modelId: 'deepseek-chat',
  customModel: '',
  customBaseUrl: '',
}

interface Props {
  readonly values: FormValues
  readonly errors: Record<string, string>
  readonly onPatch: (patch: Partial<FormValues>) => void
}

export const CreateBookFields = ({ values, errors, onPatch }: Props) => (
  <>
    <label className={fieldLabel}>
      Idea
      <textarea
        rows={3}
        className={input}
        value={values.prompt}
        placeholder="A cozy mystery set in a lighthouse village…"
        onChange={(event) => onPatch({ prompt: event.target.value })}
      />
    </label>
    <FieldError message={errors.prompt} />
    <div className="grid grid-cols-2 gap-2">
      <label className={fieldLabel}>
        Chapters
        <input
          type="number"
          min={1}
          max={30}
          className={input}
          value={values.chapters}
          onChange={(event) => onPatch({ chapters: event.target.value })}
        />
      </label>
      <label className={fieldLabel}>
        Words / chapter
        <input
          type="number"
          min={200}
          max={5000}
          className={input}
          value={values.wordsPerChapter}
          onChange={(event) => onPatch({ wordsPerChapter: event.target.value })}
        />
      </label>
    </div>
    <FieldError message={errors.chapters ?? errors.wordsPerChapter} />
    <ModelFields values={values} errors={errors} onPatch={onPatch} />
    <label className={fieldLabel}>
      API key <span className="text-slate-500">(empty = server env; OpenRouter needs a pasted key)</span>
      <input
        type="password"
        className={input}
        value={values.apiKey}
        onChange={(event) => onPatch({ apiKey: event.target.value })}
      />
    </label>
  </>
)
