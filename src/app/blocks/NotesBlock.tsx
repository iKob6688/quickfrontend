import type { NotesBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

export function NotesBlockView({ block }: { block: NotesBlock; ctx: BlockViewContext }) {
  if (!block.props.text) return null
  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
      <div className="text-xs font-semibold text-slate-900">Notes</div>
      <div className="mt-1 whitespace-pre-wrap text-slate-700">{block.props.text}</div>
    </div>
  )
}


