import { useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { DocType } from '@/app/core/types/dto'
import type { AnyBlock } from '@/app/core/types/template'
import { cn } from '@/app/lib/utils'

type PaletteItem = { type: AnyBlock['type']; label: string; forDocTypes: DocType[] }

const palette: PaletteItem[] = [
  { type: 'header', label: 'Header', forDocTypes: ['quotation', 'receipt_full', 'receipt_short', 'trf_receipt'] },
  { type: 'title', label: 'Title', forDocTypes: ['quotation', 'receipt_full', 'receipt_short', 'trf_receipt'] },
  { type: 'customerInfo', label: 'Customer Info', forDocTypes: ['quotation', 'receipt_full', 'receipt_short'] },
  { type: 'docMeta', label: 'Doc Meta', forDocTypes: ['quotation', 'receipt_full', 'receipt_short', 'trf_receipt'] },
  { type: 'itemsTable', label: 'Items / Fixed Rows', forDocTypes: ['quotation', 'receipt_full', 'receipt_short', 'trf_receipt'] },
  { type: 'summaryTotals', label: 'Summary Totals', forDocTypes: ['quotation', 'receipt_full', 'receipt_short'] },
  { type: 'amountInWords', label: 'Amount in Words', forDocTypes: ['quotation', 'receipt_full', 'trf_receipt'] },
  { type: 'paymentMethod', label: 'Payment Method', forDocTypes: ['receipt_full', 'receipt_short', 'trf_receipt'] },
  { type: 'journalItems', label: 'Journal Items', forDocTypes: ['trf_receipt'] },
  { type: 'signature', label: 'Signatures', forDocTypes: ['quotation', 'receipt_full', 'receipt_short', 'trf_receipt'] },
  { type: 'stamp', label: 'Stamp', forDocTypes: ['quotation', 'receipt_full'] },
  { type: 'notes', label: 'Notes', forDocTypes: ['quotation', 'receipt_full'] },
]

function PaletteDragItem({ item }: { item: PaletteItem }) {
  const id = `palette:${item.type}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { from: 'palette', blockType: item.type },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm hover:bg-slate-50 active:cursor-grabbing',
        isDragging && 'opacity-60',
      )}
    >
      {item.label}
      <div className="mt-0.5 text-xs text-slate-500">Drag to canvas</div>
    </div>
  )
}

export function BlockPalette({ docType }: { docType: DocType }) {
  const items = useMemo(() => palette.filter((p) => p.forDocTypes.includes(docType)), [docType])

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-900">Block Palette</div>
      <div className="text-xs text-slate-500">Drag blocks onto the A4 canvas. Reorder to change layout.</div>
      <div className="grid gap-2">
        {items.map((it) => (
          <PaletteDragItem key={it.type} item={it} />
        ))}
      </div>
    </div>
  )
}


