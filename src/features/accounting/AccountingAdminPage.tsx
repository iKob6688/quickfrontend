import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  createAccountingAdminAccount,
  createAccountingAdminJournal,
  listAccountingAdminAccounts,
  listAccountingAdminJournals,
  updateAccountingAdminAccount,
  updateAccountingAdminJournal,
  type AccountingAdminAccount,
  type AccountingAdminJournal,
} from '@/api/services/accounting-admin.service'
import { toast } from '@/lib/toastStore'

type Tab = 'accounts' | 'journals'

export function AccountingAdminPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('accounts')
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState<'all' | 'active' | 'inactive'>('all')
  const [accountDrafts, setAccountDrafts] = useState<Record<string, { code: string; name: string; active: boolean; reconcile: boolean }>>({})
  const [journalDrafts, setJournalDrafts] = useState<Record<string, { code: string; name: string; active: boolean }>>({})
  const [editingRows, setEditingRows] = useState<Record<string, boolean>>({})
  const [newAccount, setNewAccount] = useState({ code: '', name: '', accountType: 'asset_current', reconcile: false })
  const [newJournal, setNewJournal] = useState({ code: '', name: '', type: 'general' })

  const activeFilter = useMemo(() => (activeOnly === 'all' ? null : activeOnly === 'active'), [activeOnly])

  const accountsQuery = useQuery({
    queryKey: ['accounting-admin', 'accounts', search, activeOnly],
    enabled: tab === 'accounts',
    queryFn: () => listAccountingAdminAccounts({ search, activeOnly: activeFilter, limit: 300 }),
    staleTime: 30_000,
  })

  const journalsQuery = useQuery({
    queryKey: ['accounting-admin', 'journals', search, activeOnly],
    enabled: tab === 'journals',
    queryFn: () => listAccountingAdminJournals({ search, activeOnly: activeFilter, limit: 300 }),
    staleTime: 30_000,
  })

  const saveAccountMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AccountingAdminAccount> }) => updateAccountingAdminAccount(id, payload),
    onSuccess: () => {
      toast.success('บันทึกสำเร็จ', 'อัปเดตบัญชีเรียบร้อย')
      void qc.invalidateQueries({ queryKey: ['accounting-admin', 'accounts'] })
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ', e instanceof Error ? e.message : 'Unknown error'),
  })

  const createAccountMutation = useMutation({
    mutationFn: (payload: { code: string; name: string; accountType: string; reconcile: boolean }) => createAccountingAdminAccount(payload),
    onSuccess: () => {
      toast.success('สร้างสำเร็จ', 'สร้างบัญชีเรียบร้อย')
      setNewAccount({ code: '', name: '', accountType: 'asset_current', reconcile: false })
      void qc.invalidateQueries({ queryKey: ['accounting-admin', 'accounts'] })
      setTab('accounts')
    },
    onError: (e) => toast.error('สร้างไม่สำเร็จ', e instanceof Error ? e.message : 'Unknown error'),
  })

  const saveJournalMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AccountingAdminJournal> }) => updateAccountingAdminJournal(id, payload),
    onSuccess: () => {
      toast.success('บันทึกสำเร็จ', 'อัปเดตสมุดรายวันเรียบร้อย')
      void qc.invalidateQueries({ queryKey: ['accounting-admin', 'journals'] })
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ', e instanceof Error ? e.message : 'Unknown error'),
  })

  const createJournalMutation = useMutation({
    mutationFn: (payload: { code: string; name: string; type: string }) => createAccountingAdminJournal(payload),
    onSuccess: () => {
      toast.success('สร้างสำเร็จ', 'สร้างสมุดรายวันเรียบร้อย')
      setNewJournal({ code: '', name: '', type: 'general' })
      void qc.invalidateQueries({ queryKey: ['accounting-admin', 'journals'] })
      setTab('journals')
    },
    onError: (e) => toast.error('สร้างไม่สำเร็จ', e instanceof Error ? e.message : 'Unknown error'),
  })

  const accountItems = accountsQuery.data?.items ?? []
  const journalItems = journalsQuery.data?.items ?? []

  const setAccountDraft = (
    key: string,
    patch: Partial<{ code: string; name: string; active: boolean; reconcile: boolean }>,
    fallback: { code: string; name: string; active: boolean; reconcile: boolean },
  ) => {
    setAccountDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? fallback), ...patch },
    }))
  }
  const setJournalDraft = (
    key: string,
    patch: Partial<{ code: string; name: string; active: boolean }>,
    fallback: { code: string; name: string; active: boolean },
  ) => {
    setJournalDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? fallback), ...patch },
    }))
  }
  const setEditing = (key: string, value: boolean) => setEditingRows((prev) => ({ ...prev, [key]: value }))

  return (
    <div>
      <PageHeader
        title="Accounting Admin (COA / Journals)"
        subtitle="จัดการ Chart of Accounts และสมุดรายวันแบบ admin-only"
        breadcrumb="Home · Accounting · Admin"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports')}>
              กลับไปรายงานบัญชี
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void (tab === 'accounts' ? accountsQuery.refetch() : journalsQuery.refetch())}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <div className="btn-group" role="tablist" aria-label="Accounting admin tabs">
            <button type="button" className={`btn btn-sm ${tab === 'accounts' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('accounts')}>
              COA
            </button>
            <button type="button" className={`btn btn-sm ${tab === 'journals' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('journals')}>
              Journals
            </button>
          </div>
          <input
            className="form-control form-control-sm"
            style={{ maxWidth: 320 }}
            placeholder="ค้นหา code / name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-select form-select-sm" style={{ maxWidth: 180 }} value={activeOnly} onChange={(e) => setActiveOnly(e.target.value as any)}>
            <option value="all">ทั้งหมด</option>
            <option value="active">เฉพาะ Active</option>
            <option value="inactive">เฉพาะ Inactive</option>
          </select>
          <div className="small text-muted ms-auto">
            {tab === 'accounts'
              ? `Accounts: ${accountsQuery.data?.count ?? 0}`
              : `Journals: ${journalsQuery.data?.count ?? 0}`}
          </div>
        </div>
        {tab === 'journals' ? (
          <div className="mt-3 pt-3 border-top">
            <div className="small fw-semibold mb-2">สร้าง Journal (admin)</div>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <input
                className="form-control form-control-sm"
                style={{ maxWidth: 140 }}
                placeholder="Code"
                value={newJournal.code}
                onChange={(e) => setNewJournal((s) => ({ ...s, code: e.target.value.toUpperCase() }))}
              />
              <input
                className="form-control form-control-sm"
                style={{ minWidth: 240, maxWidth: 320 }}
                placeholder="Name"
                value={newJournal.name}
                onChange={(e) => setNewJournal((s) => ({ ...s, name: e.target.value }))}
              />
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 180 }}
                value={newJournal.type}
                onChange={(e) => setNewJournal((s) => ({ ...s, type: e.target.value }))}
              >
                <option value="general">General</option>
                <option value="sale">Sale</option>
                <option value="purchase">Purchase</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="misc">Misc</option>
              </select>
              <Button
                size="sm"
                onClick={() => createJournalMutation.mutate({ code: newJournal.code.trim(), name: newJournal.name.trim(), type: newJournal.type })}
                disabled={!newJournal.code.trim() || !newJournal.name.trim() || createJournalMutation.isPending}
              >
                {createJournalMutation.isPending ? 'กำลังสร้าง...' : 'สร้าง Journal'}
              </Button>
            </div>
          </div>
        ) : null}
        {tab === 'accounts' ? (
          <div className="mt-3 pt-3 border-top">
            <div className="small fw-semibold mb-2">เพิ่มบัญชี (COA)</div>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <input
                className="form-control form-control-sm"
                style={{ maxWidth: 170 }}
                placeholder="Code"
                value={newAccount.code}
                onChange={(e) => setNewAccount((s) => ({ ...s, code: e.target.value }))}
              />
              <input
                className="form-control form-control-sm"
                style={{ minWidth: 240, maxWidth: 340 }}
                placeholder="Name"
                value={newAccount.name}
                onChange={(e) => setNewAccount((s) => ({ ...s, name: e.target.value }))}
              />
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 220 }}
                value={newAccount.accountType}
                onChange={(e) => setNewAccount((s) => ({ ...s, accountType: e.target.value }))}
              >
                {[
                  'asset_current','asset_cash','asset_receivable','asset_non_current',
                  'liability_current','liability_non_current','liability_payable',
                  'equity','equity_unaffected','income','income_other','expense','expense_direct_cost','off_balance',
                ].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <label className="form-check form-check-inline m-0 ms-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={newAccount.reconcile}
                  onChange={(e) => setNewAccount((s) => ({ ...s, reconcile: e.target.checked }))}
                />
                <span className="form-check-label small">Reconcile</span>
              </label>
              <Button
                size="sm"
                onClick={() => createAccountMutation.mutate({
                  code: newAccount.code.trim(),
                  name: newAccount.name.trim(),
                  accountType: newAccount.accountType,
                  reconcile: newAccount.reconcile,
                })}
                disabled={!newAccount.code.trim() || !newAccount.name.trim() || createAccountMutation.isPending}
              >
                {createAccountMutation.isPending ? 'กำลังสร้าง...' : 'เพิ่มบัญชี'}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {tab === 'accounts' ? (
        <Card className="p-0 overflow-auto">
          {accountsQuery.isError ? (
            <div className="alert alert-danger m-3">
              โหลดบัญชีไม่สำเร็จ: {accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Unknown error'}
              {(accountsQuery.error as any)?.details ? (
                <pre className="small mt-2 mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                  {typeof (accountsQuery.error as any).details === 'string'
                    ? (accountsQuery.error as any).details
                    : JSON.stringify((accountsQuery.error as any).details, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : (
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: 120 }}>Code</th>
                  <th style={{ minWidth: 260 }}>Name</th>
                  <th>Type</th>
                  <th>Company</th>
                  <th className="text-center">Active</th>
                  <th className="text-center">Reconcile</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {accountsQuery.isLoading ? (
                  <tr><td colSpan={7} className="text-center py-3">กำลังโหลด...</td></tr>
                ) : accountItems.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-3 text-muted">ไม่พบข้อมูล</td></tr>
                ) : accountItems.map((a) => {
                  const key = `a:${a.id}`
                  const isEditing = !!editingRows[key]
                  const draft = accountDrafts[key] ?? { code: a.code, name: a.name, active: !!a.active, reconcile: !!a.reconcile }
                  return (
                    <tr key={a.id}>
                      <td>
                        <input className="form-control form-control-sm" disabled={!isEditing} value={draft.code} onChange={(e) => setAccountDraft(key, { code: e.target.value }, { code: a.code, name: a.name, active: !!a.active, reconcile: !!a.reconcile })} />
                      </td>
                      <td>
                        <input className="form-control form-control-sm" disabled={!isEditing} value={draft.name} onChange={(e) => setAccountDraft(key, { name: e.target.value }, { code: a.code, name: a.name, active: !!a.active, reconcile: !!a.reconcile })} />
                      </td>
                      <td><span className="badge bg-light text-dark border">{a.accountType || '-'}</span></td>
                      <td className="small">{a.company?.name || '-'}</td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          disabled={!isEditing}
                          checked={!!draft.active}
                          onChange={(e) => setAccountDraft(key, { active: e.target.checked }, { code: a.code, name: a.name, active: !!a.active, reconcile: !!a.reconcile })}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          disabled={!isEditing}
                          checked={!!draft.reconcile}
                          onChange={(e) => setAccountDraft(key, { reconcile: e.target.checked }, { code: a.code, name: a.name, active: !!a.active, reconcile: !!a.reconcile })}
                        />
                      </td>
                      <td className="text-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (!isEditing) {
                              setEditing(key, true)
                              return
                            }
                            saveAccountMutation.mutate({
                              id: a.id,
                              payload: {
                                code: draft.code.trim(),
                                name: draft.name.trim(),
                                active: !!draft.active,
                                reconcile: !!draft.reconcile,
                              },
                            })
                            setEditing(key, false)
                          }}
                        >
                          {isEditing ? 'บันทึก' : 'แก้ไข'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card className="p-0 overflow-auto">
          {journalsQuery.isError ? (
            <div className="alert alert-danger m-3">
              โหลดสมุดรายวันไม่สำเร็จ: {journalsQuery.error instanceof Error ? journalsQuery.error.message : 'Unknown error'}
              {(journalsQuery.error as any)?.details ? (
                <pre className="small mt-2 mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                  {typeof (journalsQuery.error as any).details === 'string'
                    ? (journalsQuery.error as any).details
                    : JSON.stringify((journalsQuery.error as any).details, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : (
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: 120 }}>Code</th>
                  <th style={{ minWidth: 260 }}>Name</th>
                  <th>Type</th>
                  <th>Company</th>
                  <th>Currency</th>
                  <th className="text-center">Active</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {journalsQuery.isLoading ? (
                  <tr><td colSpan={7} className="text-center py-3">กำลังโหลด...</td></tr>
                ) : journalItems.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-3 text-muted">ไม่พบข้อมูล</td></tr>
                ) : journalItems.map((j) => {
                  const key = `j:${j.id}`
                  const isEditing = !!editingRows[key]
                  const draft = journalDrafts[key] ?? { code: j.code, name: j.name, active: !!j.active }
                  return (
                    <tr key={j.id}>
                      <td>
                        <input className="form-control form-control-sm" disabled={!isEditing} value={draft.code} onChange={(e) => setJournalDraft(key, { code: e.target.value }, { code: j.code, name: j.name, active: !!j.active })} />
                      </td>
                      <td>
                        <input className="form-control form-control-sm" disabled={!isEditing} value={draft.name} onChange={(e) => setJournalDraft(key, { name: e.target.value }, { code: j.code, name: j.name, active: !!j.active })} />
                      </td>
                      <td><span className="badge bg-light text-dark border">{j.type || '-'}</span></td>
                      <td className="small">{j.company?.name || '-'}</td>
                      <td className="small">{j.currency?.name || '-'}</td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          disabled={!isEditing}
                          checked={!!draft.active}
                          onChange={(e) => setJournalDraft(key, { active: e.target.checked }, { code: j.code, name: j.name, active: !!j.active })}
                        />
                      </td>
                      <td className="text-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (!isEditing) {
                              setEditing(key, true)
                              return
                            }
                            saveJournalMutation.mutate({ id: j.id, payload: { code: draft.code.trim(), name: draft.name.trim(), active: !!draft.active } })
                            setEditing(key, false)
                          }}
                        >
                          {isEditing ? 'บันทึก' : 'แก้ไข'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  )
}
