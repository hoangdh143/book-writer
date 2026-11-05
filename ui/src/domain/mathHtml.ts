import DOMPurify from 'dompurify'
import { marked } from 'marked'

export interface MathPiece {
  readonly tex: string
  readonly display: boolean
}

interface MathMatch {
  readonly start: number
  readonly end: number
  readonly piece: MathPiece
}

interface Substituted {
  readonly text: string
  readonly pieces: readonly MathPiece[]
}

const mathRegexes: readonly { readonly re: RegExp; readonly display: boolean }[] = [
  { re: /\$\$([\s\S]+?)\$\$/g, display: true },
  { re: /\\\[([\s\S]+?)\\\]/g, display: true },
  { re: /\\\(([\s\S]+?)\\\)/g, display: false },
  { re: /\$([^\s$][^$\n]*?)\$/g, display: false },
]

const nonOverlapping = (matches: readonly MathMatch[]): readonly MathMatch[] =>
  matches
    .slice()
    .sort((a, b) => a.start - b.start)
    .reduce<{ readonly lastEnd: number; readonly kept: readonly MathMatch[] }>(
      (acc, m) =>
        m.start >= acc.lastEnd
          ? { lastEnd: m.end, kept: [...acc.kept, m] }
          : acc,
      { lastEnd: -1, kept: [] },
    )
    .kept

/** Replaces math spans with inert placeholder spans that marked passes through untouched. */
const substituteMath = (input: string): Substituted => {
  const matches = nonOverlapping(
    mathRegexes.flatMap(({ re, display }) =>
      Array.from(input.matchAll(re), (m: RegExpMatchArray) => ({
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length,
        piece: { tex: (m[1] ?? '').trim(), display },
      })),
    ),
  )
  const reduced = matches.reduce<{ readonly pos: number; readonly out: string; readonly pieces: readonly MathPiece[] }>(
    (acc, m) => ({
      pos: m.end,
      out: `${acc.out}${input.slice(acc.pos, m.start)}<span data-bw-math="${acc.pieces.length}"></span>`,
      pieces: [...acc.pieces, m.piece],
    }),
    { pos: 0, out: '', pieces: [] },
  )
  return { text: reduced.out + input.slice(reduced.pos), pieces: reduced.pieces }
}

/** Skips fenced code blocks, substitutes math everywhere else. */
export const extractMath = (markdown: string): Substituted => {
  const segments = markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/)
  const substituted = segments.map((segment, i) => (i % 2 === 1 ? { text: segment, pieces: [] as readonly MathPiece[] } : substituteMath(segment)))
  return {
    text: substituted.map(s => s.text).join(''),
    pieces: substituted.flatMap(s => s.pieces),
  }
}

export const renderMath = async (html: string, pieces: readonly MathPiece[]): Promise<string> => {
  if (pieces.length === 0) return html
  const { renderToString } = await import('katex')
  const rendered = pieces.map(piece =>
    renderToString(piece.tex, { displayMode: piece.display, throwOnError: false, output: 'html' }),
  )
  return html.replace(/<span data-bw-math="(\d+)"><\/span>/g, (_, n) => rendered[Number(n)] ?? '')
}

const xmlEscapeText = (s: string): string =>
  s.replaceAll('&nbsp;', '&#160;').replace(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g, '&amp;')

/** Marked emits HTML void elements; XHTML (EPUB) requires them self-closed. */
const selfCloseVoid = (html: string): string =>
  html.replace(/<(br|hr|img|input)\b([^>]*?)\s*\/?>/g, '<$1$2 />')

export const toXmlSafeHtml = (html: string): string => selfCloseVoid(xmlEscapeText(html))

/** Markdown → XHTML-safe HTML with math pre-rendered as KaTeX HTML (no read-time JS needed). */
export const markdownToXmlHtml = async (markdown: string): Promise<string> => {
  const { text, pieces } = extractMath(markdown)
  const safe = toXmlSafeHtml(marked.parse(text, { async: false }))
  return renderMath(safe, pieces)
}

const unsafeReadingTags = ['img', 'picture', 'source', 'video', 'audio', 'style', 'form', 'input', 'button', 'textarea', 'select']

/** Markdown → HTML for on-screen reading. Book text is model output, so it is sanitised and cannot load remote resources. */
export const markdownToSafeHtml = async (markdown: string): Promise<string> => {
  const { text, pieces } = extractMath(markdown)
  const html = await renderMath(marked.parse(text, { async: false }), pieces)
  return DOMPurify.sanitize(html, { FORBID_TAGS: unsafeReadingTags })
}
