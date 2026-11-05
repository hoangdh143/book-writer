import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { http, decodeWith } from './client'

const path = '/api/settings'

const serverSettingsSchema = z.object({ llmMaxConcurrency: z.number().int() })

export type ServerSettings = z.infer<typeof serverSettingsSchema>

const serverSettingsKey = ['server-settings'] as const

export const useServerSettings = () =>
  useQuery({
    queryKey: serverSettingsKey,
    queryFn: () => http.get(path, decodeWith(serverSettingsSchema)),
  })

export const useSaveServerSettings = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (settings: ServerSettings) => http.put(path, decodeWith(serverSettingsSchema), settings),
    onSuccess: (saved) => client.setQueryData(serverSettingsKey, saved),
  })
}
