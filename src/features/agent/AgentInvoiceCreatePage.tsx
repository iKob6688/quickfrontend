import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  agentCreateInvoice,
  fileToBase64,
  type InvoiceCreateResponse,
  type InvoiceLineRequest,
} from '@/api/services/agent.service'
import { toApiError } from '@/api/response'
import { toast } from '@/lib/toastStore'

export function AgentInvoiceCreatePage() {
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerVat, setCustomerVat] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
  )
  const [currency, setCurrency] = useState('THB')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<InvoiceLineRequest[]>([])
  const [result, setResult] = useState<InvoiceCreateResponse | null>(null)

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        customer_data: {
          name: customerName,
          email: customerEmail || undefined,
          phone: customerPhone || undefined,
          vat: customerVat || undefined,
        },
        invoice_date: invoiceDate || undefined,
        due_date: dueDate || undefined,
        currency: currency || 'THB',
        lines: lines.length > 0 ? lines : [],
        notes: notes || undefined,
      }

      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile)
        payload.file = base64
      }

      return await agentCreateInvoice(payload)
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success(
        'สร้างใบแจ้งหนี้สำเร็จ',
        `ใบแจ้งหนี้ #${data.invoice_number || data.invoice_id}`,
      )
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => setPreview(reader.result as string)
        reader.readAsDataURL(file)
      } else {
        setPreview(null)
      }
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => setPreview(reader.result as string)
        reader.readAsDataURL(file)
      } else {
        setPreview(null)
      }
    }
  }

  const addLine = () => {
    setLines([
      ...lines,
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        product_id: null,
      },
    ])
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const updateLine = (
    index: number,
    field: keyof InvoiceLineRequest,
    value: unknown,
  ) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('กรุณากรอกชื่อลูกค้า')
      return
    }
    if (lines.length === 0) {
      toast.error('กรุณาเพิ่มรายการสินค้าหรือบริการอย่างน้อย 1 รายการ')
      return
    }
    if (lines.some((l) => !l.description.trim() || l.quantity <= 0)) {
      toast.error('กรุณากรอกรายละเอียดและจำนวนให้ครบถ้วน')
      return
    }
    invoiceMutation.mutate()
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreview(null)
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setCustomerVat('')
    setInvoiceDate(new Date().toISOString().split('T')[0])
    setDueDate(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    )
    setCurrency('THB')
    setNotes('')
    setLines([])
    setResult(null)
    invoiceMutation.reset()
  }

  return (
    <div>
      <PageHeader
        title="Create Invoice - สร้างใบแจ้งหนี้"
        subtitle="สร้างใบแจ้งหนี้จากเอกสารหรือข้อมูลที่กรอก"
        breadcrumb="Agent · Invoice"
        actions={
          <Button size="sm" variant="ghost" onClick={() => navigate('/agent')}>
            กลับ
          </Button>
        }
      />

      <div className="row">
        <div className="col-lg-6">
          <Card className="p-4 mb-3">
            <h6 className="mb-3">ข้อมูลลูกค้า</h6>

            <div className="mb-3">
              <Label htmlFor="customerName" required>
                ชื่อลูกค้า
              </Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="ชื่อบริษัทหรือชื่อบุคคล"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="customerEmail">อีเมล</Label>
              <Input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="customerPhone">เบอร์โทร</Label>
              <Input
                id="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0123456789"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="customerVat">เลขประจำตัวผู้เสียภาษี</Label>
              <Input
                id="customerVat"
                value={customerVat}
                onChange={(e) => setCustomerVat(e.target.value)}
                placeholder="1234567890123"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="invoiceDate">วันที่ออกใบแจ้งหนี้</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="dueDate">วันครบกำหนดชำระ</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="currency">สกุลเงิน</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="THB"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="notes">หมายเหตุ</Label>
              <textarea
                id="notes"
                className="form-control"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม"
                rows={3}
              />
            </div>

            <div className="mb-3">
              <Label>เอกสารใบแจ้งหนี้ (เลือกได้)</Label>
              <div
                className="border border-dashed rounded p-3 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                style={{ minHeight: '150px', cursor: 'pointer' }}
              >
                {preview ? (
                  <div>
                    <img
                      src={preview}
                      alt="Preview"
                      style={{ maxWidth: '100%', maxHeight: '200px' }}
                      className="mb-2"
                    />
                    <div className="small text-muted">{selectedFile?.name}</div>
                  </div>
                ) : (
                  <div
                    className="d-flex flex-column align-items-center justify-content-center text-muted"
                    style={{ minHeight: '150px' }}
                  >
                    <div className="small">
                      ลากเอกสารมาวาง หรือคลิกเพื่อเลือกไฟล์
                    </div>
                    <div className="small text-muted">
                      รองรับภาพ (JPG, PNG) และ PDF
                    </div>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="form-control mt-2"
              />
            </div>
          </Card>

          <Card className="p-4 mb-3">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="mb-0">รายการสินค้า/บริการ</h6>
              <Button size="sm" variant="secondary" onClick={addLine}>
                + เพิ่มรายการ
              </Button>
            </div>

            {lines.length === 0 ? (
              <div className="text-center text-muted py-4">
                <p className="small mb-2">ยังไม่มีรายการ</p>
                <Button size="sm" variant="secondary" onClick={addLine}>
                  เพิ่มรายการแรก
                </Button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>รายละเอียด</th>
                      <th style={{ width: '100px' }}>จำนวน</th>
                      <th style={{ width: '120px' }}>ราคาต่อหน่วย</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td>
                          <Input
                            value={line.description}
                            onChange={(e) =>
                              updateLine(index, 'description', e.target.value)
                            }
                            placeholder="รายละเอียด"
                            size="sm"
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(
                                index,
                                'quantity',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            size="sm"
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) =>
                              updateLine(
                                index,
                                'unit_price',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            size="sm"
                          />
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeLine(index)}
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="d-flex gap-2">
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={
                !customerName.trim() ||
                lines.length === 0 ||
                invoiceMutation.isPending
              }
              isLoading={invoiceMutation.isPending}
            >
              สร้างใบแจ้งหนี้
            </Button>
            {(selectedFile || customerName || lines.length > 0) && (
              <Button variant="secondary" onClick={handleReset}>
                ล้าง
              </Button>
            )}
          </div>

          {invoiceMutation.isError && (
            <div className="alert alert-danger mt-3 mb-0">
              <div className="fw-semibold mb-1">เกิดข้อผิดพลาด</div>
              <div className="small">
                {toApiError(invoiceMutation.error).message}
              </div>
            </div>
          )}
        </div>

        <div className="col-lg-6">
          <Card className="p-4">
            <h6 className="mb-3">ผลลัพธ์</h6>

            {invoiceMutation.isPending && (
              <div className="text-center text-muted py-4">
                กำลังสร้างใบแจ้งหนี้...
              </div>
            )}

            {result && (
              <div>
                <div className="alert alert-success">
                  <div className="fw-semibold mb-2">สร้างใบแจ้งหนี้สำเร็จ</div>
                  <div className="small">
                    <div>เลขที่: {result.invoice_number || result.invoice_id}</div>
                    <div>ลูกค้า ID: {result.customer_id}</div>
                    {result.customer_name && (
                      <div>ลูกค้า: {result.customer_name}</div>
                    )}
                    <div>
                      มูลค่ารวม:{' '}
                      {result.amount_total.toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div>สถานะ: {result.status}</div>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      navigate(`/sales/invoices/${result.invoice_id}`)
                    }
                  >
                    ดูรายละเอียด
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/sales/invoices')}
                  >
                    ไปที่รายการใบแจ้งหนี้
                  </Button>
                </div>
              </div>
            )}

            {!invoiceMutation.isPending && !result && (
              <div className="text-center text-muted py-4">
                กรอกข้อมูลและคลิก "สร้างใบแจ้งหนี้" เพื่อดูผลลัพธ์
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

