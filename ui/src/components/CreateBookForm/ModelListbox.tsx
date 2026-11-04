import { useEffect } from 'react'
import type { RefObject } from 'react'
import { customModelId, optionGroups } from '../../domain/models'
import type { LiveModelStatuses, ModelOption } from '../../domain/models'

interface Props {
  readonly listRef: RefObject<HTMLDivElement>
  readonly listboxId: string
  readonly optionId: (index: number) => string
  readonly visible: readonly ModelOption[]
  readonly modelId: string
  readonly highlight: number
  readonly liveStatuses: LiveModelStatuses
  readonly onPick: (id: string) => void
}

const panel =
  'absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-600 bg-slate-900 py-1 shadow-xl'
const groupHeading = 'px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500'
const statusRow = 'px-3 py-1 text-xs text-slate-500'
const emptyRow = 'px-3 py-2 text-sm text-slate-500'

interface RowProps {
  readonly option: ModelOption
  readonly index: number
  readonly active: boolean
  readonly selected: boolean
  readonly optionId: (index: number) => string
  readonly onPick: (id: string) => void
}

const ModelOptionRow = ({ option, index, active, selected, optionId, onPick }: RowProps) => (
  <button
    id={optionId(index)}
    role="option"
    aria-selected={selected}
    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
      active ? 'bg-slate-700/80' : ''
    } ${selected ? 'text-sky-300' : 'text-slate-200'}`}
    onMouseDown={(event) => event.preventDefault()}
    onClick={() => onPick(option.id)}
  >
    <span className="truncate">{option.label}</span>
    <span className="flex shrink-0 items-center gap-2">
      {option.supportsTools === false ? (
        <span
          title="This model does not list tool support; the book pipeline needs it"
          className="rounded border border-amber-700/60 px-1 text-[10px] text-amber-400"
        >
          no tools
        </span>
      ) : null}
      {selected ? <span aria-hidden>✓</span> : null}
    </span>
  </button>
)

const liveStatusText: Record<'openrouter' | 'lmstudio', { readonly pending: string; readonly error: string }> = {
  openrouter: { pending: 'Loading OpenRouter models…', error: 'OpenRouter models unavailable' },
  lmstudio: { pending: 'Loading LM Studio models…', error: 'LM Studio not reachable — start its local server' },
}

const LiveStatusRow = ({
  provider,
  statuses,
}: {
  readonly provider: 'openrouter' | 'lmstudio'
  readonly statuses: LiveModelStatuses
}) => {
  const text = statuses[provider].error
    ? liveStatusText[provider].error
    : statuses[provider].pending
      ? liveStatusText[provider].pending
      : undefined
  return text === undefined ? null : <p className={statusRow}>{text}</p>
}

export const ModelListbox = ({
  listRef,
  listboxId,
  optionId,
  visible,
  modelId,
  highlight,
  liveStatuses,
  onPick,
}: Props) => {
  useEffect(() => {
    listRef.current
      ?.querySelector(`[id="${optionId(highlight)}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [listRef, optionId, highlight])

  const customIndex = visible.findIndex((option) => option.id === customModelId)
  const custom = customIndex === -1 ? undefined : visible[customIndex]

  return (
    <div ref={listRef} id={listboxId} role="listbox" className={panel}>
      {visible.length === 0 ? (
        <p className={emptyRow}>No models match your search</p>
      ) : (
        optionGroups(visible).map((group) => (
          <div key={group.provider}>
            <p className={groupHeading}>{group.label}</p>
            {group.provider === 'openrouter' || group.provider === 'lmstudio' ? (
              <LiveStatusRow provider={group.provider} statuses={liveStatuses} />
            ) : null}
            {group.options.map(({ option, index }) => (
              <ModelOptionRow
                key={option.id}
                option={option}
                index={index}
                active={index === highlight}
                selected={option.id === modelId}
                optionId={optionId}
                onPick={onPick}
              />
            ))}
          </div>
        ))
      )}
      {custom !== undefined && visible.length > 0 ? (
        <>
          <div className="my-1 border-t border-slate-700" />
          <ModelOptionRow
            option={custom}
            index={customIndex}
            active={customIndex === highlight}
            selected={custom.id === modelId}
            optionId={optionId}
            onPick={onPick}
          />
        </>
      ) : null}
    </div>
  )
}
