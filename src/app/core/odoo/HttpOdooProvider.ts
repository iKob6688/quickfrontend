import type { AnyDocumentDTO, DocType } from '../types/dto'
import type { GetDocumentParams, OdooProvider } from './OdooProvider'

export type HttpOdooProviderOptions = {
  baseUrl: string
  token?: string
  timeoutMs?: number
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

function endpointFor(docType: DocType, recordId: string): string {
  // Assumption: endpoints exist in backend; wiring is ready.
  switch (docType) {
    case 'quotation':
      return `/api/reports/quotation/${encodeURIComponent(recordId)}`
    case 'receipt_full':
      return `/api/reports/receipt/full/${encodeURIComponent(recordId)}`
    case 'receipt_short':
      return `/api/reports/receipt/short/${encodeURIComponent(recordId)}`
    case 'trf_receipt':
      return `/api/reports/trf/${encodeURIComponent(recordId)}`
    default:
      throw new Error(`Unsupported docType: ${docType}`)
  }
}

export class HttpOdooProvider implements OdooProvider {
  private opts: HttpOdooProviderOptions
  constructor(opts: HttpOdooProviderOptions) {
    this.opts = opts
  }

  async getDocumentDTO(params: GetDocumentParams): Promise<AnyDocumentDTO> {
    const timeoutMs = this.opts.timeoutMs ?? 12_000
    const baseUrl = (this.opts.baseUrl || '').replace(/\/$/, '')
    if (!baseUrl) {
      throw new Error('Missing Odoo base URL (configure in Settings).')
    }

    const path = endpointFor(params.docType, params.recordId)
    const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`

    const { signal, cleanup } = withTimeout(undefined, timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.opts.token ? { Authorization: `Bearer ${this.opts.token}` } : {}),
        },
        signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Odoo DTO fetch failed (${res.status}): ${text || res.statusText}`)
      }
      const json = (await res.json()) as AnyDocumentDTO
      return json
    } finally {
      cleanup()
    }
  }
}


