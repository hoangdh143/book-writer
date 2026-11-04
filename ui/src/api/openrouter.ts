import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { openRouterChatUrl } from '../domain/models'
import type { ModelPreset } from '../domain/models'
import { http, decodeWith } from './client'

const modelsEndpoint = 'https://openrouter.ai/api/v1/models'

const openRouterModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  supported_parameters: z.array(z.string()).nullish(),
})

const modelsResponseSchema = z.object({
  data: z.array(openRouterModelSchema),
})

const toPreset = (model: z.infer<typeof openRouterModelSchema>): ModelPreset => ({
  id: model.id,
  label: model.name,
  provider: 'openrouter',
  baseUrl: openRouterChatUrl,
  supportsTools:
    model.supported_parameters === null || model.supported_parameters === undefined
      ? undefined
      : model.supported_parameters.includes('tools'),
})

const byLabel = (a: ModelPreset, b: ModelPreset): number => a.label.localeCompare(b.label)

export const openRouterKeys = {
  root: ['openrouter'] as const,
  models: () => [...openRouterKeys.root, 'models'] as const,
}

export const useOpenRouterModels = () =>
  useQuery({
    queryKey: openRouterKeys.models(),
    queryFn: async () => {
      const body = await http.get(modelsEndpoint, decodeWith(modelsResponseSchema))
      return body.data.map(toPreset).sort(byLabel)
    },
    staleTime: 10 * 60 * 1000,
  })
