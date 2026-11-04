import { useEffect, useState } from 'react'

export const useObjectUrl = (content: string, mime: string): string | undefined => {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const created = URL.createObjectURL(new Blob([content], { type: mime }))
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [content, mime])
  return url
}
