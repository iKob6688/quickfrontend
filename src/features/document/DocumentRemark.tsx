import { Card } from '@/components/ui/Card'

type Props = {
  title: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export function DocumentRemark({ title, value, onChange, placeholder, rows = 4 }: Props) {
  return (
    <Card className="qf-document-remark">
      <div className="qf-section-title mb-3">{title}</div>
      <textarea
        className="form-control"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Card>
  )
}
