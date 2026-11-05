import { useEffect, useState } from 'react'
import 'katex/dist/katex.min.css'
import { markdownToSafeHtml } from '../domain/mathHtml'

interface Rendered {
  readonly source: string
  readonly html: string
}

/** Book text set for reading; shows the plain source until (or if never) the HTML is ready. */
export const Manuscript = ({ markdown }: { markdown: string }) => {
  const [rendered, setRendered] = useState<Rendered>()

  useEffect(() => {
    const run = new AbortController()
    void markdownToSafeHtml(markdown)
      .then((html) => {
        if (!run.signal.aborted) setRendered({ source: markdown, html })
      })
      .catch((error: unknown) => console.error('Could not render the book text', error))
    return () => run.abort()
  }, [markdown])

  return rendered?.source === markdown ? (
    <article className="manuscript" dangerouslySetInnerHTML={{ __html: rendered.html }} />
  ) : (
    <article className="manuscript whitespace-pre-wrap">{markdown}</article>
  )
}
