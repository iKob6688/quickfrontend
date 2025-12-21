import type { ItemsTableBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'
import { formatTHB } from './shared'

export function ItemsTableBlockView({ block, ctx }: { block: ItemsTableBlock; ctx: BlockViewContext }) {
  const currency = block.props.currency || ctx.dto.totals.currency || 'THB'
  const headerBg = ctx.theme.tableHeaderBgColor

  // Tax invoice short: thermal-like list
  if (ctx.dto.docType === 'receipt_short') {
    const items = ctx.dto.items
    return (
      <div className="border border-slate-900 bg-white p-2 text-[12px]" style={{ fontFamily: ctx.theme.fontFamily }}>
        <div className="border-b border-slate-900 pb-1 font-semibold">
          รายการ
          <span className="float-end">จำนวนเงิน</span>
        </div>
        <div className="pt-1">
          {items.map((it) => (
            <div key={it.no} className="py-1">
              <div className="d-flex justify-content-between">
                <div className="me-2">
                  {it.qty} {it.description}
                </div>
                <div className="text-end" style={{ minWidth: 90 }}>
                  {formatTHB(it.amount, currency)}
                </div>
              </div>
            </div>
          ))}
          {!items.length ? <div className="text-muted">-</div> : null}
        </div>
      </div>
    )
  }

  // TRF fixed format rows
  if (ctx.dto.docType === 'trf_receipt') {
    const fr = ctx.dto.fixedRows
    const rows = [
      { label: 'Transportation', amount: fr.transportation },
      { label: 'Gate Charge (Advanced)', amount: fr.gateChargeAdvanced },
      { label: 'Return Container (Advanced)', amount: fr.returnContainerAdvanced },
    ]
    return (
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full text-[11px]">
          <thead style={{ backgroundColor: headerBg }}>
            <tr className="text-white">
              <th className="px-2 py-2 text-left font-semibold">Description</th>
              <th className="px-2 py-2 text-right font-semibold">Amount (BAHT)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-slate-200">
                <td className="px-2 py-2">{r.label}</td>
                <td className="px-2 py-2 text-right font-medium">{formatTHB(r.amount, currency)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-300">
              <td className="px-2 py-2 text-right font-semibold">Total</td>
              <td className="px-2 py-2 text-right font-semibold">{formatTHB(ctx.dto.totals.total, currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  const items = ctx.dto.items
  const compact = !!block.props.compact
  const showDiscount = block.props.showDiscount !== false
  const showUnit = block.props.showUnit !== false

  return (
    <div className="overflow-hidden rounded border border-slate-900 bg-white">
      <table className="w-full text-[11px]">
        <thead style={{ backgroundColor: headerBg }}>
          <tr className="text-white">
            <th className="w-10 px-2 py-2 text-center font-semibold">เลขที่<br/><span className="text-[10px] font-normal">No.</span></th>
            <th className="px-2 py-2 text-center font-semibold">รายการ<br/><span className="text-[10px] font-normal">Description</span></th>
            <th className="w-20 px-2 py-2 text-center font-semibold">จำนวน<br/><span className="text-[10px] font-normal">Quantity</span></th>
            <th className="w-28 px-2 py-2 text-center font-semibold">ราคา/หน่วย<br/><span className="text-[10px] font-normal">Unit Price</span></th>
            {showDiscount ? <th className="w-24 px-2 py-2 text-center font-semibold">ส่วนลด<br/><span className="text-[10px] font-normal">Discount</span></th> : null}
            <th className="w-32 px-2 py-2 text-center font-semibold">จำนวนเงิน (THB)<br/><span className="text-[10px] font-normal">Amount</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.no} className="border-t border-slate-900 align-top">
              <td className="px-2 py-2 text-center">{it.no}</td>
              <td className="px-2 py-2">
                <div className={compact ? 'line-clamp-2' : ''}>{it.description}</div>
              </td>
              <td className="px-2 py-2 text-center">
                {it.qty}
                {showUnit && it.unit ? <span className="text-slate-600"> {it.unit}</span> : null}
              </td>
              <td className="px-2 py-2 text-end">{formatTHB(it.unitPrice, currency)}</td>
              {showDiscount ? <td className="px-2 py-2 text-end">{formatTHB(it.discount, currency)}</td> : null}
              <td className="px-2 py-2 text-end font-semibold">{formatTHB(it.amount, currency)}</td>
            </tr>
          ))}
          {!items.length ? (
            <tr className="border-t border-slate-900">
              <td colSpan={showDiscount ? 6 : 5} className="px-2 py-6 text-center text-slate-500">
                No items
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}


