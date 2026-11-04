import { useMemo } from 'react'
import { useOpenRouterModels } from './openrouter'
import { useLmStudioModels } from './lmstudio'
import type { LiveModelStatuses } from '../domain/models'
import type { ModelPreset } from '../domain/models'

export const useLiveModels = (): {
  readonly presets: readonly ModelPreset[]
  readonly statuses: LiveModelStatuses
} => {
  const openRouter = useOpenRouterModels()
  const lmStudio = useLmStudioModels()
  const presets = useMemo(
    () => [...(openRouter.data ?? []), ...(lmStudio.data ?? [])],
    [openRouter.data, lmStudio.data],
  )
  const statuses: LiveModelStatuses = {
    openrouter: { pending: openRouter.isPending, error: openRouter.isError },
    lmstudio: { pending: lmStudio.isPending, error: lmStudio.isError },
  }
  return { presets, statuses }
}
