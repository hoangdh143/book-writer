import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { openRouterChatUrl } from '../domain/models'
import type { ImageModel } from '../domain/illustrations'
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

const byLabel = (a: { readonly label: string }, b: { readonly label: string }): number =>
  a.label.localeCompare(b.label)

const imageModelsEndpoint = 'https://openrouter.ai/api/v1/images/models'

const imageParameterSchema = z.object({
  values: z.array(z.string()).nullish(),
  max: z.number().nullish(),
})

const imageModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  supported_parameters: z.record(imageParameterSchema).nullish(),
})

const imageModelsResponseSchema = z.object({
  data: z.array(imageModelSchema),
})

const parameterValues = (model: z.infer<typeof imageModelSchema>, name: string): readonly string[] =>
  model.supported_parameters?.[name]?.values ?? []

const toImageModel = (model: z.infer<typeof imageModelSchema>): ImageModel => ({
  id: model.id,
  label: model.name,
  aspectRatios: parameterValues(model, 'aspect_ratio'),
  resolutions: parameterValues(model, 'resolution'),
  qualities: parameterValues(model, 'quality'),
  maxReferences: model.supported_parameters?.['input_references']?.max ?? 0,
})

/** Vector models return SVG, which a book cannot embed because it can load remote resources. */
const canEmbed = (model: z.infer<typeof imageModelSchema>): boolean =>
  !parameterValues(model, 'output_format').includes('svg')

export const openRouterKeys = {
  root: ['openrouter'] as const,
  models: () => [...openRouterKeys.root, 'models'] as const,
  imageModels: () => [...openRouterKeys.root, 'image-models'] as const,
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

export const useOpenRouterImageModels = () =>
  useQuery({
    queryKey: openRouterKeys.imageModels(),
    queryFn: async () => {
      const body = await http.get(imageModelsEndpoint, decodeWith(imageModelsResponseSchema))
      return body.data.filter(canEmbed).map(toImageModel).sort(byLabel)
    },
    staleTime: 10 * 60 * 1000,
  })
