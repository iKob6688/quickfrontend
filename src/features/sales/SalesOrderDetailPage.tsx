import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Dropdown, Form, Modal, Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { confirmSalesOrder, createInvoiceFromSalesOrder, deliverSalesOrder, getSalesOrder, sendSalesOrderEmail } from '@/api/services/sales-orders.service'
import { getPartner, listPartners } from '@/api/services/partners.service'
import { useSettingsStore as useStudioSettingsStore } from '@/app/core/storage/settingsStore'
import { useTemplateStore } from '@/app/core/storage/templateStore'
import { toast } from '@/lib/toastStore'
import { useAppDateFormatter } from '@/lib/dateFormat'

export function SalesOrderDetailPage() {
  const navigate = useNavigate()
  const formatDate = useAppDateFormatter()
  const params = useParams()
  const id = useMemo(() => Number(params.id), [params.id])
  const queryClient = useQueryClient()
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailSearch, setEmailSearch] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [printMenuOpen, setPrintMenuOpen] = useState(false)
  const studioSettings = useStudioSettingsStore((s) => s.settings)
  const templates = useTemplateStore((s) => s.templates)

  const query = useQuery({
    queryKey: ['salesOrder', id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: () => getSalesOrder(id),
    staleTime: 30_000,
  })

  const partnerDetailQuery = useQuery({
    queryKey: ['partner', query.data?.partnerId],
    enabled: !!query.data?.partnerId,
    queryFn: () => getPartner(query.data!.partnerId),
    staleTime: 60_000,
  })

  const contactsQuery = useQuery({
    queryKey: ['partners', 'email-picker', query.data?.partnerId, emailSearch],
    enabled: emailModalOpen,
    queryFn: async () => {
      const q = emailSearch.trim() || query.data?.partnerName || ''
      const res = await listPartners({ q, active: true, limit: 20 })
      return (res.items || []).filter((row) => !!row.email)
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!query.data) return
    const docLabel = query.data.orderType === 'sale' ? 'Sale Order' : 'ใบเสนอราคา'
    setEmailSubject(`${docLabel} ${query.data.number || `#${query.data.id}`}`)
    setEmailMessage(
      `เรียนลูกค้า\n\nแนบเอกสาร ${docLabel} เลขที่ ${query.data.number || query.data.id}.\n\nขอบคุณครับ`,
    )
  }, [query.data])

  useEffect(() => {
    const partner = partnerDetailQuery.data
    if (!partner) return
    if (partner.email && !emailTo) {
      setEmailTo(partner.email)
      setSelectedContactId(partner.id)
    }
  }, [partnerDetailQuery.data, emailTo])

  useEffect(() => {
    if (!printMenuOpen) return
    try {
      void (useStudioSettingsStore as any).persist?.rehydrate?.()
    } catch {
      // ignore
    }
  }, [printMenuOpen])

  const defaultQuotationTemplateId =
    studioSettings.defaultTemplateIdByDocType?.quotation || 'quotation_default_v1'

  const quotationTemplates = useMemo(
    () =>
      (templates || [])
        .filter((tpl) => tpl.docType === 'quotation')
        .sort((a, b) => {
          if (a.id === defaultQuotationTemplateId) return -1
          if (b.id === defaultQuotationTemplateId) return 1
          return a.name.localeCompare(b.name, 'th')
        }),
    [templates, defaultQuotationTemplateId],
  )

  const sendEmailMutation = useMutation({
    mutationFn: async () =>
      sendSalesOrderEmail(id, {
        emailTo,
        contactId: selectedContactId || undefined,
        subject: emailSubject,
        message: emailMessage,
      }),
    onSuccess: () => {
      toast.success('ส่งอีเมลสำเร็จ', `ส่งไปยัง ${emailTo}`)
      setEmailModalOpen(false)
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'ไม่สามารถส่งผ่าน backend ได้'
      const mailto = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailMessage)}`
      window.open(mailto, '_self')
      toast.info('เปิดโปรแกรมอีเมลแทน', `Backend ส่งอีเมลไม่สำเร็จ: ${message}`)
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmSalesOrder(id),
    onSuccess: async (so) => {
      await queryClient.invalidateQueries({ queryKey: ['salesOrder', id] })
      await queryClient.invalidateQueries({ queryKey: ['salesOrders'] })
      toast.success('ยืนยันเอกสารสำเร็จ', so.orderType === 'sale' ? 'แปลงเป็น Sale Order แล้ว' : undefined)
    },
    onError: (err) => {
      toast.error('ยืนยันเอกสารไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const createInvoiceMutation = useMutation({
    mutationFn: () => createInvoiceFromSalesOrder(id),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['salesOrder', id] })
      await queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(
        res.created ? 'สร้างใบแจ้งหนี้สำเร็จ' : 'พบใบแจ้งหนี้เดิมแล้ว',
        res.invoiceNumber || (res.invoiceId ? `#${res.invoiceId}` : undefined),
      )
      if (res.invoiceId) navigate(`/sales/invoices/${res.invoiceId}`)
    },
    onError: (err) => {
      toast.error('สร้างใบแจ้งหนี้ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const deliverMutation = useMutation({
    mutationFn: () => deliverSalesOrder(id),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['salesOrder', id] })
      await queryClient.invalidateQueries({ queryKey: ['salesOrders'] })
      toast.success(res.delivered ? 'จัดส่งสินค้า/บริการสำเร็จ' : 'ไม่มีรายการจัดส่งค้าง', res.message)
    },
    onError: (err) => {
      toast.error('จัดส่งไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  if (!Number.isFinite(id) || id <= 0) {
    return <Alert variant="danger" className="small mb-0">URL ไม่ถูกต้อง</Alert>
  }

  const rowData = (query.data?.lines || []).map((line, idx) => ({
    id: idx,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: line.total,
  }))

  const columns: Column<(typeof rowData)[number]>[] = [
    { key: 'description', header: 'รายละเอียด', cell: (r) => <span>{r.description || '—'}</span> },
    { key: 'quantity', header: 'จำนวน', className: 'text-end', cell: (r) => <span>{r.quantity.toLocaleString('th-TH')}</span> },
    {
      key: 'unitPrice',
      header: 'ราคาต่อหน่วย',
      className: 'text-end',
      cell: (r) => <span className="font-monospace">{r.unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      key: 'total',
      header: 'ยอดรวม',
      className: 'text-end',
      cell: (r) => <span className="font-monospace fw-semibold">{r.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="รายละเอียดใบเสนอราคา / Sale Order"
        subtitle={query.data?.number || (query.data ? `เอกสาร #${query.data.id}` : 'กำลังโหลดข้อมูล...')}
        breadcrumb="รายรับ · ใบเสนอราคา · รายละเอียด"
        actions={
          <div className="d-flex gap-2">
            <Dropdown show={printMenuOpen} onToggle={(next) => setPrintMenuOpen(Boolean(next))}>
              <Dropdown.Toggle as={Button} size="sm" variant="ghost" disabled={!query.data}>
                พิมพ์
              </Dropdown.Toggle>
              <Dropdown.Menu align="end">
                <Dropdown.Header>Default company paper format</Dropdown.Header>
                <Dropdown.Item onClick={() => navigate(`/sales/orders/${id}/print-preview`)}>
                  เปิด Preview มาตรฐาน
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Header>Reports Studio templates</Dropdown.Header>
                {quotationTemplates.length ? (
                  quotationTemplates.map((tpl) => (
                    <Dropdown.Item
                      key={tpl.id}
                      onClick={() =>
                        navigate(
                          `/reports-studio/preview/${tpl.id}?recordId=${encodeURIComponent(String(id))}`,
                        )
                      }
                    >
                      {tpl.name}
                      {tpl.id === defaultQuotationTemplateId ? ' (Default)' : ''}
                    </Dropdown.Item>
                  ))
                ) : (
                  <Dropdown.Item disabled>ไม่พบ template สำหรับ quotation</Dropdown.Item>
                )}
              </Dropdown.Menu>
            </Dropdown>
            {query.data?.orderType === 'quotation' && ['draft', 'sent'].includes(query.data.status) ? (
              <Button
                size="sm"
                onClick={() => confirmMutation.mutate()}
                isLoading={confirmMutation.isPending}
                disabled={!query.data}
              >
                Confirm → Sale Order
              </Button>
            ) : null}
            {query.data?.orderType === 'sale' && ['sale', 'done'].includes(query.data.status) ? (
              <Button
                size="sm"
                onClick={() => createInvoiceMutation.mutate()}
                isLoading={createInvoiceMutation.isPending}
                disabled={!query.data}
              >
                Confirm → Invoice
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" disabled={!query.data} onClick={() => setEmailModalOpen(true)}>
              Send → Email
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('/sales/orders')}>
              กลับไปรายการ
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/sales/orders/${id}/edit`)} disabled={!query.data}>
              แก้ไข
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <div className="d-flex align-items-center gap-2 py-4">
          <Spinner animation="border" size="sm" />
          <span className="small text-muted">กำลังโหลด...</span>
        </div>
      ) : query.isError ? (
        <Alert variant="danger" className="small">
          {query.error instanceof Error ? query.error.message : 'โหลดข้อมูลไม่สำเร็จ'}
        </Alert>
      ) : !query.data ? null : (
        <div className="row g-4">
          <div className="col-lg-8">
            {(() => {
              const deliveries = query.data.deliveries || []
              const invoices = query.data.invoices || []
              const hasDelivery = deliveries.length > 0
              const allDelivered = hasDelivery && deliveries.every((d) => d.state === 'done')
              const hasInvoice = invoices.length > 0
              return (
            <Card className="p-3 mb-3">
              <div className="small text-muted mb-2">สถานะกระบวนการเอกสาร</div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <Badge tone="green">Quotation</Badge>
                <span className="text-muted small">→</span>
                <Badge tone={query.data.orderType === 'sale' ? 'green' : 'gray'}>Sale Order</Badge>
                <span className="text-muted small">→</span>
                <Badge tone={allDelivered ? 'green' : hasDelivery ? 'amber' : 'gray'}>Deliver Goods</Badge>
                <span className="text-muted small">→</span>
                <Badge tone={hasInvoice ? 'green' : query.data.orderType === 'sale' && (query.data.status === 'sale' || query.data.status === 'done') ? 'blue' : 'gray'}>
                  Invoice
                </Badge>
                <span className="small text-muted"> (payment/receipt ทำต่อในหน้า Invoice)</span>
              </div>
              {deliveries.length > 0 ? (
                <div className="small text-muted mt-2 d-flex flex-wrap align-items-center gap-2">
                  <span>Delivery:</span>
                  {deliveries.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="badge text-bg-light border"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/sales/deliveries/${d.id}`)}
                      title="เปิดเอกสารจัดส่ง"
                    >
                      {d.name || `#${d.id}`} ({d.state || '-'})
                    </button>
                  ))}
                </div>
              ) : null}
              {invoices.length > 0 ? (
                <div className="small text-muted mt-1 d-flex flex-wrap align-items-center gap-2">
                  <span>Invoice:</span>
                  {invoices.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      className="btn btn-link btn-sm p-0 text-decoration-none"
                      onClick={() => navigate(`/sales/invoices/${i.id}`)}
                    >
                      {i.name || `#${i.id}`} ({i.state || '-'})
                    </button>
                  ))}
                </div>
              ) : null}
            </Card>
              )
            })()}
            <Card className="p-4">
              <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                <div>
                  <h2 className="h5 fw-semibold mb-2">{query.data.number || `#${query.data.id}`}</h2>
                  <div className="small text-muted">ลูกค้า: {query.data.partnerName || '—'}</div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Badge tone={query.data.orderType === 'sale' ? 'blue' : 'gray'}>
                    {query.data.orderType === 'sale' ? 'Sale Order' : 'ใบเสนอราคา'}
                  </Badge>
                  <Badge tone={query.data.status === 'cancel' ? 'red' : query.data.status === 'sale' || query.data.status === 'done' ? 'green' : 'gray'}>
                    {query.data.status}
                  </Badge>
                </div>
              </div>

              <DataTable
                plain
                columns={columns}
                rows={rowData}
                rowKey={(row) => row.id}
                empty={<div className="text-center text-muted py-4">ไม่มีรายการ</div>}
              />
            </Card>
          </div>

          <div className="col-lg-4">
            <Card className="p-4">
              <div className="small text-muted mb-1">วันที่เอกสาร</div>
              <div className="fw-semibold mb-3">{formatDate(query.data.orderDate)}</div>

              <div className="small text-muted mb-1">วันหมดอายุ</div>
              <div className="fw-semibold mb-3">{formatDate(query.data.validityDate)}</div>

              <div className="small text-muted mb-1">ยอดรวม</div>
              <div className="h5 fw-bold font-monospace mb-0">
                {query.data.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {query.data.orderType === 'sale' && (query.data.status === 'sale' || query.data.status === 'done') ? (
                <div className="mt-3 d-grid gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => deliverMutation.mutate()}
                    isLoading={deliverMutation.isPending}
                  >
                    Confirm → Deliver Goods
                  </Button>
                  <Button size="sm" onClick={() => createInvoiceMutation.mutate()} isLoading={createInvoiceMutation.isPending}>
                    Confirm → Invoice
                  </Button>
                  {(query.data.invoices?.length || 0) > 0 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/sales/invoices/${query.data.invoices![query.data.invoices!.length - 1]!.id}`)}
                    >
                      เปิดใบแจ้งหนี้ล่าสุด
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      )}

      <Modal show={emailModalOpen} onHide={() => setEmailModalOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>ส่งเอกสารทางอีเมล</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-2 small text-muted">
            เลือก contact ที่มีอีเมล หรือพิมพ์อีเมลปลายทางเอง
          </div>

          <Form.Group className="mb-2">
            <Form.Label>ค้นหา Contact</Form.Label>
            <Form.Control
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              placeholder="ชื่อ / อีเมล"
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>เลือก Contact (มีอีเมล)</Form.Label>
            <Form.Select
              value={selectedContactId || ''}
              onChange={(e) => {
                const contactId = Number(e.target.value || 0)
                const row = (contactsQuery.data || []).find((c) => c.id === contactId)
                setSelectedContactId(contactId || null)
                if (row?.email) setEmailTo(row.email)
              }}
            >
              <option value="">-- ไม่เลือก / กรอกอีเมลเอง --</option>
              {(contactsQuery.data || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>อีเมลปลายทาง</Form.Label>
            <Form.Control
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="customer@example.com"
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>หัวข้ออีเมล</Form.Label>
            <Form.Control value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
          </Form.Group>

          <Form.Group>
            <Form.Label>ข้อความ</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" onClick={() => setEmailModalOpen(false)}>
            ยกเลิก
          </Button>
          <Button
            size="sm"
            onClick={() => void sendEmailMutation.mutateAsync()}
            disabled={!emailTo.trim() || sendEmailMutation.isPending}
          >
            {sendEmailMutation.isPending ? 'กำลังส่ง...' : 'ส่งอีเมล'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
