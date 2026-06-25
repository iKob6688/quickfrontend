import { Form, Spinner, Alert } from 'react-bootstrap'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { toApiError } from '@/api/response'
import { toast } from '@/lib/toastStore'
import { useSettingsStore } from '@/app/core/storage/settingsStore'
import { useAppDateFormatter } from '@/lib/dateFormat'
import {
  createDocumentDraft,
  getDocumentReviewDetail,
  listDocumentReviewItems,
  updateDocumentReview,
  uploadPaymentSlip,
  type DocumentReviewListItem,
  type PaymentSlipTransactionType,
} from '@/api/services/document-review.service'
import { listPartners, type PartnerSummary } from '@/api/services/partners.service'
import {
  postPurchaseVendorBill,
  getPurchaseVendorBill,
  registerPurchaseVendorBillPayment,
  searchPurchaseVendorBills,
  type PurchaseVendorBill,
} from '@/api/services/purchase-vendor-bills.service'
import {
  getInvoice,
  listInvoices,
  postInvoice,
  registerPayment,
} from '@/api/services/invoices.service'

type ReconcileTarget = 'new_bill' | 'invoice' | 'bill'

const TARGET_FILTER = 20

function asCurrency(value?: number, currency = 'THB') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` ${currency}`
}

function normalizeAmount(value: string): number {
  const next = value.trim().replace(/,/g, '')
  const parsed = Number(next)
  return Number.isFinite(parsed) ? parsed : 0
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function targetFromSlipType(type?: PaymentSlipTransactionType): ReconcileTarget {
  if (type === 'sale') return 'invoice'
  return 'new_bill'
}

function slipTypeLabel(type?: PaymentSlipTransactionType) {
  if (type === 'sale') return 'ขาย / รับเงินลูกค้า'
  if (type === 'purchase') return 'ซื้อ / จ่ายผู้ขาย'
  if (type === 'internal_transfer') return 'โอนภายใน'
  return 'ยังไม่ระบุ'
}

export function PendingReconcilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scanSlipEnabled = useSettingsStore((state) => state.settings.scanSlipEnabled)
  const patchSettings = useSettingsStore((state) => state.patchSettings)
  const formatDate = useAppDateFormatter()

  const [searchParams, setSearchParams] = useSearchParams()
  const requestedExtractionId = Number(searchParams.get('extraction_id'))
  const hasRequestedExtractionId = Number.isFinite(requestedExtractionId)
  const uploadRequested = searchParams.get('upload') === '1'
  const uploadSource = searchParams.get('source') || 'pending_reconcile'
  const [selectedId, setSelectedId] = useState<number | null>(hasRequestedExtractionId ? requestedExtractionId : null)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [showUpload, setShowUpload] = useState(uploadRequested)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTransactionType, setUploadTransactionType] = useState<PaymentSlipTransactionType>(() => {
    if (uploadSource === 'sales') return 'sale'
    if (uploadSource === 'purchase' || uploadSource === 'expense') return 'purchase'
    return ''
  })
  const [uploadPartnerName, setUploadPartnerName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [target, setTarget] = useState<ReconcileTarget>('new_bill')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [billSearch, setBillSearch] = useState('')
  const [partnerSearch, setPartnerSearch] = useState('')
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
  const [selectedBillId, setSelectedBillId] = useState<number | null>(null)
  const [manualBillId, setManualBillId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayIsoDate())
  const [paymentMethod, setPaymentMethod] = useState('Manual')
  const [paymentReference, setPaymentReference] = useState('')
  const [postBeforePay, setPostBeforePay] = useState(true)
  const [registerPaymentAfterCreate, setRegisterPaymentAfterCreate] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 250)
  const debouncedInvoiceSearch = useDebouncedValue(invoiceSearch, 250)
  const debouncedBillSearch = useDebouncedValue(billSearch, 250)
  const debouncedPartnerSearch = useDebouncedValue(partnerSearch, 250)

  const queueQuery = useQuery({
    queryKey: ['document-review', 'pending-reconcile', 'list', debouncedSearch, offset],
    queryFn: async () => {
      const response = await listDocumentReviewItems({
        limit: TARGET_FILTER,
        offset,
        states: ['ready_for_review'],
        review_states: ['pending_review', 'in_review'],
        document_types: ['payment_slip'],
        search: debouncedSearch || undefined,
      })
      return {
        ...response,
      } as { total: number; count: number; items: DocumentReviewListItem[] }
    },
  })

  const items = queueQuery.data?.items ?? []
  const total = queueQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / TARGET_FILTER))
  const page = Math.floor(offset / TARGET_FILTER) + 1

  useEffect(() => {
    if (uploadRequested) setShowUpload(true)
  }, [uploadRequested])

  useEffect(() => {
    if (!scanSlipEnabled) return
    if (!items.length) return
    if (hasRequestedExtractionId && selectedId === requestedExtractionId) return
    if (selectedId && items.some((item) => item.id === selectedId)) return
    const firstId = items[0].id
    setSelectedId(firstId)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('extraction_id', String(firstId))
      return next
    }, { replace: true })
  }, [hasRequestedExtractionId, items, requestedExtractionId, scanSlipEnabled, selectedId, setSearchParams])

  const detailQuery = useQuery({
    queryKey: ['document-review', 'pending-reconcile', 'detail', selectedId],
    queryFn: () => getDocumentReviewDetail(selectedId!),
    enabled: !!selectedId && scanSlipEnabled,
  })

  const detail = detailQuery.data

  const partnerQuery = useQuery({
    queryKey: ['document-review', 'pending-reconcile', 'partners', debouncedPartnerSearch],
    queryFn: () => listPartners({ q: debouncedPartnerSearch, limit: 8, active: true }),
    enabled: debouncedPartnerSearch.trim().length >= 2,
  })

  const partnerResults = partnerQuery.data?.items ?? []

  const invoiceQuery = useQuery({
    queryKey: ['document-review', 'pending-reconcile', 'invoices', debouncedInvoiceSearch],
    queryFn: () =>
      listInvoices({
        search: debouncedInvoiceSearch || undefined,
        limit: 12,
      }),
    enabled: target === 'invoice' && debouncedInvoiceSearch.trim().length >= 2,
  })

  const billQuery = useQuery({
    queryKey: ['document-review', 'pending-reconcile', 'bills', debouncedBillSearch],
    queryFn: () =>
      searchPurchaseVendorBills({
        q: debouncedBillSearch || undefined,
        limit: 12,
      }),
    enabled: target === 'bill' && debouncedBillSearch.trim().length >= 2,
  })

  const billSearchResult = billQuery.data
  const billList: PurchaseVendorBill[] = billSearchResult?.items ?? []
  const billSearchUnavailable = !!billSearchResult?.endpointUnavailable

  const manualBillQuery = useQuery({
    queryKey: ['document-review', 'pending-reconcile', 'bill-by-id', selectedBillId || manualBillId],
    queryFn: () => {
      const billId = selectedBillId || Number(manualBillId)
      if (!billId) return null
      return getPurchaseVendorBill(billId)
    },
    enabled: target === 'bill' && (Boolean(selectedBillId) || Number(manualBillId) > 0),
  })

  useEffect(() => {
    if (!detail) return
    const partnerId = detail.matched_partner_id || null
    setSelectedPartnerId(partnerId)
    setSelectedInvoiceId(null)
    setSelectedBillId(null)
    setManualBillId('')
    setPaymentAmount(detail.total_amount ? String(detail.total_amount) : '')
    setPaymentReference(detail.document_number || '')
    setTarget(targetFromSlipType(detail.payment_payload?.transaction_type))
  }, [detail])

  const selectedBill = useMemo(() => {
    if (selectedBillId) return billList.find((bill) => bill.id === selectedBillId) || manualBillQuery.data || null
    if (manualBillQuery.data) return manualBillQuery.data
    if (manualBillId) {
      const billId = Number(manualBillId)
      if (billId > 0) return { id: billId } as PurchaseVendorBill
    }
    return null
  }, [selectedBillId, billList, manualBillQuery.data, manualBillId])

  const paymentPayload = {
    amount: normalizeAmount(paymentAmount),
    date: paymentDate,
    method: paymentMethod || 'Manual',
    reference: paymentReference || undefined,
  }

  const completeSelectedSlip = async (linkedModel?: string, linkedResId?: number) => {
    if (!selectedId || !detail) return
    const currentPayload = detail.payment_payload || {}
    await updateDocumentReview(selectedId, {
      review_state: 'confirmed',
      document_type: 'payment_slip',
      document_number: detail.document_number || paymentReference || undefined,
      total_amount: detail.total_amount || paymentPayload.amount || undefined,
    })
    await queryClient.invalidateQueries({ queryKey: ['document-review', 'pending-reconcile', 'list'] })
    await queryClient.invalidateQueries({ queryKey: ['document-review', 'pending-reconcile', 'detail', selectedId] })
    // Keep the UI state grounded even when backend matching is intentionally review-only.
    console.debug('[PendingReconcile] slip confirmed', {
      extractionId: selectedId,
      linkedModel,
      linkedResId,
      transactionType: currentPayload.transaction_type,
    })
  }

  const syncPartnerMutation = useMutation({
    mutationFn: async (nextPartnerId: number | null) => {
      if (!selectedId || detail?.matched_partner_id === nextPartnerId) return null
      return updateDocumentReview(selectedId, {
        matched_partner_id: nextPartnerId,
        review_state: detail?.review_state,
      })
    },
  })

  const uploadSlipMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('กรุณาเลือกไฟล์สลิปก่อน')
      return uploadPaymentSlip({
        file: uploadFile,
        source: uploadSource,
        transaction_type: uploadTransactionType,
        partner_name: uploadPartnerName,
        description: uploadDescription,
      })
    },
    onSuccess: async (result) => {
      toast.success('อัปโหลดสลิปแล้ว', 'ระบบบันทึกเข้า Pending Reconcile เพื่อรอ review/reconcile')
      setUploadFile(null)
      setUploadPartnerName('')
      setUploadDescription('')
      setShowUpload(false)
      await queryClient.invalidateQueries({ queryKey: ['document-review', 'pending-reconcile', 'list'] })
      openExtraction(result.extraction_id)
    },
    onError: (error) => {
      toast.error('อัปโหลดสลิปไม่สำเร็จ', toApiError(error).message)
    },
  })

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId || !detail) throw new Error('ยังไม่เลือก slip ที่ต้องการ')
      await syncPartnerMutation.mutateAsync(selectedPartnerId)
      const draft = await createDocumentDraft(selectedId)
      const billId = draft.linked_res_id || draft.linked_move_id
      if (!billId) throw new Error('ระบบไม่สามารถสร้างบิลได้')

      let bill = await getPurchaseVendorBill(billId)
      if (postBeforePay && bill.status === 'draft') {
        bill = await postPurchaseVendorBill(billId)
      }
      if (registerPaymentAfterCreate && paymentPayload.amount > 0) {
        if (postBeforePay && bill.status === 'draft') {
          throw new Error('ยังคงเป็นร่างอยู่ จึงยังไม่สามารถรับชำระ')
        }
        await registerPurchaseVendorBillPayment(billId, paymentPayload)
      }
      return { billId, posted: postBeforePay, paid: registerPaymentAfterCreate }
    },
    onSuccess: async (result) => {
      toast.success(`สร้าง Vendor Bill #${result.billId} แล้ว${result.paid ? ' และชำระเรียบร้อย' : ''}`)
      await completeSelectedSlip('account.move', result.billId)
      navigate(`/purchases/bills/${result.billId}`)
    },
    onError: (error) => {
      toast.error('สร้าง Vendor Bill ไม่สำเร็จ', toApiError(error).message)
    },
  })

  const reconcileInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !selectedInvoiceId) throw new Error('ยังไม่เลือก invoice')
      await syncPartnerMutation.mutateAsync(selectedPartnerId)
      if (postBeforePay) {
        const invoiceBefore = await getInvoice(selectedInvoiceId)
        if (invoiceBefore.status === 'draft') {
          await postInvoice(selectedInvoiceId)
        }
      }
      if (paymentPayload.amount > 0) {
        await registerPayment(selectedInvoiceId, paymentPayload)
      }
      return { invoiceId: selectedInvoiceId }
    },
    onSuccess: async () => {
      toast.success('จับคู่และรับชำระ Invoice เรียบร้อย', 'เปิดหน้าใบเสร็จรับเงินให้ทำงานต่อได้ทันที')
      await completeSelectedSlip('account.move', selectedInvoiceId || undefined)
      if (selectedInvoiceId) {
        navigate(`/sales/invoices/${selectedInvoiceId}?action=receipt`)
      }
    },
    onError: (error) => {
      toast.error('ชำระ Invoice ไม่สำเร็จ', toApiError(error).message)
    },
  })

  const reconcileBillMutation = useMutation({
    mutationFn: async () => {
      const billId = selectedBill?.id
      if (!billId) throw new Error('ยังไม่เลือก bill')
      let bill = await getPurchaseVendorBill(billId)
      if (postBeforePay && bill.status === 'draft') {
        bill = await postPurchaseVendorBill(billId)
      }
      if (paymentPayload.amount > 0) {
        await registerPurchaseVendorBillPayment(billId, paymentPayload)
      }
      return { billId }
    },
    onSuccess: async (result) => {
      toast.success(`จับคู่และชำระ Vendor Bill #${result.billId} เรียบร้อย`)
      await completeSelectedSlip('account.move', result.billId)
      navigate(`/purchases/bills/${result.billId}`)
    },
    onError: (error) => {
      toast.error('ชำระ Vendor Bill ไม่สำเร็จ', toApiError(error).message)
    },
  })

  const openExtraction = (id: number) => {
    setSelectedId(id)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('extraction_id', String(id))
      return next
    }, { replace: true })
  }

  const submitUpload = async (event: FormEvent) => {
    event.preventDefault()
    await uploadSlipMutation.mutateAsync()
  }

  const run = async (event: FormEvent) => {
    event.preventDefault()
    if (!scanSlipEnabled || !detail) {
      return
    }

    if (target === 'new_bill') {
      await createDraftMutation.mutateAsync()
      return
    }

    if (target === 'invoice') {
      await reconcileInvoiceMutation.mutateAsync()
      return
    }

    await reconcileBillMutation.mutateAsync()
  }

  if (!scanSlipEnabled) {
    return (
      <div>
        <PageHeader
          title="Pending Reconcile"
          breadcrumb="บัญชี · Pending Reconcile"
          subtitle="Upload Payment Slip และ reconcile เข้ากับ invoice/vendor bill"
        />
        <Card className="p-4 border-primary">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-center">
            <div>
              <div className="fw-semibold mb-1">Scan Slip ยังปิดอยู่ในเครื่องนี้</div>
              <div className="small text-muted">
                กดเปิดเพื่อแสดงปุ่ม Upload Payment Slip และคิว Pending Reconcile ทันที
              </div>
            </div>
            <div className="d-flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  patchSettings({ scanSlipEnabled: true })
                  setShowUpload(true)
                }}
              >
                <i className="bi bi-upc-scan me-1" />
                เปิด Scan Slip ตอนนี้
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/reports-studio/settings')}>
                ไปหน้าตั้งค่า
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Pending Reconcile"
        subtitle="คิวจับคู่สลิปชำระเงิน, เลือก Invoice หรือ Vendor Bill, และนำไปโพสต์/ชำระต่อได้ในหน้าเดียว"
        breadcrumb="บัญชี · Pending Reconcile"
      />

      <Card className="mb-3 p-3">
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-end">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOffset(0)
            }}
            placeholder="ค้นหา slip จากคู่ค้า/เลขที่เอกสาร"
            leftAdornment={<i className="bi bi-search" />}
          />
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <Badge tone="blue">ทั้งหมดในคิว: {total}</Badge>
            <Button size="sm" type="button" onClick={() => setShowUpload((value) => !value)}>
              <i className="bi bi-upc-scan me-1" />
              Scan Slip
            </Button>
          </div>
        </div>
      </Card>

      {showUpload ? (
        <Card className="mb-3 p-3 border-primary">
          <form onSubmit={submitUpload}>
            <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
              <div>
                <div className="fw-semibold">Upload Payment Slip</div>
                <div className="small text-muted">รองรับรูปภาพ/PDF แล้วบันทึกเป็น payment_slip ในคิว pending reconcile</div>
              </div>
              <Badge tone="gray">source: {uploadSource}</Badge>
            </div>
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label small text-muted">ประเภท</label>
                <Form.Select
                  value={uploadTransactionType}
                  onChange={(event) => setUploadTransactionType(event.target.value as PaymentSlipTransactionType)}
                >
                  <option value="">ให้ assistant/ผู้ตรวจเลือกภายหลัง</option>
                  <option value="purchase">ซื้อ / จ่ายผู้ขาย</option>
                  <option value="sale">ขาย / รับเงินลูกค้า</option>
                  <option value="internal_transfer">โอนภายใน</option>
                </Form.Select>
              </div>
              <div className="col-md-4">
                <label className="form-label small text-muted">ผู้จ่าย/ผู้รับ/คู่ค้า</label>
                <Input value={uploadPartnerName} onChange={(event) => setUploadPartnerName(event.target.value)} placeholder="เช่น ลูกค้า A / Vendor B" />
              </div>
              <div className="col-md-4">
                <label className="form-label small text-muted">ไฟล์สลิป</label>
                <Form.Control
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => setUploadFile((event.currentTarget as HTMLInputElement).files?.[0] || null)}
                />
              </div>
              <div className="col-12">
                <label className="form-label small text-muted">สินค้า/บริการ/คำอธิบาย</label>
                <Input value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} placeholder="เช่น ค่าบริการบัญชีเดือนนี้ / ซื้อสินค้าเข้าสต็อก" />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <Button size="sm" variant="secondary" type="button" onClick={() => setShowUpload(false)}>
                  ปิด
                </Button>
                <Button size="sm" type="submit" isLoading={uploadSlipMutation.isPending} disabled={!uploadFile}>
                  OCR และบันทึกเข้าคิว
                </Button>
              </div>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="row g-3">
        <div className="col-lg-5">
          <Card>
            <div className="p-3 d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-semibold">คิวสลิปรอทำงาน</div>
                <Badge tone="gray">หน้า {page} / {pageCount}</Badge>
              </div>
              {queueQuery.isLoading ? (
                <div className="py-4 text-center">
                  <Spinner animation="border" />
                </div>
              ) : queueQuery.isError ? (
                <Alert variant="danger">{toApiError(queueQuery.error).message}</Alert>
              ) : items.length === 0 ? (
                <div className="small text-muted">ยังไม่มี slip ในคิวนี้</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`text-start p-2 border rounded ${selectedId === item.id ? 'bg-light border-primary' : ''}`}
                      onClick={() => openExtraction(item.id)}
                    >
                      <div className="fw-semibold">{item.vendor_name || item.name}</div>
                      <div className="small text-muted">{item.document_number || 'ไม่มีเลขเอกสาร'} • {formatDate(item.document_date || '')}</div>
                      <div className="small">{item.total_amount ? asCurrency(item.total_amount, item.currency_name || 'THB') : 'ยังไม่ระบุยอด'}</div>
                    </button>
                  ))}
                </div>
              )}

              <div className="d-flex justify-content-between">
                <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset((prev) => Math.max(0, prev - TARGET_FILTER))}>
                  ก่อนหน้า
                </Button>
                <Button size="sm" variant="secondary" disabled={offset + TARGET_FILTER >= total} onClick={() => setOffset((prev) => prev + TARGET_FILTER)}>
                  ถัดไป
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-lg-7">
          {!selectedId || detailQuery.isLoading ? (
            <Card>
              <div className="p-3 text-muted">เลือก slip จากด้านซ้ายเพื่อเริ่มทำงาน</div>
            </Card>
          ) : detailQuery.isError || !detail ? (
            <Alert variant="danger">{toApiError(detailQuery.error).message}</Alert>
          ) : (
            <form onSubmit={run}>
              <Card className="mb-3 p-3">
                <div className="mb-3">
                  <div className="fw-semibold">ข้อมูลจากสลิป</div>
                  <div className="small text-muted">{detail.vendor_name || 'ยังไม่รู้จักคู่ค้า'} · {detail.document_date || '-'} · {detail.document_type}</div>
                </div>
                <div className="row g-3">
                  <div className="col-12">
                    <div className="small text-muted mb-1">ยอดรวมสลิป</div>
                    <div className="h4 mb-0">{asCurrency(detail.total_amount, detail.currency_name || 'THB')}</div>
                  </div>
                  <div className="col-12">
                    <div className="small text-muted mb-1">ข้อมูลจาก LINE/Assistant</div>
                    <div className="d-flex flex-wrap gap-2">
                      <Badge tone="gray">ประเภท: {detail.payment_payload?.transaction_type || 'ยังไม่ระบุ'}</Badge>
                      <Badge tone={detail.payment_payload?.transaction_type === 'sale' ? 'green' : 'blue'}>
                        workflow: {slipTypeLabel(detail.payment_payload?.transaction_type)}
                      </Badge>
                      <Badge tone="gray">คู่ค้า: {detail.payment_payload?.partner_name || detail.vendor_name || 'ยังไม่ระบุ'}</Badge>
                      <Badge tone="gray">ที่มา: {detail.payment_payload?.source || 'qacc'}</Badge>
                    </div>
                    {detail.payment_payload?.description ? (
                      <div className="small mt-2">{detail.payment_payload.description}</div>
                    ) : null}
                  </div>
                  <div className="col-12">
                    <label className="form-label small text-muted">ค้นหาคู่ค้า</label>
                    <Input
                      value={partnerSearch}
                      onChange={(event) => setPartnerSearch(event.target.value)}
                      placeholder={detail.matched_partner_name || 'ค้นหาคู่ค้าเพื่อจับคู่'}
                      leftAdornment={<i className="bi bi-building" />}
                    />
                    <div className="small text-muted mt-2">
                      คู่ค้าที่จับคู่ปัจจุบัน: {selectedPartnerId ? `#${selectedPartnerId}` : 'ยังไม่ระบุ'}
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {partnerResults.map((partner: PartnerSummary) => (
                        <Button
                          size="sm"
                          variant="secondary"
                          key={partner.id}
                          type="button"
                          onClick={() => {
                            setSelectedPartnerId(partner.id)
                            setPartnerSearch(partner.name)
                          }}
                        >
                          {partner.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="mb-3 p-3">
                <div className="fw-semibold mb-2">ตัวเลือกการ Match/ปิดบัญชี</div>
                <Alert variant="info" className="small">
                  เลือก Invoice/Bill ที่ต้องการ reconcile แล้วระบบจะ post เอกสาร (ถ้ายังเป็นร่าง), บันทึกรับ/จ่ายชำระ,
                  ปิดรายการสลิปออกจากคิว และพาไปหน้าใบเสร็จ/เอกสารต้นทางเพื่อพิมพ์หรือส่ง e-Tax ต่อ
                </Alert>
                <Form.Select value={target} onChange={(event) => setTarget(event.target.value as ReconcileTarget)} className="mb-3">
                  <option value="new_bill">สร้าง Vendor Bill ใหม่</option>
                  <option value="invoice">จับคู่กับ Invoice ลูกหนี้</option>
                  <option value="bill">จับคู่กับ Vendor Bill</option>
                </Form.Select>

                {target === 'invoice' ? (
                  <div>
                    <Input
                      value={invoiceSearch}
                      onChange={(event) => setInvoiceSearch(event.target.value)}
                      placeholder="ค้นหา invoice (เลขที่, ลูกค้า, พิมพ์ข้อความ)"
                      leftAdornment={<i className="bi bi-search" />}
                    />
                    <div className="mt-2 d-flex flex-column gap-2">
                      {invoiceQuery.isLoading ? <Spinner animation="border" size="sm" /> : null}
                      {invoiceQuery.data?.map((invoice) => (
                        <label key={invoice.id} className={`d-flex justify-content-between align-items-center border rounded p-2 ${selectedInvoiceId === invoice.id ? 'bg-light' : ''}`}>
                          <span className="small">
                            #{invoice.number} · {invoice.customerName} · {invoice.status} · {asCurrency(invoice.total, invoice.currency || 'THB')}
                          </span>
                          <input
                            type="radio"
                            name="invoice"
                            checked={selectedInvoiceId === invoice.id}
                            onChange={() => setSelectedInvoiceId(invoice.id)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {target === 'bill' ? (
                  <div>
                    <Input
                      value={billSearch}
                      onChange={(event) => setBillSearch(event.target.value)}
                      placeholder="ค้นหา Vendor Bill (เลขที่บิล/ชื่อผู้จำหน่าย)"
                      leftAdornment={<i className="bi bi-search" />}
                    />
                    {billSearchUnavailable ? (
                      <div className="small text-warning mt-2">ไม่พบ endpoint list สำหรับบิลในระบบนี้ กรุณาใส่ ID ด้วยตนเอง</div>
                    ) : null}
                    <div className="mt-2">
                      <Input
                        value={manualBillId}
                        onChange={(event) => {
                          setManualBillId(event.target.value)
                          setSelectedBillId(null)
                        }}
                        placeholder="หรือใส่ Vendor Bill ID เลย"
                      />
                      {selectedBill ? <div className="small text-muted mt-1">เลือกบิล: #{selectedBill.id}</div> : null}
                    </div>
                    <div className="mt-2 d-flex flex-column gap-2">
                      {billQuery.isLoading ? <Spinner animation="border" size="sm" /> : null}
                      {billList.map((bill) => (
                        <label
                          key={bill.id}
                          className={`d-flex justify-content-between align-items-center border rounded p-2 ${selectedBillId === bill.id ? 'bg-light' : ''}`}
                        >
                          <span className="small">
                            #{bill.number || bill.id} · {bill.vendorName} · {bill.status} · {asCurrency(bill.total, bill.currency)}
                          </span>
                          <input
                            type="radio"
                            name="bill"
                            checked={selectedBillId === bill.id}
                            onChange={() => {
                              setSelectedBillId(bill.id)
                              setManualBillId('')
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>

              <Card className="mb-3 p-3">
                <div className="fw-semibold mb-2">ค่าการชำระ</div>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small text-muted">ยอดชำระ</label>
                    <Input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted">วันที่ชำระ</label>
                    <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted">วิธีชำระ</label>
                    <Input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small text-muted">อ้างอิง</label>
                    <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
                  </div>
                </div>
                <div className="d-flex gap-3 mt-2">
                  <label className="d-flex align-items-center gap-1">
                    <input type="checkbox" checked={postBeforePay} onChange={(event) => setPostBeforePay(event.target.checked)} />
                    <span className="small">โพสต์ก่อนชำระ</span>
                  </label>
                  {target === 'new_bill' ? (
                    <label className="d-flex align-items-center gap-1">
                      <input
                        type="checkbox"
                        checked={registerPaymentAfterCreate}
                        onChange={(event) => setRegisterPaymentAfterCreate(event.target.checked)}
                      />
                      <span className="small">ชำระทันทีหลังสร้างบิล</span>
                    </label>
                  ) : null}
                </div>
                <div className="d-flex justify-content-end mt-4">
                  <Button
                    type="submit"
                    isLoading={createDraftMutation.isPending || reconcileInvoiceMutation.isPending || reconcileBillMutation.isPending}
                    disabled={
                      target === 'new_bill'
                        ? false
                        : target === 'invoice'
                          ? !selectedInvoiceId
                          : !(selectedBillId || Number(manualBillId) > 0)
                    }
                  >
                    {target === 'new_bill'
                      ? registerPaymentAfterCreate
                        ? 'สร้าง Vendor Bill + จ่ายชำระจาก Slip'
                        : 'สร้าง Vendor Bill จาก Slip'
                      : target === 'invoice'
                        ? 'รับชำระ + เปิดใบเสร็จจาก Invoice'
                        : 'ชำระเข้ากับ Bill ที่เลือก'}
                  </Button>
                </div>
              </Card>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
