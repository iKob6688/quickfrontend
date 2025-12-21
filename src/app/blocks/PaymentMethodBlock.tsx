import type { PaymentMethodBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

function CheckboxLine({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-3.5 w-3.5 rounded-sm border border-slate-400"
        style={{ backgroundColor: checked ? '#111827' : 'transparent' }}
      />
      <div className="text-slate-700">{label}</div>
    </div>
  )
}

export function PaymentMethodBlockView({ block, ctx }: { block: PaymentMethodBlock; ctx: BlockViewContext }) {
  const payment = (ctx.dto as any).payment as
    | { method: 'cash' | 'transfer' | 'cheque' | 'other'; bank?: string; chequeNo?: string; date?: string }
    | undefined

  const method = payment?.method

  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
      <div className="mb-2 text-xs font-semibold text-slate-900">Payment Method</div>

      {block.props.style === 'checkboxes' ? (
        <div className="grid gap-1">
          <CheckboxLine checked={method === 'cash'} label="Cash" />
          <CheckboxLine checked={method === 'transfer'} label="Transfer" />
          <CheckboxLine checked={method === 'cheque'} label="Cheque" />
          <CheckboxLine checked={method === 'other'} label="Other" />
        </div>
      ) : (
        <div className="text-slate-700">Method: {method || '-'}</div>
      )}

      <div className="mt-2 grid gap-1 text-slate-700">
        {block.props.showBank ? (
          <div className="flex justify-between gap-2">
            <div className="text-slate-600">Bank</div>
            <div className="font-medium text-slate-900">{payment?.bank || '-'}</div>
          </div>
        ) : null}
        {block.props.showChequeNo ? (
          <div className="flex justify-between gap-2">
            <div className="text-slate-600">Cheque No.</div>
            <div className="font-medium text-slate-900">{payment?.chequeNo || '-'}</div>
          </div>
        ) : null}
        {block.props.showDate ? (
          <div className="flex justify-between gap-2">
            <div className="text-slate-600">Date</div>
            <div className="font-medium text-slate-900">{payment?.date || ctx.dto.document.date || '-'}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}


