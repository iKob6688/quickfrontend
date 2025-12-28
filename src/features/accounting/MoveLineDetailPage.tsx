import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getMoveLineDetail } from '@/api/services/accounting-reports.service'
import { ApiError } from '@/api/response'

function asString(v: unknown): string {
  if (typeof v === 'string') return v
  if (v == null) return ''
  return String(v)
}

export function MoveLineDetailPage() {
  const navigate = useNavigate()
  const { moveLineId } = useParams()
  const id = Number(moveLineId)

  const q = useQuery({
    queryKey: ['accounting', 'moveLine', id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: () => getMoveLineDetail(id),
    staleTime: 60_000,
    retry: 1,
  })

  const moveLine = (q.data?.moveLine ?? {}) as Record<string, unknown>
  const move = (moveLine.move ?? null) as Record<string, unknown> | null
  const relatedLines = (moveLine.relatedLines ?? []) as unknown[]

  return (
    <div>
      <PageHeader
        title={`รายละเอียดรายการบัญชี #${Number.isFinite(id) ? id : '—'}`}
        subtitle="ดูรายละเอียดบรรทัดบัญชี และรายการใน journal entry เดียวกัน"
        breadcrumb="Home · Accounting · Reports"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>
              ย้อนกลับ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void q.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
          </div>
        }
      />

      {q.isError ? (
        <Card className="p-3 mb-3">
          <div className="alert alert-danger mb-0">
            <div className="fw-semibold mb-2">โหลดรายละเอียดไม่สำเร็จ</div>
            <div className="mb-2">
              {q.error instanceof Error ? q.error.message : 'Unknown error'}
            </div>
            {q.error instanceof ApiError ? (
              <>
                {q.error.code ? (
                  <div className="small text-muted mb-2">
                    Error code: <code>{q.error.code}</code>
                  </div>
                ) : null}
                {q.error.details ? (
                  <div className="small">
                    <div className="text-muted mb-1">รายละเอียดเพิ่มเติม:</div>
                    <pre className="small mb-0 bg-light p-2 rounded border" style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                      {typeof q.error.details === 'string' ? q.error.details : JSON.stringify(q.error.details, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>
                ย้อนกลับ
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-3 mb-3">
            <div className="row g-2">
              <div className="col-md-6">
                <div className="small text-muted">Move</div>
                <div className="fw-semibold">{asString(move?.name || move?.moveName || moveLine.moveName)}</div>
                <div className="text-muted small">{asString(move?.ref || moveLine.ref)}</div>
              </div>
              <div className="col-md-6">
                <div className="small text-muted">สถานะ</div>
                <div className="font-monospace">{asString(move?.state || '')}</div>
                <div className="text-muted small">วันที่: {asString(move?.date || moveLine.date || '')}</div>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="fw-semibold mb-2">Related lines</div>
            {relatedLines.length === 0 ? (
              <div className="text-muted">—</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th className="text-end">Debit</th>
                      <th className="text-end">Credit</th>
                      <th>Partner</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedLines.map((x, idx) => {
                      const r = (x ?? {}) as Record<string, unknown>
                      const acc = (r.account ?? null) as Record<string, unknown> | null
                      const partner = (r.partner ?? null) as Record<string, unknown> | null
                      return (
                        <tr key={idx}>
                          <td className="font-monospace">
                            {asString(acc?.code)} {asString(acc?.name)}
                          </td>
                          <td className="text-end font-monospace">{asString(r.debit)}</td>
                          <td className="text-end font-monospace">{asString(r.credit)}</td>
                          <td>{asString(partner?.name)}</td>
                          <td>{asString(r.name)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}


