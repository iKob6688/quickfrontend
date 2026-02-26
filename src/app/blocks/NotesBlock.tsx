import type { NotesBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

export function NotesBlockView({ block, ctx }: { block: NotesBlock; ctx: BlockViewContext }) {
  const text = block.props.text || (ctx.dto.document as any).notes || ''
  if (!text) return null
  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
      <div className="text-xs font-semibold text-slate-900">Notes</div>
      <div className="mt-1 whitespace-pre-wrap text-slate-700">{text}</div>
    </div>
  )
}

