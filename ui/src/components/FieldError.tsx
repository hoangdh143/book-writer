export const FieldError = ({ message }: { message: string | undefined }) =>
  message === undefined ? null : <p className="field-error">{message}</p>
