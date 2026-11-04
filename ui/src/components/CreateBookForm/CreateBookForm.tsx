import { useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import { useCreateBook } from '../../api/bookMutations'
import { resolveModelChoice } from '../../domain/models'
import { trimmedOrUndefined } from '../../domain/text'
import { button, panel } from '../../domain/uiClasses'
import { initialValues, CreateBookFields } from './CreateBookFields'
import type { FormValues } from './CreateBookFields'

const formSchema = z
  .object({
    prompt: z.string().trim().min(1, 'Describe your book idea'),
    chapters: z.coerce.number().int().min(1, '1..30').max(30, '1..30'),
    wordsPerChapter: z.coerce.number().int().min(200, '200..5000').max(5000, '200..5000'),
    modelId: z.string().min(1),
    customModel: z.string(),
    customBaseUrl: z.string(),
    apiKey: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.modelId === 'custom' && values.customModel.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customModel'], message: 'Model id required' })
    }
    const baseUrl = values.customBaseUrl.trim()
    if (baseUrl !== '' && !z.string().url().safeParse(baseUrl).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customBaseUrl'], message: 'Must be a valid URL' })
    }
  })

const errorsOf = (error: z.ZodError): Record<string, string> =>
  error.issues.reduce<Record<string, string>>((acc, issue) => {
    const key = String(issue.path[0] ?? 'form')
    return { ...acc, [key]: issue.message }
  }, {})

export const CreateBookForm = () => {
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreateBook()

  const patchValues = (patch: Partial<FormValues>): void =>
    setValues((current) => ({ ...current, ...patch }))

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const parsed = formSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(errorsOf(parsed.error))
      return
    }
    setErrors({})
    create.mutate({
      prompt: parsed.data.prompt,
      chapters: parsed.data.chapters,
      wordsPerChapter: parsed.data.wordsPerChapter,
      apiKey: trimmedOrUndefined(parsed.data.apiKey),
      ...resolveModelChoice(parsed.data.modelId, parsed.data.customModel, parsed.data.customBaseUrl),
    })
  }

  return (
    <form className={`${panel} flex flex-col`} onSubmit={submit}>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-300">New book</h2>
      <div className="flex flex-col gap-3">
        <CreateBookFields values={values} errors={errors} onPatch={patchValues} />
        <button className={button.primary} type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create book'}
        </button>
      </div>
    </form>
  )
}
