import type { PropsWithChildren } from 'react'

interface PageContainerProps extends PropsWithChildren {
  className?: string
  fluid?: boolean
}

export function PageContainer({ children, className, fluid }: PageContainerProps) {
  const base = fluid
    ? 'w-full px-3 pb-24 pt-3'
    : 'mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10'
  return (
    <div
      className={`${base} ${className ?? ''}`}
    >
      {children}
    </div>
  )
}


