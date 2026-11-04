import { marked } from 'marked'

export type ExportFormat = 'markdown' | 'html' | 'text'

export interface ExportFormatOption {
  readonly id: ExportFormat
  readonly label: string
}

export const exportFormats: readonly ExportFormatOption[] = [
  { id: 'markdown', label: 'Markdown (.md)' },
  { id: 'html', label: 'HTML (.html)' },
  { id: 'text', label: 'Plain text (.txt)' },
]

export interface ExportArtifact {
  readonly content: string
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

const stripMarkdown = (markdown: string): string =>
  markdown
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

const buildText = (markdown: string, base: string): ExportArtifact => ({
  content: stripMarkdown(markdown),
  filename: `${base}.txt`,
  mime: 'text/plain',
})

const builders: Record<ExportFormat, (markdown: string, base: string) => ExportArtifact> = {
  markdown: buildMarkdown,
  html: buildHtml,
  text: buildText,
}

export const exportArtifact = (
  markdown: string,
  format: ExportFormat,
  baseName: string,
): ExportArtifact => builders[format](markdown, baseName)
