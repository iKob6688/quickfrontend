import type { ReactNode } from 'react'
import { Table } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'
import { Card } from '@/components/ui/Card'

export interface Column<T> {
  key: string
  header: ReactNode
  className?: string
  cell: (row: T) => ReactNode
}

export function DataTable<T>(props: {
  title?: ReactNode
  right?: ReactNode
  columns: Column<T>[]
  rows: T[]
  empty?: ReactNode
  className?: string
}) {
  const { title, right, columns, rows, empty, className } = props

  return (
    <Card className={twMerge('overflow-hidden', className)}>
      {(title || right) && (
        <div className="d-flex align-items-center justify-content-between gap-3 border-bottom px-4 py-3">
          <div className="fw-semibold">{title}</div>
          {right ? <div className="d-flex align-items-center gap-2">{right}</div> : null}
        </div>
      )}

      <div className="table-responsive">
        <Table hover className="mb-0">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={twMerge(
                    'text-nowrap text-start small text-uppercase fw-semibold text-muted',
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center text-muted py-5"
                >
                  {empty ?? 'ไม่มีข้อมูล'}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={twMerge('text-nowrap', c.className)}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </Card>
  )
}


