import { badgeClass, dotClass, needsReview, parseStatus, statusLabel } from '../domain/bookStatus'

export const StatusBadge = ({ status }: { status: string }) => {
  const parsed = parseStatus(status)
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass[parsed]}`}
    >
      {statusLabel[parsed]}
    </span>
  )
}

export const StatusLine = ({ status }: { status: string }) => {
  const parsed = parseStatus(status)
  return (
    <span className={`flex items-center gap-1.5 ${needsReview(parsed) ? 'font-medium text-amber-300' : ''}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${dotClass[parsed]}`} />
      {statusLabel[parsed]}
    </span>
  )
}
