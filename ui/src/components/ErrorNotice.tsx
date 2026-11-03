const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong'

export const ErrorNotice = ({ error }: { error: unknown }) =>
  error === null || error === undefined ? null : (
    <p className="error-text">{messageOf(error)}</p>
  )
