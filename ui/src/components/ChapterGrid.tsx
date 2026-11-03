import type { ChapterStatus } from '../api/types'

const wordLabel = (wordCount: number | null | undefined): string =>
  wordCount === null || wordCount === undefined ? '' : ` · ${wordCount} words`

export const ChapterGrid = ({ chapters }: { chapters: readonly ChapterStatus[] }) =>
  chapters.length === 0 ? null : (
    <ul className="chapter-grid">
      {chapters.map((chapter) => (
        <li key={chapter.number} className={`chapter-chip state-${chapter.state}`}>
          <span className="chip-no">{chapter.number}</span>
          <span className="chip-title">{chapter.title}</span>
          <span className="chip-state">
            {chapter.state}
            {wordLabel(chapter.wordCount)}
          </span>
        </li>
      ))}
    </ul>
  )
