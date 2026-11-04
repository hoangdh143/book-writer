import { useEffect } from 'react'
import { button, fieldLabel, input, panel } from '../domain/uiClasses'
import { providerLabels } from '../domain/models'
import { keyProviders, useSettingsStore } from '../store/settingsStore'

interface Props {
  readonly onClose: () => void
}

export const SettingsPanel = ({ onClose }: Props) => {
  const apiKeys = useSettingsStore((state) => state.apiKeys)
  const setApiKey = useSettingsStore((state) => state.setApiKey)
  const clearApiKeys = useSettingsStore((state) => state.clearApiKeys)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Settings"
        className={`${panel} w-full max-w-md`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
          Settings
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          API keys are stored only in this browser (localStorage) and sent with book-creation
          requests when the form key is left empty. LM Studio needs no key.
        </p>
        <div className="flex flex-col gap-3">
          {keyProviders.map((provider) => (
            <label key={provider} className={fieldLabel}>
              {providerLabels[provider]} API key
              <input
                type="password"
                className={input}
                value={apiKeys[provider]}
                placeholder="saved locally on change"
                onChange={(event) => setApiKey(provider, event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className={button.danger} onClick={clearApiKeys}>
            Clear saved keys
          </button>
          <button className={button.primary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
