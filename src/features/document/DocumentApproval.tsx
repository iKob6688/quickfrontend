import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

type Props = {
  status: string
  detail?: string
  tone?: 'gray' | 'green' | 'blue' | 'amber' | 'red'
}

export function DocumentApproval({ status, detail, tone = 'gray' }: Props) {
  return (
    <Card className="qf-document-approval">
      <div className="qf-section-title mb-3">อนุมัติ / Workflow</div>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <Badge tone={tone}>{status}</Badge>
      </div>
      {detail ? <div className="small text-muted">{detail}</div> : <div className="small text-muted">ยังไม่มี workflow พิเศษ</div>}
    </Card>
  )
}
