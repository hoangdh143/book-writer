import { errorMessage } from '../domain/text'
import { button } from '../domain/uiClasses'

interface Props {
  readonly title: string
  readonly error?: unknown
  readonly message?: string
  readonly onRetry?: () => void
  readonly onBack?: () => void
}

export const ErrorPanel = ({ title, error, message, onRetry, onBack }: Props) => (
  <section className="rounded-xl border border-red-900/60 bg-red-950/30 p-5">
    <h3 className="text-base font-semibold text-red-300">{title}</h3>
    <p className="mt-1 break-words text-sm text-red-200/80">{message ?? errorMessage(error)}</p>
    {onRetry === undefined && onBack === undefined ? null : (
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry === undefined ? null : (
          <button className={button.secondary} onClick={onRetry}>
            Try again
          </button>
        )}
        {onBack === undefined ? null : (
          <button className={button.secondary} onClick={onBack}>
            Back to books
          </button>
        )}
      </div>
    )}
  </section>
)
