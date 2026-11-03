import { parseStatus, statusLabel } from '../domain/bookStatus'

export const StatusBadge = ({ status }: { status: string }) => {
  const parsed = parseStatus(status)
  return <span className={`badge badge-${parsed}`}>{statusLabel[parsed]}</span>
}
