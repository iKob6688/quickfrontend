import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Alert } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { ProductCombobox } from '@/features/sales/ProductCombobox'
import { EmployeeUserCombobox } from '@/features/sales/EmployeeUserCombobox'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { listPartners, getPartner } from '@/api/services/partners.service'
import { createInvoice, type InvoiceLine, type InvoicePayload } from '@/api/services/invoices.service'
import { initializeChonlateeBillingInvoice } from '@/api/services/chonlatee-billing.service'
import { toast } from '@/lib/toastStore'
import { useAuthStore } from '@/features/auth/store'
import type { EmployeeUserOption } from '@/api/services/employee-users.service'

type BillingRow = {
  id: string
  label: string
  include: boolean
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
}

const DEFAULT_ROWS: BillingRow[] = [
  { id: 'pnd1', label: 'ภาษีเงินได้ หัก ณ ที่จ่าย (ภ.ง.ด.1)', include: false, productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 0 },
  { id: 'pnd3', label: 'ภาษีเงินได้ หัก ณ ที่จ่าย (ภ.ง.ด.3)', include: false, productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 0 },
  { id: 'pnd53', label: 'ภาษีเงินได้ หัก ณ ที่จ่าย (ภ.ง.ด.53)', include: false, productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 0 },
  { id: 'vat30', label: 'ภาษีมูลค่าเพิ่ม (ภ.พ.30)', include: false, productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 0 },
  { id: 'vat36', label: 'ภาษีมูลค่าเพิ่ม (ภ.พ.36)', include: false, productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 0 },
  { id: 'social_security', label: 'ประกันสังคม', include: false, productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 0 },
  { id: 'accounting_service', label: 'ค่าบริการทำบัญชีประจำเดือน', include: true, productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 7 },
]

function isoToday() {
  return new Date().toISOString().split('T')[0]
}

