import type { KeyboardEvent } from 'react'
import { fieldLabel, input } from '../../domain/uiClasses'

interface Props {
  readonly open: boolean
  readonly query: string
  readonly selectedLabel: string
  readonly highlight: number
  readonly listboxId: string
  readonly optionId: (index: number) => string
  readonly onSearch: (value: string) => void
  readonly onOpen: () => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

export const ModelComboboxInput = ({
  open,
  query,
  selectedLabel,
  highlight,
  listboxId,
  optionId,
  onSearch,
  onOpen,
  onKeyDown,
}: Props) => (
  <label className={fieldLabel}>
    Model
    <input
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={open ? optionId(highlight) : undefined}
      autoComplete="off"
      className={`${input} font-normal`}
      value={open ? query : selectedLabel}
      placeholder="Search models…"
      onChange={(event) => onSearch(event.target.value)}
      onFocus={onOpen}
      onClick={onOpen}
      onKeyDown={onKeyDown}
    />
  </label>
)
