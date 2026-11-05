import type { ReactNode } from 'react'
import { fieldLabel, growingText, input } from '../domain/uiClasses'

interface Props {
  readonly comment: string
  readonly onComment: (value: string) => void
  readonly note?: string
  readonly children: ReactNode
}

/** Stays in view while the reader scrolls, so the decision is never a long way back up the page. */
export const ReviewBar = ({ comment, onComment, note, children }: Props) => (
  <div className="sticky bottom-0 z-10 mt-8 flex flex-col gap-3 border-t border-slate-800 bg-slate-950 py-4">
    <label className={fieldLabel}>
      Feedback (required for a revision, optional to approve)
      <textarea
        rows={1}
        className={`${input} ${growingText} max-h-32 font-normal`}
        value={comment}
        placeholder="What should the writer change or keep in mind?"
        onChange={(event) => onComment(event.target.value)}
      />
    </label>
    {note === undefined ? null : <p className="text-sm text-amber-300">{note}</p>}
    <div className="flex flex-wrap justify-end gap-2">{children}</div>
  </div>
)
