export const trimmedOrUndefined = (raw: string): string | undefined => {
  const value = raw.trim()
  return value === '' ? undefined : value
}

export const timeLabel = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString()
}

export const durationLabel = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds % 60}s`
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong'

export const safeBaseName = (raw: string): string => {
  const base = raw
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return base === '' ? 'book' : base
}
