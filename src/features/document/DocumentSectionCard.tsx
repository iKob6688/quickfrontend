import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

type Props = {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function DocumentSectionCard({ title, description, actions, children, className }: Props) {
  return (
    <Card className={className ? `qf-document-section ${className}` : 'qf-document-section'}>
      {(title || description || actions) ? (
        <div className="qf-document-section__head">
          <div>
            {title ? <div className="qf-section-title mb-1">{title}</div> : null}
            {description ? <div className="small text-muted">{description}</div> : null}
          </div>
          {actions ? <div className="d-flex align-items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Card>
  )
}
