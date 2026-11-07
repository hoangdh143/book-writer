import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type KeyProvider = 'deepseek' | 'openai' | 'openrouter'

export const keyProviders: readonly KeyProvider[] = ['deepseek', 'openai', 'openrouter']

interface SettingsStore {
  readonly apiKeys: Record<KeyProvider, string>
  readonly imageApiKey: string
  /** Empty means the server's default image model; OpenRouter models carry the openrouter: prefix. */
  readonly imageModel: string
  /** The cover aspect ratio for an OpenRouter model, chosen when the model is; empty means its default. */
  readonly imageAspectRatio: string
  readonly setApiKey: (provider: KeyProvider, key: string) => void
  readonly setImageApiKey: (key: string) => void
  readonly setImageModel: (model: string, aspectRatio?: string) => void
  readonly clearApiKeys: () => void
}

const emptyKeys: Record<KeyProvider, string> = { deepseek: '', openai: '', openrouter: '' }

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKeys: emptyKeys,
      imageApiKey: '',
      imageModel: '',
      imageAspectRatio: '',
      setApiKey: (provider, key) =>
        set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
      setImageApiKey: (key) => set({ imageApiKey: key }),
      setImageModel: (model, aspectRatio = '') => set({ imageModel: model, imageAspectRatio: aspectRatio }),
      clearApiKeys: () => set({ apiKeys: emptyKeys, imageApiKey: '' }),
    }),
    {
      name: 'book-writer-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        imageApiKey: state.imageApiKey,
        imageModel: state.imageModel,
        imageAspectRatio: state.imageAspectRatio,
      }),
    },
  ),
)
