import type { LabelHTMLAttributes, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export function Label({
  className,
  children,
  ...rest
}: PropsWithChildren<LabelHTMLAttributes<HTMLLabelElement>>) {
  return (
    <label className={twMerge('form-label', className)} {...rest}>
      {children}
    </label>
  )
}


