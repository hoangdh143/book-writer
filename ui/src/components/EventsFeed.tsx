import type { BookEvent } from '../api/types'
import { timeLabel } from '../domain/text'

export const EventsFeed = ({ events }: { events: readonly BookEvent[] }) =>
  events.length === 0 ? null : (
    <details className="mt-8 border-t border-slate-800 pt-4">
      <summary className="text-sm text-slate-400 hover:text-slate-200">
        Activity log ({events.length})
      </summary>
      <ul className="mt-3 max-h-64 overflow-auto">
        {[...events].reverse().map((event, index) => (
          <li key={`${event.at}-${index}`} className="flex gap-3 py-1 text-xs text-slate-300">
            <time className="shrink-0 tabular-nums text-slate-500">{timeLabel(event.at)}</time>
            <span>{event.message}</span>
          </li>
        ))}
      </ul>
    </details>
  )
