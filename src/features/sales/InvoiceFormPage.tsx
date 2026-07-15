import { useParams, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryFunctionContext } from '@tanstack/react-query'
import { getInvoice, createInvoice, updateInvoice, type InvoicePayload } from '@/api/services/invoices.service'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Spinner, Alert } from 'react-bootstrap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { extractFieldErrors, type FieldErrors } from '@/lib/formErrors'
import { clearDraft, loadDraft, loadRecentNotes, pushRecentNote, saveDraft } from '@/lib/formDrafts'
import { toast } from '@/lib/toastStore'
import { listPartners, getPartner, type PartnerListResponse, type PartnerSummary } from '@/api/services/partners.service'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { ProductCombobox } from '@/features/sales/ProductCombobox'
import { useAppDateTimeFormatter } from '@/lib/dateFormat'
import {
  DocumentLineTable,
  DocumentPageLayout,
  DocumentSectionCard,
  DocumentSummary,
  DocumentToolbar,
  useDocumentKeyboardShortcuts,
} from '@/features/document'

function normalizeNotesForTextarea(raw?: string | null): string {
  if (!raw) return ''
  // Convert common HTML text into readable plain text for textarea editing.
  if (raw.includes('<') || raw.includes('&')) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(raw, 'text/html')
    return (doc.body.textContent || '').trim()
  }
  return raw
}

const INVOICE_DRAFT_KEY = 'qf:draft:invoice-form:create:v1'
const INVOICE_RECENT_NOTES_KEY = 'qf:recent-notes:invoice:v1'

function hasMeaningfulInvoiceDraft(data: InvoicePayload) {
  return (
    data.customerId > 0 ||
    (data.notes || '').trim().length > 0 ||
    (data.lines || []).length > 0
  )
}

