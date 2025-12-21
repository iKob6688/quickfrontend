import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { Button as BootstrapButton, Spinner } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type Size = 'sm' | 'default' | 'lg'

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    PropsWithChildren {
  variant?: Variant
  size?: Size
  isLoading?: boolean
}

const variantMap: Record<Variant, string> = {
  default: 'primary',
  secondary: 'outline-secondary',
  outline: 'outline-secondary',
  ghost: 'link',
  destructive: 'danger',
}

const sizeMap: Record<Size, 'sm' | undefined> = {
  sm: 'sm',
  default: undefined,
  lg: undefined,
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  isLoading,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const bsVariant = variantMap[variant]
  const bsSize = sizeMap[size]

  return (
    <BootstrapButton
      variant={bsVariant as any}
      size={bsSize}
      className={twMerge(
        variant === 'ghost' && 'text-decoration-none text-muted',
        className,
      )}
      disabled={disabled || isLoading}
      {...(rest as any)}
    >
      {isLoading ? (
        <Spinner
          as="span"
          animation="border"
          size="sm"
          role="status"
          aria-hidden="true"
          className="me-2"
        />
      ) : null}
      {children}
    </BootstrapButton>
  )
}


