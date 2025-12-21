import type { JournalItemsBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'
import { formatTHB } from './shared'

export function JournalItemsBlockView({ block, ctx }: { block: JournalItemsBlock; ctx: BlockViewContext }) {
  const title = block.props.title || 'Journal Items'
  const currency = ctx.dto.totals.currency || 'THB'
  const journalItems = (ctx.dto as any).journalItems as
    | Array<{
        accountCode: string
        accountName: string
        label: string
        partnerName?: string
        debit: number
        credit: number
      }>
    | undefined

  if (!journalItems?.length) {
    return (
      <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
        <div className="text-xs font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-slate-500">No journal items</div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white">
      <div className="px-3 py-2 text-xs font-semibold text-slate-900">{title}</div>
      <table className="w-full text-[11px]">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-2 py-2 text-left font-semibold text-slate-700">Account</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-700">Label</th>
            <th className="px-2 py-2 text-right font-semibold text-slate-700">Debit</th>
            <th className="px-2 py-2 text-right font-semibold text-slate-700">Credit</th>
          </tr>
        </thead>
        <tbody>
          {journalItems.map((j, idx) => (
            <tr key={idx} className="border-t border-slate-200">
              <td className="px-2 py-2">
                <div className="font-medium text-slate-900">
                  {j.accountCode} {j.accountName}
                </div>
                {j.partnerName ? <div className="text-slate-500">{j.partnerName}</div> : null}
              </td>
              <td className="px-2 py-2">{j.label}</td>
              <td className="px-2 py-2 text-right">{formatTHB(j.debit, currency)}</td>
              <td className="px-2 py-2 text-right">{formatTHB(j.credit, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