export function InvoiceFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!id
  const formatDateTime = useAppDateTimeFormatter()
  const invoiceId = id ? Number.parseInt(id, 10) : null
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const customerIdFromQuery = searchParams.get('customerId')
  const partnerIdFromQuery = searchParams.get('partnerId')
  const customerIdPrefill = customerIdFromQuery
    ? Number(customerIdFromQuery)
    : partnerIdFromQuery
      ? Number(partnerIdFromQuery)
      : null

  const {
    data: existingInvoice,
    isLoading: isLoadingInvoice,
  } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId!),
    enabled: isEdit && !!invoiceId,
  })

  const [formData, setFormData] = useState<InvoicePayload>(() => ({
    customerId:
      !isEdit && customerIdPrefill && Number.isFinite(customerIdPrefill) && customerIdPrefill > 0
        ? customerIdPrefill
        : 0,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    currency: 'THB',
    lines: [],
    notes: '',
  }))

  const [customerSearch, setCustomerSearch] = useState('')
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 250)
  const customerLimit = 20

  const customerOptionsQuery = useInfiniteQuery<PartnerListResponse, Error, InfiniteData<PartnerListResponse>, readonly unknown[], number>({
    queryKey: ['partner-selector', debouncedCustomerSearch],
    enabled: !isEdit && debouncedCustomerSearch.trim().length >= 0,
    initialPageParam: 0,
    queryFn: (context: QueryFunctionContext<readonly unknown[], number>) =>
      listPartners({
        q: debouncedCustomerSearch || undefined,
        active: true,
        limit: customerLimit,
        offset: Number(context.pageParam ?? 0),
      }),
    getNextPageParam: (lastPage: PartnerListResponse, allPages: PartnerListResponse[]) => {
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0)
      if (loaded >= (lastPage?.total ?? 0)) return undefined
      if ((lastPage?.items?.length ?? 0) < customerLimit) return undefined
      return loaded
    },
    staleTime: 30_000,
  } as any)

  const customerItems = useMemo(
    () => customerOptionsQuery.data?.pages.flatMap((p: PartnerListResponse) => p.items) ?? [],
    [customerOptionsQuery.data?.pages],
  )
  const customerTotal = customerOptionsQuery.data?.pages[0]?.total

  const selectedCustomerQuery = useQuery({
    queryKey: ['partner', formData.customerId],
    enabled: !isEdit && formData.customerId > 0,
    queryFn: () => getPartner(formData.customerId),
    staleTime: 30_000,
  })

  // Hydrate form when editing invoice is loaded (avoid stale initial state)
  useEffect(() => {
    if (!isEdit || !existingInvoice) return
    const timer = window.setTimeout(() => {
      setFormData({
        customerId: existingInvoice.customerId,
        invoiceDate: existingInvoice.invoiceDate || new Date().toISOString().split('T')[0],
        dueDate: existingInvoice.dueDate || new Date().toISOString().split('T')[0],
        currency: existingInvoice.currency || 'THB',
        lines: existingInvoice.lines || [],
        notes: normalizeNotesForTextarea(existingInvoice.notes),
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [existingInvoice, isEdit])

  const canSubmit = useMemo(() => {
    if (!formData.customerId) return false
    if (!formData.invoiceDate || !formData.dueDate) return false
    if (!formData.currency) return false
    if (!formData.lines || formData.lines.length === 0) return false
    return true
  }, [formData])

  const createMutation = useMutation({
    mutationFn: (payload: InvoicePayload) => createInvoice(payload),
    onSuccess: (data: Awaited<ReturnType<typeof createInvoice>>) => {
      clearDraft(INVOICE_DRAFT_KEY)
      if (formData.notes?.trim()) {
        pushRecentNote(INVOICE_RECENT_NOTES_KEY, formData.notes)
        setRecentNotes(loadRecentNotes(INVOICE_RECENT_NOTES_KEY))
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('สร้างใบแจ้งหนี้สำเร็จ', data.number ? `เลขที่: ${data.number}` : undefined)
      navigate(`/sales/invoices/${data.id}`)
    },
    onError: (err: unknown) => {
      const fe = extractFieldErrors(err)
      if (fe) setFieldErrors(fe)
      toast.error('สร้างใบแจ้งหนี้ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: InvoicePayload) => updateInvoice(invoiceId!, payload),
    onSuccess: () => {
      if (formData.notes?.trim()) {
        pushRecentNote(INVOICE_RECENT_NOTES_KEY, formData.notes)
        setRecentNotes(loadRecentNotes(INVOICE_RECENT_NOTES_KEY))
      }
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('บันทึกสำเร็จ')
      navigate(`/sales/invoices/${invoiceId}`)
    },
    onError: (err: unknown) => {
      const fe = extractFieldErrors(err)
      if (fe) setFieldErrors(fe)
      toast.error('บันทึกไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const [fieldErrors, setFieldErrors] = useState<FieldErrors | null>(null)
  const [recentNotes, setRecentNotes] = useState<string[]>([])
  const [draftPendingRestore, setDraftPendingRestore] = useState<InvoicePayload | null>(null)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [draftGateResolved, setDraftGateResolved] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const skipNextDraftSaveRef = useRef(false)

  useEffect(() => {
    setRecentNotes(loadRecentNotes(INVOICE_RECENT_NOTES_KEY))
  }, [])

  useEffect(() => {
    if (isEdit) {
      setDraftGateResolved(true)
      return
    }
    const draft = loadDraft<InvoicePayload>(INVOICE_DRAFT_KEY)
    if (draft?.data) {
      setDraftPendingRestore(draft.data)
      setDraftUpdatedAt(draft.updatedAt || null)
    }
    setDraftGateResolved(true)
  }, [isEdit])

  useEffect(() => {
    if (isEdit) return
    if (!draftGateResolved) return
    if (draftPendingRestore) return
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false
      return
    }
    if (!hasMeaningfulInvoiceDraft(formData)) {
      clearDraft(INVOICE_DRAFT_KEY)
      setDraftSavedAt(null)
      return
    }
    const timer = window.setTimeout(() => {
      saveDraft(INVOICE_DRAFT_KEY, formData)
      setDraftSavedAt(new Date().toISOString())
    }, 700)
    return () => window.clearTimeout(timer)
  }, [isEdit, draftGateResolved, draftPendingRestore, formData])

  const applyRecentNote = (note: string) => setFormData((prev) => ({ ...prev, notes: note }))
  const appendRecentNote = (note: string) =>
    setFormData((prev) => ({ ...prev, notes: prev.notes?.trim() ? `${prev.notes}\n${note}` : note }))

  const totalAmount = useMemo(
    () =>
      (formData.lines || []).reduce(
        (sum, line) => sum + (Number(line.quantity || 0) * Number(line.unitPrice || 0)),
        0,
      ),
    [formData.lines],
  )

  const lineRows = useMemo(
    () => (formData.lines || []).map((line, idx) => ({ id: idx, ...line })),
    [formData.lines],
  )

  const lineColumns = useMemo(
    () => [
      {
        key: 'product',
        header: 'สินค้า/บริการ',
        className: 'qf-document-line__product',
        cell: (r: (typeof lineRows)[number]) => (
          <ProductCombobox
            valueId={r.productId ?? null}
            onPick={(p) => {
              const next = [...formData.lines]
              const prev = next[r.id]
              const pickedTaxRate = Array.isArray(p.taxes) && p.taxes.length
                ? Number(p.taxes[0]?.amount || 0)
                : prev.taxRate ?? 0
              next[r.id] = {
                ...prev,
                productId: p.id,
                description: (prev.description || '').trim() ? prev.description : p.name,
                taxRate: Number.isFinite(pickedTaxRate) ? pickedTaxRate : 0,
              }
              setFormData({ ...formData, lines: next })
            }}
          />
        ),
      },
      {
        key: 'description',
        header: 'รายละเอียด',
        className: 'qf-document-line__description',
        cell: (r: (typeof lineRows)[number]) => (
          <input
            className="form-control form-control-sm"
            value={r.description || ''}
            onChange={(e) => {
              const next = [...formData.lines]
              next[r.id] = { ...next[r.id], description: e.target.value }
              setFormData({ ...formData, lines: next })
            }}
            placeholder="ชื่อสินค้า / รายละเอียด"
          />
        ),
      },
      {
        key: 'quantity',
        header: 'จำนวน',
        className: 'text-end qf-document-line__qty',
        cell: (r: (typeof lineRows)[number]) => (
          <input
            className="form-control form-control-sm text-end"
            type="number"
            value={r.quantity ?? 1}
            onChange={(e) => {
              const next = [...formData.lines]
              next[r.id] = { ...next[r.id], quantity: Number.parseFloat(e.target.value || '0') }
              setFormData({ ...formData, lines: next })
            }}
            min={0}
            step="0.01"
          />
        ),
      },
      {
        key: 'unitPrice',
        header: 'ราคาต่อหน่วย',
        className: 'text-end qf-document-line__price',
        cell: (r: (typeof lineRows)[number]) => (
          <input
            className="form-control form-control-sm text-end"
            type="number"
            value={r.unitPrice ?? 0}
            onChange={(e) => {
              const next = [...formData.lines]
              next[r.id] = { ...next[r.id], unitPrice: Number.parseFloat(e.target.value || '0') }
              setFormData({ ...formData, lines: next })
            }}
            min={0}
            step="0.01"
          />
        ),
      },
      {
        key: 'taxRate',
        header: 'VAT%',
        className: 'text-end qf-document-line__tax',
        cell: (r: (typeof lineRows)[number]) => (
          <input
            className="form-control form-control-sm text-end"
            type="number"
            value={r.taxRate ?? 0}
            onChange={(e) => {
              const next = [...formData.lines]
              next[r.id] = { ...next[r.id], taxRate: Number.parseFloat(e.target.value || '0') }
              setFormData({ ...formData, lines: next })
            }}
            min={0}
            step="0.01"
          />
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'text-end qf-document-line__action',
        cell: (r: (typeof lineRows)[number]) => (
          <div className="d-flex justify-content-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const next = [...formData.lines]
                const current = next[r.id]
                next.splice(r.id + 1, 0, {
                  ...current,
                  description: current.description ? `${current.description} (สำเนา)` : '',
                })
                setFormData({ ...formData, lines: next })
              }}
            >
              <i className="bi bi-files me-1"></i>
              สำเนา
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const ok = window.confirm('ยืนยันการลบรายการนี้?')
                if (!ok) return
                const next = [...formData.lines]
                next.splice(r.id, 1)
                setFormData({ ...formData, lines: next })
              }}
            >
              <i className="bi bi-trash me-1"></i>
              ลบ
            </Button>
          </div>
        ),
      },
    ],
    [formData, lineRows],
  )

  const summaryRows = useMemo(
    () => [
      { label: 'จำนวนรายการ', value: `${formData.lines.length}` },
      {
        label: 'สกุลเงิน',
        value: formData.currency || 'THB',
      },
    ],
    [formData.currency, formData.lines.length],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors(null)
    if (isEdit) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  useDocumentKeyboardShortcuts({
    onSave: () => document.querySelector<HTMLFormElement>('#invoice-form')?.requestSubmit(),
    onPrint: () => window.print(),
  })

  if (isEdit && isLoadingInvoice) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" />
        <span className="ms-3">กำลังโหลดข้อมูล...</span>
      </div>
    )
  }

  return (
    <DocumentPageLayout
      title={isEdit ? 'แก้ไขใบแจ้งหนี้' : 'สร้างใบแจ้งหนี้ใหม่'}
      subtitle={isEdit ? `แก้ไข ${existingInvoice?.number || `#${invoiceId}`}` : 'กรอกข้อมูลใบแจ้งหนี้'}
      breadcrumb="รายรับ · ใบแจ้งหนี้"
      actions={
        <div className="d-flex align-items-center gap-2">
          {!isEdit && draftSavedAt ? (
            <span className="small text-muted">
              บันทึกแบบร่างอัตโนมัติ {formatDateTime(draftSavedAt)}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(isEdit ? `/sales/invoices/${invoiceId}` : '/sales/invoices')}
          >
            ยกเลิก
          </Button>
        </div>
      }
    >
      <form id="invoice-form" onSubmit={handleSubmit} className="qf-document-form">
        <div className="qf-document-form__stack">
          {!isEdit && draftPendingRestore ? (
            <Alert variant="warning" className="small">
              <div className="fw-semibold mb-1">พบแบบร่างที่บันทึกไว้</div>
              <div className="mb-2">เวลา: {formatDateTime(draftUpdatedAt, 'ไม่ทราบเวลา')}</div>
              <div className="d-flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    clearDraft(INVOICE_DRAFT_KEY)
                    setFormData(draftPendingRestore)
                    setDraftPendingRestore(null)
                    setDraftUpdatedAt(null)
                    setDraftSavedAt(null)
                    toast.info('กู้แบบร่างสำเร็จ')
                  }}
                >
                  กู้แบบร่าง
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    skipNextDraftSaveRef.current = true
                    clearDraft(INVOICE_DRAFT_KEY)
                    setDraftPendingRestore(null)
                    setDraftUpdatedAt(null)
                    setDraftSavedAt(null)
                    toast.success('ลบแบบร่างแล้ว')
                  }}
                >
                  ลบแบบร่าง
                </Button>
              </div>
            </Alert>
          ) : null}

          {createMutation.error || updateMutation.error ? (
            <Alert variant="danger" className="small">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'เกิดข้อผิดพลาด'}
            </Alert>
          ) : null}

          <DocumentSectionCard title="ข้อมูลหลัก">
            <div className="row g-3">
              <div className="col-md-6">
                <Label htmlFor="customerId" required>
                  ลูกค้า
                </Label>
                <Combobox
                  id="customerSearch"
                  value={customerSearch}
                  onChange={setCustomerSearch}
                  placeholder="พิมพ์เพื่อค้นหาลูกค้า (ชื่อ / VAT / อีเมล)"
                  leftAdornment={<i className="bi bi-search"></i>}
                  minChars={1}
                  isLoading={customerOptionsQuery.isFetching || selectedCustomerQuery.isFetching}
                  isLoadingMore={customerOptionsQuery.isFetchingNextPage}
                  onLoadMore={() => {
                    if (customerOptionsQuery.hasNextPage) customerOptionsQuery.fetchNextPage()
                  }}
                  options={customerItems.map<ComboboxOption>((p: PartnerSummary) => ({
                    id: p.id,
                    label: p.name,
                    meta: p.vat ? `เลขผู้เสียภาษี: ${p.vat}` : p.email ? p.email : `รหัส: ${p.id}`,
                  }))}
                  total={customerTotal}
                  emptyText="ไม่พบลูกค้า (ลองพิมพ์คำอื่น)"
                  onPick={(opt) => {
                    setFormData((prev) => ({ ...prev, customerId: Number(opt.id) }))
                    setCustomerSearch(opt.label)
                  }}
                />
                <div className="small text-muted mt-2">
                  พิมพ์อย่างน้อย 1 ตัวอักษรเพื่อค้นหา • ใช้ ↑/↓ และ Enter เพื่อเลือก • Esc เพื่อปิด
                </div>
                {selectedCustomerQuery.data ? (
                  <div className="small text-muted mt-2">
                    เลือกแล้ว: <span className="fw-semibold">{selectedCustomerQuery.data.displayName}</span> (รหัส:{' '}
                    {formData.customerId})
                  </div>
                ) : null}
                {customerOptionsQuery.isError ? (
                  <div className="small text-danger mt-2">
                    {customerOptionsQuery.error instanceof Error ? customerOptionsQuery.error.message : 'โหลดรายชื่อลูกค้าไม่สำเร็จ'}
                  </div>
                ) : null}
                {fieldErrors?.customerId ? <small className="text-danger">{fieldErrors.customerId}</small> : null}
              </div>
              <div className="col-md-6">
                <Label htmlFor="currency" required>
                  สกุลเงิน
                </Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="THB"
                  required
                />
                {fieldErrors?.currency ? <small className="text-danger">{fieldErrors.currency}</small> : null}
              </div>
              <div className="col-md-6">
                <Label htmlFor="invoiceDate" required>
                  วันที่เอกสาร
                </Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  required
                />
                {fieldErrors?.invoiceDate ? <small className="text-danger">{fieldErrors.invoiceDate}</small> : null}
              </div>
              <div className="col-md-6">
                <Label htmlFor="dueDate" required>
                  วันครบกำหนด
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  required
                />
                {fieldErrors?.dueDate ? <small className="text-danger">{fieldErrors.dueDate}</small> : null}
              </div>
              <div className="col-12">
                <Label htmlFor="notes">หมายเหตุ</Label>
                <textarea
                  id="notes"
                  className="form-control"
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                />
                {recentNotes.length > 0 ? (
                  <div className="mt-2">
                    <div className="small text-muted mb-1">หมายเหตุที่ใช้ล่าสุด</div>
                    <div className="d-flex flex-wrap gap-2">
                      {recentNotes.slice(0, 4).map((note, idx) => (
                        <div key={`${idx}-${note.slice(0, 12)}`} className="d-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => applyRecentNote(note)}
                            title={note}
                          >
                            ใช้ล่าสุด {idx + 1}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => appendRecentNote(note)}
                            title={note}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </DocumentSectionCard>

          <DocumentSectionCard>
            <DocumentLineTable
              title="รายการสินค้า/บริการ"
              description="Odoo จะคำนวณยอด/ภาษี/รวมทั้งหมดหลังบันทึก (Quickfront แสดงผลเท่านั้น)"
              rows={lineRows}
              columns={lineColumns as any}
              empty={<div className="alert alert-warning small mb-0">กรุณาเพิ่มอย่างน้อย 1 รายการ</div>}
              addLabel={
                <>
                  <i className="bi bi-plus-lg me-1" />
                  เพิ่มรายการ
                </>
              }
              onAdd={() =>
                setFormData({
                  ...formData,
                  lines: [
                    ...formData.lines,
                    { productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 0, subtotal: 0 },
                  ],
                })
              }
            />
          </DocumentSectionCard>

          <DocumentSummary
            rows={summaryRows}
            totalLabel="ยอดรวมโดยประมาณ"
            totalValue={`${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${formData.currency}`}
            note="สรุปนี้แสดงยอดประมาณการก่อนยืนยันบันทึก"
          />

          <DocumentToolbar>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={!canSubmit || createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? 'บันทึกการแก้ไข' : 'สร้างใบแจ้งหนี้'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(isEdit ? `/sales/invoices/${invoiceId}` : '/sales/invoices')}
            >
              ยกเลิก
            </Button>
          </DocumentToolbar>
        </div>
      </form>
    </DocumentPageLayout>
  )
}
