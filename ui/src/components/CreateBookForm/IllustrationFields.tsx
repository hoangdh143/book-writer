import { useOpenRouterImageModels } from '../../api/openrouter'
import { imageChoicesFor, maxImagesPerChapter } from '../../domain/illustrations'
import { fieldLabel, growingText, hint, input } from '../../domain/uiClasses'
import { useSettingsStore } from '../../store/settingsStore'
import { FieldError } from '../FieldError'
import { ApiKeyHint } from './ApiKeyHint'
import type { FormValues } from './CreateBookFields'
import { OptionCheckbox } from './OptionCheckbox'

interface Props {
  readonly values: FormValues
  readonly errors: Record<string, string>
  readonly onPatch: (patch: Partial<FormValues>) => void
}

const ChoiceSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | undefined
  options: readonly string[]
  onChange: (value: string) => void
}) =>
  options.length === 0 ? null : (
    <label className={fieldLabel}>
      {label}
      <select className={`${input} font-normal`} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Model default</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )

const imageCountHint = ({ chapters, imagesPerChapter }: FormValues): string | undefined => {
  const total = Number(chapters) * Number(imagesPerChapter)
  return Number.isFinite(total) && total > 0 ? `Up to ${total.toLocaleString()} images in this book.` : undefined
}

export const IllustrationFields = ({ values, errors, onPatch }: Props) => {
  const models = useOpenRouterImageModels()
  const hasKey = useSettingsStore((state) => state.apiKeys.openrouter.trim() !== '')
  const list = models.data ?? []
  const model = list.find((candidate) => candidate.id === values.imageModelId)
  const choices = imageChoicesFor(model, values)

  return (
    <div className="flex flex-col gap-3">
      <OptionCheckbox
        label="Illustrations"
        description="Let the writer ask for AI-generated illustrations where they help. They are generated when the book is finished, so chapter review shows each description and revising a chapter costs nothing extra."
        checked={values.illustrations}
        onChange={(illustrations) => onPatch({ illustrations })}
      />
      {values.illustrations ? (
        <div className="ml-6 flex flex-col gap-4 border-l border-slate-800 pl-4">
          <label className={fieldLabel}>
            Image model
            <select
              className={`${input} font-normal`}
              value={values.imageModelId}
              onChange={(event) => onPatch({ imageModelId: event.target.value })}
            >
              {model === undefined ? <option value={values.imageModelId}>{values.imageModelId}</option> : null}
              {list.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {models.isPending ? <p className={hint}>Loading image models from OpenRouter…</p> : null}
          {models.isError ? (
            <p className="text-sm text-amber-300">
              Could not load image models from OpenRouter, so the options below are hidden and the model’s defaults apply.{' '}
              <button type="button" className="text-sky-300 underline hover:text-sky-200" onClick={() => void models.refetch()}>
                Try again
              </button>
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ChoiceSelect
              label="Aspect ratio"
              value={choices.aspectRatio}
              options={model?.aspectRatios ?? []}
              onChange={(imageAspectRatio) => onPatch({ imageAspectRatio })}
            />
            <ChoiceSelect
              label="Resolution"
              value={choices.resolution}
              options={model?.resolutions ?? []}
              onChange={(imageResolution) => onPatch({ imageResolution })}
            />
            <ChoiceSelect
              label="Quality"
              value={choices.quality}
              options={model?.qualities ?? []}
              onChange={(imageQuality) => onPatch({ imageQuality })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={fieldLabel}>
              Illustrations per chapter (at most)
              <input
                type="number"
                min={1}
                max={maxImagesPerChapter}
                className={`${input} font-normal`}
                value={values.imagesPerChapter}
                onChange={(event) => onPatch({ imagesPerChapter: event.target.value })}
              />
            </label>
            <FieldError message={errors.imagesPerChapter} />
            <p className={hint}>
              {imageCountHint(values)} The writer may use fewer. OpenRouter bills each image;{' '}
              <a
                className="text-sky-300 underline hover:text-sky-200"
                href={`https://openrouter.ai/${values.imageModelId}`}
                target="_blank"
                rel="noreferrer"
              >
                see this model’s prices
              </a>
              . The book’s activity log shows what was spent.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={fieldLabel}>
              Illustration style (optional)
              <textarea
                className={`${input} ${growingText} max-h-32 font-normal`}
                maxLength={500}
                value={values.imageStyle}
                placeholder="e.g. Soft watercolour with muted colours and clean ink outlines"
                onChange={(event) => onPatch({ imageStyle: event.target.value })}
              />
            </label>
            <FieldError message={errors.imageStyle} />
          </div>
          {model === undefined || model.maxReferences === 0 ? null : (
            <OptionCheckbox
              label="Match the first illustration"
              description="Send the book's first image with the others as a style reference, for a more consistent look. It can cost slightly more per image."
              checked={values.imageReference}
              onChange={(imageReference) => onPatch({ imageReference })}
            />
          )}
          <ApiKeyHint provider="openrouter" hasKey={hasKey} />
        </div>
      ) : null}
    </div>
  )
}
