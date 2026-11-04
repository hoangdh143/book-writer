export const CommentBox = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) => (
  <label className="mt-3 flex flex-col gap-1 text-sm text-slate-400">
    {label}
    <textarea
      rows={2}
      className="w-full rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      value={value}
      placeholder="Feedback for the writer…"
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
)
