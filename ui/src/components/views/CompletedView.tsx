import { useEffect, useState } from 'react'
import type { Book } from '../../api/types'
import { fetchCover, generateCover } from '../../api/endpoints'
import type { CoverImage } from '../../api/endpoints'
import { exportFormats, syncArtifact } from '../../domain/export'
import type { ExportArtifact, ExportFormat } from '../../domain/export'
import { buildEpub } from '../../domain/epubExport'
import { safeBaseName } from '../../domain/text'
import { button, hint, input } from '../../domain/uiClasses'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { Manuscript } from '../Manuscript'

/** One in-flight/finished cover request per book, so exports and renders share it. */
const coverCache = new Map<string, Promise<CoverImage>>()

const coverFor = (bookId: string): Promise<CoverImage> => {
  const cached = coverCache.get(bookId)
  if (cached !== undefined) return cached
  const request = fetchCover(bookId).then((found) => found ?? generateCover(bookId))
  coverCache.set(bookId, request)
  request.catch(() => coverCache.delete(bookId))
  return request
}

const epubArtifact = async (
  markdown: string,
  baseName: string,
  cover?: CoverImage,
): Promise<ExportArtifact> => ({
  content: await buildEpub(markdown, baseName, cover),
  filename: `${baseName}.epub`,
  mime: 'application/epub+zip',
})

const ExportBar = ({
  markdown,
  baseName,
  coverPromise,
}: {
  markdown: string
  baseName: string
  coverPromise?: Promise<CoverImage>
}) => {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [loaded, setLoaded] = useState<ExportArtifact & { readonly format: ExportFormat }>()
  const [failedFormat, setFailedFormat] = useState<ExportFormat>()
  useEffect(() => {
    const load = async (): Promise<ExportArtifact & { readonly format: ExportFormat }> => {
      if (format !== 'epub') return { format, ...syncArtifact(markdown, format, baseName) }
      const cover = await coverPromise?.catch(() => undefined)
      return { format, ...(await epubArtifact(markdown, baseName, cover)) }
    }
    setFailedFormat(undefined)
    void load()
      .then(setLoaded)
      .catch(() => {
        setLoaded(undefined)
        setFailedFormat(format)
      })
  }, [markdown, format, baseName, coverPromise])
  const artifact = loaded?.format === format ? loaded : undefined
  const href = useObjectUrl(artifact?.content, artifact?.mime ?? 'application/octet-stream')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-slate-300">
        Format
        <select
          className={`${input} w-auto`}
          value={format}
          onChange={(event) => setFormat(event.target.value as ExportFormat)}
        >
          {exportFormats.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {failedFormat === format ? <span className="text-sm text-red-300">Could not prepare this format.</span> : null}
      {artifact === undefined && failedFormat !== format ? <span className={hint}>Preparing…</span> : null}
      {href === undefined ? null : (
        <a className={button.primary} href={href} download={artifact?.filename}>
          Download
        </a>
      )}
    </div>
  )
}

export const CompletedView = ({ book }: { book: Book }) => {
  const baseName = safeBaseName(book.outline?.title ?? book.id)
  const hasMarkdown = book.markdown != null
  const [cover, setCover] = useState<CoverImage>()
  const [coverError, setCoverError] = useState<string>()
  const [coverPromise, setCoverPromise] = useState<Promise<CoverImage>>()
  useEffect(() => {
    if (!hasMarkdown) return undefined
    const promise = coverFor(book.id)
    setCoverPromise(promise)
    setCoverError(undefined)
    promise.then(setCover, (error: unknown) => {
      setCoverError(error instanceof Error ? error.message : 'Could not generate a cover.')
    })
    return undefined
  }, [book.id, hasMarkdown])
  const coverUrl = useObjectUrl(cover?.bytes, cover?.mime ?? 'image/png')

  return (
    <section>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-emerald-300">Book complete</h3>
          {book.markdownFiles.length === 0 ? null : (
            <p className={`${hint} break-all`}>Saved to {book.markdownFiles.join(', ')}</p>
          )}
          {coverError === undefined ? null : (
            <p className="text-sm text-red-300">Cover: {coverError}</p>
          )}
          {coverUrl !== undefined || coverError !== undefined ? null : (
            <p className={hint}>Generating the cover image…</p>
          )}
        </div>
        {coverUrl === undefined ? null : (
          <img
            className="h-32 w-auto rounded-lg border border-slate-700 object-cover"
            src={coverUrl}
            alt="Generated book cover"
          />
        )}
        {book.markdown == null ? null : (
          <ExportBar markdown={book.markdown} baseName={baseName} coverPromise={coverPromise} />
        )}
      </div>
      {book.markdown == null ? (
        <p className={hint}>No book text is available.</p>
      ) : (
        <Manuscript markdown={book.markdown} />
      )}
    </section>
  )
}
