import type { AmountInWordsBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

export function AmountInWordsBlockView({ block, ctx }: { block: AmountInWordsBlock; ctx: BlockViewContext }) {
  // Quotation / Tax invoice full: light bar like sample
  if (ctx.dto.docType === 'quotation' || ctx.dto.docType === 'receipt_full') {
    return (
      <div className="border border-slate-900 bg-slate-100 px-2 py-2 text-[11px]">
        <div className="d-flex gap-2">
          <div className="fw-semibold">{block.props.label || 'จำนวนเงิน (ตัวอักษร) / Amount'}</div>
          <div className="ms-auto fw-semibold text-center flex-grow-1">{ctx.dto.totals.amountText || '-'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
      <div className="text-xs font-semibold text-slate-900">{block.props.label || 'Amount in words'}</div>
      <div className="mt-1 text-slate-700">{ctx.dto.totals.amountText || '-'}</div>
    </div>
  )
}


