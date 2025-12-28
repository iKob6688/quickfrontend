import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getGeneralLedger } from '@/api/services/accounting-reports.service'

export function GeneralLedgerReportPage() {
  const navigate = useNavigate()
  const [option, setOption] = useState('')
  const [tag, setTag] = useState('')

  const q = useQuery({
    queryKey: ['accounting', 'generalLedger', option, tag],
    queryFn: () => getGeneralLedger({ option, tag }),
    staleTime: 60_000,
    retry: 1,
  })

  return (
    <div>
      <PageHeader
        title="สมุดบัญชีแยกประเภท (General Ledger)"
        subtitle="Phase 2: เชื่อมต่อ API และสามารถ drilldown ต่อไปดู move line detail ได้"
        breadcrumb="Home · Accounting · Reports"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports')}>
              กลับไปรายงานบัญชี
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void q.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="fw-semibold mb-1">หมายเหตุ</div>
        <div className="text-muted small">
          หน้า General Ledger แบบเต็ม (เลือกบัญชี/ตัวกรองละเอียด) ขึ้นกับ wizard ของ Odoo add-on ที่ติดตั้งอยู่ใน instance นี้
          แต่การ drilldown หลักจะทำผ่าน P&amp;L / Balance Sheet → เลือกบัญชี → เปิดหน้า General Ledger (Account Drilldown)
        </div>
        <div className="row g-2 align-items-end mt-2">
          <div className="col-md-5">
            <label className="form-label">option (optional)</label>
            <input className="form-control" value={option} onChange={(e) => setOption(e.target.value)} placeholder="ปล่อยว่างเพื่อใช้ default" />
          </div>
          <div className="col-md-5">
            <label className="form-label">tag (optional)</label>
            <input className="form-control" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ปล่อยว่างเพื่อใช้ default" />
          </div>
          <div className="col-md-2 d-grid">
            <Button onClick={() => void q.refetch()}>โหลด</Button>
          </div>
        </div>
      </Card>

      {q.isError ? (
        <div className="alert alert-danger">
          โหลดรายงานไม่สำเร็จ: {q.error instanceof Error ? q.error.message : 'Unknown error'}
        </div>
      ) : (
        <Card className="p-3">
          <div className="fw-semibold mb-2">Raw reportData (จาก backend)</div>
          <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {q.isLoading ? 'กำลังโหลด...' : JSON.stringify(q.data?.reportData ?? {}, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}


