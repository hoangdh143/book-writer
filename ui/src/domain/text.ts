export const trimmedOrUndefined = (raw: string): string | undefined => {
  const value = raw.trim()
  return value === '' ? undefined : value
}

export const timeLabel = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString()
}

export const durationLabel = (seconds: number): string =>
  `${Math.floor(seconds / 60)}m ${seconds % 60}s`

export const safeFilename = (raw: string): string => {
  const base = raw
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return base === '' ? 'book.md' : `${base}.md`
}
