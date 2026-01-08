import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { agentCreateQuotation, fileToBase64, type QuotationCreateResponse, type QuotationLineRequest } from '@/api/services/agent.service'
import { toApiError } from '@/api/response'
import { toast } from '@/lib/toastStore'

export function AgentQuotationCreatePage() {
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [lines, setLines] = useState<QuotationLineRequest[]>([])
  const [result, setResult] = useState<QuotationCreateResponse | null>(null)

  const quotationMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        customer_data: {
          name: customerName,
          email: customerEmail || undefined,
          phone: customerPhone || undefined,
        },
        lines: lines.length > 0 ? lines : [],
      }

      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile)
        payload.file = base64
      }

      return await agentCreateQuotation(payload)
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success('สร้างใบเสนอราคาสำเร็จ', `ใบเสนอราคา #${data.quotation_name}`)
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

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('กรุณากรอกชื่อลูกค้า')
      return
    }
    quotationMutation.mutate()
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreview(null)
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setLines([])
    setResult(null)
    quotationMutation.reset()
  }

  return (
    <div>
      <PageHeader
        title="Create Quotation - สร้างใบเสนอราคา"
        subtitle="สร้างใบเสนอราคาจากเอกสารหรือข้อมูลที่กรอก"
        breadcrumb="Agent · Quotation"
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
              <Label>เอกสารใบเสนอราคา (เลือกได้)</Label>
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
                  <div className="d-flex flex-column align-items-center justify-content-center text-muted" style={{ minHeight: '150px' }}>
                    <div className="small">
                      ลากเอกสารมาวาง หรือคลิกเพื่อเลือกไฟล์
                    </div>
                    <div className="small text-muted">
                      รองรับภาพ (JPG, PNG)
                    </div>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="form-control mt-2"
              />
            </div>

            <div className="d-flex gap-2">
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!customerName.trim() || quotationMutation.isPending}
                isLoading={quotationMutation.isPending}
              >
                สร้างใบเสนอราคา
              </Button>
              {(selectedFile || customerName) && (
                <Button variant="secondary" onClick={handleReset}>
                  ล้าง
                </Button>
              )}
            </div>

            {quotationMutation.isError && (
              <div className="alert alert-danger mt-3 mb-0">
                <div className="fw-semibold mb-1">เกิดข้อผิดพลาด</div>
                <div className="small">
                  {toApiError(quotationMutation.error).message}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="col-lg-6">
          <Card className="p-4">
            <h6 className="mb-3">ผลลัพธ์</h6>
            
            {quotationMutation.isPending && (
              <div className="text-center text-muted py-4">
                กำลังสร้างใบเสนอราคา...
              </div>
            )}

            {result && (
              <div>
                <div className="alert alert-success">
                  <div className="fw-semibold mb-2">สร้างใบเสนอราคาสำเร็จ</div>
                  <div className="small">
                    <div>เลขที่: {result.quotation_name}</div>
                    <div>ลูกค้า ID: {result.customer_id}</div>
                    <div>มูลค่ารวม: {result.amount_total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/sales/invoices/${result.quotation_id}`)}
                  >
                    ดูรายละเอียด
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/sales/invoices')}
                  >
                    ไปที่รายการใบเสนอราคา
                  </Button>
                </div>
              </div>
            )}

            {!quotationMutation.isPending && !result && (
              <div className="text-center text-muted py-4">
                กรอกข้อมูลและคลิก "สร้างใบเสนอราคา" เพื่อดูผลลัพธ์
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

