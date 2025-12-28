import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getPartnerLedger } from '@/api/services/accounting-reports.service'

export function PartnerLedgerReportPage() {
  const navigate = useNavigate()
  const [option, setOption] = useState('')
  const [tag, setTag] = useState('')
  const [partnerId, setPartnerId] = useState('')

  const q = useQuery({
    queryKey: ['accounting', 'partnerLedger', option, tag],
    queryFn: () => getPartnerLedger({ option, tag }),
    staleTime: 60_000,
    retry: 1,
  })

  return (
    <div>
      <PageHeader
        title="ลูกหนี้/เจ้าหนี้ (Partner Ledger)"
        subtitle="ดู ledger แยกตามคู่ค้า และ drilldown ไป move lines ของคู่ค้ารายบุคคล"
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
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">option (optional)</label>
            <input className="form-control" value={option} onChange={(e) => setOption(e.target.value)} placeholder="ปล่อยว่างเพื่อใช้ default" />
          </div>
          <div className="col-md-4">
            <label className="form-label">tag (optional)</label>
            <input className="form-control" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ปล่อยว่างเพื่อใช้ default" />
          </div>
          <div className="col-md-4">
            <label className="form-label">Partner ID (สำหรับ drilldown)</label>
            <div className="d-flex gap-2">
              <input className="form-control" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="เช่น 12" />
              <Button
                variant="secondary"
                onClick={() => {
                  const id = Number(partnerId)
                  if (!Number.isFinite(id) || id <= 0) return
                  navigate(`/accounting/reports/partner-ledger/partner/${id}`)
                }}
              >
                Drilldown
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {q.isError ? (
        <div className="alert alert-danger">
          โหลดรายงานไม่สำเร็จ: {q.error instanceof Error ? q.error.message : 'Unknown error'}
        </div>
      ) : (
        <Card className="p-3">
          <div className="fw-semibold mb-2">Raw reportData</div>
          <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {q.isLoading ? 'กำลังโหลด...' : JSON.stringify(q.data?.reportData ?? {}, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}


