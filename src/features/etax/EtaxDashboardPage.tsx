import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Tabs } from '@/components/ui/Tabs'
import { toast } from '@/lib/toastStore'
import {
  cancelEtaxDocument,
  getEtaxDocument,
  getEtaxSummary,
  listEtaxDocuments,
  pollEtaxDocument,
  resendEtaxDocumentEmail,
  retryEtaxDocument,
  sendEtaxDocumentEmail,
  submitEtaxDocument,
  type EtaxDocumentRecord,
  type EtaxDocumentState,
} from '@/api/services/etax.service'
import { writeAssistantPageContext, type AssistantPageSelectionRecord } from '@/lib/assistantPageContext'

type FilterState = EtaxDocumentState | 'all'
type BulkActionKey = 'submit' | 'poll' | 'retry' | 'cancel' | 'send-email' | 'resend-email'

function formatMoney(amount: number | null | undefined, currency = 'THB') {
  const value = Number(amount || 0)
  return `${value.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function stateTone(state: EtaxDocumentState) {
  switch (state) {
    case 'done':
      return 'green'
    case 'processing':
      return 'amber'
    case 'submitted':
    case 'queued':
      return 'blue'
    case 'error':
      return 'red'
    case 'cancelled':
      return 'gray'
    default:
      return 'gray'
  }
}

function stateLabel(state: EtaxDocumentState) {
  switch (state) {
    case 'draft':
      return 'ร่าง'
    case 'queued':
      return 'เข้าคิว'
    case 'submitted':
      return 'ส่งแล้ว'
    case 'processing':
      return 'กำลังประมวลผล'
    case 'done':
      return 'สำเร็จ'
    case 'error':
      return 'ผิดพลาด'
    case 'cancelled':
      return 'ยกเลิก'
    default:
      return state
  }
}

function inetTone(status: EtaxDocumentRecord['inetStatus']) {
  if (status === 'OK') return 'green'
  if (status === 'PC') return 'amber'
  if (status === 'ER') return 'red'
  return 'gray'
}

function emailTone(state: EtaxDocumentRecord['emailState']) {
  if (state === 'sent') return 'green'
  if (state === 'pending') return 'amber'
  if (state === 'failed') return 'red'
  return 'gray'
}

function emailLabel(state: EtaxDocumentRecord['emailState']) {
  switch (state) {
    case 'pending':
      return 'กำลังส่ง'
    case 'sent':
      return 'ส่งแล้ว'
    case 'failed':
      return 'ผิดพลาด'
    case 'not_applicable':
    default:
      return 'ไม่เกี่ยวข้อง'
  }
}

function formatFieldLabel(field: string) {
  const roleMap: Record<string, string> = {
    seller: 'Seller',
    buyer: 'Buyer',
    shipTo: 'Ship-to',
  }
  const map: Record<string, string> = {
    street: 'Street',
    subdistrict: 'Subdistrict',
    district: 'District',
    province: 'Province',
    zip: 'Postal Code',
    country: 'Country',
  }
  if (field.includes('.')) {
    const [role, rawField] = field.split('.', 2)
    const roleLabel = roleMap[role] || role
    return `${roleLabel} ${map[rawField] || rawField}`
  }
  return map[field] || field
}

function formatRuntimeLabel(mode?: string | null, style?: string | null) {
  const parts = [mode, style].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

function bulkActionLabel(action: BulkActionKey) {
  switch (action) {
    case 'submit':
      return 'ส่ง e-Tax'
    case 'poll':
      return 'อัปเดตสถานะ'
    case 'retry':
      return 'ลองใหม่'
    case 'cancel':
      return 'ยกเลิกเอกสาร'
    case 'send-email':
      return 'ส่งอีเมล'
    case 'resend-email':
      return 'ส่งอีเมลอีกครั้ง'
    default:
      return action
  }
}

function getSourceDocumentRoute(doc: Pick<EtaxDocumentRecord, 'moveId' | 'documentType'>) {
  if (!doc.moveId) return null
  const rawType = (doc.documentType || '').toLowerCase()
  if (rawType.includes('credit') || rawType.includes('debit') || rawType.includes('note')) {
    return `/sales/notes/${doc.moveId}`
  }
  return `/sales/invoices/${doc.moveId}`
}

export function EtaxDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [stateFilter, setStateFilter] = useState<FilterState>('all')
  const [search, setSearch] = useState('')
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([])
  const [bulkActionKey, setBulkActionKey] = useState<BulkActionKey | null>(null)
  const requestedDocumentId = Number.parseInt(searchParams.get('documentId') || '', 10)

  const summaryQuery = useQuery({
    queryKey: ['etax', 'summary'],
    queryFn: getEtaxSummary,
    staleTime: 30_000,
  })

  const listQuery = useQuery({
    queryKey: ['etax', 'documents', stateFilter, search],
    queryFn: () =>
      listEtaxDocuments({
        state: stateFilter,
        q: search.trim() || undefined,
        limit: 20,
        offset: 0,
      }),
    staleTime: 15_000,
  })

  useEffect(() => {
    if (Number.isFinite(requestedDocumentId) && requestedDocumentId > 0 && selectedDocumentId !== requestedDocumentId) {
      setSelectedDocumentId(requestedDocumentId)
    }
  }, [requestedDocumentId, selectedDocumentId])

  useEffect(() => {
    const first = listQuery.data?.items?.[0]
    if (!selectedDocumentId && first) {
      setSelectedDocumentId(first.id)
    }
  }, [listQuery.data?.items, selectedDocumentId])

  useEffect(() => {
    if (!selectedDocumentId) return
    const current = listQuery.data?.items?.find((item) => item.id === selectedDocumentId)
    if (!current && listQuery.data?.items?.[0]) {
      setSelectedDocumentId(listQuery.data.items[0].id)
    }
  }, [listQuery.data?.items, selectedDocumentId])

  useEffect(() => {
    const visibleIds = new Set((listQuery.data?.items ?? []).map((item) => item.id))
    setSelectedRowIds((current) => current.filter((id) => visibleIds.has(id)))
  }, [listQuery.data?.items])

  const detailQuery = useQuery({
    queryKey: ['etax', 'document', selectedDocumentId],
    enabled: Boolean(selectedDocumentId),
    queryFn: () => getEtaxDocument(selectedDocumentId as number),
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!selectedDocumentId) return
    const next = new URLSearchParams(searchParams)
    next.set('documentId', String(selectedDocumentId))
    setSearchParams(next, { replace: true })
  }, [selectedDocumentId, searchParams, setSearchParams])

  useEffect(() => {
    const doc = detailQuery.data
    const selectedRecords: AssistantPageSelectionRecord[] = doc
      ? [
          {
            id: doc.id,
            name: doc.name || `ETAX#${doc.id}`,
            model: 'adt.etax.document',
            route: `/accounting/etax?documentId=${doc.id}`,
            documentType: doc.documentType || undefined,
            state: doc.state,
            status: doc.inetStatus || doc.state,
            submissionMode: doc.submissionMode || undefined,
            csvPayloadStyle: doc.csvPayloadStyle || undefined,
            transactionCode: doc.transactionCode || undefined,
          },
          ...(doc.moveId
            ? [
                {
                  id: doc.moveId,
                  name: doc.moveName || doc.invoiceNumber || `INV#${doc.moveId}`,
                  model: 'account.move',
                  route: `/sales/invoices/${doc.moveId}`,
                  ref: doc.invoiceNumber || undefined,
                  documentType: doc.documentType || undefined,
                  state: doc.state,
                  status: doc.inetStatus || doc.state,
                },
              ]
            : []),
        ]
      : []
    writeAssistantPageContext({
      route: '/accounting/etax',
      search: location.search,
      page_kind: 'etax_dashboard',
      q: search,
      filter: stateFilter,
      source_model: doc?.moveId ? 'account.move' : doc?.id ? 'adt.etax.document' : undefined,
      source_id: doc?.moveId || doc?.id || undefined,
      source_name: doc?.moveName || doc?.name || undefined,
      document_type_candidate: doc?.documentType || undefined,
      selected_etax_document_id: doc?.id || undefined,
      selected_records: selectedRecords,
      selected_count: selectedRecords.length,
      selection_scope: 'etax_dashboard',
    })
    return () => {
      writeAssistantPageContext(null)
    }
  }, [detailQuery.data, location.search, search, stateFilter])

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['etax'] })
  }

  const submitMutation = useMutation({
    mutationFn: submitEtaxDocument,
    onSuccess: async (doc) => {
      toast.success('ส่ง e-Tax สำเร็จ', doc.transactionCode ? `Transaction: ${doc.transactionCode}` : undefined)
      setSelectedDocumentId(doc.id)
      await refreshAll()
    },
    onError: (err) => toast.error('ส่ง e-Tax ไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const pollMutation = useMutation({
    mutationFn: pollEtaxDocument,
    onSuccess: async (doc) => {
      toast.success('อัปเดตสถานะ e-Tax แล้ว')
      setSelectedDocumentId(doc.id)
      await refreshAll()
    },
    onError: (err) => toast.error('ดึงสถานะ e-Tax ไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const retryMutation = useMutation({
    mutationFn: retryEtaxDocument,
    onSuccess: async (doc) => {
      toast.success('นำเอกสารกลับเข้าคิวแล้ว')
      setSelectedDocumentId(doc.id)
      await refreshAll()
    },
    onError: (err) => toast.error('Retry ไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const cancelMutation = useMutation({
    mutationFn: cancelEtaxDocument,
    onSuccess: async (doc) => {
      toast.success('ยกเลิกเอกสารแล้ว')
      setSelectedDocumentId(doc.id)
      await refreshAll()
    },
    onError: (err) => toast.error('ยกเลิกไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const sendEmailMutation = useMutation({
    mutationFn: sendEtaxDocumentEmail,
    onSuccess: async (doc) => {
      toast.success('ส่งอีเมล e-Tax สำเร็จ')
      setSelectedDocumentId(doc.id)
      await refreshAll()
    },
    onError: (err) => toast.error('ส่งอีเมล e-Tax ไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const resendEmailMutation = useMutation({
    mutationFn: resendEtaxDocumentEmail,
    onSuccess: async (doc) => {
      toast.success('ส่งอีเมล e-Tax อีกครั้งสำเร็จ')
      setSelectedDocumentId(doc.id)
      await refreshAll()
    },
    onError: (err) => toast.error('ส่งอีเมล e-Tax อีกครั้งไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const summaryState = summaryQuery.data
  const summary = summaryState?.config
  const usage = summary?.usage

  const rows = useMemo(
    () =>
      (listQuery.data?.items ?? []).map((doc) => ({
        id: doc.id,
        moveId: doc.moveId ?? null,
        documentType: doc.documentType || '',
        invoiceNumber: doc.invoiceNumber || doc.moveName || doc.name,
        partnerName: doc.partnerName || '—',
        state: doc.state,
        inetStatus: doc.inetStatus,
        amountTotal: doc.amountTotal ?? 0,
        currency: doc.currency || 'THB',
        updatedAt: doc.lastPollDate || doc.lastSubmitDate || '',
        availableNextActions: doc.availableNextActions ?? [],
        canSendEmail: Boolean(doc.canSendEmail),
        canResendEmail: Boolean(doc.canResendEmail),
      })),
    [listQuery.data?.items],
  )

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedRowIds.includes(row.id))
  const selectedDocuments = rows.filter((row) => selectedRowIds.includes(row.id))
  const eligibleRowsByAction = useMemo(
    () =>
      ({
        submit: selectedDocuments.filter((row) => row.availableNextActions.includes('submit')),
        poll: selectedDocuments.filter((row) => row.availableNextActions.includes('poll')),
        retry: selectedDocuments.filter((row) => row.availableNextActions.includes('retry')),
        cancel: selectedDocuments.filter((row) => row.availableNextActions.includes('cancel')),
        'send-email': selectedDocuments.filter((row) => row.canSendEmail),
        'resend-email': selectedDocuments.filter((row) => row.canResendEmail),
      }) as Record<BulkActionKey, typeof selectedDocuments>,
    [selectedDocuments],
  )

  const openSourceDocument = (row: { id: number; moveId: number | null; documentType: string }) => {
    const route = getSourceDocumentRoute({ moveId: row.moveId, documentType: row.documentType })
    if (!route) {
      toast.info('ยังไม่มีเอกสารต้นทางให้เปิด', 'รายการนี้ยังไม่เชื่อมกับใบแจ้งหนี้หรือใบเพิ่ม/ลดหนี้')
      return
    }
    navigate(route)
  }

  const toggleRowSelection = (documentId: number, checked: boolean) => {
    setSelectedRowIds((current) =>
      checked ? Array.from(new Set([...current, documentId])) : current.filter((id) => id !== documentId),
    )
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedRowIds((current) => {
      if (!checked) return current.filter((id) => !rows.some((row) => row.id === id))
      return Array.from(new Set([...current, ...rows.map((row) => row.id)]))
    })
  }

  const runBulkAction = async (action: BulkActionKey) => {
    if (!selectedRowIds.length) {
      toast.info('ยังไม่ได้เลือกรายการ', 'เลือกเอกสารจากตารางก่อนแล้วจึงจัดการหลายรายการ')
      return
    }
    const actionMap: Record<
      BulkActionKey,
      {
        label: string
        success: string
        fn: (documentId: number) => Promise<EtaxDocumentRecord>
      }
    > = {
      submit: { label: 'ส่ง e-Tax', success: 'ส่ง e-Tax ให้รายการที่เลือกแล้ว', fn: submitEtaxDocument },
      poll: { label: 'อัปเดตสถานะ', success: 'อัปเดตสถานะรายการที่เลือกแล้ว', fn: pollEtaxDocument },
      retry: { label: 'ลองใหม่', success: 'นำรายการที่เลือกกลับเข้าคิวแล้ว', fn: retryEtaxDocument },
      cancel: { label: 'ยกเลิกเอกสาร', success: 'ยกเลิกรายการที่เลือกแล้ว', fn: cancelEtaxDocument },
      'send-email': { label: 'ส่งอีเมล', success: 'ส่งอีเมลให้รายการที่เลือกแล้ว', fn: sendEtaxDocumentEmail },
      'resend-email': { label: 'ส่งอีเมลอีกครั้ง', success: 'ส่งอีเมลซ้ำให้รายการที่เลือกแล้ว', fn: resendEtaxDocumentEmail },
    }
    const targetIds = eligibleRowsByAction[action].map((row) => row.id)
    if (!targetIds.length) {
      toast.info('ยังไม่มีรายการที่ทำคำสั่งนี้ได้', `${bulkActionLabel(action)}ได้เฉพาะเอกสารที่อยู่ในสถานะที่รองรับ`)
      return
    }
    const config = actionMap[action]
    setBulkActionKey(action)
    try {
      let successCount = 0
      for (const documentId of targetIds) {
        await config.fn(documentId)
        successCount += 1
      }
      toast.success(config.success, `${successCount} รายการ`)
      if (selectedRowIds.length > targetIds.length) {
        toast.info('มีบางรายการถูกข้าม', `ระบบข้าม ${selectedRowIds.length - targetIds.length} รายการที่ยังไม่รองรับคำสั่งนี้`)
      }
      if (targetIds[0]) setSelectedDocumentId(targetIds[0])
      await refreshAll()
    } catch (err) {
      toast.error(`${config.label}ไม่สำเร็จ`, err instanceof Error ? err.message : undefined)
    } finally {
      setBulkActionKey(null)
    }
  }

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'selected',
      header: (
        <input
          type="checkbox"
          className="form-check-input"
          checked={allVisibleSelected}
          aria-label="เลือกรายการทั้งหมด"
          onChange={(event) => toggleSelectAllVisible(event.target.checked)}
        />
      ),
      className: 'text-center text-nowrap',
      cell: (row) => (
        <input
          type="checkbox"
          className="form-check-input"
          checked={selectedRowIds.includes(row.id)}
          aria-label={`เลือกรายการ ${row.invoiceNumber}`}
          onChange={(event) => toggleRowSelection(row.id, event.target.checked)}
        />
      ),
    },
    {
      key: 'invoiceNumber',
      header: 'เอกสาร',
      cell: (row) => (
        <div className="d-flex flex-column align-items-start gap-1">
          <button
            type="button"
            className="btn btn-link p-0 fw-semibold text-decoration-none text-start font-monospace"
            onClick={() => setSelectedDocumentId(row.id)}
          >
            {row.invoiceNumber}
          </button>
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-decoration-none"
            onClick={() => openSourceDocument(row)}
          >
            เปิดเอกสารต้นทาง
          </button>
        </div>
      ),
    },
    {
      key: 'partnerName',
      header: 'ลูกค้า',
      cell: (row) => <span>{row.partnerName}</span>,
    },
    {
      key: 'state',
      header: 'สถานะ',
      className: 'text-nowrap',
      cell: (row) => <Badge tone={stateTone(row.state)}>{stateLabel(row.state)}</Badge>,
    },
    {
      key: 'inetStatus',
      header: 'INET',
      className: 'text-nowrap',
      cell: (row) => <Badge tone={inetTone(row.inetStatus)}>{row.inetStatus || '—'}</Badge>,
    },
    {
      key: 'amountTotal',
      header: 'มูลค่า',
      className: 'text-end text-nowrap',
      cell: (row) => <span className="font-monospace">{formatMoney(row.amountTotal, row.currency)}</span>,
    },
    {
      key: 'updatedAt',
      header: 'อัปเดตล่าสุด',
      className: 'text-nowrap',
      cell: (row) => <span>{row.updatedAt ? new Date(row.updatedAt).toLocaleString('th-TH') : '—'}</span>,
    },
  ]

  const currentDoc = detailQuery.data
  const currentAvailableActions = currentDoc?.availableNextActions || []
  const canSubmitCurrentDoc = Boolean(
    currentDoc &&
      currentAvailableActions.includes('submit') &&
      summary?.credentialsConfigured,
  )
  const canPollCurrentDoc = Boolean(
    currentDoc && currentAvailableActions.includes('poll'),
  )
  const currentStatusMessage =
    currentDoc?.state === 'done'
      ? 'เอกสารเสร็จสมบูรณ์แล้ว สามารถเปิด signed artifacts หรือส่งอีเมลได้'
      : currentDoc?.state === 'cancelled'
        ? 'เอกสารถูกยกเลิกแล้ว'
        : currentDoc?.errorMessage
          ? currentDoc.errorMessage
          : 'ไม่มีข้อความผิดพลาด'

  return (
    <div className="qf-etax-page">
      <PageHeader
        title="เอกสาร e-Tax"
        subtitle="ติดตามคิว e-Tax ดูสถานะ INET และจัดการเอกสารจากหน้ารายการเดียว"
        breadcrumb="บัญชี · เอกสาร e-Tax"
        actions={
          <div className="d-flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/etax-settings')}>
              เปิดการตั้งค่า
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void refreshAll()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
          </div>
        }
      />

      <div className="row g-3 mb-3">
        <div className="col-md-6 col-xl-3">
          <Card className="qf-report-card qf-report-card--blue h-100">
            <div className="small text-muted mb-1">จำนวนงานในคิว</div>
            <div className="h4 fw-semibold mb-1">{usage?.queueDepth ?? '—'}</div>
            <div className="small text-muted">รวมรายการที่เข้าคิว ส่งแล้ว และกำลังประมวลผล</div>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card className="qf-report-card qf-report-card--green h-100">
            <div className="small text-muted mb-1">อัตราสำเร็จ</div>
            <div className="h4 fw-semibold mb-1">{usage ? `${usage.successRate.toFixed(1)}%` : '—'}</div>
            <div className="small text-muted">เทียบจากงานที่สำเร็จ งานกำลังวิ่ง และงานผิดพลาด</div>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card className="qf-report-card qf-report-card--amber h-100">
            <div className="small text-muted mb-1">เวลาเฉลี่ยในการส่ง</div>
            <div className="h4 fw-semibold mb-1">{usage ? `${Math.round(usage.averageSubmitMs)} ms` : '—'}</div>
            <div className="small text-muted">เวลาเฉลี่ยของขั้นตอน sign endpoint</div>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card className="qf-report-card qf-report-card--purple h-100">
            <div className="small text-muted mb-1">รายการบันทึก API</div>
            <div className="h4 fw-semibold mb-1">{usage?.apiLogCount ?? '—'}</div>
            <div className="small text-muted">ประวัติการทำงานจาก backend</div>
          </Card>
        </div>
                <div className="col-md-6 col-xl-3">
                  <Card className="qf-report-card qf-report-card--amber h-100">
                    <div className="small text-muted mb-1">ที่อยู่ผู้ขาย</div>
                    <div className="h4 fw-semibold mb-1">
                      {summaryState?.configMissing ? 'ยังไม่ตั้งค่า' : summary?.sellerAddressReviewNeeded ? 'ต้องตรวจสอบ' : 'พร้อมใช้งาน'}
                    </div>
                    <div className="small text-muted">
                      {summaryState?.configMissing
                        ? 'ยังไม่มี active ETax configuration ให้เริ่มงานจากหน้า invoice ก่อนแล้วเปิด Settings เพื่อตรวจสอบการตั้งค่า'
                        : summary?.sellerAddressMissingFields?.length
                        ? summary.sellerAddressMissingFields.map(formatFieldLabel).join(', ')
                        : 'ตรวจสอบจาก backend แล้ว และพร้อมใช้ส่งในโหมดปัจจุบัน'}
                    </div>
                    {!summaryState?.configMissing ? (
                      <div className="small text-muted mt-2">
                        รูปแบบที่ใช้งานจริง:{' '}
                        <span className="font-monospace">
                          {formatRuntimeLabel(summary?.effectiveRuntime?.submissionMode, summary?.effectiveRuntime?.csvPayloadStyle)}
                        </span>
                      </div>
                    ) : null}
                  </Card>
                </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <Card
            header={
              <div className="d-flex flex-column gap-3">
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <div className="fw-semibold">รายการเอกสาร e-Tax ล่าสุด</div>
                    <div className="small text-muted">
                      {summaryState?.configMissing
                        ? 'ยังไม่มี config จึงยังเริ่มสร้าง e-Tax document ไม่ได้'
                        : 'เลือกรายการเพื่อเปิดดูรายละเอียด เปิดเอกสารต้นทาง หรือจัดการหลายรายการ'}
                    </div>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate('/accounting/etax-settings')}
                    >
                      การตั้งค่า
                    </Button>
                    <Button size="sm" onClick={() => void refreshAll()}>
                      รีเฟรช
                    </Button>
                  </div>
                </div>
                <div className="d-flex flex-column flex-md-row gap-2 align-items-md-center justify-content-between">
                  <Tabs
                    value={stateFilter}
                    onChange={(value) => setStateFilter(value as FilterState)}
                    items={[
                      { key: 'all', label: 'ทั้งหมด', count: summary?.usage.totalDocuments ?? 0 },
                      { key: 'draft', label: 'ร่าง' },
                      { key: 'queued', label: 'เข้าคิว' },
                      { key: 'submitted', label: 'ส่งแล้ว' },
                      { key: 'processing', label: 'กำลังประมวลผล' },
                      { key: 'done', label: 'สำเร็จ' },
                      { key: 'error', label: 'ผิดพลาด' },
                    ]}
                  />
                  <div style={{ minWidth: 240 }}>
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="ค้นหาเลขที่ / ลูกค้า"
                      leftAdornment={<i className="bi bi-search" />}
                    />
                  </div>
                </div>
                {rows.length > 0 ? (
                  <div className="d-flex flex-column gap-2 rounded-3 border bg-light p-3">
                    <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                      <div>
                        <div className="fw-semibold">จัดการจากรายการ</div>
                        <div className="small text-muted">
                          เลือกเอกสารจากตารางเพื่อสั่งงานหลายรายการ โดยไม่เปลี่ยน flow เดิมของแต่ละเอกสาร
                        </div>
                      </div>
                      <Badge tone={selectedRowIds.length > 0 ? 'blue' : 'gray'}>
                        เลือกแล้ว {selectedRowIds.length} รายการ
                      </Badge>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void runBulkAction('submit')}
                        disabled={eligibleRowsByAction.submit.length === 0}
                        isLoading={bulkActionKey === 'submit'}
                      >
                        ส่ง e-Tax{eligibleRowsByAction.submit.length > 0 ? ` (${eligibleRowsByAction.submit.length})` : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void runBulkAction('poll')}
                        disabled={eligibleRowsByAction.poll.length === 0}
                        isLoading={bulkActionKey === 'poll'}
                      >
                        อัปเดตสถานะ{eligibleRowsByAction.poll.length > 0 ? ` (${eligibleRowsByAction.poll.length})` : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void runBulkAction('retry')}
                        disabled={eligibleRowsByAction.retry.length === 0}
                        isLoading={bulkActionKey === 'retry'}
                      >
                        ลองใหม่{eligibleRowsByAction.retry.length > 0 ? ` (${eligibleRowsByAction.retry.length})` : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void runBulkAction('send-email')}
                        disabled={eligibleRowsByAction['send-email'].length === 0}
                        isLoading={bulkActionKey === 'send-email'}
                      >
                        ส่งอีเมล{eligibleRowsByAction['send-email'].length > 0 ? ` (${eligibleRowsByAction['send-email'].length})` : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void runBulkAction('cancel')}
                        disabled={eligibleRowsByAction.cancel.length === 0}
                        isLoading={bulkActionKey === 'cancel'}
                      >
                        ยกเลิก{eligibleRowsByAction.cancel.length > 0 ? ` (${eligibleRowsByAction.cancel.length})` : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedRowIds([])}
                        disabled={selectedRowIds.length === 0 || bulkActionKey !== null}
                      >
                        ล้างการเลือก
                      </Button>
                    </div>
                    {selectedRowIds.length > 0 ? (
                      <div className="small text-muted">
                        แถวสีฟ้าอ่อนคือรายการที่เลือก และแถวสีน้ำเงินเข้มคือรายการที่กำลังเปิดดูรายละเอียด
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            }
          >
            <DataTable
              plain
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              rowClassName={(row) =>
                row.id === selectedDocumentId
                  ? 'table-primary'
                  : selectedRowIds.includes(row.id)
                    ? 'table-info'
                    : undefined
              }
              empty={
                <div className="py-4 text-center">
                  <div className="fw-semibold">
                    {summaryState?.configMissing ? 'ยังไม่มี e-Tax configuration' : 'ไม่พบเอกสาร e-Tax'}
                  </div>
                  <div className="small text-muted">
                    {summaryState?.configMissing
                      ? 'ยังไม่มี config ให้เริ่มจากหน้าใบแจ้งหนี้หรือใบเสร็จ แล้วเปิด Settings เพื่อผูก active e-Tax configuration ก่อน'
                      : search
                        ? 'ลองล้างคำค้นหา'
                        : 'ยังไม่มีเอกสาร e-Tax ใน workspace ให้เริ่มจากหน้าใบแจ้งหนี้ ใบเสร็จ หรือใบเพิ่ม/ลดหนี้ แล้วกดส่ง e-Tax จากเอกสารต้นทาง'}
                  </div>
                  <div className="d-flex justify-content-center gap-2 mt-3 flex-wrap">
                    <Button size="sm" variant="secondary" onClick={() => navigate('/sales/invoices')}>
                      ไปหน้าใบแจ้งหนี้
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => navigate('/notes?domain=sales')}>
                      ไปหน้าใบเพิ่ม/ลดหนี้
                    </Button>
                    <Button size="sm" onClick={() => navigate('/accounting/etax-settings')}>
                      เปิด Settings
                    </Button>
                  </div>
                </div>
              }
            />
          </Card>
        </div>

        <div className="col-12 col-xl-5">
          <Card
            header={
              <div className="d-flex align-items-center justify-content-between gap-2">
                <div>
                  <div className="fw-semibold">รายละเอียดเอกสาร</div>
                  <div className="small text-muted">ดูสถานะและสั่งงานต่อจากรายการที่เลือก</div>
                </div>
                {currentDoc ? <Badge tone={stateTone(currentDoc.state)}>{stateLabel(currentDoc.state)}</Badge> : null}
              </div>
            }
          >
            {!currentDoc ? (
              <div className="py-4 text-center text-muted">
                {summaryState?.configMissing
                  ? 'ยังไม่มี config ให้เริ่มจาก Settings ก่อน แล้วค่อยกลับไป Submit e-Tax จากหน้าเอกสารต้นทาง'
                  : 'เลือกเอกสารจากตารางด้านซ้าย หรือเริ่มจากหน้าใบแจ้งหนี้แล้วกด Submit e-Tax'}
              </div>
            ) : detailQuery.isLoading ? (
              <div className="py-4 text-center text-muted">กำลังโหลดรายละเอียด...</div>
            ) : (
              <div className="d-flex flex-column gap-3">
                <div>
                  <div className="small text-muted">{currentDoc.documentTypeLabel || 'เอกสาร'}</div>
                  <div className="fw-semibold font-monospace">{currentDoc.invoiceNumber || currentDoc.moveName || currentDoc.name}</div>
                  <div className="small text-muted">{currentDoc.partnerName || '—'}</div>
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const route = getSourceDocumentRoute(currentDoc)
                        if (!route) {
                          toast.info('ยังไม่มีเอกสารต้นทางให้เปิด')
                          return
                        }
                        navigate(route)
                      }}
                    >
                      เปิดเอกสารต้นทาง
                    </Button>
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    <div className="rounded-3 border bg-light p-3">
                      <div className="small text-muted">มูลค่ารวม</div>
                      <div className="fw-semibold">{formatMoney(currentDoc.amountTotal, currentDoc.currency || 'THB')}</div>
                    </div>
                  </div>
                  <div className="col-6">
                  <div className="rounded-3 border bg-light p-3">
                      <div className="small text-muted">INET</div>
                    <div className="fw-semibold">{currentDoc.inetStatus || '—'}</div>
                  </div>
                </div>
                  <div className="col-6">
                    <div className="rounded-3 border bg-light p-3">
                      <div className="small text-muted">จำนวนครั้งที่ส่ง</div>
                      <div className="fw-semibold">{currentDoc.submitCount ?? 0}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="rounded-3 border bg-light p-3">
                      <div className="small text-muted">จำนวนครั้งที่เช็กสถานะ</div>
                      <div className="fw-semibold">{currentDoc.pollCount ?? 0}</div>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  {canSubmitCurrentDoc ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!currentDoc) return
                        submitMutation.mutate(currentDoc.id)
                      }}
                      isLoading={submitMutation.isPending && submitMutation.variables === currentDoc.id}
                      disabled={!canSubmitCurrentDoc}
                    >
                      ส่ง e-Tax
                    </Button>
                  ) : null}
                  {canPollCurrentDoc ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (!currentDoc) return
                        pollMutation.mutate(currentDoc.id)
                      }}
                      isLoading={pollMutation.isPending && pollMutation.variables === currentDoc.id}
                      disabled={!canPollCurrentDoc}
                    >
                      อัปเดตสถานะ
                    </Button>
                  ) : null}
                  {currentAvailableActions.includes('retry') ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => retryMutation.mutate(currentDoc.id)}
                      isLoading={retryMutation.isPending && retryMutation.variables === currentDoc.id}
                      disabled={!currentAvailableActions.includes('retry')}
                    >
                      ลองใหม่
                    </Button>
                  ) : null}
                  {currentDoc.canSendEmail ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => sendEmailMutation.mutate(currentDoc.id)}
                      isLoading={sendEmailMutation.isPending && sendEmailMutation.variables === currentDoc.id}
                      disabled={!currentDoc.canSendEmail}
                    >
                      ส่งอีเมลเอกสาร
                    </Button>
                  ) : null}
                  {currentDoc.canResendEmail ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => resendEmailMutation.mutate(currentDoc.id)}
                      isLoading={resendEmailMutation.isPending && resendEmailMutation.variables === currentDoc.id}
                      disabled={!currentDoc.canResendEmail}
                    >
                      ส่งอีเมลอีกครั้ง
                    </Button>
                  ) : null}
                  {currentAvailableActions.includes('cancel') ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelMutation.mutate(currentDoc.id)}
                      isLoading={cancelMutation.isPending && cancelMutation.variables === currentDoc.id}
                      disabled={!currentAvailableActions.includes('cancel')}
                    >
                      ยกเลิก
                    </Button>
                  ) : null}
                </div>

                <div className="rounded-3 border bg-light p-3">
                  <div className="small fw-semibold mb-2">สถานะปัจจุบัน</div>
                  <div className="small text-muted">
                    {currentStatusMessage}
                  </div>
                  <div className={`small mt-2 ${currentDoc.addressReviewNeeded ? 'text-danger' : 'text-success'}`}>
                    {currentDoc.addressReviewNeeded
                      ? `ต้องตรวจสอบข้อมูลที่อยู่: ${currentDoc.addressMissingFields?.map(formatFieldLabel).join(', ') || 'ไม่ทราบจุดที่ขาด'}`
                      : 'ข้อมูลที่อยู่พร้อมสำหรับส่งเข้า INET'}
                  </div>
                  <div className="small text-muted mt-2">
                    เลข Transaction: <span className="font-monospace">{currentDoc.transactionCode || '—'}</span>
                  </div>
                  <div className="small text-muted">
                    XML: {currentDoc.xmlUrl ? 'พร้อม' : 'ยังไม่มี'} · PDF: {currentDoc.pdfUrl ? 'พร้อม' : 'ยังไม่มี'}
                  </div>
                  <div className="small text-muted mt-2">
                    รูปแบบที่ใช้งานจริง:{' '}
                    <span className="font-monospace">
                      {formatRuntimeLabel(currentDoc.effectiveRuntime?.submissionMode, currentDoc.effectiveRuntime?.csvPayloadStyle)}
                    </span>
                  </div>
                  {currentDoc.runtimeOverrideActive ? (
                    <div className="small text-muted">
                      ค่าที่บันทึกไว้:{' '}
                      <span className="font-monospace">
                        {formatRuntimeLabel(currentDoc.storedConfig?.submissionMode, currentDoc.storedConfig?.csvPayloadStyle)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-3 border bg-white p-3">
                  <div className="small fw-semibold mb-2">การส่งอีเมล</div>
                  <div className="d-flex flex-column gap-1">
                    <div className="small text-muted">
                      เปิดใช้งาน: {currentDoc.emailDeliveryEnabled ? <Badge tone="green">ใช่</Badge> : <Badge tone="gray">ไม่ใช่</Badge>}
                    </div>
                    <div className="small text-muted">
                      สถานะ: <Badge tone={emailTone(currentDoc.emailState)}>
                        {emailLabel(currentDoc.emailState)}
                      </Badge>
                    </div>
                    <div className="small text-muted">
                      ผู้รับ: <span className="font-monospace">{currentDoc.emailRecipient || '—'}</span>
                    </div>
                    <div className="small text-muted">
                      ส่งล่าสุดเมื่อ: {currentDoc.emailSentAt ? new Date(currentDoc.emailSentAt).toLocaleString('th-TH') : '—'}
                    </div>
                    <div className="small text-muted">
                      จำนวนครั้งที่ลองส่ง: <span className="font-monospace">{currentDoc.emailRetryCount ?? 0}</span>
                    </div>
                    <div className="small text-danger">
                      {currentDoc.emailLastError || ''}
                    </div>
                  </div>
                </div>

                <div className="rounded-3 border bg-white p-3">
                  <div className="small fw-semibold mb-2">บันทึกล่าสุด</div>
                  {detailQuery.data?.logs?.length ? (
                    <div className="d-flex flex-column gap-2">
                      {detailQuery.data.logs.slice(0, 5).map((log) => (
                        <div key={log.id} className="rounded-3 bg-light p-2">
                          <div className="d-flex justify-content-between gap-2">
                            <span className="small fw-semibold text-capitalize">{log.endpoint}</span>
                            <Badge tone={inetTone(log.requestStatus)}>{log.requestStatus || '—'}</Badge>
                          </div>
                          <div className="small text-muted">
                            {log.errorMessage || 'สำเร็จ'} · {log.httpStatus || 0} · {log.durationMs || 0} ms
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="small text-muted">ยังไม่มี log</div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
