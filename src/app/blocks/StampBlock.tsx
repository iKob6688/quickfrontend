import type { StampBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

export function StampBlockView({ block, ctx }: { block: StampBlock; ctx: BlockViewContext }) {
  if (!block.props.enabled) return null
  const stamp = ctx.branding.stampBase64
  return (
    <div className="flex items-start justify-end">
      <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
        <div className="text-xs font-semibold text-slate-900">{block.props.label || 'Stamp'}</div>
        <div className="mt-2 h-24 w-24 overflow-hidden rounded border border-dashed border-slate-300 bg-slate-50">
          {stamp ? <img src={stamp} alt="Stamp" className="h-full w-full object-contain" /> : null}
        </div>
      </div>
    </div>
  )
}


