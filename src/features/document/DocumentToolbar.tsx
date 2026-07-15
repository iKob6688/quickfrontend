import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function DocumentToolbar({ children, className }: Props) {
  return <div className={className ? `qf-document-toolbar ${className}` : 'qf-document-toolbar'}>{children}</div>
}
