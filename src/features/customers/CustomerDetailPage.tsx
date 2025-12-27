import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner, Alert } from 'react-bootstrap'
import { getPartner, archivePartner, unarchivePartner } from '@/api/services/partners.service'
import { toast } from '@/lib/toastStore'

export function CustomerDetailPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams()
  const id = useMemo(() => Number(params.id), [params.id])
  const copyText = async (label: string, value?: string | null) => {
    const v = (value || '').trim()
    if (!v) {
      toast.info('ไม่มีข้อมูลให้คัดลอก')
      return
    }
    try {
      await navigator.clipboard.writeText(v)
      toast.success(`คัดลอก${label}แล้ว`)
    } catch {
      // best-effort fallback
      try {
        const el = document.createElement('textarea')
        el.value = v
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        toast.success(`คัดลอก${label}แล้ว`)
      } catch (err) {
        toast.error('คัดลอกไม่สำเร็จ', err instanceof Error ? err.message : undefined)
      }
    }
  }

  const query = useQuery({
    queryKey: ['partner', id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: () => getPartner(id),
    staleTime: 30_000,
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!query.data) throw new Error('Missing partner')
      return query.data.active ? archivePartner(query.data.id) : unarchivePartner(query.data.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['partner', id] })
      await queryClient.invalidateQueries({ queryKey: ['partners'] })
      toast.success('บันทึกสถานะรายชื่อติดต่อเรียบร้อย')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    },
  })

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="container py-4">
        <Alert variant="danger" className="small mb-0">
          URL ไม่ถูกต้อง
        </Alert>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="รายละเอียดรายชื่อติดต่อ"
        subtitle="ข้อมูลรายชื่อผู้ติดต่อ (res.partner) ทั้งลูกค้าและผู้ขาย"
        breadcrumb="รายรับ · รายชื่อติดต่อ · รายละเอียด"
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate('/customers')}>
              กลับไปยังรายการ
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(`/sales/invoices/new?customerId=${id}`)}
              disabled={!query.data}
            >
              + สร้างใบแจ้งหนี้
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/customers/${id}/edit`)}
              disabled={!query.data}
            >
              แก้ไข
            </Button>
            <Button
              size="sm"
              onClick={() => archiveMutation.mutate()}
              isLoading={archiveMutation.isPending}
              disabled={!query.data}
            >
              {query.data?.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
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
            <Card className="p-4">
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <h2 className="h5 fw-semibold mb-0">{query.data.displayName}</h2>
                    <Badge tone={query.data.active ? 'green' : 'gray'}>
                      {query.data.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </Badge>
                  </div>
                  <div className="small text-muted">
                    ประเภท: {query.data.companyType === 'company' ? 'นิติบุคคล' : 'บุคคล'}
                  </div>
                </div>
              </div>

              <hr className="my-4" />

              <div className="qf-section-title mb-3">ข้อมูลติดต่อ</div>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="small text-muted mb-1">เลขผู้เสียภาษี</div>
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <div className="fw-semibold font-monospace">
                      {query.data.vat || query.data.taxId || '—'}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText('เลขผู้เสียภาษี', query.data.vat || query.data.taxId)}
                    >
                      คัดลอก
                    </Button>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="small text-muted mb-1">อีเมล</div>
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <div className="fw-semibold">{query.data.email || '—'}</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText('อีเมล', query.data.email)}
                    >
                      คัดลอก
                    </Button>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="small text-muted mb-1">โทรศัพท์</div>
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <div className="fw-semibold">{query.data.phone || '—'}</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText('เบอร์โทร', query.data.phone)}
                    >
                      คัดลอก
                    </Button>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="small text-muted mb-1">มือถือ</div>
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <div className="fw-semibold">{query.data.mobile || '—'}</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText('มือถือ', query.data.mobile)}
                    >
                      คัดลอก
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-lg-4">
            <Card className="p-4">
              <div className="qf-section-title mb-3">ที่อยู่</div>
              <div className="small">
                <div>{query.data.street || '—'}</div>
                {query.data.street2 ? <div>{query.data.street2}</div> : null}
                <div>
                  {[query.data.city, query.data.zip].filter(Boolean).join(' ') || ''}
                </div>
                <div className="text-muted">
                  {query.data.countryName || ''}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}


