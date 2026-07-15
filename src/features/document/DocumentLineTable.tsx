import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'

export type DocumentLineTableProps<T> = {
  title: string
  description?: string
  rows: T[]
  columns: Column<T>[]
  empty?: ReactNode
  addLabel?: string
  onAdd?: () => void
  footer?: ReactNode
  className?: string
}

export function DocumentLineTable<T>({
  title,
  description,
  rows,
  columns,
  empty,
  addLabel = '+ เพิ่มรายการ',
  onAdd,
  footer,
  className,
}: DocumentLineTableProps<T>) {
  return (
    <div className={className ? `qf-document-lines ${className}` : 'qf-document-lines'}>
      <div className="qf-document-lines__head">
        <div>
          <div className="qf-section-title mb-1">{title}</div>
          {description ? <div className="small text-muted">{description}</div> : null}
        </div>
        {onAdd ? (
          <Button size="sm" type="button" onClick={onAdd}>
            {addLabel}
          </Button>
        ) : null}
      </div>
      <DataTable plain allowMenuOverflow columns={columns} rows={rows} empty={empty} className="qf-document-lines__table" />
      {footer ? <div className="qf-document-lines__footer">{footer}</div> : null}
    </div>
  )
}
