import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react'
import { Card as BootstrapCard } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

interface CardProps extends PropsWithChildren, HTMLAttributes<HTMLElement> {
  header?: ReactNode
  footer?: ReactNode
}

export function Card({
  header,
  footer,
  children,
  className,
  ...rest
}: CardProps) {
  return (
    <BootstrapCard
      className={twMerge(
        rest.onClick && 'cursor-pointer',
        className,
      )}
      onClick={rest.onClick}
      {...(rest as any)}
    >
      {header && (
        <BootstrapCard.Header className="border-bottom">
          {header}
        </BootstrapCard.Header>
      )}
      <BootstrapCard.Body className={header || footer ? '' : 'p-4'}>
        {children}
      </BootstrapCard.Body>
      {footer && (
        <BootstrapCard.Footer className="border-top">
          {footer}
        </BootstrapCard.Footer>
      )}
    </BootstrapCard>
  )
}


