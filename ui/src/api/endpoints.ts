import { z } from 'zod'
import { http, decodeWith } from './client'
import type { CreateBookInput, TocApproveInput } from './requests'
import {
  bookSchema,
  bookListItemSchema,
  chapterTextSchema,
  createdBookSchema,
  okSchema,
} from './types'

const base = '/api/books'
const bookPath = (id: string): string => `${base}/${encodeURIComponent(id)}`

export const bookApi = {
  list: (): Promise<z.infer<typeof bookListItemSchema>[]> =>
    http.get(base, decodeWith(z.array(bookListItemSchema))),
  get: (id: string) => http.get(bookPath(id), decodeWith(bookSchema)),
  chapter: (id: string, number: number) =>
    http.get(`${bookPath(id)}/chapters/${number}`, decodeWith(chapterTextSchema)),
  create: (input: CreateBookInput) => http.post(base, decodeWith(createdBookSchema), input),
  approveToc: (id: string, input: TocApproveInput) =>
    http.post(`${bookPath(id)}/toc/approve`, decodeWith(okSchema), input),
  reviseToc: (id: string, comment: string) =>
    http.post(`${bookPath(id)}/toc/revise`, decodeWith(okSchema), { comment }),
  approveChapter: (id: string, number: number, comment?: string) =>
    http.post(`${bookPath(id)}/chapters/${number}/approve`, decodeWith(okSchema), { comment }),
  reviseChapter: (id: string, number: number, comment: string) =>
    http.post(`${bookPath(id)}/chapters/${number}/revise`, decodeWith(okSchema), { comment }),
  approveRest: (id: string, comment?: string) =>
    http.post(`${bookPath(id)}/chapters/approve-rest`, decodeWith(okSchema), { comment }),
  remove: (id: string) => http.delete(bookPath(id), decodeWith(okSchema)),
}
