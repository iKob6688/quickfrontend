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
    <header className="qf-page-header mb-4 d-flex flex-column gap-3 border-bottom pb-3 mb-md-5 flex-md-row align-items-md-center justify-content-md-between pb-md-4">
      <div>
        {breadcrumb && (
          <div className="qf-breadcrumb small fw-medium text-muted mb-1">
            {breadcrumb}
          </div>
        )}
        <div>
          <h1 className="qf-page-title mb-1">
            {title}
          </h1>
          {subtitle && (
            <p className="qf-subtitle text-muted mb-0">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}


