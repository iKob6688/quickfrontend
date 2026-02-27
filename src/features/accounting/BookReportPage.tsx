import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { getBankBook, getCashBook } from '@/api/services/accounting-reports.service'
import { ReportDataTable } from '@/features/accounting/ReportDataTable'

type Mode = 'cash' | 'bank'

export function BookReportPage(props: { mode: Mode }) {
  const navigate = useNavigate()
  const { mode } = props

  const q = useQuery({
    queryKey: ['accounting', 'book', mode],
    queryFn: () => (mode === 'cash' ? getCashBook({}) : getBankBook({})),
    staleTime: 60_000,
    retry: 1,
  })

  const title = mode === 'cash' ? 'สมุดเงินสด (Cash Book)' : 'สมุดเงินฝากธนาคาร (Bank Book)'

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="สรุปรายการสมุดรายวันจากข้อมูลจริงในระบบ"
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

      {q.isError ? (
        <div className="alert alert-danger">
          โหลดรายงานไม่สำเร็จ: {q.error instanceof Error ? q.error.message : 'Unknown error'}
        </div>
      ) : (
        <ReportDataTable title="รายการสมุดรายวัน" reportData={q.data?.reportData} loading={q.isLoading} />
      )}
    </div>
  )
}
