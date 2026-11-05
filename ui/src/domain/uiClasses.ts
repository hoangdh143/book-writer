const buttonBase =
  'inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45'

export const button = {
  primary: `${buttonBase} bg-sky-600 text-white hover:bg-sky-500 disabled:hover:bg-sky-600`,
  secondary: `${buttonBase} border border-slate-700 text-slate-100 hover:bg-slate-800 disabled:hover:bg-transparent`,
  danger: `${buttonBase} bg-red-700 text-white hover:bg-red-600`,
  quiet: `${buttonBase} text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:hover:bg-transparent disabled:hover:text-slate-400`,
} as const

export type ButtonVariant = keyof typeof button

export const panel = 'rounded-xl border border-slate-800 bg-slate-900/60 p-5'

const inputBase =
  'w-full rounded-lg px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'

export const input = `${inputBase} border border-slate-700 bg-slate-900 py-2`

/** Reads as plain text until hovered or focused, for long lists of editable rows. */
export const inlineInput = `${inputBase} border border-transparent bg-transparent py-1 hover:border-slate-700 focus:bg-slate-900`

/** Grows with its content instead of hiding text behind a tiny scroll area. */
export const growingText = 'field-sizing-content resize-none'

export const fieldLabel = 'flex flex-col gap-1.5 text-sm font-medium text-slate-300'

export const hint = 'text-sm text-slate-400'

export const pageHeading = 'text-2xl font-semibold text-slate-50'

export const sectionHeading = 'text-lg font-semibold text-slate-100'
