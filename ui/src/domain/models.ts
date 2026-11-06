export type Provider = 'deepseek' | 'openai' | 'openrouter' | 'lmstudio' | 'custom'

export interface ModelChoice {
  readonly model: string
  readonly baseUrl?: string
}

export interface ModelPreset {
  readonly id: string
  readonly label: string
  readonly provider: Exclude<Provider, 'custom'>
  readonly baseUrl: string
  readonly supportsTools?: boolean
}

export interface ModelOption {
  readonly id: string
  readonly label: string
  readonly provider: Provider
  readonly supportsTools?: boolean
}

export const customModelId = 'custom'

export const openRouterChatUrl = 'https://openrouter.ai/api/v1/chat/completions'

export const lmStudioChatUrl = 'http://localhost:1234/v1/chat/completions'

export const providerLabels: Record<Exclude<Provider, 'custom'>, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  lmstudio: 'LM Studio',
}

export const groupedProviders: readonly Exclude<Provider, 'custom'>[] = [
  'deepseek',
  'openai',
  'openrouter',
  'lmstudio',
]

export const modelPresets: readonly ModelPreset[] = [
  {
    id: 'deepseek-chat',
    label: 'DeepSeek Chat',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/chat/completions',
  },
  {
    id: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/chat/completions',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
  },
]

export const imageModels: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'gpt-image-2.6-sunburst', label: 'GPT Image 2.6 Sunburst (detailed compositions)' },
  { id: 'gpt-image-2.6-flare', label: 'GPT Image 2.6 Flare (faster)' },
]

export const customOption: ModelOption = {
  id: customModelId,
  label: 'Custom model…',
  provider: 'custom',
}

export interface ModelOptionEntry {
  readonly option: ModelOption
  readonly index: number
}

export interface ModelOptionGroup {
  readonly provider: Exclude<Provider, 'custom'>
  readonly label: string
  readonly options: readonly ModelOptionEntry[]
}

export const assembleOptions = (
  staticPresets: readonly ModelPreset[],
  livePresets: readonly ModelPreset[],
): readonly ModelOption[] => [...staticPresets, ...livePresets, customOption]

export const matchesQuery = (option: ModelOption, query: string): boolean => {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return option.label.toLowerCase().includes(needle) || option.id.toLowerCase().includes(needle)
}

export const optionGroups = (options: readonly ModelOption[]): readonly ModelOptionGroup[] =>
  groupedProviders.map((provider) => ({
    provider,
    label: providerLabels[provider],
    options: options
      .map((option, index) => ({ option, index }))
      .filter((entry) => entry.option.provider === provider),
  }))

export const modelLabel = (modelId: string, options: readonly ModelOption[]): string =>
  options.find((option) => option.id === modelId)?.label ?? modelId

export const providerForModelId = (
  modelId: string,
  livePresets: readonly ModelPreset[] = [],
): Provider | undefined => {
  if (isCustomChoice(modelId)) return 'custom'
  const preset = [...modelPresets, ...livePresets].find((candidate) => candidate.id === modelId)
  if (preset !== undefined) return preset.provider
  return modelId.includes('/') ? 'openrouter' : undefined
}

export interface LiveModelStatus {
  readonly pending: boolean
  readonly error: boolean
}

export type LiveModelStatuses = Record<'openrouter' | 'lmstudio', LiveModelStatus>

export const isCustomChoice = (modelId: string): boolean => modelId === customModelId

export const resolveModelChoice = (
  modelId: string,
  customModel: string,
  customBaseUrl: string,
  livePresets: readonly ModelPreset[] = [],
): ModelChoice => {
  if (isCustomChoice(modelId)) {
    const baseUrl = customBaseUrl.trim()
    return { model: customModel.trim(), baseUrl: baseUrl === '' ? undefined : baseUrl }
  }
  const preset = [...modelPresets, ...livePresets].find((candidate) => candidate.id === modelId)
  if (preset !== undefined) return { model: preset.id, baseUrl: preset.baseUrl }
  return modelId.includes('/')
    ? { model: modelId, baseUrl: openRouterChatUrl }
    : { model: modelId }
}
