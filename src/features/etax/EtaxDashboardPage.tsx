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

export function EtaxDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [stateFilter, setStateFilter] = useState<FilterState>('all')
  const [search, setSearch] = useState('')
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)
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

  const summary = summaryQuery.data?.config
  const usage = summary?.usage

  const rows = useMemo(
    () =>
      (listQuery.data?.items ?? []).map((doc) => ({
        id: doc.id,
        invoiceNumber: doc.invoiceNumber || doc.moveName || doc.name,
        partnerName: doc.partnerName || '—',
        state: doc.state,
        inetStatus: doc.inetStatus,
        amountTotal: doc.amountTotal ?? 0,
        currency: doc.currency || 'THB',
        updatedAt: doc.lastPollDate || doc.lastSubmitDate || '',
      })),
    [listQuery.data?.items],
  )

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'invoiceNumber',
      header: 'เอกสาร',
      cell: (row) => (
        <button
          type="button"
          className="btn btn-link p-0 fw-semibold text-decoration-none text-start font-monospace"
          onClick={() => setSelectedDocumentId(row.id)}
        >
          {row.invoiceNumber}
        </button>
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
  const canSubmitCurrentDoc = Boolean(
    currentDoc &&
      ['draft', 'queued', 'error'].includes(currentDoc.state) &&
      !currentDoc.addressReviewNeeded &&
      summary?.credentialsConfigured,
  )
  const canPollCurrentDoc = Boolean(
    currentDoc &&
      currentDoc.transactionCode &&
      ['submitted', 'processing', 'queued'].includes(currentDoc.state),
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
        title="e-Tax Operations"
        subtitle="ติดตามคิว e-Tax, ดูสถานะ INET, และสั่ง submit / poll / retry ได้จากที่เดียว"
        breadcrumb="Accounting · e-Tax"
        actions={
          <div className="d-flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/etax-settings')}>
              เปิด Settings
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
            <div className="small text-muted mb-1">Queue Depth</div>
            <div className="h4 fw-semibold mb-1">{usage?.queueDepth ?? '—'}</div>
            <div className="small text-muted">Queued + Submitted + Processing</div>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card className="qf-report-card qf-report-card--green h-100">
            <div className="small text-muted mb-1">Success Rate</div>
            <div className="h4 fw-semibold mb-1">{usage ? `${usage.successRate.toFixed(1)}%` : '—'}</div>
            <div className="small text-muted">Done / in-flight + done + error</div>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card className="qf-report-card qf-report-card--amber h-100">
            <div className="small text-muted mb-1">Avg Submit Latency</div>
            <div className="h4 fw-semibold mb-1">{usage ? `${Math.round(usage.averageSubmitMs)} ms` : '—'}</div>
            <div className="small text-muted">sign endpoint</div>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card className="qf-report-card qf-report-card--purple h-100">
            <div className="small text-muted mb-1">API Logs</div>
            <div className="h4 fw-semibold mb-1">{usage?.apiLogCount ?? '—'}</div>
            <div className="small text-muted">Backend audit trail</div>
          </Card>
        </div>
                <div className="col-md-6 col-xl-3">
                  <Card className="qf-report-card qf-report-card--amber h-100">
                    <div className="small text-muted mb-1">Seller Address</div>
                    <div className="h4 fw-semibold mb-1">{summary?.sellerAddressReviewNeeded ? 'Needs review' : 'Ready'}</div>
                    <div className="small text-muted">
                      {summary?.sellerAddressMissingFields?.length
                        ? summary.sellerAddressMissingFields.map(formatFieldLabel).join(', ')
                        : 'Backend-validated, but not a submit blocker in provider mode'}
                    </div>
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
                    <div className="fw-semibold">Recent ETax Documents</div>
                    <div className="small text-muted">เอกสารล่าสุดที่พร้อมดำเนินการต่อ</div>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate('/accounting/etax-settings')}
                    >
                      Settings
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
                      { key: 'queued', label: 'Queue' },
                      { key: 'submitted', label: 'Submitted' },
                      { key: 'processing', label: 'Processing' },
                      { key: 'done', label: 'Done' },
                      { key: 'error', label: 'Error' },
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
              </div>
            }
          >
            <DataTable
              plain
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              empty={
                <div className="py-4 text-center">
                  <div className="fw-semibold">ไม่พบเอกสาร e-Tax</div>
                  <div className="small text-muted">
                    {search ? 'ลองล้างคำค้นหา' : 'รอเอกสารจาก Odoo backend'}
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
                  <div className="fw-semibold">Document Detail</div>
                  <div className="small text-muted">รายละเอียดและคำสั่งด่วน</div>
                </div>
                {currentDoc ? <Badge tone={stateTone(currentDoc.state)}>{stateLabel(currentDoc.state)}</Badge> : null}
              </div>
            }
          >
            {!currentDoc ? (
              <div className="py-4 text-center text-muted">เลือกเอกสารจากตารางด้านซ้าย</div>
            ) : detailQuery.isLoading ? (
              <div className="py-4 text-center text-muted">กำลังโหลดรายละเอียด...</div>
            ) : (
              <div className="d-flex flex-column gap-3">
                <div>
                  <div className="small text-muted">Invoice</div>
                  <div className="fw-semibold font-monospace">{currentDoc.invoiceNumber || currentDoc.moveName || currentDoc.name}</div>
                  <div className="small text-muted">{currentDoc.partnerName || '—'}</div>
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    <div className="rounded-3 border bg-light p-3">
                      <div className="small text-muted">Amount</div>
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
                      <div className="small text-muted">Submit Attempts</div>
                      <div className="fw-semibold">{currentDoc.submitCount ?? 0}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="rounded-3 border bg-light p-3">
                      <div className="small text-muted">Poll Attempts</div>
                      <div className="fw-semibold">{currentDoc.pollCount ?? 0}</div>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!currentDoc) return
                      if (!canSubmitCurrentDoc) {
                        toast.info('Submit ใช้ไม่ได้กับสถานะนี้', `สถานะปัจจุบัน: ${stateLabel(currentDoc.state)}`)
                        return
                      }
                      submitMutation.mutate(currentDoc.id)
                    }}
                    isLoading={submitMutation.isPending && submitMutation.variables === currentDoc.id}
                    disabled={!canSubmitCurrentDoc}
                  >
                    Submit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (!currentDoc) return
                      if (!canPollCurrentDoc) {
                        toast.info('Poll ใช้ไม่ได้กับสถานะนี้', `สถานะปัจจุบัน: ${stateLabel(currentDoc.state)}`)
                        return
                      }
                      pollMutation.mutate(currentDoc.id)
                    }}
                    isLoading={pollMutation.isPending && pollMutation.variables === currentDoc.id}
                    disabled={!canPollCurrentDoc}
                  >
                    Poll
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => retryMutation.mutate(currentDoc.id)}
                    isLoading={retryMutation.isPending && retryMutation.variables === currentDoc.id}
                    disabled={currentDoc.state !== 'error'}
                  >
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => sendEmailMutation.mutate(currentDoc.id)}
                    isLoading={sendEmailMutation.isPending && sendEmailMutation.variables === currentDoc.id}
                    disabled={!currentDoc.canSendEmail}
                  >
                    Send Email
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => resendEmailMutation.mutate(currentDoc.id)}
                    isLoading={resendEmailMutation.isPending && resendEmailMutation.variables === currentDoc.id}
                    disabled={!currentDoc.canResendEmail}
                  >
                    Resend Email
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelMutation.mutate(currentDoc.id)}
                    isLoading={cancelMutation.isPending && cancelMutation.variables === currentDoc.id}
                    disabled={currentDoc.state === 'done' || currentDoc.state === 'cancelled'}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="rounded-3 border bg-light p-3">
                  <div className="small fw-semibold mb-2">Current Status</div>
                  <div className="small text-muted">
                    {currentStatusMessage}
                  </div>
                  <div className={`small mt-2 ${currentDoc.addressReviewNeeded ? 'text-danger' : 'text-success'}`}>
                    {currentDoc.addressReviewNeeded
                      ? `Address review required: ${currentDoc.addressMissingFields?.map(formatFieldLabel).join(', ') || 'unknown'}`
                      : 'Address ready for buyer / ship-to INET submission'}
                  </div>
                  <div className="small text-muted mt-2">
                    Transaction: <span className="font-monospace">{currentDoc.transactionCode || '—'}</span>
                  </div>
                  <div className="small text-muted">
                    XML: {currentDoc.xmlUrl ? 'พร้อม' : 'ยังไม่มี'} · PDF: {currentDoc.pdfUrl ? 'พร้อม' : 'ยังไม่มี'}
                  </div>
                </div>

                <div className="rounded-3 border bg-white p-3">
                  <div className="small fw-semibold mb-2">Email Delivery</div>
                  <div className="d-flex flex-column gap-1">
                    <div className="small text-muted">
                      Enabled: {currentDoc.emailDeliveryEnabled ? <Badge tone="green">Yes</Badge> : <Badge tone="gray">No</Badge>}
                    </div>
                    <div className="small text-muted">
                      State: <Badge tone={emailTone(currentDoc.emailState)}>
                        {emailLabel(currentDoc.emailState)}
                      </Badge>
                    </div>
                    <div className="small text-muted">
                      Recipient: <span className="font-monospace">{currentDoc.emailRecipient || '—'}</span>
                    </div>
                    <div className="small text-muted">
                      Sent At: {currentDoc.emailSentAt ? new Date(currentDoc.emailSentAt).toLocaleString('th-TH') : '—'}
                    </div>
                    <div className="small text-muted">
                      Retry Count: <span className="font-monospace">{currentDoc.emailRetryCount ?? 0}</span>
                    </div>
                    <div className="small text-danger">
                      {currentDoc.emailLastError || ''}
                    </div>
                  </div>
                </div>

                <div className="rounded-3 border bg-white p-3">
                  <div className="small fw-semibold mb-2">Recent Logs</div>
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
