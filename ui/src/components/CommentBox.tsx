export const CommentBox = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) => (
  <label className="field">
    {label}
    <textarea
      rows={2}
      value={value}
      placeholder="Feedback for the writer…"
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
)
