import { z } from 'zod'

const chapterPlanSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  synopsis: z.string(),
})

const outlineSchema = z.object({
  title: z.string(),
  genre: z.string(),
  premise: z.string(),
  chapters: z.array(chapterPlanSchema),
})

const chapterStatusSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  synopsis: z.string(),
  state: z.string(),
  wordCount: z.number().int().nullish(),
})

const eventSchema = z.object({
  at: z.string(),
  message: z.string(),
})

const illustrationSettingsSchema = z.object({
  model: z.string(),
  aspectRatio: z.string().nullish(),
  resolution: z.string().nullish(),
  quality: z.string().nullish(),
  perChapter: z.number().int(),
  style: z.string(),
  useReference: z.boolean(),
})

const bookSettingsSchema = z.object({
  chapters: z.number().int(),
  wordsPerChapter: z.number().int(),
  concurrency: z.number().int(),
  baseUrl: z.string(),
  diagrams: z.boolean(),
  illustrations: illustrationSettingsSchema.nullish(),
})

const bookSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  model: z.string(),
  status: z.string(),
  scholar: z.boolean().nullish(),
  storyBible: z.string().nullish(),
  settings: bookSettingsSchema.nullish(),
  writtenCount: z.number().int(),
  totalChapters: z.number().int(),
  outline: outlineSchema.nullish(),
  chapters: z.array(chapterStatusSchema).default([]),
  currentChapter: z.number().int().nullish(),
  mode: z.string().nullish(),
  error: z.string().nullish(),
  markdownFiles: z.array(z.string()).default([]),
  markdown: z.string().nullish(),
  events: z.array(eventSchema).default([]),
  elapsedSeconds: z.number().int().nullish(),
})

const bookListItemSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  status: z.string(),
  title: z.string().nullish(),
  scholar: z.boolean().nullish(),
  writtenCount: z.number().int().default(0),
  totalChapters: z.number().int().default(0),
})

const chapterTextSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  text: z.string(),
})

const createdBookSchema = z.object({ id: z.string() })
const okSchema = z.object({ ok: z.boolean() })
const apiErrorSchema = z.object({ error: z.string() })

export type ChapterPlan = z.infer<typeof chapterPlanSchema>
export type Outline = z.infer<typeof outlineSchema>
export type ChapterStatus = z.infer<typeof chapterStatusSchema>
export type BookEvent = z.infer<typeof eventSchema>
export type Book = z.infer<typeof bookSchema>
export type BookListItem = z.infer<typeof bookListItemSchema>
export type ChapterText = z.infer<typeof chapterTextSchema>
export type CreatedBook = z.infer<typeof createdBookSchema>
export type Ok = z.infer<typeof okSchema>

export {
  chapterPlanSchema,
  outlineSchema,
  chapterStatusSchema,
  eventSchema,
  bookSchema,
  bookListItemSchema,
  chapterTextSchema,
  createdBookSchema,
  okSchema,
  apiErrorSchema,
}
