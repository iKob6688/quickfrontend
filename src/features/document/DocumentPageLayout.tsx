import type { ReactNode } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'

type Props = {
  title: string
  subtitle?: string
  breadcrumb?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function DocumentPageLayout({ title, subtitle, breadcrumb, actions, children, className }: Props) {
  return (
    <div className={className ? `qf-document-page ${className}` : 'qf-document-page'}>
      <PageHeader title={title} subtitle={subtitle} breadcrumb={breadcrumb} actions={actions} />
      <div className="qf-document-page__body">{children}</div>
    </div>
  )
}
