import type { FormControlProps } from 'react-bootstrap'
import { Form } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

export interface TextareaProps extends Omit<FormControlProps, 'size'> {
  error?: boolean
}

export function Textarea({ className, error, disabled, ...rest }: TextareaProps) {
  return (
    <Form.Control
      as="textarea"
      rows={(rest as any).rows || 4}
      className={twMerge(error && 'is-invalid', className)}
      disabled={disabled}
      {...(rest as any)}
    />
  )
}


