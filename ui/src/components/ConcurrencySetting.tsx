import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSaveServerSettings, useServerSettings } from '../api/serverSettings'
import { errorMessage } from '../domain/text'
import { button, fieldLabel, hint, input } from '../domain/uiClasses'
import { FieldError } from './FieldError'

const minLimit = 1
const maxLimit = 100

const parseLimit = (raw: string): number | undefined => {
  const value = Number(raw)
  return raw.trim() !== '' && Number.isInteger(value) && value >= minLimit && value <= maxLimit ? value : undefined
}

export const ConcurrencySetting = () => {
  const settings = useServerSettings()
  const save = useSaveServerSettings()
  const [draft, setDraft] = useState<string | undefined>(undefined)

  const current = settings.data?.llmMaxConcurrency
  const shown = draft ?? (current === undefined ? '' : String(current))
  const limit = parseLimit(shown)
  const invalid = shown !== '' && limit === undefined

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (limit === undefined || limit === current) return
    save.mutate({ llmMaxConcurrency: limit }, { onSuccess: () => setDraft(undefined) })
  }

  return (
    <form className="mt-6 border-t border-slate-700 pt-4" noValidate onSubmit={submit}>
      <div className="flex items-end gap-2">
        <label className={`${fieldLabel} flex-1`}>
          Concurrent LLM calls
          <input
            type="number"
            min={minLimit}
            max={maxLimit}
            step={1}
            className={input}
            value={shown}
            disabled={current === undefined}
            onChange={(event) => {
              save.reset()
              setDraft(event.target.value)
            }}
          />
        </label>
        <button
          type="submit"
          className={button.secondary}
          disabled={limit === undefined || limit === current || save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className={`${hint} mt-1.5`}>
        Shared by all books on this server and saved there, not in this browser. A change applies right away.
        Lower it if your provider returns rate-limit errors.
      </p>
      {save.isSuccess ? <p className="mt-1.5 text-sm text-emerald-400">Saved.</p> : null}
      <FieldError
        message={
          invalid
            ? `Enter a whole number from ${minLimit} to ${maxLimit}.`
            : settings.isError
              ? `Couldn’t load this setting: ${errorMessage(settings.error)}`
              : save.isError
                ? errorMessage(save.error)
                : undefined
        }
      />
    </form>
  )
}
