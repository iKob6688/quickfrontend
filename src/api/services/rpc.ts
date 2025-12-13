export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: 'call'
  params: Record<string, unknown>
}

export function getOdooDb(): string | undefined {
  const db = import.meta.env.VITE_ODOO_DB
  return db && typeof db === 'string' && db.trim() ? db.trim() : undefined
}

/**
 * Build a JSON-RPC 2.0 request body.
 * By default includes `db` from VITE_ODOO_DB when available.
 */
export function makeRpc(
  params: Record<string, unknown> | object,
  options?: { includeDb?: boolean },
): JsonRpcRequest {
  const includeDb = options?.includeDb ?? true
  const db = includeDb ? getOdooDb() : undefined
  const p = params as Record<string, unknown>
  return {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      ...p,
      ...(db ? { db } : {}),
    },
  }
}


