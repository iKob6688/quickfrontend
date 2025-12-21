import type { TitleBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

export function TitleBlockView({ block, ctx }: { block: TitleBlock; ctx: BlockViewContext }) {
  const barColor = ctx.theme.headerBarColor
  const docNo = ctx.dto.document.number

  // Quotation sample: title + original + doc no are right-aligned in a boxed area.
  if (ctx.dto.docType === 'quotation') {
    return (
      <div className="flex justify-end">
        <div className="w-[360px] overflow-hidden rounded border border-slate-900">
          <div className="px-3 py-2 text-white" style={{ backgroundColor: barColor }}>
            <div className="text-base font-semibold leading-tight">
              {block.props.titleEn}
            </div>
            {block.props.titleTh ? <div className="text-sm font-medium">{block.props.titleTh}</div> : null}
          </div>
          <div className="grid grid-cols-2 border-t border-slate-900">
            <div className="border-r border-slate-900 px-2 py-1 text-center text-[11px] font-semibold">
              {block.props.subtitleRight || 'ต้นฉบับ / Original'}
            </div>
            <div className="px-2 py-1 text-center text-[11px] font-semibold">
              {docNo}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Default title bar
  return (
    <div className="overflow-hidden rounded border border-slate-200">
      <div className="flex items-center justify-between px-3 py-2 text-white" style={{ backgroundColor: barColor }}>
        <div className="text-sm font-bold tracking-wide">
          {block.props.titleEn}
          {block.props.titleTh ? <span className="ml-2 font-medium">/ {block.props.titleTh}</span> : null}
        </div>
        {block.props.showOriginalBadge !== false ? (
          <div className="rounded bg-white/20 px-2 py-0.5 text-xs">{block.props.subtitleRight || 'Original'}</div>
        ) : null}
      </div>
      <div className="px-3 py-2 text-[11px] text-slate-600">
        {ctx.dto.document.reference ? <span>Ref: {ctx.dto.document.reference}</span> : <span>&nbsp;</span>}
      </div>
    </div>
  )
}


