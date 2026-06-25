import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { getSalesDocumentNumberingSettings, updateSalesDocumentNumberingSettings } from '@/api/services/sales-document-numbering.service'
import { useAuthStore } from '@/features/auth/store'
import { isAdminUser } from '@/lib/adminAccess'
import { toast } from '@/lib/toastStore'

function sanitizePrefix(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function SalesDocumentNumberingSettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canManage = isAdminUser(user)
  const [quotationPrefix, setQuotationPrefix] = useState('QT')
  const [saleOrderPrefix, setSaleOrderPrefix] = useState('SO')

  const query = useQuery({
    queryKey: ['sales-document-numbering-settings'],
    queryFn: getSalesDocumentNumberingSettings,
    enabled: canManage,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!query.data) return
    setQuotationPrefix(query.data.quotationPrefix || 'QT')
    setSaleOrderPrefix(query.data.saleOrderPrefix || 'SO')
  }, [query.data])

  const mutation = useMutation({
    mutationFn: updateSalesDocumentNumberingSettings,
    onSuccess: (data) => {
      setQuotationPrefix(data.quotationPrefix)
      setSaleOrderPrefix(data.saleOrderPrefix)
      toast.success('บันทึก prefix เลขเอกสารสำเร็จ')
      query.refetch().catch(() => undefined)
    },
    onError: (err) => {
      toast.error('บันทึก prefix ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const nextQuotationPrefix = sanitizePrefix(quotationPrefix)
    const nextSaleOrderPrefix = sanitizePrefix(saleOrderPrefix)

    if (!nextQuotationPrefix || !nextSaleOrderPrefix) {
      toast.error('กรุณากรอก prefix ให้ครบ')
      return
    }

    mutation.mutate({
      quotationPrefix: nextQuotationPrefix,
      saleOrderPrefix: nextSaleOrderPrefix,
    })
  }

  return (
    <div>
      <PageHeader
        title="ตั้งค่าเลขเอกสารขาย"
        subtitle="กำหนด prefix แยกสำหรับใบเสนอราคาและ Sale Order ตามบริษัทที่กำลังใช้งาน"
        breadcrumb="ตั้งค่า · เลขเอกสารขาย"
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate('/sales/orders')}>
              กลับไปเอกสารขาย
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/tax-settings')}>
              ไปหน้า VAT/ภาษี
            </Button>
          </div>
        }
      />

      {!canManage ? (
        <Alert variant="warning">
          เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการ prefix เลขเอกสารขายได้
        </Alert>
      ) : null}

      {canManage ? (
        <div className="row g-4">
          <div className="col-lg-7">
            <Card className="p-4">
              <div className="qf-section-title mb-3">Document Prefix</div>
              {query.isError ? (
                <Alert variant="danger" className="small">
                  {query.error instanceof Error ? query.error.message : 'โหลดข้อมูลไม่สำเร็จ'}
                </Alert>
              ) : null}
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <Label htmlFor="companyName">บริษัท</Label>
                  <Input
                    id="companyName"
                    value={query.data?.companyName || user?.companyName || ''}
                    disabled
                  />
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <Label htmlFor="quotationPrefix" required>
                      Prefix ใบเสนอราคา
                    </Label>
                    <Input
                      id="quotationPrefix"
                      value={quotationPrefix}
                      maxLength={10}
                      onChange={(e) => setQuotationPrefix(sanitizePrefix(e.target.value))}
                      disabled={query.isLoading || mutation.isPending}
                    />
                    <div className="small text-muted mt-1">ตัวอย่างเลขใหม่: {sanitizePrefix(quotationPrefix || 'QT') || 'QT'}00001</div>
                  </div>
                  <div className="col-md-6">
                    <Label htmlFor="saleOrderPrefix" required>
                      Prefix Sale Order
                    </Label>
                    <Input
                      id="saleOrderPrefix"
                      value={saleOrderPrefix}
                      maxLength={10}
                      onChange={(e) => setSaleOrderPrefix(sanitizePrefix(e.target.value))}
                      disabled={query.isLoading || mutation.isPending}
                    />
                    <div className="small text-muted mt-1">ตัวอย่างเลขใหม่: {sanitizePrefix(saleOrderPrefix || 'SO') || 'SO'}00001</div>
                  </div>
                </div>

                <div className="d-flex gap-2 mt-4">
                  <Button type="submit" size="sm" isLoading={mutation.isPending} disabled={query.isLoading}>
                    บันทึก
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setQuotationPrefix(query.data?.quotationPrefix || 'QT')
                      setSaleOrderPrefix(query.data?.saleOrderPrefix || 'SO')
                    }}
                    disabled={query.isLoading || mutation.isPending}
                  >
                    คืนค่าเดิม
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div className="col-lg-5">
            <Card className="p-4">
              <div className="qf-section-title mb-3">กติกา</div>
              <ul className="small mb-0 ps-3">
                <li>มีผลกับเอกสารใหม่เท่านั้น</li>
                <li>ระบบจะแปลงเป็นตัวพิมพ์ใหญ่ให้อัตโนมัติ</li>
                <li>อนุญาตเฉพาะ A-Z และ 0-9</li>
                <li>ใบเสนอราคาจะใช้ prefix ของ quotation</li>
                <li>Sale Order ที่สร้างตรงจะใช้ prefix ของ sale order</li>
              </ul>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}
