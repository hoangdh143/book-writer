import { fieldLabel, hint } from '../../domain/uiClasses'

interface Props {
  readonly label: string
  readonly description: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}

export const OptionCheckbox = ({ label, description, checked, onChange }: Props) => (
  <div className="flex flex-col gap-1.5">
    <label className={`${fieldLabel} flex items-start gap-2.5 font-normal`}>
      <input
        type="checkbox"
        className="mt-1 size-4 accent-indigo-400"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {label}
        <span className={`${hint} mt-0.5 block`}>{description}</span>
      </span>
    </label>
  </div>
)
