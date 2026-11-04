import { parseStatus, badgeClass, statusLabel } from '../domain/bookStatus'

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
