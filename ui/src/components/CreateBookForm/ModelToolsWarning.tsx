import { useMemo } from 'react'
import { useLiveModels } from '../../api/liveModels'
import { assembleOptions, modelPresets } from '../../domain/models'

export const ModelToolsWarning = ({ modelId }: { readonly modelId: string }) => {
  const live = useLiveModels()
  const options = useMemo(() => assembleOptions(modelPresets, live.presets), [live.presets])
  const selected = options.find((option) => option.id === modelId)
  if (selected?.supportsTools !== false) return null
  return (
    <p className="text-xs text-amber-400">
      This model does not support tool use — the book pipeline needs it, and OpenRouter may return
      “No endpoints found that support tool use”. Pick a model without the “no tools” badge.
    </p>
  )
}
