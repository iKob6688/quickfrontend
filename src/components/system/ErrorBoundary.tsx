import type { ReactNode } from 'react'
import React from 'react'
import { Button } from '@/components/ui/Button'

export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container py-5">
          <div className="alert alert-danger">
            <p className="fw-semibold mb-1">เกิดข้อผิดพลาดในหน้าเว็บ</p>
            <p className="small mb-0">
              {this.state.error.message || 'Unknown error'}
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>
            รีโหลดหน้า
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}


