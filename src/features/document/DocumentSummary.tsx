import { Card } from '@/components/ui/Card'

export type DocumentSummaryRow = {
  label: string
  value: string
  emphasis?: boolean
  muted?: boolean
}

type Props = {
  title?: string
  rows: DocumentSummaryRow[]
  note?: string
  totalLabel?: string
  totalValue?: string
  className?: string
}

export function DocumentSummary({ title = 'สรุป', rows, note, totalLabel, totalValue, className }: Props) {
  return (
    <Card className={className ? `qf-document-summary ${className}` : 'qf-document-summary'}>
      <div className="qf-section-title mb-3">{title}</div>
      <div className="qf-document-summary__list">
        {rows.map((row) => (
          <div key={row.label} className={row.emphasis ? 'qf-document-summary__row qf-document-summary__row--emphasis' : 'qf-document-summary__row'}>
            <span className={row.muted ? 'text-muted' : ''}>{row.label}</span>
            <span className={row.emphasis ? 'fw-semibold font-monospace' : 'font-monospace'}>{row.value}</span>
          </div>
        ))}
      </div>
      {totalLabel && totalValue ? (
        <div className="qf-document-summary__total">
          <span>{totalLabel}</span>
          <span>{totalValue}</span>
        </div>
      ) : null}
      {note ? <div className="small text-muted mt-3">{note}</div> : null}
    </Card>
  )
}
