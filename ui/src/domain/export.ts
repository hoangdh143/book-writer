import { marked } from 'marked'
import { extractMath } from './mathHtml'
import type { MathPiece } from './mathHtml'

export type ExportFormat = 'markdown' | 'html' | 'text' | 'epub'

export interface ExportFormatOption {
  readonly id: ExportFormat
  readonly label: string
}

export const exportFormats: readonly ExportFormatOption[] = [
  { id: 'markdown', label: 'Markdown (.md)' },
  { id: 'html', label: 'HTML (.html)' },
  { id: 'text', label: 'Plain text (.txt)' },
  { id: 'epub', label: 'EPUB (.epub)' },
]

export interface ExportArtifact {
  readonly content: string | Uint8Array
  readonly filename: string
  readonly mime: string
}

const htmlDocument = (title: string, bodyHtml: string): string =>
  [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${title}</title>`,
    '<style>body{max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.6;font-family:Georgia,serif;color:#1a1a1a}</style>',
    '</head>',
    '<body>',
    bodyHtml,
    '</body>',
    '</html>',
  ].join('\n')

const NUL = String.fromCharCode(0)

const stripMarkdown = (markdown: string): string =>
  markdown
    .replace(/<span data-bw-math="(\d+)"><\/span>/g, `${NUL}$1${NUL}`)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>#]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const buildMarkdown = (markdown: string, base: string): ExportArtifact => ({
  content: markdown,
  filename: `${base}.md`,
  mime: 'text/markdown',
})

const buildHtml = (markdown: string, base: string): ExportArtifact => {
  const title = markdown.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? base
  return {
    content: htmlDocument(title, marked.parse(markdown, { async: false })),
    filename: `${base}.html`,
    mime: 'text/html',
  }
}

const restoreMath = (stripped: string, pieces: readonly MathPiece[]): string =>
  stripped
    .split(NUL)
    .map((segment, i) => {
      if (i % 2 === 0) return segment
      const piece = pieces[Number(segment)]
      if (piece === undefined) return ''
      return piece.display ? `$$${piece.tex}$$` : `$${piece.tex}$`
    })
    .join('')

const buildText = (markdown: string, base: string): ExportArtifact => {
  const { text, pieces } = extractMath(markdown)
  return {
    content: restoreMath(stripMarkdown(text), pieces),
    filename: `${base}.txt`,
    mime: 'text/plain',
  }
}

const builders: Record<Exclude<ExportFormat, 'epub'>, (markdown: string, base: string) => ExportArtifact> = {
  markdown: buildMarkdown,
  html: buildHtml,
  text: buildText,
}

export const syncArtifact = (
  markdown: string,
  format: Exclude<ExportFormat, 'epub'>,
  baseName: string,
): ExportArtifact => builders[format](markdown, baseName)
