import type { FormControlProps } from 'react-bootstrap'
import { Form } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

export interface InputProps extends Omit<FormControlProps, 'size'> {
  error?: boolean
  size?: 'sm' | 'lg'
}

export function Input({ className, error, disabled, ...rest }: InputProps) {
  return (
    <Form.Control
      type={(rest as any).type || 'text'}
      className={twMerge(error && 'is-invalid', className)}
      disabled={disabled}
      {...(rest as any)}
    />
  )
}


