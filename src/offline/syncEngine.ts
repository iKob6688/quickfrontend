import { nanoid } from 'nanoid'
import { db, type PendingOperation, type PendingOpType } from '@/offline/db'
import {
  createInvoice,
  updateInvoice,
  postInvoice,
  registerPayment,
  type InvoicePayload,
  type RegisterPaymentPayload,
} from '@/api/services/invoices.service'

export interface QueueOperationInput {
  type: PendingOpType
  payload: unknown
}

export async function queueOfflineOperation(input: QueueOperationInput) {
  const now = new Date().toISOString()
  const op: PendingOperation = {
    id: nanoid(),
    type: input.type,
    payload: input.payload,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  await db.pendingOps.add(op)
  return op
}

export async function getPendingOperations() {
  return db.pendingOps.where('status').equals('pending').toArray()
}

export async function clearOfflineData() {
  await Promise.all([
    db.masters.clear(),
    db.draftInvoices.clear(),
    db.pendingOps.clear(),
  ])
}

export function isOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

async function dispatchOperation(op: PendingOperation) {
  switch (op.type) {
    case 'CREATE_INVOICE':
      await createInvoice(op.payload as InvoicePayload)
      break
    case 'UPDATE_INVOICE': {
      const payload = op.payload as InvoicePayload & { id: number }
      await updateInvoice(payload.id, payload)
      break
    }
    case 'POST_INVOICE': {
      const payload = op.payload as { id: number }
      await postInvoice(payload.id)
      break
    }
    case 'REGISTER_PAYMENT': {
      const payload = op.payload as {
        id: number
        payment: RegisterPaymentPayload
      }
      await registerPayment(payload.id, payload.payment)
      break
    }
    default:
      throw new Error(`Unknown PendingOpType: ${op.type as string}`)
  }
}

// In a real app we would inject API client and implement retry/backoff here.
export async function syncPendingOperations() {
  if (!isOnline()) return

  const pending = await getPendingOperations()
  for (const op of pending) {
    try {
      await db.pendingOps.update(op.id, {
        status: 'syncing',
        updatedAt: new Date().toISOString(),
      })

      await dispatchOperation(op)

      await db.pendingOps.update(op.id, {
        status: 'done',
        updatedAt: new Date().toISOString(),
        lastError: undefined,
      })
    } catch (error) {
      await db.pendingOps.update(op.id, {
        status: 'error',
        updatedAt: new Date().toISOString(),
        lastError:
          error instanceof Error ? error.message : 'Unknown sync error',
      })
    }
  }
}

export function attachOnlineOfflineListeners() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => {
    void syncPendingOperations()
  })
}

