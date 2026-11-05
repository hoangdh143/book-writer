import { providerLabels } from '../../domain/models'
import { hint } from '../../domain/uiClasses'
import type { KeyProvider } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'

interface Props {
  readonly provider: KeyProvider | undefined
  readonly hasKey: boolean
}

export const ApiKeyHint = ({ provider, hasKey }: Props) => {
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen)
  if (provider === undefined) return null
  const label = providerLabels[provider]
  return hasKey ? (
    <p className={hint}>Using your saved {label} key.</p>
  ) : (
    <p className={hint}>
      No {label} key saved.{' '}
      <button type="button" className="text-sky-300 underline hover:text-sky-200" onClick={() => setSettingsOpen(true)}>
        Add one
      </button>
      , or the server’s environment key is used.
    </p>
  )
}
