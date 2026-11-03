import { useEffect, useState } from 'react'

const useObjectUrl = (content: string): string | undefined => {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const created = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }))
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [content])
  return url
}

export const MarkdownBlock = ({ markdown, filename }: { markdown: string; filename: string }) => {
  const href = useObjectUrl(markdown)
  return (
    <>
      <p>
        {href === undefined ? null : (
          <a className="button-link" href={href} download={filename}>
            Download markdown
          </a>
        )}
      </p>
      <pre className="markdown">{markdown}</pre>
    </>
  )
}
