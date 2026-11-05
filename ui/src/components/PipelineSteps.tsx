import { completedSteps, needsReview, parseStatus, pipelineSteps } from '../domain/bookStatus'

const stepClass = (index: number, done: number, waiting: boolean): string => {
  if (index < done) return 'text-emerald-300'
  if (index > done) return 'text-slate-500'
  return waiting ? 'font-medium text-amber-300' : 'font-medium text-sky-300'
}

export const PipelineSteps = ({ status }: { status: string }) => {
  const parsed = parseStatus(status)
  const done = completedSteps(parsed)
  if (done === undefined) return null
  return (
    <ol aria-label="Progress" className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {pipelineSteps.map((step, index) => (
        <li
          key={step}
          aria-current={index === done ? 'step' : undefined}
          className={`flex items-center gap-2 ${stepClass(index, done, needsReview(parsed))}`}
        >
          {index === 0 ? null : <span aria-hidden className="h-px w-5 bg-slate-700" />}
          {index < done ? <span aria-hidden>✓</span> : null}
          {step}
        </li>
      ))}
    </ol>
  )
}
