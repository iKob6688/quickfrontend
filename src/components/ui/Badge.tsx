import type { HTMLAttributes, PropsWithChildren } from 'react'
import { Badge as BootstrapBadge } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

type Tone = 'gray' | 'blue' | 'green' | 'red' | 'amber'

const toneClassMap: Record<Tone, string> = {
  gray: 'qf-badge--gray',
  blue: 'qf-badge--blue',
  green: 'qf-badge--green',
  red: 'qf-badge--red',
  amber: 'qf-badge--amber',
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
  const toneClass = toneClassMap[tone]
  // Remove tone prop from DOM
  const { tone: _tone, ...domProps } = rest as { tone?: Tone } & HTMLAttributes<HTMLSpanElement>
  
  return (
    <BootstrapBadge
      bg="light"
      className={twMerge('qf-badge', toneClass, className)}
      {...domProps}
    >
      {children}
    </BootstrapBadge>
  )
}


