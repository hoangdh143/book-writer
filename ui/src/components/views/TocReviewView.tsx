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
import { actionRow, button, panel } from '../../domain/uiClasses'
import { CommentBox } from '../CommentBox'
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
    <section className={`${panel} flex flex-col`}>
      <h2 className="text-base font-semibold text-slate-100">Review the table of contents</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Adjust anything below, add a comment, then approve — or send it back for revision.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <OutlineFields draft={draft} onPatch={onPatchOutline} />
        <ChapterPlanList draft={draft} onPatch={onPatchChapter} />
        <CommentBox
          label="Comment (optional for approval, required for revision)"
          value={comment}
          onChange={setComment}
        />
        <div className={actionRow}>
          <button
            className={button.primary}
            disabled={busy}
            onClick={() => approve.mutate({ mode: 'all', comment: trimmedOrUndefined(comment), edits })}
          >
            Approve — all chapters
          </button>
          <button
            className={button.primary}
            disabled={busy}
            onClick={() => approve.mutate({ mode: 'step', comment: trimmedOrUndefined(comment), edits })}
          >
            Approve — step by step
          </button>
          <button
            className={button.secondary}
            disabled={busy || comment.trim() === ''}
            onClick={() => revise.mutate(comment.trim())}
          >
            Request revision
          </button>
        </div>
      </div>
    </section>
  )
}