function buildBillingNotes(input: {
  periodLabel: string
  subject: string
  contactName: string
  contactPhone: string
  contactEmail: string
  preparedByName: string
  reference: string
  remarks: string
}) {
  return [
    '[Chonlatee Billing Input]',
    input.reference ? `Reference: ${input.reference}` : null,
    input.subject ? `Subject: ${input.subject}` : null,
    input.periodLabel ? `Period: ${input.periodLabel}` : null,
    input.preparedByName ? `Prepared by: ${input.preparedByName}` : null,
    input.contactName ? `Contact: ${input.contactName}` : null,
    input.contactPhone ? `Phone: ${input.contactPhone}` : null,
    input.contactEmail ? `Email: ${input.contactEmail}` : null,
    input.remarks ? `Remarks:\n${input.remarks}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function ChonlateeBillingFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [customerSearch, setCustomerSearch] = useState('')
  const [preparedByEmployeeId, setPreparedByEmployeeId] = useState<number | null>(null)
  const [preparedByUserId, setPreparedByUserId] = useState<number | null>(user?.id ?? null)
  const [preparedByName, setPreparedByName] = useState(user?.name || '')
  const [customerId, setCustomerId] = useState<number>(0)
  const [currency, setCurrency] = useState('THB')
  const [invoiceDate, setInvoiceDate] = useState(isoToday())
  const [dueDate, setDueDate] = useState(isoToday())
  const [periodLabel, setPeriodLabel] = useState('')
  const [subject, setSubject] = useState('แจ้งค่าใช้จ่าย')
  const [reference, setReference] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [remarks, setRemarks] = useState('')
  const [rows, setRows] = useState<BillingRow[]>(DEFAULT_ROWS)
  const [contactTouched, setContactTouched] = useState({
    name: false,
    phone: false,
    email: false,
  })

  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 250)
  const customerOptionsQuery = useInfiniteQuery({
    queryKey: ['chonlatee-partner-selector', debouncedCustomerSearch],
    enabled: true,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listPartners({
        q: debouncedCustomerSearch || undefined,
        active: true,
        limit: 20,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, page) => acc + (page?.items?.length ?? 0), 0)
      if (loaded >= (lastPage?.total ?? 0)) return undefined
      if ((lastPage?.items?.length ?? 0) < 20) return undefined
      return loaded
    },
    staleTime: 30_000,
  })

  const customerItems = useMemo(
    () => customerOptionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [customerOptionsQuery.data?.pages],
  )

  const selectedCustomerQuery = useQuery({
    queryKey: ['chonlatee-partner', customerId],
    enabled: customerId > 0,
    queryFn: () => getPartner(customerId),
    staleTime: 30_000,
  })

  useEffect(() => {
    const customer = selectedCustomerQuery.data
    if (!customer) return
    if (!contactTouched.name && !contactName.trim()) {
      setContactName(customer.displayName || customer.name || '')
    }
    if (!contactTouched.phone && !contactPhone.trim()) {
      setContactPhone(customer.phone || customer.mobile || '')
    }
    if (!contactTouched.email && !contactEmail.trim()) {
      setContactEmail(customer.email || '')
    }
  }, [
    contactEmail,
    contactName,
    contactPhone,
    contactTouched.email,
    contactTouched.name,
    contactTouched.phone,
    selectedCustomerQuery.data,
  ])

  const totalAmount = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (!row.include) return sum
        return sum + Number(row.quantity || 0) * Number(row.unitPrice || 0)
      }, 0),
    [rows],
  )

  const invoiceLines = useMemo<InvoiceLine[]>(() => {
    return rows
      .filter((row) => row.include)
      .filter((row) => row.productId || row.description.trim() || row.unitPrice > 0)
      .map((row) => ({
        productId: row.productId,
        description: [row.label, row.description.trim(), periodLabel ? `งวด ${periodLabel}` : null]
          .filter(Boolean)
          .join('\n'),
        quantity: Number(row.quantity || 0),
        unitPrice: Number(row.unitPrice || 0),
        taxRate: Number(row.taxRate || 0),
        subtotal: Number(row.quantity || 0) * Number(row.unitPrice || 0),
      }))
  }, [periodLabel, rows])

  const createMutation = useMutation({
    mutationFn: (payload: InvoicePayload) => createInvoice(payload),
    onSuccess: async (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      try {
        await initializeChonlateeBillingInvoice(invoice.id, {
          preparedByEmployeeId,
          preparedByUserId,
          preparedByName,
          billingPeriod: periodLabel,
          billingSubject: subject,
          reference,
          contactName,
          contactPhone,
          contactEmail,
          remarks,
        })
      } catch (error) {
        toast.error(
          'สร้าง draft invoice สำเร็จ แต่เปิด billing session ไม่สำเร็จ',
          error instanceof Error ? error.message : undefined,
        )
      }
      toast.success('สร้าง Chonlatee billing draft สำเร็จ', invoice.number || `#${invoice.id}`)
      navigate(`/sales/invoices/${invoice.id}`)
    },
    onError: (error) => {
      toast.error('สร้าง Chonlatee billing draft ไม่สำเร็จ', error instanceof Error ? error.message : undefined)
    },
  })

  const canSubmit = customerId > 0 && invoiceLines.length > 0 && Boolean(invoiceDate) && Boolean(dueDate)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    createMutation.mutate({
      customerId,
      invoiceDate,
      dueDate,
      currency,
      lines: invoiceLines,
      notes: buildBillingNotes({
        periodLabel,
        subject,
        contactName,
        contactPhone,
        contactEmail,
        preparedByName,
        reference,
        remarks,
      }),
      reference,
      contact: contactName,
      salesperson: preparedByName,
      project: periodLabel,
      invoiceRefTop: reference,
      employeeId: preparedByEmployeeId,
      employeeName: preparedByName,
      billingPeriod: periodLabel,
      billingSubject: subject,
      billingType: 'chonlatee_billing',
    } as InvoicePayload)
  }

  return (
    <div>
      <PageHeader
        title="Chonlatee Billing Input"
        subtitle="สร้าง draft invoice จริงจากแบบฟอร์มแจ้งค่าใช้จ่ายของ Chonlatee Innovation"
        breadcrumb="รายรับ · ใบแจ้งหนี้ · Chonlatee Billing"
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/sales/invoices')}>
              กลับ
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="row g-4">
          <div className="col-lg-8">
            <Card>
              <h5 className="h6 fw-semibold mb-3">ข้อมูลเอกสาร</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <Label htmlFor="chonlateeCustomer" required>ลูกค้า</Label>
                  <Combobox
                    id="chonlateeCustomer"
                    value={customerSearch}
                    onChange={setCustomerSearch}
                    placeholder="พิมพ์เพื่อค้นหาลูกค้า"
                    minChars={1}
                    isLoading={customerOptionsQuery.isFetching}
                    isLoadingMore={customerOptionsQuery.isFetchingNextPage}
                    onLoadMore={() => customerOptionsQuery.hasNextPage && customerOptionsQuery.fetchNextPage()}
                    options={customerItems.map<ComboboxOption>((item) => ({
                      id: item.id,
                      label: item.name,
                      meta: item.vat ? `Tax ID: ${item.vat}` : item.email || `ID: ${item.id}`,
                    }))}
                    total={customerOptionsQuery.data?.pages[0]?.total}
                    emptyText="ไม่พบลูกค้า"
                    onPick={(opt) => {
                      setCustomerId(Number(opt.id))
                      setCustomerSearch(opt.label)
                    }}
                  />
                  {selectedCustomerQuery.data ? (
                    <div className="small text-muted mt-2">
                      {selectedCustomerQuery.data.displayName}
                    </div>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <Label htmlFor="preparedBy">ผู้จัดทำ / พนักงาน</Label>
                  <EmployeeUserCombobox
                    id="preparedBy"
                    initialLabel={preparedByName}
                    onPick={(item: EmployeeUserOption) => {
                      setPreparedByEmployeeId(item.employeeId ?? null)
                      setPreparedByUserId(item.userId ?? item.id)
                      setPreparedByName(item.name)
                    }}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="invoiceDate" required>วันที่เอกสาร</Label>
                  <Input id="invoiceDate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="dueDate" required>วันครบกำหนด</Label>
                  <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="currency">สกุลเงิน</Label>
                  <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <Label htmlFor="periodLabel">งวด / Period</Label>
                  <Input id="periodLabel" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="เช่น พฤษภาคม 2569" />
                </div>
                <div className="col-md-6">
                  <Label htmlFor="subject">หัวเรื่อง</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <Label htmlFor="reference">เลขอ้างอิง</Label>
                  <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="เช่น ท-0426-6906013" />
                </div>
              </div>
            </Card>

            <Card className="mt-4">
              <h5 className="h6 fw-semibold mb-3">ข้อมูลผู้ติดต่อ</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <Label htmlFor="contactName">Contact</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => {
                      setContactTouched((prev) => ({ ...prev, name: true }))
                      setContactName(e.target.value)
                    }}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="contactPhone">Tel</Label>
                  <Input
                    id="contactPhone"
                    value={contactPhone}
                    onChange={(e) => {
                      setContactTouched((prev) => ({ ...prev, phone: true }))
                      setContactPhone(e.target.value)
                    }}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="contactEmail">E-mail</Label>
                  <Input
                    id="contactEmail"
                    value={contactEmail}
                    onChange={(e) => {
                      setContactTouched((prev) => ({ ...prev, email: true }))
                      setContactEmail(e.target.value)
                    }}
                  />
                </div>
              </div>
            </Card>

            <Card className="mt-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <h5 className="h6 fw-semibold mb-1">Billing Rows</h5>
                  <div className="small text-muted">แต่ละแถวต้อง map ไปยัง product จริง เพื่อสร้าง draft invoice ในระบบบัญชี</div>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 60 }}>ใช้</th>
                      <th style={{ width: 260 }}>หมวดค่าใช้จ่าย</th>
                      <th style={{ width: 220 }}>Product</th>
                      <th>รายละเอียด</th>
                      <th style={{ width: 100 }} className="text-end">Qty</th>
                      <th style={{ width: 140 }} className="text-end">Unit Price</th>
                      <th style={{ width: 100 }} className="text-end">VAT%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, include: e.target.checked } : item,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="fw-semibold">{row.label}</td>
                        <td>
                          <ProductCombobox
                            id={`chonlatee-product-${row.id}`}
                            valueId={row.productId}
                            onPick={(product) =>
                              setRows((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        productId: product.id,
                                        description: item.description.trim() ? item.description : product.name,
                                        taxRate:
                                          Array.isArray(product.taxes) && product.taxes.length
                                            ? Number(product.taxes[0]?.amount || item.taxRate || 0)
                                            : item.taxRate,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            value={row.description}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, description: e.target.value } : item,
                                ),
                              )
                            }
                            placeholder="รายละเอียดเพิ่มเติม"
                          />
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm text-end"
                            type="number"
                            value={row.quantity}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, quantity: Number(e.target.value || 0) } : item,
                                ),
                              )
                            }
                            min={0}
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm text-end"
                            type="number"
                            value={row.unitPrice}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, unitPrice: Number(e.target.value || 0) } : item,
                                ),
                              )
                            }
                            min={0}
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm text-end"
                            type="number"
                            value={row.taxRate}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, taxRate: Number(e.target.value || 0) } : item,
                                ),
                              )
                            }
                            min={0}
                            step="0.01"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="mt-4">
              <h5 className="h6 fw-semibold mb-3">หมายเหตุสำหรับพิมพ์</h5>
              <textarea
                className="form-control"
                rows={5}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="ข้อความหมายเหตุ / เงื่อนไขการชำระ / ข้อมูลบัญชีธนาคาร"
              />
            </Card>
          </div>

          <div className="col-lg-4">
            <Card>
              <h5 className="h6 fw-semibold mb-3">สรุปก่อนสร้าง</h5>
              <div className="small text-muted mb-2">ระบบจะสร้างเป็น draft sales invoice จริง แล้วใช้ flow เดิมต่อไปยัง post, payment, receipt</div>
              <div className="d-flex justify-content-between mb-2">
                <span>จำนวนบรรทัด</span>
                <span className="fw-semibold">{invoiceLines.length}</span>
              </div>
              <div className="d-flex justify-content-between mb-3">
                <span>ยอดรวมก่อนภาษี</span>
                <span className="fw-semibold">
                  {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                </span>
              </div>
              {!canSubmit ? (
                <Alert variant="warning" className="small">
                  เลือกลูกค้าและเพิ่มอย่างน้อย 1 billing row ที่จะสร้างเป็น invoice line
                </Alert>
              ) : null}
              {createMutation.isError ? (
                <Alert variant="danger" className="small">
                  {createMutation.error instanceof Error ? createMutation.error.message : 'เกิดข้อผิดพลาด'}
                </Alert>
              ) : null}
              <div className="d-grid gap-2">
                <Button type="submit" disabled={!canSubmit || createMutation.isPending} isLoading={createMutation.isPending}>
                  สร้าง Draft Invoice
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate('/sales/invoices')}>
                  ยกเลิก
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
