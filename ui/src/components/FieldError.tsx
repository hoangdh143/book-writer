export const FieldError = ({ message }: { message: string | undefined }) =>
  message === undefined ? null : <p className="text-sm text-red-300">{message}</p>
