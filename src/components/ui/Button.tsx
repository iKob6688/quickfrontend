import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { Button as BootstrapButton, Spinner } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    PropsWithChildren {
  variant?: Variant
  size?: Size
  isLoading?: boolean
}

const variantMap: Record<Variant, string> = {
  primary: 'primary',
  secondary: 'outline-secondary',
  ghost: 'link',
}

const sizeMap: Record<Size, 'sm' | undefined> = {
  sm: 'sm',
  md: undefined,
  lg: undefined,
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
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
      {...rest}
    >
      {isLoading && (
        <Spinner
          as="span"
          animation="border"
          size="sm"
          role="status"
          aria-hidden="true"
          className="me-2"
        />
      )}
      {children}
    </BootstrapButton>
  )
}


