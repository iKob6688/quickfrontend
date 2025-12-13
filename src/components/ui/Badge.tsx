import type { HTMLAttributes, PropsWithChildren } from 'react'
import { Badge as BootstrapBadge } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

type Tone = 'gray' | 'blue' | 'green' | 'red' | 'amber'

const variantMap: Record<Tone, string> = {
  gray: 'secondary',
  blue: 'info',
  green: 'success',
  red: 'danger',
  amber: 'warning',
}

/**
 * Status badge component using Bootstrap Badge
 * - Pill shape with consistent padding
 * - Readable font size (not compressed)
 * - Uses semantic status colors
 * - Text is explicit (not color-only)
 */
export function Badge({
  className,
  children,
  ...rest
}: PropsWithChildren<
  HTMLAttributes<HTMLSpanElement> & { tone?: Tone }
>) {
  const tone = (rest as { tone?: Tone }).tone ?? 'gray'
  const variant = variantMap[tone]
  // Remove tone prop from DOM
  const { tone: _tone, ...domProps } = rest as { tone?: Tone } & HTMLAttributes<HTMLSpanElement>
  
  return (
    <BootstrapBadge
      bg={variant as any}
      className={twMerge('rounded-pill fw-bold', className)}
      {...domProps}
    >
      {children}
    </BootstrapBadge>
  )
}


