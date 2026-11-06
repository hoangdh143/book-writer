import { useEffect, useRef } from 'react'
import { button, fieldLabel, hint, input, sectionHeading } from '../domain/uiClasses'
import { providerLabels } from '../domain/models'
import { keyProviders, useSettingsStore } from '../store/settingsStore'
import { ConcurrencySetting } from './ConcurrencySetting'
import { CoverImageSettings } from './CoverImageSettings'

interface Props {
  readonly onClose: () => void
}

export const SettingsPanel = ({ onClose }: Props) => {
  const apiKeys = useSettingsStore((state) => state.apiKeys)
  const imageApiKey = useSettingsStore((state) => state.imageApiKey)
  const setApiKey = useSettingsStore((state) => state.setApiKey)
  const clearApiKeys = useSettingsStore((state) => state.clearApiKeys)
  const dialog = useRef<HTMLDialogElement>(null)
  const noKeys = imageApiKey === '' && keyProviders.every((provider) => apiKeys[provider] === '')

  useEffect(() => {
    if (dialog.current?.open === false) dialog.current.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-label="Settings"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/70"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className="p-6">
        <h2 className={sectionHeading}>Settings</h2>
        <p className={`${hint} mt-1 mb-4`}>
          API keys stay in this browser and are sent with each new book or cover. Without one, the server’s
          environment key is used. LM Studio needs no key.
        </p>
        <div className="flex flex-col gap-3">
          {keyProviders.map((provider) => (
            <label key={provider} className={fieldLabel}>
              {providerLabels[provider]} API key
              <input
                type="password"
                autoComplete="off"
                className={input}
                value={apiKeys[provider]}
                onChange={(event) => setApiKey(provider, event.target.value)}
              />
            </label>
          ))}
          <CoverImageSettings />
        </div>
        <div className="mt-3 flex justify-end">
          <button className={button.quiet} disabled={noKeys} onClick={clearApiKeys}>
            Clear saved keys
          </button>
        </div>
        <ConcurrencySetting />
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className={button.primary} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  )
}
