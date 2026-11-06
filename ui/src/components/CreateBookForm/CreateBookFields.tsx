import { fieldLabel, growingText, hint, input } from '../../domain/uiClasses'
import { FieldError } from '../FieldError'
import { ChaptersAtOnceField } from './ChaptersAtOnceField'
import { ModelFields } from './ModelFields'
import { OptionCheckbox } from './OptionCheckbox'

export interface FormValues {
  readonly prompt: string
  readonly chapters: string
  readonly wordsPerChapter: string
  readonly chaptersAtOnce: string
  readonly modelId: string
  readonly customModel: string
  readonly customBaseUrl: string
  readonly scholar: boolean
  readonly diagrams: boolean
}

export const initialValues: FormValues = {
  prompt: '',
  chapters: '6',
  wordsPerChapter: '1500',
  chaptersAtOnce: '1',
  modelId: 'deepseek-chat',
  customModel: '',
  customBaseUrl: '',
  scholar: false,
  diagrams: false,
}

interface Props {
  readonly values: FormValues
  readonly errors: Record<string, string>
  readonly onPatch: (patch: Partial<FormValues>) => void
}

const lengthEstimate = ({ chapters, wordsPerChapter }: FormValues): string | undefined => {
  const total = Number(chapters) * Number(wordsPerChapter)
  return Number.isFinite(total) && total > 0 ? `About ${total.toLocaleString()} words in total.` : undefined
}

export const CreateBookFields = ({ values, errors, onPatch }: Props) => (
  <>
    <div className="flex flex-col gap-1.5">
      <label className={fieldLabel}>
        Book idea
        <textarea
                    className={`${input} ${growingText} min-h-32 max-h-96 font-normal`}
          value={values.prompt}
          placeholder="A cozy mystery set in a lighthouse village…"
          onChange={(event) => onPatch({ prompt: event.target.value })}
        />
      </label>
      <FieldError message={errors.prompt} />
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-4">
        <label className={fieldLabel}>
          Chapters
          <input
            type="number"
            min={1}
            max={30}
            className={`${input} font-normal`}
            value={values.chapters}
            onChange={(event) => onPatch({ chapters: event.target.value })}
          />
        </label>
        <label className={fieldLabel}>
          Words per chapter
          <input
            type="number"
            min={200}
            step={100}
            className={`${input} font-normal`}
            value={values.wordsPerChapter}
            onChange={(event) => onPatch({ wordsPerChapter: event.target.value })}
          />
        </label>
      </div>
      <FieldError message={errors.chapters ?? errors.wordsPerChapter} />
      <p className={hint}>{lengthEstimate(values)}</p>
    </div>
    <ChaptersAtOnceField
      value={values.chaptersAtOnce}
      error={errors.chaptersAtOnce}
      onChange={(chaptersAtOnce) => onPatch({ chaptersAtOnce })}
    />
    <OptionCheckbox
      label="Scholar mode"
      description="Produce a research paper instead of a book: a real bibliography with numbered citations, per-section fact cross-checking with automatic repairs, and a peer-review pass before assembly."
      checked={values.scholar}
      onChange={(scholar) => onPatch({ scholar })}
    />
    <OptionCheckbox
      label="Diagrams"
      description="Let the writer add diagrams where they help, such as flowcharts and sequence diagrams. They are drawn when the book is finished, so chapter review shows their source."
      checked={values.diagrams}
      onChange={(diagrams) => onPatch({ diagrams })}
    />
    <ModelFields values={values} errors={errors} onPatch={onPatch} />
  </>
)
