import { z } from 'zod'
import { ApiError, http, decodeWith } from './client'
import type { CreateBookInput, TocApproveInput, TocReviseInput } from './requests'
import {
  bookSchema,
  bookListItemSchema,
  chapterTextSchema,
  createdBookSchema,
  okSchema,
  apiErrorSchema,
} from './types'

const base = '/api/books'
const bookPath = (id: string): string => `${base}/${encodeURIComponent(id)}`

export interface CoverImage {
  readonly mime: string
  readonly bytes: Uint8Array
}

export interface CoverInput {
  readonly imageBaseUrl?: string
  readonly imageApiKey?: string
  readonly imageModel?: string
}

const coverFromResponse = async (response: Response): Promise<CoverImage> => ({
  mime: response.headers.get('content-type') ?? 'image/png',
  bytes: new Uint8Array(await response.arrayBuffer()),
})

const coverError = async (response: Response): Promise<ApiError> => {
  const raw: unknown = await response.json().catch(() => undefined)
  const parsed = apiErrorSchema.safeParse(raw)
  const message = parsed.success ? parsed.data.error : `Request failed (HTTP ${response.status})`
  return new ApiError(message, response.status)
}

/** Returns the cached cover, or undefined when the book has none yet. */
export const fetchCover = async (id: string): Promise<CoverImage | undefined> => {
  const response = await fetch(`${bookPath(id)}/cover`)
  if (response.status === 404) return undefined
  if (!response.ok) throw await coverError(response)
  return coverFromResponse(response)
}

/** Generates the cover (server-side, cached after the first call). */
export const generateCover = async (id: string, input?: CoverInput): Promise<CoverImage> => {
  const response = await fetch(`${bookPath(id)}/cover`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  })
  if (!response.ok) throw await coverError(response)
  return coverFromResponse(response)
}

export const bookApi = {
  list: (): Promise<z.infer<typeof bookListItemSchema>[]> =>
    http.get(base, decodeWith(z.array(bookListItemSchema))),
  get: (id: string) => http.get(bookPath(id), decodeWith(bookSchema)),
  chapter: (id: string, number: number) =>
    http.get(`${bookPath(id)}/chapters/${number}`, decodeWith(chapterTextSchema)),
  create: (input: CreateBookInput) => http.post(base, decodeWith(createdBookSchema), input),
  approveToc: (id: string, input: TocApproveInput) =>
    http.post(`${bookPath(id)}/toc/approve`, decodeWith(okSchema), input),
  reviseToc: (id: string, input: TocReviseInput) =>
    http.post(`${bookPath(id)}/toc/revise`, decodeWith(okSchema), input),
  approveChapter: (id: string, number: number, comment?: string) =>
    http.post(`${bookPath(id)}/chapters/${number}/approve`, decodeWith(okSchema), { comment }),
  reviseChapter: (id: string, number: number, comment: string) =>
    http.post(`${bookPath(id)}/chapters/${number}/revise`, decodeWith(okSchema), { comment }),
  approveRest: (id: string, comment?: string) =>
    http.post(`${bookPath(id)}/chapters/approve-rest`, decodeWith(okSchema), { comment }),
  remove: (id: string) => http.delete(bookPath(id), decodeWith(okSchema)),
}
