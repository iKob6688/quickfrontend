import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

type PostCandidate = { url: string; baseURL?: string }

async function postWithProdFallback<T>(path: string, payload: Record<string, unknown>) {
  const rpcPayload = makeRpc(payload)
  const candidates: PostCandidate[] = [
    { url: path },
    { url: `/api${path}`, baseURL: '' },
    { url: `/web/adt${path}`, baseURL: '' },
    { url: path, baseURL: '' },
  ]
  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      const res = await apiClient.post(candidate.url, rpcPayload, candidate.baseURL ? { baseURL: candidate.baseURL } : undefined)
      return unwrapResponse<T>(res)
    } catch (e) {
      const status = (e as { status?: number; response?: { status?: number } })?.status ?? (e as any)?.response?.status
      // Stop retrying when backend route exists but returned an application/server error.
      // Retrying alternate paths only helps for 404/proxy path mismatches.
      if (status && status !== 404) {
        throw e instanceof Error ? e : new Error('Accounting admin request failed')
      }
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Accounting admin request failed')
}

export type AccountingAdminAccount = {
  id: number
  code: string
  name: string
  displayName?: string
  active: boolean
  deprecated?: boolean
  accountType?: string
  reconcile?: boolean
  company?: { id: number; name: string } | null
}

export type AccountingAdminJournal = {
  id: number
  code: string
  name: string
  type: string
  active: boolean
  currency?: { id: number; name: string } | null
  company?: { id: number; name: string } | null
}

function parseMaybeI18nJsonText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string') return String(value)
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) return value
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const preferredKeys = ['th_TH', 'th', 'en_US', 'en', '1']
    for (const k of preferredKeys) {
      const v = parsed[k]
      if (typeof v === 'string' && v.trim()) return v
    }
    const firstString = Object.values(parsed).find((v) => typeof v === 'string' && v.trim()) as string | undefined
    return firstString ?? value
  } catch {
    return value
  }
}

function normalizeAdminAccount(item: AccountingAdminAccount): AccountingAdminAccount {
  return {
    ...item,
    code: parseMaybeI18nJsonText(item.code),
    name: parseMaybeI18nJsonText(item.name),
    displayName: item.displayName ? parseMaybeI18nJsonText(item.displayName) : item.displayName,
    company: item.company
      ? {
          ...item.company,
          name: parseMaybeI18nJsonText(item.company.name),
        }
      : item.company,
  }
}

function normalizeAdminJournal(item: AccountingAdminJournal): AccountingAdminJournal {
  return {
    ...item,
    code: parseMaybeI18nJsonText(item.code),
    name: parseMaybeI18nJsonText(item.name),
    company: item.company
      ? {
          ...item.company,
          name: parseMaybeI18nJsonText(item.company.name),
        }
      : item.company,
    currency: item.currency
      ? {
          ...item.currency,
          name: parseMaybeI18nJsonText(item.currency.name),
        }
      : item.currency,
  }
}

export async function listAccountingAdminAccounts(params: {
  search?: string
  activeOnly?: boolean | null
  accountType?: string
  limit?: number
}) {
  const res = await postWithProdFallback<{ items: AccountingAdminAccount[]; count: number }>(
    '/th/v1/accounting/admin/accounts',
    {
      ...(params.search ? { search: params.search } : {}),
      ...(params.activeOnly !== null && params.activeOnly !== undefined ? { active_only: params.activeOnly } : {}),
      ...(params.accountType ? { account_type: params.accountType } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
    },
  )
  return {
    ...res,
    items: (res.items ?? []).map(normalizeAdminAccount),
  }
}

export async function updateAccountingAdminAccount(
  id: number,
  payload: Partial<Pick<AccountingAdminAccount, 'code' | 'name' | 'active' | 'reconcile'>>,
) {
  const res = await postWithProdFallback<{ item: AccountingAdminAccount }>(`/th/v1/accounting/admin/accounts/${id}/update`, payload as Record<string, unknown>)
  return { ...res, item: normalizeAdminAccount(res.item) }
}

export async function createAccountingAdminAccount(payload: {
  code: string
  name: string
  accountType: string
  reconcile?: boolean
}) {
  const res = await postWithProdFallback<{ item: AccountingAdminAccount }>(
    '/th/v1/accounting/admin/accounts/create',
    {
      code: payload.code,
      name: payload.name,
      account_type: payload.accountType,
      reconcile: !!payload.reconcile,
    },
  )
  return { ...res, item: normalizeAdminAccount(res.item) }
}

export async function listAccountingAdminJournals(params: {
  search?: string
  activeOnly?: boolean | null
  journalType?: string
  limit?: number
}) {
  const res = await postWithProdFallback<{ items: AccountingAdminJournal[]; count: number }>(
    '/th/v1/accounting/admin/journals',
    {
      ...(params.search ? { search: params.search } : {}),
      ...(params.activeOnly !== null && params.activeOnly !== undefined ? { active_only: params.activeOnly } : {}),
      ...(params.journalType ? { journal_type: params.journalType } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
    },
  )
  return {
    ...res,
    items: (res.items ?? []).map(normalizeAdminJournal),
  }
}

export async function updateAccountingAdminJournal(
  id: number,
  payload: Partial<Pick<AccountingAdminJournal, 'code' | 'name' | 'active'>>,
) {
  const res = await postWithProdFallback<{ item: AccountingAdminJournal }>(`/th/v1/accounting/admin/journals/${id}/update`, payload as Record<string, unknown>)
  return { ...res, item: normalizeAdminJournal(res.item) }
}

export async function createAccountingAdminJournal(payload: {
  code: string
  name: string
  type: string
  currencyId?: number | null
}) {
  const res = await postWithProdFallback<{ item: AccountingAdminJournal }>(
    '/th/v1/accounting/admin/journals/create',
    {
      code: payload.code,
      name: payload.name,
      type: payload.type,
      ...(payload.currencyId ? { currency_id: payload.currencyId } : {}),
    },
  )
  return { ...res, item: normalizeAdminJournal(res.item) }
}
