import type { SummaryTotalsBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'
import { formatTHB } from './shared'

export function SummaryTotalsBlockView({ block, ctx }: { block: SummaryTotalsBlock; ctx: BlockViewContext }) {
  const t = ctx.dto.totals
  const currency = t.currency || 'THB'
  const showDiscount = block.props.showDiscount !== false
  const showVat = block.props.showVat !== false && typeof t.vat === 'number'

  // Receipt short: compact one-column total
  if (ctx.dto.docType === 'receipt_short') {
    return (
      <div className="border border-slate-900 bg-white p-2 text-[12px]" style={{ fontFamily: ctx.theme.fontFamily }}>
        <div className="d-flex justify-content-between">
          <div className="fw-semibold">รวมทั้งสิ้น</div>
          <div className="fw-semibold">{formatTHB(t.total, currency)}</div>
        </div>
      </div>
    )
  }

  const rows: Array<{ label: string; value: number }> = [
    { label: 'Subtotal', value: t.subtotal },
    ...(showDiscount ? [{ label: 'Discount', value: t.discount }] : []),
    { label: 'After discount', value: t.afterDiscount },
    ...(showVat ? [{ label: 'VAT', value: t.vat! }] : []),
    { label: 'Total', value: t.total },
  ]

  // Quotation/Tax Invoice full: boxed right totals with bold total row
  const isInvoiceLike = ctx.dto.docType === 'quotation' || ctx.dto.docType === 'receipt_full'
  if (isInvoiceLike) {
    const totalBg = ctx.theme.totalsBarBgColor || '#111111'
    const totalText = ctx.theme.totalsBarTextColor || '#ffffff'
    return (
      <div className="ms-auto w-100" style={{ maxWidth: 320 }}>
        <table className="w-full text-[11px] border border-slate-900 bg-white">
          <tbody>
            <tr className="border-b border-slate-900">
              <td className="px-2 py-2">
                <div className="fw-semibold">รวมเป็นเงิน</div>
                <div className="text-[10px] text-slate-600">Subtotal</div>
              </td>
              <td className="px-2 py-2 text-end fw-semibold">{formatTHB(t.subtotal, currency)}</td>
            </tr>
            {showDiscount ? (
              <tr className="border-b border-slate-900">
                <td className="px-2 py-2">
                  <div className="fw-semibold">หักส่วนลดพิเศษ</div>
                  <div className="text-[10px] text-slate-600">Special Discount</div>
                </td>
                <td className="px-2 py-2 text-end fw-semibold">{formatTHB(t.discount, currency)}</td>
              </tr>
            ) : null}
            <tr className="border-b border-slate-900">
              <td className="px-2 py-2">
                <div className="fw-semibold">ยอดรวมหลังหักส่วนลด</div>
                <div className="text-[10px] text-slate-600">After Discount</div>
              </td>
              <td className="px-2 py-2 text-end fw-semibold">{formatTHB(t.afterDiscount, currency)}</td>
            </tr>
            {showVat ? (
              <tr className="border-b border-slate-900">
                <td className="px-2 py-2">
                  <div className="fw-semibold">ภาษีมูลค่าเพิ่ม</div>
                  <div className="text-[10px] text-slate-600">VAT</div>
                </td>
                <td className="px-2 py-2 text-end fw-semibold">{formatTHB(t.vat!, currency)}</td>
              </tr>
            ) : null}
            <tr style={{ backgroundColor: totalBg, color: totalText }}>
              <td className="px-2 py-2">
                <div className="fw-semibold">จำนวนเงินรวมทั้งสิ้น</div>
                <div className="text-[10px]" style={{ color: totalText, opacity: 0.85 }}>
                  Total
                </div>
              </td>
              <td className="px-2 py-2 text-end fw-semibold">{formatTHB(t.total, currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  // Fallback
  return (
    <div className="ml-auto w-full max-w-sm rounded border border-slate-200 bg-white p-3 text-[11px]">
      <div className="grid gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-2">
            <div className={r.label === 'Total' ? 'font-semibold text-slate-900' : 'text-slate-600'}>{r.label}</div>
            <div className={r.label === 'Total' ? 'font-semibold text-slate-900' : 'font-medium text-slate-900'}>
              {formatTHB(r.value, currency)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


