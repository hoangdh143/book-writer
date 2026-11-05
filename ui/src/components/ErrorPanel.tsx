import { errorMessage } from '../domain/text'
import { button } from '../domain/uiClasses'

type Tone = 'error' | 'notice'

interface Props {
  readonly title: string
  readonly error?: unknown
  readonly message?: string
  readonly tone?: Tone
  readonly onRetry?: () => void
  readonly onBack?: () => void
}

const toneClass: Record<Tone, { readonly box: string; readonly title: string; readonly body: string }> = {
  error: { box: 'border-red-900/60 bg-red-950/30', title: 'text-red-300', body: 'text-red-200/80' },
  notice: { box: 'border-amber-900/60 bg-amber-950/20', title: 'text-amber-300', body: 'text-amber-100/80' },
}

export const ErrorPanel = ({ title, error, message, tone = 'error', onRetry, onBack }: Props) => (
  <section className={`rounded-xl border p-5 ${toneClass[tone].box}`}>
    <h3 className={`text-base font-semibold ${toneClass[tone].title}`}>{title}</h3>
    <p className={`mt-1 break-words text-sm ${toneClass[tone].body}`}>{message ?? errorMessage(error)}</p>
    {onRetry === undefined && onBack === undefined ? null : (
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry === undefined ? null : (
          <button className={button.secondary} onClick={onRetry}>
            Try again
          </button>
        )}
        {onBack === undefined ? null : (
          <button className={button.secondary} onClick={onBack}>
            Close
          </button>
        )}
      </div>
    )}
  </section>
)
