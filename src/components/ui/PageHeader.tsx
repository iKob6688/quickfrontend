import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumb?: ReactNode
  actions?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-4 d-flex flex-column gap-3 border-bottom pb-3 mb-md-5 flex-md-row align-items-md-center justify-content-md-between pb-md-4">
      <div>
        {breadcrumb && (
          <div className="small fw-medium text-uppercase text-muted mb-1" style={{ letterSpacing: '0.18em' }}>
            {breadcrumb}
          </div>
        )}
        <div>
          <h1 className="h2 fw-bold mb-1">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted mb-0">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}


