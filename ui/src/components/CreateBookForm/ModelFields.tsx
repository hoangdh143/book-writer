import { modelPresets, groupedProviders, providerLabels, isCustomChoice } from '../../domain/models'
import { fieldLabel, input } from '../../domain/uiClasses'
import { FieldError } from '../FieldError'
import type { FormValues } from './CreateBookFields'

interface Props {
  readonly values: FormValues
  readonly errors: Record<string, string>
  readonly onPatch: (patch: Partial<FormValues>) => void
}

export const ModelFields = ({ values, errors, onPatch }: Props) => (
  <>
    <label className={fieldLabel}>
      Model
      <select
        className={input}
        value={values.modelId}
        onChange={(event) => onPatch({ modelId: event.target.value })}
      >
        {groupedProviders.map((provider) => (
          <optgroup key={provider} label={providerLabels[provider]}>
            {modelPresets
              .filter((preset) => preset.provider === provider)
              .map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
          </optgroup>
        ))}
        <option value="custom">Custom model…</option>
      </select>
    </label>
    {isCustomChoice(values.modelId) ? (
      <div className="flex flex-col gap-2">
        <label className={fieldLabel}>
          Custom model id
          <input
            className={input}
            value={values.customModel}
            placeholder="e.g. qwen/qwen-2.5-72b-instruct"
            onChange={(event) => onPatch({ customModel: event.target.value })}
          />
        </label>
        <label className={fieldLabel}>
          Base URL <span className="text-slate-500">(optional)</span>
          <input
            className={input}
            value={values.customBaseUrl}
            placeholder="OpenAI-compatible chat-completions URL"
            onChange={(event) => onPatch({ customBaseUrl: event.target.value })}
          />
        </label>
        <FieldError message={errors.customModel ?? errors.customBaseUrl} />
      </div>
    ) : null}
  </>
)
