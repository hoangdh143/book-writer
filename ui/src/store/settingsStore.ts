import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type KeyProvider = 'deepseek' | 'openai' | 'openrouter'

export const keyProviders: readonly KeyProvider[] = ['deepseek', 'openai', 'openrouter']

interface SettingsStore {
  readonly apiKeys: Record<KeyProvider, string>
  readonly setApiKey: (provider: KeyProvider, key: string) => void
  readonly clearApiKeys: () => void
}

const emptyKeys: Record<KeyProvider, string> = { deepseek: '', openai: '', openrouter: '' }

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKeys: emptyKeys,
      setApiKey: (provider, key) =>
        set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
      clearApiKeys: () => set({ apiKeys: emptyKeys }),
    }),
    {
      name: 'book-writer-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ apiKeys: state.apiKeys }),
    },
  ),
)
