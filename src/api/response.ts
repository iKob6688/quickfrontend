import type { AxiosError, AxiosResponse } from 'axios'

export type ApiErrorPayload =
  | string
  | {
      code?: string
      message: string
      details?: unknown
    }

export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: ApiErrorPayload | null
}

/**
 * JSON-RPC 2.0 response wrapper from Odoo backend
 */
interface JsonRpcResponse<T> {
  jsonrpc: '2.0'
  id: number | string | null
  result?: ApiEnvelope<T>
  error?: ApiErrorPayload
}

/**
 * Normalizes response data to ApiEnvelope format.
 * Handles both JSON-RPC format ({ jsonrpc, result: { success, data, error } })
 * and plain envelope format ({ success, data, error }).
 */
function normalizeEnvelope<T>(raw: unknown): ApiEnvelope<T> {
  // Check if it's JSON-RPC format
  if (
    raw &&
    typeof raw === 'object' &&
    'jsonrpc' in raw &&
    'result' in raw &&
    (raw as JsonRpcResponse<T>).jsonrpc === '2.0'
  ) {
    const rpc = raw as JsonRpcResponse<T>
    // If result exists, use it as the envelope
    if (rpc.result) {
      return rpc.result
    }
    // If error exists in JSON-RPC, wrap it
    if (rpc.error) {
      return {
        success: false,
        error: rpc.error,
      }
    }
  }

  // Otherwise, treat raw as the envelope directly
  return raw as ApiEnvelope<T>
}

export class ApiError extends Error {
  code?: string
  status?: number
  details?: unknown

  constructor(message: string, options?: { code?: string; status?: number; details?: unknown }) {
    super(message)
    this.name = 'ApiError'
    this.code = options?.code
    this.status = options?.status
    this.details = options?.details
  }
}

function parseEnvelopeError(err: ApiErrorPayload | null | undefined) {
  if (!err) {
    return { message: 'Unexpected API response' }
  }

  if (typeof err === 'string') {
    return { message: err }
  }

  return {
    message: err.message ?? 'Unexpected API response',
    code: err.code,
    details: err.details,
  }
}

/**
 * Unwraps API response, supporting both JSON-RPC and plain envelope formats.
 * @param response Axios response (response.data may be JSON-RPC or plain envelope)
 * @returns The data payload if successful, throws ApiError otherwise
 */
export function unwrapResponse<T>(response: AxiosResponse<unknown>): T {
  const envelope = normalizeEnvelope<T>(response.data)

  if (envelope?.success && envelope.data !== undefined) {
    return envelope.data as T
  }

  const { message, code, details } = parseEnvelopeError(envelope?.error)
  throw new ApiError(message, { code, details })
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  const axiosError = error as AxiosError<unknown> | undefined
  const status = axiosError?.response?.status
  const rawPayload = axiosError?.response?.data

  if (rawPayload) {
    const envelope = normalizeEnvelope<unknown>(rawPayload)
    if (!envelope.success && envelope.error) {
      const parsed = parseEnvelopeError(envelope.error)
      return new ApiError(parsed.message, {
        code: parsed.code,
        status,
        details: parsed.details,
      })
    }
  }

  return new ApiError(
    axiosError?.message ?? 'Network error',
    status ? { status } : undefined,
  )
}

