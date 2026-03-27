import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  archiveTaxAdminItem,
  createTaxAdminItem,
  getTaxAdminMeta,
  listTaxAdminItems,
  updateTaxAdminItem,
  type TaxAdminListItem,
} from '@/api/services/taxes.service'
import { toast } from '@/lib/toastStore'

type TaxUse = 'sale' | 'purchase'

export function VatSettingsAdminPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [taxUse, setTaxUse] = useState<TaxUse>('sale')
  const [q, setQ] = useState('')
  const [activeOnly, setActiveOnly] = useState<'all' | 'active' | 'inactive'>('all')
  const [createForm, setCreateForm] = useState({
    name: '',
    amount: 7,
    priceInclude: false,
    invoiceAccountId: '',
    refundAccountId: '',
  })
  const [drafts, setDrafts] = useState<Record<number, Partial<TaxAdminListItem>>>({})

  const activeFilter = useMemo(
    () => (activeOnly === 'all' ? null : activeOnly === 'active'),
    [activeOnly],
  )

  const metaQuery = useQuery({
    queryKey: ['tax-admin', 'meta'],
    queryFn: getTaxAdminMeta,
    staleTime: 60_000,
  })

  const listQuery = useQuery({
    queryKey: ['tax-admin', 'list', taxUse, q, activeOnly],
    queryFn: () => listTaxAdminItems({ typeTaxUse: taxUse, q, activeOnly: activeFilter, vatOnly: false, limit: 500 }),
    staleTime: 15_000,
  })

  const createMutation = useMutation({
    mutationFn: createTaxAdminItem,
    onSuccess: () => {
      toast.success('สร้างภาษีสำเร็จ', 'เพิ่มรายการ VAT เรียบร้อย')
      setCreateForm((prev) => ({ ...prev, name: '' }))
      void qc.invalidateQueries({ queryKey: ['tax-admin', 'list'] })
      void qc.invalidateQueries({ queryKey: ['taxes'] })
    },
    onError: (e) => toast.error('สร้างภาษีไม่สำเร็จ', e instanceof Error ? e.message : 'Unknown error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateTaxAdminItem>[1] }) =>
      updateTaxAdminItem(id, payload),
    onSuccess: () => {
      toast.success('บันทึกสำเร็จ', 'อัปเดต VAT เรียบร้อย')
      void qc.invalidateQueries({ queryKey: ['tax-admin', 'list'] })
      void qc.invalidateQueries({ queryKey: ['taxes'] })
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ', e instanceof Error ? e.message : 'Unknown error'),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: number) => archiveTaxAdminItem(id),
    onSuccess: () => {
      toast.success('ยกเลิกการใช้งาน VAT แล้ว')
      void qc.invalidateQueries({ queryKey: ['tax-admin', 'list'] })
      void qc.invalidateQueries({ queryKey: ['taxes'] })
    },
    onError: (e) => toast.error('ยกเลิกใช้งานไม่สำเร็จ', e instanceof Error ? e.message : 'Unknown error'),
  })

  const canManage = metaQuery.data?.permissions?.canManageAdminFields ?? false
  const accounts = metaQuery.data?.accounts ?? []
  const items = listQuery.data?.items ?? []

  return (
    <div>
      <PageHeader
        title="VAT and Taxes Settings"
        subtitle="ตั้งค่า VAT และ taxes จาก backend เป็น source of truth"
        breadcrumb="Home · Accounting · Tax Settings"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports/vat')}>
              กลับรายงาน VAT
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports/wht')}>
              ไป WHT
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void listQuery.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
          </div>
        }
      />

      {!canManage ? (
        <div className="alert alert-warning">
          คุณไม่มีสิทธิ์จัดการ VAT settings (ต้องเป็น Admin หรือ Accounting Manager)
        </div>
      ) : null}

      <Card className="p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-2">
            <label className="form-label">ประเภท</label>
            <select className="form-select" value={taxUse} onChange={(e) => setTaxUse(e.target.value as TaxUse)}>
              <option value="sale">ภาษีขาย</option>
              <option value="purchase">ภาษีซื้อ</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">ค้นหา</label>
            <input className="form-control" placeholder="ชื่อภาษี / อัตรา" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">สถานะ</label>
            <select className="form-select" value={activeOnly} onChange={(e) => setActiveOnly(e.target.value as any)}>
              <option value="active">Active</option>
              <option value="all">ทั้งหมด</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="col-md-4 text-md-end small text-muted">
            Tax Items: {listQuery.data?.total ?? 0}
          </div>
        </div>
      </Card>

      <Card className="p-3 mb-3">
        <div className="fw-semibold mb-2">สร้าง VAT / Tax ใหม่</div>
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label">ชื่อ</label>
            <input className="form-control" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} placeholder="VAT 7%" />
          </div>
          <div className="col-md-2">
            <label className="form-label">อัตรา (%)</label>
            <input className="form-control" type="number" step="0.01" value={createForm.amount} onChange={(e) => setCreateForm((p) => ({ ...p, amount: Number(e.target.value || 0) }))} />
          </div>
          <div className="col-md-3">
            <label className="form-label">บัญชีภาษี</label>
            <select className="form-select" value={createForm.invoiceAccountId} onChange={(e) => setCreateForm((p) => ({ ...p, invoiceAccountId: e.target.value }))}>
              <option value="">(ใช้ค่า default)</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">บัญชีคืนภาษี</label>
            <select className="form-select" value={createForm.refundAccountId} onChange={(e) => setCreateForm((p) => ({ ...p, refundAccountId: e.target.value }))}>
              <option value="">(ใช้ค่า default)</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <div className="col-md-1">
            <div className="form-check mt-4">
              <input id="priceInclude" className="form-check-input" type="checkbox" checked={createForm.priceInclude} onChange={(e) => setCreateForm((p) => ({ ...p, priceInclude: e.target.checked }))} />
              <label htmlFor="priceInclude" className="form-check-label">รวมในราคา</label>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={() =>
              createMutation.mutate({
                name: createForm.name.trim(),
                amount: createForm.amount,
                typeTaxUse: taxUse,
                amountType: 'percent',
                priceInclude: createForm.priceInclude,
                invoiceAccountId: createForm.invoiceAccountId ? Number(createForm.invoiceAccountId) : null,
                refundAccountId: createForm.refundAccountId ? Number(createForm.refundAccountId) : null,
              })
            }
            disabled={!canManage || !createForm.name.trim() || createMutation.isPending}
            >
            + สร้าง
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-auto">
        {listQuery.isError ? (
          <div className="alert alert-danger m-3">
            โหลด VAT settings ไม่สำเร็จ: {listQuery.error instanceof Error ? listQuery.error.message : 'Unknown error'}
          </div>
        ) : (
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>ชื่อภาษี</th>
                <th>ประเภท</th>
                <th className="text-end">อัตรา (%)</th>
                <th className="text-center">รวมในราคา</th>
                <th>บัญชีภาษี</th>
                <th>บัญชีคืนภาษี</th>
                <th className="text-center">Active</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr><td colSpan={8} className="text-center py-3">กำลังโหลด...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-3 text-muted">ไม่พบข้อมูล</td></tr>
              ) : items.map((t) => {
                const d = drafts[t.id] ?? {}
                const name = (d.name as string | undefined) ?? t.name
                const amount = (d.amount as number | undefined) ?? t.amount
                const priceInclude = (d.priceInclude as boolean | undefined) ?? !!t.priceInclude
                const invoiceAccountId = (d.invoiceAccountId as number | null | undefined) ?? t.invoiceAccountId ?? null
                const refundAccountId = (d.refundAccountId as number | null | undefined) ?? t.refundAccountId ?? null
                return (
                  <tr key={t.id}>
                    <td>
                      <input className="form-control form-control-sm" value={name} onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), name: e.target.value } }))} />
                    </td>
                    <td style={{ minWidth: 120 }} className="text-nowrap">
                      <span className="badge text-bg-light border text-uppercase">
                        {t.typeTaxUse}
                      </span>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <input className="form-control form-control-sm text-end" type="number" step="0.01" value={amount} onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), amount: Number(e.target.value || 0) } }))} />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={priceInclude} onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), priceInclude: e.target.checked } }))} />
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <select className="form-select form-select-sm" value={invoiceAccountId ?? ''} onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), invoiceAccountId: e.target.value ? Number(e.target.value) : null } }))}>
                        <option value="">(ค่า default)</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <select className="form-select form-select-sm" value={refundAccountId ?? ''} onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), refundAccountId: e.target.value ? Number(e.target.value) : null } }))}>
                        <option value="">(ค่า default)</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={!!t.active} onChange={(e) => updateMutation.mutate({ id: t.id, payload: { active: e.target.checked } })} disabled={!canManage} />
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            updateMutation.mutate({
                              id: t.id,
                              payload: {
                                name: String(name).trim(),
                                amount: Number(amount || 0),
                                priceInclude,
                                invoiceAccountId,
                                refundAccountId,
                              },
                            })
                          }
                          disabled={!canManage}
                        >
                          บันทึก
                        </Button>
                        <Button
                          size="sm"
                          variant={t.active ? 'ghost' : 'secondary'}
                          onClick={() => {
                            if (t.active) {
                              archiveMutation.mutate(t.id)
                              return
                            }
                            updateMutation.mutate({ id: t.id, payload: { active: true } })
                          }}
                          disabled={!canManage || archiveMutation.isPending || updateMutation.isPending}
                        >
                          {t.active ? 'Archive' : 'เปิดใช้งาน'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
