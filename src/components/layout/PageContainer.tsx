import type { PropsWithChildren } from 'react'

interface PageContainerProps extends PropsWithChildren {
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={`mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10 ${className ?? ''}`}
    >
      {children}
    </div>
  )
}


