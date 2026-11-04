import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { lmStudioChatUrl } from '../domain/models'
import type { ModelPreset } from '../domain/models'
import { http, decodeWith } from './client'

const modelsResponseSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
})

const toPreset = (model: z.infer<typeof modelsResponseSchema>['data'][number]): ModelPreset => ({
  id: model.id,
  label: model.id,
  provider: 'lmstudio',
  baseUrl: lmStudioChatUrl,
})

export const lmStudioKeys = {
  root: ['lmstudio'] as const,
  models: () => [...lmStudioKeys.root, 'models'] as const,
}

export const useLmStudioModels = () =>
  useQuery({
    queryKey: lmStudioKeys.models(),
    queryFn: async () => {
      const body = await http.get('/api/models/lmstudio', decodeWith(modelsResponseSchema))
      return body.data.map(toPreset)
    },
    staleTime: 10 * 60 * 1000,
  })
