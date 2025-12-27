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
 * 
 * Odoo type="json" routes return:
 * {
 *   "jsonrpc": "2.0",
 *   "id": ...,
 *   "result": {
 *     "success": true,
 *     "data": [...],  // ← Actual data array
 *     "error": null
 *   }
 * }
 */
function normalizeEnvelope<T>(raw: unknown): ApiEnvelope<T> {
  // Handle string responses (Axios might not parse JSON in some cases)
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      // If not JSON, treat as error
      return {
        success: false,
        error: 'Invalid JSON response',
      }
    }
  }

  // Check if it's JSON-RPC format
  if (
    raw &&
    typeof raw === 'object' &&
    'jsonrpc' in raw &&
    (raw as JsonRpcResponse<T>).jsonrpc === '2.0'
  ) {
    const rpc = raw as JsonRpcResponse<T>
    
    // If result exists, use it as the envelope
    // result should be ApiEnvelope<T> = { success: boolean, data?: T, error?: ... }
    if ('result' in rpc && rpc.result) {
      // Ensure result has the expected structure
      if (typeof rpc.result === 'object' && ('success' in rpc.result || 'data' in rpc.result || 'error' in rpc.result)) {
        return rpc.result as ApiEnvelope<T>
      }
      // If result is not an envelope, wrap it
      return {
        success: true,
        data: rpc.result as T,
      }
    }
    
    // If error exists in JSON-RPC, wrap it
    if ('error' in rpc && rpc.error) {
      return {
        success: false,
        error: rpc.error,
      }
    }
    
    // JSON-RPC with no result/error (unlikely but handle gracefully)
    return {
      success: false,
      error: 'JSON-RPC response missing result and error',
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

  // Odoo JSON-RPC error shape often includes { code, message, data: { message, debug, ... } }
  // We prefer the most human-friendly message possible.
  const anyErr: any = err as any
  const nestedMessage =
    typeof anyErr?.data?.message === 'string' && anyErr.data.message.trim().length ? anyErr.data.message : undefined
  const nestedDetails =
    anyErr?.details ??
    (typeof anyErr?.data?.debug === 'string' ? anyErr.data.debug : undefined) ??
    anyErr?.data

  return {
    message: nestedMessage ?? err.message ?? 'Unexpected API response',
    code: (err as any).code,
    details: nestedDetails,
  }
}

/**
 * Unwraps API response, supporting both JSON-RPC and plain envelope formats.
 * 
 * Odoo type="json" routes return JSON-RPC 2.0:
 * {
 *   "jsonrpc": "2.0",
 *   "id": 1,
 *   "result": {
 *     "success": true,
 *     "data": [...],  // ← This is what we return
 *     "error": null
 *   }
 * }
 * 
 * This function extracts: response.data.result.data
 * 
 * @param response Axios response (response.data may be JSON-RPC or plain envelope)
 * @returns The data payload if successful, throws ApiError otherwise
 */
export function unwrapResponse<T>(response: AxiosResponse<unknown>): T {
  // Debug: Log raw response in development
  if (import.meta.env.DEV) {
    const url = (response.config?.url || 'unknown').toString()
    if (url.includes('purchases') || url.includes('orders') || url.includes('partners')) {
      console.debug('[unwrapResponse] Processing response:', {
        url,
        status: response.status,
        hasData: !!response.data,
        dataType: typeof response.data,
        rawData: response.data,
      })
    }
  }

  const envelope = normalizeEnvelope<T>(response.data)

  // Debug: Log normalized envelope
  if (import.meta.env.DEV) {
    const url = (response.config?.url || 'unknown').toString()
    if (url.includes('purchases') || url.includes('orders') || url.includes('partners')) {
      console.debug('[unwrapResponse] Normalized envelope:', {
        url,
        success: envelope?.success,
        hasData: envelope?.data !== undefined,
        dataType: Array.isArray(envelope?.data) ? 'array' : typeof envelope?.data,
        dataLength: Array.isArray(envelope?.data) ? envelope.data.length : 'N/A',
        firstItem: Array.isArray(envelope?.data) && envelope.data.length > 0 ? envelope.data[0] : null,
      })
    }
  }

  // Success case: envelope has success=true and data is defined
  if (envelope?.success === true && envelope.data !== undefined && envelope.data !== null) {
    return envelope.data as T
  }

  // Error case: extract and throw error
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

