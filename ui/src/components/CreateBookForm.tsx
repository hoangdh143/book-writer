import { useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import { useCreateBook } from '../api/bookMutations'
import { trimmedOrUndefined } from '../domain/text'
import { ErrorNotice } from './ErrorNotice'
import { FieldError } from './FieldError'
import { initialValues, CreateBookFields } from './CreateBookFields'
import type { FormValues } from './CreateBookFields'

const formSchema = z.object({
  prompt: z.string().trim().min(1, 'Describe your book idea'),
  chapters: z.coerce.number().int().min(1, '1..30').max(30, '1..30'),
  wordsPerChapter: z.coerce.number().int().min(200, '200..5000').max(5000, '200..5000'),
  model: z.string().trim().min(1, 'Model id required'),
  apiKey: z.string(),
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
      model: parsed.data.model,
      apiKey: trimmedOrUndefined(parsed.data.apiKey),
    })
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <h2>New book</h2>
      <CreateBookFields values={values} errors={errors} onPatch={patchValues} />
      <FieldError message={errors.model ?? errors.apiKey} />
      <button className="primary" type="submit" disabled={create.isPending}>
        {create.isPending ? 'Creating…' : 'Create book'}
      </button>
      <ErrorNotice error={create.error} />
    </form>
  )
}
