import type { CustomerInfoBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

export function CustomerInfoBlockView({ block, ctx }: { block: CustomerInfoBlock; ctx: BlockViewContext }) {
  const p = ctx.dto.partner
  const label = block.props.label || 'Customer'

  // Quotation/Tax invoice: boxed layout with bilingual labels
  if (ctx.dto.docType === 'quotation' || ctx.dto.docType === 'receipt_full') {
    const address = block.props.showAddress && p.addressLines?.length ? p.addressLines.join(' ') : ''
    return (
      <div className="overflow-hidden rounded border border-slate-900 bg-white text-[11px]">
        <div className="border-b border-slate-900 px-2 py-1 text-xs font-semibold">{label}</div>
        <div className="grid grid-cols-[180px_1fr] border-b border-slate-900">
          <div className="border-r border-slate-900 px-2 py-2">
            <div className="font-semibold">ชื่อลูกค้า</div>
            <div className="text-[10px] text-slate-600">Customer Name</div>
          </div>
          <div className="px-2 py-2 font-medium">{p.name || '-'}</div>
        </div>
        <div className="grid grid-cols-[180px_1fr] border-b border-slate-900">
          <div className="border-r border-slate-900 px-2 py-2">
            <div className="font-semibold">เลขที่ผู้เสียภาษี</div>
            <div className="text-[10px] text-slate-600">Tax ID</div>
          </div>
          <div className="px-2 py-2 font-medium">{block.props.showTaxId ? (p.taxId || '-') : '-'}</div>
        </div>
        <div className="grid grid-cols-[180px_1fr]">
          <div className="border-r border-slate-900 px-2 py-2">
            <div className="font-semibold">ที่อยู่</div>
            <div className="text-[10px] text-slate-600">Address</div>
          </div>
          <div className="px-2 py-2 font-medium">{address || '-'}</div>
        </div>
      </div>
    )
  }

  // Default (other docs)
  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
      <div className="mb-1 text-xs font-semibold text-slate-900">{label}</div>
      <div className="font-semibold text-slate-900">{p.name}</div>
      {block.props.showAddress && p.addressLines?.length ? (
        <div className="mt-1 space-y-0.5 text-slate-700">
          {p.addressLines.map((l, idx) => (
            <div key={idx}>{l}</div>
          ))}
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-700">
        {block.props.showTaxId && p.taxId ? <div>Tax ID: {p.taxId}</div> : null}
        {block.props.showTel && p.tel ? <div>Tel: {p.tel}</div> : null}
      </div>
    </div>
  )
}


