import Dexie, { type Table } from 'dexie'

export type MasterType = 'customer' | 'product'

export interface MasterRecord {
  id: string
  type: MasterType
  data: unknown
}

export interface DraftInvoiceRecord {
  id: string
  payload: unknown
  updatedAt: string
}

export type PendingOpType =
  | 'CREATE_INVOICE'
  | 'UPDATE_INVOICE'
  | 'POST_INVOICE'
  | 'REGISTER_PAYMENT'

export type PendingOpStatus = 'pending' | 'syncing' | 'done' | 'error'

export interface PendingOperation {
  id: string
  type: PendingOpType
  payload: unknown
  status: PendingOpStatus
  lastError?: string
  createdAt: string
  updatedAt: string
}

export class AccountingOfflineDb extends Dexie {
  masters!: Table<MasterRecord, string>
  draftInvoices!: Table<DraftInvoiceRecord, string>
  pendingOps!: Table<PendingOperation, string>

  constructor() {
    super('accountingOffline')

    this.version(1).stores({
      masters: '&id,type',
      draftInvoices: '&id,updatedAt',
      pendingOps: '&id,status,createdAt',
    })
  }
}

export const db = new AccountingOfflineDb()


