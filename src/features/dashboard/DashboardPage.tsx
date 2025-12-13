import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/features/auth/store'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ping } from '@/api/endpoints/system'

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const instancePublicId = useAuthStore((s) => s.instancePublicId)

  const pingQuery = useQuery({
    queryKey: ['system', 'ping'],
    queryFn: ping,
    staleTime: 30_000,
  })

  return (
    <div>
      <PageHeader
        title="แดชบอร์ดภาพรวมธุรกิจ"
        subtitle="ภาพรวมยอดขาย รายจ่าย กำไร และสถานะใบแจ้งหนี้สำหรับ Quickfront18"
        breadcrumb="Home · Dashboard"
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" onClick={() => navigate('/sales/invoices')}>
              ไปหน้าใบแจ้งหนี้
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void pingQuery.refetch()}
            >
              ตรวจสอบการเชื่อมต่อ
            </Button>
          </div>
        }
      />

      <div className="row g-4">
        <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/sales/invoices')}
            role="button"
            tabIndex={0}
          >
            <p className="small fw-medium text-muted mb-2">Invoices</p>
            <p className="h6 fw-semibold mb-2">
              ไปจัดการใบแจ้งหนี้
            </p>
            <p className="small text-muted mb-0">
              สร้าง/แก้ไข/โพสต์ใบแจ้งหนี้
            </p>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/excel-import')}
            role="button"
            tabIndex={0}
          >
            <p className="small fw-medium text-muted mb-2">Excel Import</p>
            <p className="h6 fw-semibold mb-2">
              นำเข้าข้อมูลจาก Excel
            </p>
            <p className="small text-muted mb-0">
              อัปโหลด .xlsx เพื่อสร้างข้อมูล
            </p>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/backend-connection')}
            role="button"
            tabIndex={0}
          >
            <p className="small fw-medium text-muted mb-2">Backend</p>
            <p className="h6 fw-semibold mb-2">
              ตั้งค่า/Provisioning
            </p>
            <p className="small text-muted mb-0">
              สร้างบริษัทและ admin ใหม่
            </p>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card>
            <p className="small fw-medium text-muted mb-2">Connection</p>
            <p className="h6 fw-semibold mb-2">
              {pingQuery.isLoading
                ? 'กำลังตรวจสอบ...'
                : pingQuery.isError
                  ? 'เชื่อมต่อไม่ได้'
                  : pingQuery.data?.pong
                    ? 'เชื่อมต่อได้ (pong)'
                    : 'ไม่ทราบสถานะ'}
            </p>
            <p className="small text-muted mb-0">
              Instance ID: {instancePublicId ?? '—'}
            </p>
          </Card>
        </div>
      </div>

      <div className="row g-4 mt-4">
        <div className="col-lg-8">
          <Card>
            <p className="h6 fw-semibold mb-3">ผู้ใช้งานปัจจุบัน</p>
            <div className="row g-2">
              <div className="col-sm-6">
                <div className="rounded bg-light p-3">
                  <p className="small fw-medium text-muted mb-1">
                    ชื่อ
                  </p>
                  <p className="fw-semibold mb-0">{user?.name ?? '—'}</p>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="rounded bg-light p-3">
                  <p className="small fw-medium text-muted mb-1">
                    Login
                  </p>
                  <p className="fw-semibold mb-0 font-monospace">{user?.login ?? '—'}</p>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="rounded bg-light p-3">
                  <p className="small fw-medium text-muted mb-1">
                    Company
                  </p>
                  <p className="fw-semibold mb-0">{user?.companyName ?? '—'}</p>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="rounded bg-light p-3">
                  <p className="small fw-medium text-muted mb-1">
                    Companies
                  </p>
                  <p className="fw-semibold mb-0 font-monospace">
                    {user?.companies?.length ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
        <div className="col-lg-4">
          <Card>
            <p className="h6 fw-semibold mb-2">
              Next: KPI จริงจาก Odoo
            </p>
            <p className="small text-muted mb-0">
              ตอนนี้ยังไม่มี endpoint KPI/แดชบอร์ดใน addon แต่ระบบ auth + instance
              ทำงานแล้ว (เริ่มดึง sales/invoices ต่อได้เลย)
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}


