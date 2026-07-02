import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  cancelRdEfilingSubmission,
  checkRdEfilingStatus,
  listReportPrintouts,
  listRdEfilingSubmissions,
  prepareRdEfilingSubmission,
  submitRdEfilingSubmission,
} from '@/api/services/rd-efiling.service'
import { toast } from '@/lib/toastStore'

function badgeClass(state?: string) {
  if (state === 'ready') return 'text-bg-warning'
  if (state === 'submitted') return 'text-bg-info'
  if (state === 'accepted' || state === 'paid') return 'text-bg-success'
  if (state === 'rejected' || state === 'cancelled') return 'text-bg-danger'
  return 'text-bg-secondary'
}

export function RdEfilingSubmissionsPage() {
  const queryClient = useQueryClient()
  const printoutsQuery = useQuery({
    queryKey: ['rd-efiling', 'printouts'],
    queryFn: () => listReportPrintouts({ limit: 100 }),
  })
  const submissionsQuery = useQuery({
    queryKey: ['rd-efiling', 'submissions'],
    queryFn: () => listRdEfilingSubmissions({ limit: 100 }),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rd-efiling'] })

  const prepareMutation = useMutation({
    mutationFn: prepareRdEfilingSubmission,
    onSuccess: () => {
      toast.success('เตรียมรายการยื่นแบบแล้ว')
      void invalidate()
    },
  })
  const submitMutation = useMutation({
    mutationFn: submitRdEfilingSubmission,
    onSuccess: () => {
      toast.success('ส่งคำสั่ง submit แล้ว')
      void invalidate()
    },
  })
  const statusMutation = useMutation({
    mutationFn: checkRdEfilingStatus,
    onSuccess: (data) => toast.info('สถานะ RD e-Filing', `${data.submission.name}: ${data.submission.state}`),
  })
  const cancelMutation = useMutation({
    mutationFn: cancelRdEfilingSubmission,
    onSuccess: () => {
      toast.success('ยกเลิกรายการแล้ว')
      void invalidate()
    },
  })

  const printoutRows = printoutsQuery.data?.items ?? []
  const submissionRows = submissionsQuery.data?.items ?? []

  return (
    <div>
      <PageHeader
        title="RD e-Filing Submissions"
        subtitle="ตรวจรายการ printout ที่พร้อมเตรียมยื่นแบบ และควบคุม submit ด้วย admin approval"
        breadcrumb="Accounting · Tax · RD e-Filing"
      />

      <Card className="p-3 mb-3">
        <div className="fw-semibold mb-1">แนวทางความปลอดภัย</div>
        <div className="text-muted small">
          ระบบจะไม่ submit ไป RD e-Filing ถ้า admin ยังไม่เปิด setting และต้องมี export log/attachment ก่อนเสมอ
        </div>
      </Card>

      <Card className="p-0 overflow-hidden mb-3">
        <div className="p-3 border-bottom">
          <div className="fw-semibold">Generated Printouts</div>
          <div className="small text-muted">ไฟล์ที่สร้างแล้วและสามารถเตรียมเป็น RD e-Filing submission ได้</div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>รายงาน</th>
                <th>ช่วงวันที่</th>
                <th>สถานะ</th>
                <th>ไฟล์</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {printoutRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="fw-semibold">{row.name}</div>
                    <div className="small text-muted">{row.reportType}</div>
                  </td>
                  <td className="small">{(row as any).periodFrom || '-'} - {(row as any).periodTo || '-'}</td>
                  <td>
                    <span className={`badge ${badgeClass(row.state)}`}>{row.state}</span>
                  </td>
                  <td>
                    {row.attachmentUrl ? (
                      <a href={row.attachmentUrl} target="_blank" rel="noreferrer">
                        ดาวน์โหลด
                      </a>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="text-end">
                    <div className="d-flex justify-content-end gap-2 flex-wrap">
                      <Button size="sm" variant="secondary" onClick={() => prepareMutation.mutate(row.id)}>
                        Prepare Submission
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!printoutsQuery.isLoading && printoutRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    ยังไม่มีรายการ printout/export log
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-bottom">
          <div className="fw-semibold">RD e-Filing Queue</div>
          <div className="small text-muted">รายการที่เตรียมยื่นแบบแล้ว พร้อมตรวจสถานะหรือ submit ตามสิทธิ์และ setting</div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>รายการ</th>
                <th>ช่องทาง</th>
                <th>สถานะ</th>
                <th>อ้างอิง RD</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {submissionRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="fw-semibold">{row.name}</div>
                    <div className="small text-muted">{row.reportType} · {row.periodFrom || '-'} - {row.periodTo || '-'}</div>
                  </td>
                  <td>{row.sourceChannel || 'qacc'}</td>
                  <td>
                    <span className={`badge ${badgeClass(row.state)}`}>{row.state}</span>
                  </td>
                  <td>{row.rdReference || '-'}</td>
                  <td className="text-end">
                    <div className="d-flex justify-content-end gap-2 flex-wrap">
                      <Button size="sm" onClick={() => submitMutation.mutate(row.id)}>
                        Submit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => statusMutation.mutate(row.id)}>
                        Check
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => cancelMutation.mutate(row.id)}>
                        Cancel
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!submissionsQuery.isLoading && submissionRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    ยังไม่มี RD e-Filing submission
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
