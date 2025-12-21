import type { SignatureBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

export function SignatureBlockView({ block, ctx }: { block: SignatureBlock; ctx: BlockViewContext }) {
  // Quotation / Tax invoice full: 3-column signature + stamp box like sample
  if (ctx.dto.docType === 'quotation' || ctx.dto.docType === 'receipt_full') {
    const bottomEnabled = block.props.bottomBarEnabled ?? true
    const bottomColor = block.props.bottomBarColor ?? '#111111'
    const bottomHeight = block.props.bottomBarHeightPx ?? 10
    return (
      <div className="overflow-hidden rounded border border-slate-900 bg-white text-[11px]">
        <div className="grid grid-cols-3">
          <div className="border-r border-slate-900 p-3 text-center">
            <div className="text-slate-900 fw-semibold">{block.props.leftLabel}</div>
            <div className="mt-5" style={{ borderTop: '1px dashed #111' }} />
            <div className="mt-1 text-slate-600">วันที่ / Date</div>
            <div className="mt-3" style={{ borderTop: '1px dashed #111' }} />
          </div>
          <div className="border-r border-slate-900 p-3 text-center">
            <div className="text-slate-400 fw-semibold">ตราประทับบริษัท</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-slate-900 fw-semibold">{block.props.rightLabel}</div>
            <div className="mt-5" style={{ borderTop: '1px dashed #111' }} />
            <div className="mt-1 text-slate-600">วันที่ / Date</div>
            <div className="mt-3" style={{ borderTop: '1px dashed #111' }} />
          </div>
        </div>
        {bottomEnabled ? <div style={{ backgroundColor: bottomColor, height: bottomHeight }} /> : null}
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
        <div className="text-slate-700">{block.props.leftLabel}</div>
        <div className="mt-8 border-t border-slate-400 pt-1 text-center text-slate-600">Signature</div>
      </div>
      <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
        <div className="text-slate-700">{block.props.rightLabel}</div>
        <div className="mt-8 border-t border-slate-400 pt-1 text-center text-slate-600">Signature</div>
      </div>
    </div>
  )
}


