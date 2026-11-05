import { useMemo } from 'react'
import { useLiveModels } from '../../api/liveModels'
import { assembleOptions, modelPresets } from '../../domain/models'

export const ModelToolsWarning = ({ modelId }: { readonly modelId: string }) => {
  const live = useLiveModels()
  const options = useMemo(() => assembleOptions(modelPresets, live.presets), [live.presets])
  const selected = options.find((option) => option.id === modelId)
  if (selected?.supportsTools !== false) return null
  return (
    <p className="text-sm text-amber-300">
      This model doesn’t support tool use, which the book pipeline needs, so it will likely fail.
      Pick a model without the “no tools” badge.
    </p>
  )
}
