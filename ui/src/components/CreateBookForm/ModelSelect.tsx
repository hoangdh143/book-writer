import { useMemo, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { useLiveModels } from '../../api/liveModels'
import { assembleOptions, matchesQuery, modelLabel, modelPresets } from '../../domain/models'
import { ModelComboboxInput } from './ModelComboboxInput'
import { ModelListbox } from './ModelListbox'

interface Props {
  readonly modelId: string
  readonly onSelect: (modelId: string) => void
}

interface SelectState {
  readonly open: boolean
  readonly query: string
  readonly highlight: number
}

const closedState: SelectState = { open: false, query: '', highlight: 0 }

const listboxId = 'model-select-listbox'
const optionId = (index: number): string => `${listboxId}-option-${index}`

const clamp = (value: number, max: number): number => Math.max(0, Math.min(value, max))

export const ModelSelect = ({ modelId, onSelect }: Props) => {
  const [state, setState] = useState<SelectState>(closedState)
  const live = useLiveModels()
  const options = useMemo(() => assembleOptions(modelPresets, live.presets), [live.presets])
  const visible = useMemo(() => options.filter((option) => matchesQuery(option, state.query)), [options, state.query])
  const listRef = useRef<HTMLDivElement>(null)

  const close = (): void => setState(closedState)

  const pick = (id: string): void => {
    onSelect(id)
    setState(closedState)
  }

  const openList = (): void =>
    setState((current) => ({
      ...current,
      open: true,
      highlight: clamp(visible.findIndex((option) => option.id === modelId), visible.length - 1),
    }))

  const search = (value: string): void =>
    setState((current) => ({ ...current, open: true, query: value, highlight: 0 }))

  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setState((current) => ({
        ...current,
        open: true,
        highlight: clamp(current.highlight + delta, visible.length - 1),
      }))
    } else if (event.key === 'Enter' && state.open) {
      event.preventDefault()
      const chosen = visible[state.highlight]
      if (chosen !== undefined) pick(chosen.id)
    } else if (event.key === 'Escape') {
      close()
    }
  }

  const hideIfOutside = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget)) return
    close()
  }

  return (
    <div className="relative" onBlur={hideIfOutside}>
      <ModelComboboxInput
        open={state.open}
        query={state.query}
        selectedLabel={modelLabel(modelId, options)}
        highlight={state.highlight}
        listboxId={listboxId}
        optionId={optionId}
        onSearch={search}
        onOpen={openList}
        onKeyDown={keyDown}
      />
      {state.open ? (
        <ModelListbox
          listRef={listRef}
          listboxId={listboxId}
          optionId={optionId}
          visible={visible}
          modelId={modelId}
          highlight={state.highlight}
          liveStatuses={live.statuses}
          onPick={pick}
        />
      ) : null}
    </div>
  )
}
