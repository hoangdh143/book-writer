import type { BookEvent } from '../api/types'
import { timeLabel } from '../domain/text'

export const EventsFeed = ({ events }: { events: readonly BookEvent[] }) =>
  events.length === 0 ? null : (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Activity</h3>
      <ul className="max-h-56 overflow-auto rounded-xl border border-slate-700/70 bg-slate-900/50">
        {events.map((event, index) => (
          <li
            key={`${event.at}-${index}`}
            className="flex gap-3 border-b border-slate-800 px-3 py-1.5 text-xs text-slate-300 last:border-b-0"
          >
            <time className="shrink-0 text-slate-500">{timeLabel(event.at)}</time>
            <span>{event.message}</span>
          </li>
        ))}
      </ul>
    </section>
  )
