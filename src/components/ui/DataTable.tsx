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
  rowKey?: (row: T, index: number) => string | number
  rowClassName?: (row: T, index: number) => string | undefined
  /** When true, renders table without the Card wrapper (useful when you already are inside a Card) */
  plain?: boolean
  /** Allow dropdown menus (e.g. combobox in cells) to overflow vertically */
  allowMenuOverflow?: boolean
}) {
  const { title, right, columns, rows, empty, className, rowKey, rowClassName, plain, allowMenuOverflow } = props

  const content = (
    <>
      {(title || right) && (
        <div className="qf-table-head d-flex align-items-center justify-content-between gap-3 border-bottom px-4 py-3">
          <div className="qf-section-title fw-semibold">{title}</div>
          {right ? <div className="d-flex align-items-center gap-2">{right}</div> : null}
        </div>
      )}

      <div className={twMerge('table-responsive qf-data-table-desktop', allowMenuOverflow && 'qf-table-responsive-menu')}>
        <Table hover bordered className="qf-table mb-0">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={twMerge('qf-th', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="qf-empty text-center text-muted py-5">
                  {empty ?? 'ไม่มีข้อมูล'}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={rowKey ? rowKey(row, idx) : idx} className={rowClassName?.(row, idx)}>
                  {columns.map((c) => (
                    <td key={c.key} className={twMerge('qf-td', c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <div className="qf-data-table-mobile" aria-label={typeof title === 'string' ? title : 'รายการข้อมูล'}>
        {rows.length === 0 ? (
          <div className="qf-data-table-mobile__empty text-center text-muted">
            {empty ?? 'ไม่มีข้อมูล'}
          </div>
        ) : (
          <div className="qf-data-table-mobile__list">
            {rows.map((row, idx) => {
              const key = rowKey ? rowKey(row, idx) : idx
              const [primaryColumn, ...secondaryColumns] = columns
              return (
                <article key={key} className={twMerge('qf-data-table-mobile__card', rowClassName?.(row, idx))}>
                  {primaryColumn ? (
                    <div className="qf-data-table-mobile__primary">
                      <div className="qf-data-table-mobile__primary-label">{primaryColumn.header}</div>
                      <div className={twMerge('qf-data-table-mobile__primary-value', primaryColumn.className)}>
                        {primaryColumn.cell(row)}
                      </div>
                    </div>
                  ) : null}
                  {secondaryColumns.length > 0 ? (
                    <div className="qf-data-table-mobile__fields">
                      {secondaryColumns.map((column) => (
                        <div
                          key={column.key}
                          className={twMerge(
                            'qf-data-table-mobile__field',
                            column.key === 'actions' && 'qf-data-table-mobile__field--actions',
                          )}
                        >
                          <div className="qf-data-table-mobile__label">{column.header}</div>
                          <div className={twMerge('qf-data-table-mobile__value', column.className)}>
                            {column.cell(row)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </>
  )

  if (plain) return <div className={className}>{content}</div>

  return <Card className={twMerge('overflow-hidden', className)}>{content}</Card>
}
