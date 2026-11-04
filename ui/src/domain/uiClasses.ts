const buttonBase =
  'inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45'

export const button = {
  primary: `${buttonBase} bg-sky-600 text-white hover:bg-sky-500`,
  secondary: `${buttonBase} border border-slate-600 bg-slate-700/60 text-slate-100 hover:border-sky-600 hover:bg-slate-700`,
  danger: `${buttonBase} border border-red-900/70 bg-slate-800 text-red-300 hover:bg-red-950/60`,
} as const

export type ButtonVariant = keyof typeof button

export const panel =
  'rounded-xl border border-slate-700/70 bg-slate-800/50 p-4 shadow-sm'

export const input =
  'w-full rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'

export const fieldLabel = 'flex flex-col gap-1 text-sm text-slate-400'

export const actionRow = 'mt-3 flex flex-wrap gap-2'

export const prose =
  'max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-700/70 bg-slate-900/70 p-4 font-serif text-sm leading-relaxed text-slate-200'
