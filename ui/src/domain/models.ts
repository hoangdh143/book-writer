export type Provider = 'deepseek' | 'openai' | 'openrouter' | 'custom'

export interface ModelChoice {
  readonly model: string
  readonly baseUrl?: string
}

export interface ModelPreset {
  readonly id: string
  readonly label: string
  readonly provider: Exclude<Provider, 'custom'>
  readonly baseUrl: string
}

export const customModelId = 'custom'

export const providerLabels: Record<Exclude<Provider, 'custom'>, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
}

export const groupedProviders: readonly Exclude<Provider, 'custom'>[] = [
  'deepseek',
  'openai',
  'openrouter',
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
  {
    id: 'openrouter/gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    label: 'Claude 3.7 Sonnet',
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    id: 'google/gemini-2.0-flash-001',
    label: 'Gemini 2.0 Flash',
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B Instruct',
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    id: 'deepseek/deepseek-chat',
    label: 'DeepSeek Chat',
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    id: 'mistralai/mistral-nemo',
    label: 'Mistral Nemo',
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  },
]

export const isCustomChoice = (modelId: string): boolean => modelId === customModelId

const presetById = (modelId: string): ModelPreset | undefined =>
  modelPresets.find((preset) => preset.id === modelId)

export const resolveModelChoice = (
  modelId: string,
  customModel: string,
  customBaseUrl: string,
): ModelChoice => {
  if (isCustomChoice(modelId)) {
    const baseUrl = customBaseUrl.trim()
    return { model: customModel.trim(), baseUrl: baseUrl === '' ? undefined : baseUrl }
  }
  const preset = presetById(modelId)
  return preset === undefined ? { model: modelId } : { model: preset.id, baseUrl: preset.baseUrl }
}
