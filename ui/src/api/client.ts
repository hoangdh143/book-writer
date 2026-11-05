import type { z } from 'zod'
import { apiErrorSchema } from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type Decode<T> = (body: unknown) => T

// `Input = unknown` keeps inference on the *output* side when schemas use `.default()`
export const decodeWith = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>): Decode<T> =>
  (body) => schema.parse(body)

interface RequestOptions {
  readonly method: string
  readonly path: string
  readonly body?: unknown
}

const errorText = (raw: unknown, status: number): string => {
  const parsed = apiErrorSchema.safeParse(raw)
  return parsed.success ? parsed.data.error : `Request failed (HTTP ${status})`
}

const finish = async <T>(response: Response, decode: Decode<T>): Promise<T> => {
  const raw: unknown = await response.json().catch(() => undefined)
  if (!response.ok) throw new ApiError(errorText(raw, response.status), response.status)
  return decode(raw)
}

const request = async <T>(decode: Decode<T>, options: RequestOptions): Promise<T> => {
  const response = await fetch(options.path, {
    method: options.method,
    headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  return finish(response, decode)
}

export const http = {
  get: <T>(path: string, decode: Decode<T>): Promise<T> => request(decode, { method: 'GET', path }),
  post: <T>(path: string, decode: Decode<T>, body?: unknown): Promise<T> =>
    request(decode, { method: 'POST', path, body }),
  put: <T>(path: string, decode: Decode<T>, body?: unknown): Promise<T> =>
    request(decode, { method: 'PUT', path, body }),
  delete: <T>(path: string, decode: Decode<T>): Promise<T> => request(decode, { method: 'DELETE', path }),
}
