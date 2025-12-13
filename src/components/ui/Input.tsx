import type { FormControlProps } from 'react-bootstrap'
import { Form } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

export interface InputProps extends Omit<FormControlProps, 'size'> {
  leftAdornment?: React.ReactNode
  rightAdornment?: React.ReactNode
  error?: boolean
  size?: 'sm' | 'lg'
}

/**
 * Form input component using Bootstrap Form.Control
 * - Touch-friendly (Bootstrap default)
 * - 16px font size prevents iOS zoom on focus
 * - Clear focus ring for accessibility
 * - Distinct disabled state
 */
export function Input({
  className,
  leftAdornment,
  rightAdornment,
  error,
  disabled,
  ...rest
}: InputProps) {
  if (leftAdornment || rightAdornment) {
    return (
      <div className="input-group">
        {leftAdornment && (
          <span className="input-group-text bg-white border-end-0">
            {leftAdornment}
          </span>
        )}
        <Form.Control
          type={rest.type || 'text'}
          className={twMerge(
            error && 'is-invalid',
            leftAdornment && 'border-start-0',
            rightAdornment && 'border-end-0',
            className,
          )}
          disabled={disabled}
          {...rest}
        />
        {rightAdornment && (
          <span className="input-group-text bg-white border-start-0">
            {rightAdornment}
          </span>
        )}
      </div>
    )
  }

  return (
    <Form.Control
      type={rest.type || 'text'}
      className={twMerge(
        error && 'is-invalid',
        className,
      )}
      disabled={disabled}
      {...rest}
    />
  )
}


