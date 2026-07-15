import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type Props = {
  title?: string
  subtitle?: string
  onPrint?: () => void
  children: ReactNode
  className?: string
}

export function DocumentPrintPreview({ title = 'พิมพ์ / PDF', subtitle, onPrint, children, className }: Props) {
  return (
    <Card className={className ? `qf-document-print-preview ${className}` : 'qf-document-print-preview'}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <div className="qf-section-title mb-1">{title}</div>
          {subtitle ? <div className="small text-muted">{subtitle}</div> : null}
        </div>
        {onPrint ? (
          <Button type="button" size="sm" variant="secondary" onClick={onPrint}>
            <i className="bi bi-printer me-1"></i>
            พิมพ์
          </Button>
        ) : null}
      </div>
      <div className="qf-document-print-preview__frame">{children}</div>
    </Card>
  )
}
