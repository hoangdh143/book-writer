import { useEffect, useState } from 'react'

export const useObjectUrl = (content: string | Uint8Array | undefined, mime: string): string | undefined => {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (content === undefined) {
      setUrl(undefined)
      return undefined
    }
    const created = URL.createObjectURL(new Blob([content as BlobPart], { type: mime }))
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [content, mime])
  return url
}
