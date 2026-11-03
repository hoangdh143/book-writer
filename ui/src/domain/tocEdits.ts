import type { ChapterEditInput, OutlineEditsInput } from '../api/requests'
import type { Outline } from '../api/types'

export interface DraftChapter {
  readonly number: number
  readonly title: string
  readonly synopsis: string
}

export interface DraftOutline {
  readonly title: string
  readonly genre: string
  readonly premise: string
  readonly chapters: readonly DraftChapter[]
}

export type OutlinePatch = Partial<Pick<DraftOutline, 'title' | 'genre' | 'premise'>>
export type ChapterPatch = Partial<Pick<DraftChapter, 'title' | 'synopsis'>>

export const draftFrom = (outline: Outline): DraftOutline => ({
  title: outline.title,
  genre: outline.genre,
  premise: outline.premise,
  chapters: outline.chapters.map((chapter) => ({
    number: chapter.number,
    title: chapter.title,
    synopsis: chapter.synopsis,
  })),
})

export const patchOutline = (draft: DraftOutline, patch: OutlinePatch): DraftOutline => ({
  ...draft,
  ...patch,
})

export const patchChapter = (
  draft: DraftOutline,
  number: number,
  patch: ChapterPatch,
): DraftOutline => ({
  ...draft,
  chapters: draft.chapters.map((chapter) =>
    chapter.number === number ? { ...chapter, ...patch } : chapter,
  ),
})

const changed = (original: string, current: string): string | undefined => {
  const value = current.trim()
  return value === original ? undefined : value
}

const chapterEdits = (
  original: readonly Outline['chapters'][number][],
  draft: readonly DraftChapter[],
): readonly ChapterEditInput[] | undefined => {
  const baseByNumber = new Map(original.map((chapter) => [chapter.number, chapter]))
  const edits = draft.flatMap((chapter) => {
    const base = baseByNumber.get(chapter.number)
    const differs =
      base === undefined ||
      base.title !== chapter.title.trim() ||
      base.synopsis !== chapter.synopsis.trim()
    return differs
      ? [{ number: chapter.number, title: chapter.title.trim(), synopsis: chapter.synopsis.trim() }]
      : []
  })
  return edits.length === 0 ? undefined : edits
}

export const outlineEdits = (original: Outline, draft: DraftOutline): OutlineEditsInput | undefined => {
  const title = changed(original.title, draft.title)
  const genre = changed(original.genre, draft.genre)
  const premise = changed(original.premise, draft.premise)
  const chapters = chapterEdits(original.chapters, draft.chapters)
  return title === undefined && genre === undefined && premise === undefined && chapters === undefined
    ? undefined
    : { title, genre, premise, chapters }
}

export const outlineSignature = (outline: Outline): string => JSON.stringify(outline)
