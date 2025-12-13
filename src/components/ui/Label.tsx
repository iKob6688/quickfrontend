import type { LabelHTMLAttributes, PropsWithChildren } from 'react'
import { Form } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

export interface LabelProps
  extends LabelHTMLAttributes<HTMLLabelElement>,
    PropsWithChildren {
  required?: boolean
  helperText?: string
  error?: string
}

/**
 * Form label component using Bootstrap Form.Label
 * - Always visible (never placeholder-only)
 * - Clear hierarchy with helper text
 * - Error messages positioned near field
 */
export function Label({
  children,
  required,
  helperText,
  error,
  className,
  ...rest
}: LabelProps) {
  return (
    <div className="mb-1">
      <Form.Label
        className={twMerge(
          'fw-semibold small',
          error && 'text-danger',
          className,
        )}
        {...rest}
      >
        {children}
        {required && (
          <span className="text-danger ms-1" aria-label="required">
            *
          </span>
        )}
      </Form.Label>
      {helperText && !error && (
        <Form.Text className="text-muted small d-block">
          {helperText}
        </Form.Text>
      )}
      {error && (
        <Form.Text className="text-danger small d-block" role="alert">
          {error}
        </Form.Text>
      )}
    </div>
  )
}

