import { useMemo, useState } from 'react'
import type { Book, Outline } from '../../api/types'
import { useTocApprove, useTocRevise } from '../../api/bookMutations'
import {
  draftFrom,
  outlineEdits,
  outlineSignature,
  patchChapter,
  patchOutline,
} from '../../domain/tocEdits'
import type { ChapterPatch, DraftOutline, OutlinePatch } from '../../domain/tocEdits'
import { trimmedOrUndefined } from '../../domain/text'
import { button, fieldLabel, growingText, hint, input, sectionHeading } from '../../domain/uiClasses'
import { FieldError } from '../FieldError'
import { ReviewBar } from '../ReviewBar'
import { OutlineFields } from './OutlineFields'
import { ChapterPlanList } from './ChapterPlanList'

interface Props {
  readonly book: Book
  readonly outline: Outline
}

const reviewNote = (ideaChanged: boolean, outlineEdited: boolean): string | undefined => {
  const notes = [
    ideaChanged ? 'Approving keeps this outline as it is. Request a revision to replan it from the new idea.' : '',
    outlineEdited ? 'Requesting a revision uses your book idea and feedback, and discards the edits to the outline.' : '',
  ].filter((note) => note !== '')
  return notes.length === 0 ? undefined : notes.join(' ')
}

export const TocReviewView = ({ book, outline }: Props) => {
  const [draft, setDraft] = useState<DraftOutline>(() => draftFrom(outline))
  const [idea, setIdea] = useState(book.prompt)
  const [comment, setComment] = useState('')
  const approve = useTocApprove(book.id)
  const revise = useTocRevise(book.id)
  const edits = useMemo(() => outlineEdits(outline, draft), [outline, draft])
  const busy = approve.isPending || revise.isPending
  const trimmedIdea = idea.trim()
  const ideaBlank = trimmedIdea === ''
  const newIdea = ideaBlank || trimmedIdea === book.prompt ? undefined : trimmedIdea

  // reset the draft when the writer produces a new outline after a revision
  const signature = outlineSignature(outline)
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    setDraft(draftFrom(outline))
    setIdea(book.prompt)
  }

  const onPatchOutline = (patch: OutlinePatch): void => setDraft((d) => patchOutline(d, patch))
  const onPatchChapter = (number: number, patch: ChapterPatch): void =>
    setDraft((d) => patchChapter(d, number, patch))

  return (
    <section className="flex flex-col">
      <h3 className={sectionHeading}>Review the outline</h3>
      <p className={`${hint} mt-1 mb-5`}>Click any text to edit it, then approve when it looks right.</p>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className={fieldLabel}>
            Book idea
            <textarea
              className={`${input} ${growingText} max-h-96 font-normal`}
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
            />
          </label>
          <FieldError message={ideaBlank ? 'Describe your book idea' : undefined} />
        </div>
        <OutlineFields draft={draft} onPatch={onPatchOutline} />
        <ChapterPlanList draft={draft} onPatch={onPatchChapter} />
      </div>
      <ReviewBar
        comment={comment}
        onComment={setComment}
        note={reviewNote(newIdea !== undefined, edits !== undefined)}
        feedbackOptional={newIdea !== undefined}
      >
        <button
          className={button.quiet}
          disabled={busy || ideaBlank || (comment.trim() === '' && newIdea === undefined)}
          onClick={() => revise.mutate({ comment: comment.trim(), prompt: newIdea })}
        >
          Request revision
        </button>
        <button
          className={button.secondary}
          disabled={busy || ideaBlank}
          onClick={() => approve.mutate({ mode: 'all', comment: trimmedOrUndefined(comment), edits, prompt: newIdea })}
        >
          Approve and write all chapters
        </button>
        <button
          className={button.primary}
          disabled={busy || ideaBlank}
          onClick={() => approve.mutate({ mode: 'step', comment: trimmedOrUndefined(comment), edits, prompt: newIdea })}
        >
          Approve and review each chapter
        </button>
      </ReviewBar>
    </section>
  )
}
