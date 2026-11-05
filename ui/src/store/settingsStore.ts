import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type KeyProvider = 'deepseek' | 'openai' | 'openrouter' | 'wiro'

export const keyProviders: readonly KeyProvider[] = ['deepseek', 'openai', 'openrouter', 'wiro']

interface SettingsStore {
  readonly apiKeys: Record<KeyProvider, string>
  readonly setApiKey: (provider: KeyProvider, key: string) => void
  readonly clearApiKeys: () => void
}

const emptyKeys: Record<KeyProvider, string> = { deepseek: '', openai: '', openrouter: '', wiro: '' }

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
      // Settings saved before a provider existed lack its key; keep every provider a string.
      merge: (persisted, current) => ({
        ...current,
        apiKeys: { ...emptyKeys, ...(persisted as Partial<SettingsStore> | undefined)?.apiKeys },
      }),
    },
  ),
)
