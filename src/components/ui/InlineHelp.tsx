import type { HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

export function InlineHelp({
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={twMerge('text-label text-surfaceDark/60', className)}
      {...rest}
    />
  )
}


