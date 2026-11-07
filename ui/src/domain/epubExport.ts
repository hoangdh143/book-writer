import { markdownToXmlHtml } from './mathHtml'
import { createZip } from './zip'
import type { ZipEntry } from './zip'
import katexCss from 'katex/dist/katex.min.css?raw'

const fontLoaders = import.meta.glob<string>('/node_modules/katex/dist/fonts/*.woff2', { query: '?url', import: 'default' })

const bookCss = `body{line-height:1.6;font-family:Georgia,'Times New Roman',serif;margin:1.5em}
h1{text-align:center;font-size:1.8em;margin:1em 0}
h2{font-size:1.3em;margin:1.8em 0 .6em}
blockquote{color:#444;border-left:3px solid #ccc;margin:1em 0;padding:.2em 1em}
img{max-width:100%}
.katex-display{overflow-x:auto;overflow-y:hidden;padding:.3em 0}`

const xmlEscape = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const encoder = new TextEncoder()
const encode = (s: string): Uint8Array => encoder.encode(s)

const xhtmlDocument = (title: string, body: string): string =>
  `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head>
<title>${xmlEscape(title)}</title>
<link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
${body}
</body>
</html>`

interface Section {
  readonly title: string
  readonly anchor: string
}

const sectionTitles = (markdown: string): readonly Section[] =>
  Array.from(markdown.matchAll(/^##\s+(.+)$/gm)).map((m, i) => ({ title: m[1] ?? '', anchor: `s${i}` }))

/** Gives every <h2> the id its nav entry links to (marked emits no heading ids). */
const withHeadingIds = (bodyHtml: string): string =>
  bodyHtml
    .split('<h2>')
    .map((part, i) => (i === 0 ? part : `<h2 id="s${i - 1}">${part}`))
    .join('')

const containerXml = (): string =>
  `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

const navXhtml = (title: string, sections: readonly Section[]): string =>
  `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head><title>${xmlEscape(title)}</title></head>
<body>
<nav epub:type="toc" id="toc">
<h1>Contents</h1>
<ol>
${sections.map(s => `    <li><a href="book.xhtml#${s.anchor}">${xmlEscape(s.title)}</a></li>`).join('\n')}
</ol>
</nav>
</body>
</html>`

const coverExtension = (mime: string): string =>
  mime.includes('jpeg') ? 'jpg' : mime.includes('gif') ? 'gif' : mime.includes('webp') ? 'webp' : 'png'

const imageMediaType = (name: string): string => `image/${name.slice(name.lastIndexOf('.') + 1)}`

const contentOpf = (
  title: string,
  uuid: string,
  modified: string,
  extras: {
    readonly fontNames: readonly string[]
    readonly cover: { readonly file: string; readonly mime: string } | undefined
    readonly diagramNames: readonly string[]
  },
): string => {
  const { fontNames, cover, diagramNames } = extras
  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${xmlEscape(title)}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>${cover === undefined ? '' : '\n    <meta name="cover" content="cover-image"/>'}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="book" href="book.xhtml" media-type="application/xhtml+xml"/>${cover === undefined ? '' : `\n    <item id="cover-image" href="${cover.file}" media-type="${cover.mime}" properties="cover-image"/>\n    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`}
${diagramNames.map((name, i) => `    <item id="diagram-${i}" href="${name}" media-type="${imageMediaType(name)}"/>\n`).join('')}${fontNames.map((name, i) => `    <item id="font-${i}" href="${name}" media-type="font/woff2"/>`).join('\n')}
  </manifest>
  <spine>
${[...(cover === undefined ? [] : ['    <itemref idref="cover-page"/>']), '    <itemref idref="nav"/>', '    <itemref idref="book"/>'].join('\n')}
  </spine>
</package>`
}

const coverXhtml = (file: string): string =>
  `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head>
<title>Cover</title>
</head>
<body style="margin:0;padding:0;text-align:center">
<img src="${file}" alt="Cover" style="max-width:100%;max-height:100%"/>
</body>
</html>`

const loadFonts = async (): Promise<readonly ZipEntry[]> =>
  Promise.all(
    Object.entries(fontLoaders).map(async ([path, loader]) => {
      const url = await loader()
      const response = await fetch(url)
      if (!response.ok) throw new Error(`font asset ${path} fetch failed: HTTP ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length < 1000) throw new Error(`font asset ${path} came back empty (${bytes.length} bytes)`)
      return { name: `OEBPS/fonts/${path.split('/').at(-1) ?? 'font.woff2'}`, bytes }
    }),
  )

export interface CoverImage {
  readonly mime: string
  readonly bytes: Uint8Array
}

/** Moves embedded images out of the text and into their own EPUB files. */
const extractDiagrams = (markdown: string): { readonly text: string; readonly files: readonly ZipEntry[] } => {
  // Splitting on two capture groups leaves repeating runs of text, image type and base64 payload.
  const pieces = markdown.split(/\]\(data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)\)/)
  const diagramName = (position: number): string => `diagram-${(position + 2) / 3}.${pieces[position]}`
  return {
    text: pieces.flatMap((piece, i) => (i % 3 === 0 ? [piece] : i % 3 === 1 ? [`](${diagramName(i)})`] : [])).join(''),
    files: pieces.flatMap((piece, i) =>
      i % 3 !== 2
        ? []
        : [{ name: `OEBPS/${diagramName(i - 1)}`, bytes: Uint8Array.from(atob(piece), (char) => char.charCodeAt(0)) }],
    ),
  }
}

export const buildEpub = async (
  markdown: string,
  baseName: string,
  cover?: CoverImage,
): Promise<Uint8Array> => {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? baseName
  const diagrams = extractDiagrams(markdown)
  const bodyHtml = withHeadingIds(await markdownToXmlHtml(diagrams.text))
  const fonts = await loadFonts()
  const fontNames = fonts.map(f => f.name.replace('OEBPS/', ''))
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const coverFile = cover === undefined ? undefined : `cover.${coverExtension(cover.mime)}`
  const coverMime = cover === undefined ? undefined : cover.mime.split(';')[0]?.trim() || 'image/png'
  const entries: readonly ZipEntry[] = [
    { name: 'mimetype', bytes: encode('application/epub+zip') },
    { name: 'META-INF/container.xml', bytes: encode(containerXml()) },
    {
      name: 'OEBPS/content.opf',
      bytes: encode(
        contentOpf(
          title,
          crypto.randomUUID(),
          modified,
          {
            fontNames,
            diagramNames: diagrams.files.map((file) => file.name.replace('OEBPS/', '')),
            cover:
              coverFile === undefined || coverMime === undefined ? undefined : { file: coverFile, mime: coverMime },
          },
        ),
      ),
    },
    { name: 'OEBPS/nav.xhtml', bytes: encode(navXhtml(title, sectionTitles(markdown))) },
    ...(cover === undefined || coverFile === undefined
      ? []
      : [{ name: `OEBPS/${coverFile}`, bytes: cover.bytes }]),
    ...(cover === undefined ? [] : [{ name: 'OEBPS/cover.xhtml', bytes: encode(coverXhtml(coverFile ?? '')) }]),
    { name: 'OEBPS/book.xhtml', bytes: encode(xhtmlDocument(title, bodyHtml)) },
    { name: 'OEBPS/styles.css', bytes: encode(`${bookCss}\n${katexCss}`) },
    ...diagrams.files,
    ...fonts,
  ]
  return createZip(entries)
}
