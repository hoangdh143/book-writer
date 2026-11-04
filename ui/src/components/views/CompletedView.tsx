import { useMemo, useState } from 'react'
import type { Book } from '../../api/types'
import { exportArtifact, exportFormats } from '../../domain/export'
import type { ExportFormat } from '../../domain/export'
import { safeBaseName } from '../../domain/text'
import { button, input, prose } from '../../domain/uiClasses'
import { useObjectUrl } from '../../hooks/useObjectUrl'

const ExportBar = ({ markdown, baseName }: { markdown: string; baseName: string }) => {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const artifact = useMemo(() => exportArtifact(markdown, format, baseName), [markdown, format, baseName])
  const href = useObjectUrl(artifact.content, artifact.mime)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-400">
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
      {href === undefined ? null : (
        <a className={button.primary} href={href} download={artifact.filename}>
          Download
        </a>
      )}
    </div>
  )
}

export const CompletedView = ({ book }: { book: Book }) => {
  const baseName = safeBaseName(book.outline?.title ?? book.id)
  return (
    <section className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
      <h2 className="text-base font-semibold text-emerald-300">Book complete</h2>
      {book.markdownFiles.length === 0 ? null : (
        <p className="mt-1 text-sm text-slate-400">Saved: {book.markdownFiles.join(', ')}</p>
      )}
      {book.markdown == null ? (
        <p className="mt-2 text-sm text-slate-500">No markdown available.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <ExportBar markdown={book.markdown} baseName={baseName} />
          <pre className={prose}>{book.markdown}</pre>
        </div>
      )}
    </section>
  )
}
