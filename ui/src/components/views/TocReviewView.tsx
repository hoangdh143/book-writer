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
import { button, hint, sectionHeading } from '../../domain/uiClasses'
import { ReviewBar } from '../ReviewBar'
import { OutlineFields } from './OutlineFields'
import { ChapterPlanList } from './ChapterPlanList'

interface Props {
  readonly book: Book
  readonly outline: Outline
}

export const TocReviewView = ({ book, outline }: Props) => {
  const [draft, setDraft] = useState<DraftOutline>(() => draftFrom(outline))
  const [comment, setComment] = useState('')
  const approve = useTocApprove(book.id)
  const revise = useTocRevise(book.id)
  const edits = useMemo(() => outlineEdits(outline, draft), [outline, draft])
  const busy = approve.isPending || revise.isPending

  // reset the draft when the writer produces a new outline after a revision
  const signature = outlineSignature(outline)
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    setDraft(draftFrom(outline))
  }

  const onPatchOutline = (patch: OutlinePatch): void => setDraft((d) => patchOutline(d, patch))
  const onPatchChapter = (number: number, patch: ChapterPatch): void =>
    setDraft((d) => patchChapter(d, number, patch))

  return (
    <section className="flex flex-col">
      <h3 className={sectionHeading}>Review the outline</h3>
      <p className={`${hint} mt-1 mb-5`}>Click any text to edit it, then approve when it looks right.</p>
      <div className="flex flex-col gap-5">
        <OutlineFields draft={draft} onPatch={onPatchOutline} />
        <ChapterPlanList draft={draft} onPatch={onPatchChapter} />
      </div>
      <ReviewBar
        comment={comment}
        onComment={setComment}
        note={edits === undefined ? undefined : 'Requesting a revision sends only your feedback and discards the edits above.'}
      >
        <button
          className={button.quiet}
          disabled={busy || comment.trim() === ''}
          onClick={() => revise.mutate(comment.trim())}
        >
          Request revision
        </button>
        <button
          className={button.secondary}
          disabled={busy}
          onClick={() => approve.mutate({ mode: 'all', comment: trimmedOrUndefined(comment), edits })}
        >
          Approve and write all chapters
        </button>
        <button
          className={button.primary}
          disabled={busy}
          onClick={() => approve.mutate({ mode: 'step', comment: trimmedOrUndefined(comment), edits })}
        >
          Approve and review each chapter
        </button>
      </ReviewBar>
    </section>
  )
}
