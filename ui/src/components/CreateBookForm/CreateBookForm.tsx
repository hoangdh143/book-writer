import { useLayoutEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import { useCreateBook } from '../../api/bookMutations'
import { useLiveModels } from '../../api/liveModels'
import { useOpenRouterImageModels } from '../../api/openrouter'
import type { IllustrationsInput } from '../../api/requests'
import { imageChoicesFor, maxImagesPerChapter } from '../../domain/illustrations'
import type { ImageModel } from '../../domain/illustrations'
import { providerForModelId, resolveModelChoice } from '../../domain/models'
import type { KeyProvider } from '../../store/settingsStore'
import type { ModelPreset } from '../../domain/models'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'
import { button, hint, pageHeading } from '../../domain/uiClasses'
import { ApiKeyHint } from './ApiKeyHint'
import { initialValues, CreateBookFields } from './CreateBookFields'
import type { FormValues } from './CreateBookFields'

const formSchema = z
  .object({
    prompt: z.string().trim().min(1, 'Describe your book idea'),
    chapters: z.coerce.number().int().min(1, 'Choose 1 to 30 chapters').max(30, 'Choose 1 to 30 chapters'),
    wordsPerChapter: z.coerce.number().int().min(200, 'Use at least 200 words per chapter'),
    chaptersAtOnce: z.coerce.number().int().min(1, 'Choose 1 to 10 chapters at once').max(10, 'Choose 1 to 10 chapters at once'),
    modelId: z.string().min(1),
    customModel: z.string(),
    customBaseUrl: z.string(),
    illustrations: z.boolean(),
    imagesPerChapter: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.modelId === 'custom' && values.customModel.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customModel'], message: 'Model id required' })
    }
    const baseUrl = values.customBaseUrl.trim()
    if (baseUrl !== '' && !z.string().url().safeParse(baseUrl).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customBaseUrl'], message: 'Must be a valid URL' })
    }
    const perChapter = Number(values.imagesPerChapter)
    if (values.illustrations && (!Number.isInteger(perChapter) || perChapter < 1 || perChapter > maxImagesPerChapter)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['imagesPerChapter'],
        message: `Choose 1 to ${maxImagesPerChapter} illustrations per chapter`,
      })
    }
  })

const errorsOf = (error: z.ZodError): Record<string, string> =>
  error.issues.reduce<Record<string, string>>((acc, issue) => {
    const key = String(issue.path[0] ?? 'form')
    return { ...acc, [key]: issue.message }
  }, {})

const savedKeyFor = (
  modelId: string,
  livePresets: readonly ModelPreset[],
  apiKeys: Record<KeyProvider, string>,
): { readonly key: string; readonly provider?: KeyProvider } => {
  const provider = providerForModelId(modelId, livePresets)
  if (provider === undefined || provider === 'custom' || provider === 'lmstudio') return { key: '' }
  return { key: apiKeys[provider].trim(), provider }
}

const illustrationsInput = (
  values: FormValues,
  models: readonly ImageModel[],
  apiKey: string,
): IllustrationsInput | undefined => {
  if (!values.illustrations) return undefined
  const style = values.imageStyle.trim()
  return {
    ...imageChoicesFor(models.find((model) => model.id === values.imageModelId), values),
    model: values.imageModelId,
    perChapter: Number(values.imagesPerChapter),
    style: style === '' ? undefined : style,
    apiKey: apiKey === '' ? undefined : apiKey,
  }
}

export const CreateBookForm = () => {
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [copiedFrom, setCopiedFrom] = useState<string>()
  const bookCopy = useUiStore((state) => state.bookCopy)
  const clearBookCopy = useUiStore((state) => state.clearBookCopy)
  const create = useCreateBook()
  const live = useLiveModels()
  const savedKeys = useSettingsStore((state) => state.apiKeys)
  const imageModels = useOpenRouterImageModels()

  useLayoutEffect(() => {
    if (bookCopy === null) return
    setValues(bookCopy.values)
    setErrors({})
    setCopiedFrom(bookCopy.from)
    clearBookCopy()
  }, [bookCopy, clearBookCopy])

  const patchValues = (patch: Partial<FormValues>): void =>
    setValues((current) => ({ ...current, ...patch }))

  const saved = savedKeyFor(values.modelId, live.presets, savedKeys)

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const parsed = formSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(errorsOf(parsed.error))
      return
    }
    setErrors({})
    create.mutate(
      {
        prompt: parsed.data.prompt,
        chapters: parsed.data.chapters,
        wordsPerChapter: parsed.data.wordsPerChapter,
        concurrency: parsed.data.chaptersAtOnce > 1 ? parsed.data.chaptersAtOnce : undefined,
        apiKey: saved.key === '' ? undefined : saved.key,
        scholar: values.scholar || undefined,
        diagrams: values.diagrams || undefined,
        illustrations: illustrationsInput(values, imageModels.data ?? [], savedKeys.openrouter.trim()),
        ...resolveModelChoice(parsed.data.modelId, parsed.data.customModel, parsed.data.customBaseUrl, live.presets),
      },
      {
        onSuccess: () => {
          patchValues({ prompt: '' })
          setCopiedFrom(undefined)
        },
      },
    )
  }

  return (
    <form className="flex flex-col" noValidate onSubmit={submit}>
      <h2 className={pageHeading}>New book</h2>
      <p className={`${hint} mt-1 mb-6`}>
        Describe your idea. You’ll approve an outline before any chapter is written, and can review
        each chapter as it’s finished.
      </p>
      {copiedFrom === undefined ? null : (
        <p className="mb-6 -mt-3 text-sm text-sky-300">
          Copied from “{copiedFrom}”. Change anything you like. Nothing starts until you press Create book.
        </p>
      )}
      <div className="flex flex-col gap-5">
        <CreateBookFields values={values} errors={errors} onPatch={patchValues} />
        <ApiKeyHint provider={saved.provider} hasKey={saved.key !== ''} />
        <div>
          <button className={button.primary} type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create book'}
          </button>
        </div>
      </div>
    </form>
  )
}
