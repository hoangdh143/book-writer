import type { BookEvent } from '../api/types'
import { timeLabel } from '../domain/text'

export const EventsFeed = ({ events }: { events: readonly BookEvent[] }) =>
  events.length === 0 ? null : (
    <section className="events">
      <h3>Activity</h3>
      <ul>
        {events.map((event, index) => (
          <li key={`${event.at}-${index}`}>
            <time>{timeLabel(event.at)}</time>
            <span>{event.message}</span>
          </li>
        ))}
      </ul>
    </section>
  )
