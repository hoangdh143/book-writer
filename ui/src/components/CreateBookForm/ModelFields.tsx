import { isCustomChoice } from '../../domain/models'
import { fieldLabel, input } from '../../domain/uiClasses'
import { FieldError } from '../FieldError'
import { ModelSelect } from './ModelSelect'
import { ModelToolsWarning } from './ModelToolsWarning'
import type { FormValues } from './CreateBookFields'

interface Props {
  readonly values: FormValues
  readonly errors: Record<string, string>
  readonly onPatch: (patch: Partial<FormValues>) => void
}

export const ModelFields = ({ values, errors, onPatch }: Props) => (
  <div className="flex flex-col gap-3">
    <ModelSelect modelId={values.modelId} onSelect={(modelId) => onPatch({ modelId })} />
    <ModelToolsWarning modelId={values.modelId} />
    {isCustomChoice(values.modelId) ? (
      <div className="flex flex-col gap-3">
        <label className={fieldLabel}>
          Custom model id
          <input
            className={`${input} font-normal`}
            value={values.customModel}
            placeholder="e.g. qwen/qwen-2.5-72b-instruct"
            onChange={(event) => onPatch({ customModel: event.target.value })}
          />
        </label>
        <label className={fieldLabel}>
          Base URL (optional)
          <input
            className={`${input} font-normal`}
            value={values.customBaseUrl}
            placeholder="OpenAI-compatible chat-completions URL"
            onChange={(event) => onPatch({ customBaseUrl: event.target.value })}
          />
        </label>
        <FieldError message={errors.customModel ?? errors.customBaseUrl} />
      </div>
    ) : null}
  </div>
)
