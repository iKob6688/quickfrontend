import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { agentCreateContact, fileToBase64, type ContactCreateResponse } from '@/api/services/agent.service'
import { toApiError } from '@/api/response'
import { toast } from '@/lib/toastStore'

export function AgentContactCreatePage() {
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [vat, setVat] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [result, setResult] = useState<ContactCreateResponse | null>(null)

  const contactMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        contact_data: {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          mobile: mobile.trim() || undefined,
          vat: vat.trim() || undefined,
          website: website.trim() || undefined,
          street: address.trim() || undefined,
        },
      }

      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile)
        payload.file = base64
      }

      return await agentCreateContact(payload)
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success(
        data.created ? 'สร้างผู้ติดต่อสำเร็จ' : 'อัปเดตผู้ติดต่อสำเร็จ',
        data.contact_name,
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

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('กรุณากรอกชื่อผู้ติดต่อ')
      return
    }
    contactMutation.mutate()
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreview(null)
    setName('')
    setEmail('')
    setPhone('')
    setMobile('')
    setVat('')
    setWebsite('')
    setAddress('')
    setResult(null)
    contactMutation.reset()
  }

  return (
    <div>
      <PageHeader
        title="Create Contact - เพิ่มผู้ติดต่อจากนามบัตร"
        subtitle="สแกนนามบัตรหรือกรอกข้อมูลเพื่อเพิ่มผู้ติดต่อ"
        breadcrumb="Agent · Contact"
        actions={
          <Button size="sm" variant="ghost" onClick={() => navigate('/agent')}>
            กลับ
          </Button>
        }
      />

      <div className="row">
        <div className="col-lg-6">
          <Card className="p-4 mb-3">
            <h6 className="mb-3">ข้อมูลผู้ติดต่อ</h6>
            
            <div className="mb-3">
              <Label htmlFor="name" required>
                ชื่อ
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อบริษัทหรือชื่อบุคคล"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="phone">เบอร์โทร</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="02-123-4567"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="mobile">มือถือ</Label>
              <Input
                id="mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="081-234-5678"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="vat">เลขประจำตัวผู้เสียภาษี</Label>
              <Input
                id="vat"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                placeholder="1234567890123"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="website">เว็บไซต์</Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="address">ที่อยู่</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ที่อยู่"
              />
            </div>

            <div className="mb-3">
              <Label>นามบัตร (เลือกได้)</Label>
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
                      ลากนามบัตรมาวาง หรือคลิกเพื่อเลือกไฟล์
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
                disabled={!name.trim() || contactMutation.isPending}
                isLoading={contactMutation.isPending}
              >
                บันทึกผู้ติดต่อ
              </Button>
              {(selectedFile || name) && (
                <Button variant="secondary" onClick={handleReset}>
                  ล้าง
                </Button>
              )}
            </div>

            {contactMutation.isError && (
              <div className="alert alert-danger mt-3 mb-0">
                <div className="fw-semibold mb-1">เกิดข้อผิดพลาด</div>
                <div className="small">
                  {toApiError(contactMutation.error).message}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="col-lg-6">
          <Card className="p-4">
            <h6 className="mb-3">ผลลัพธ์</h6>
            
            {contactMutation.isPending && (
              <div className="text-center text-muted py-4">
                กำลังบันทึกผู้ติดต่อ...
              </div>
            )}

            {result && (
              <div>
                <div className={`alert ${result.created ? 'alert-success' : 'alert-info'}`}>
                  <div className="fw-semibold mb-2">
                    {result.created ? 'สร้างผู้ติดต่อสำเร็จ' : 'อัปเดตผู้ติดต่อสำเร็จ'}
                  </div>
                  <div className="small">
                    <div>ID: {result.contact_id}</div>
                    <div>ชื่อ: {result.contact_name}</div>
                    {result.email && <div>อีเมล: {result.email}</div>}
                    {result.phone && <div>เบอร์โทร: {result.phone}</div>}
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/customers/${result.contact_id}`)}
                  >
                    ดูรายละเอียด
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/customers')}
                  >
                    ไปที่รายการลูกค้า
                  </Button>
                </div>
              </div>
            )}

            {!contactMutation.isPending && !result && (
              <div className="text-center text-muted py-4">
                กรอกข้อมูลหรืออัปโหลดนามบัตรและคลิก "บันทึกผู้ติดต่อ" เพื่อดูผลลัพธ์
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

