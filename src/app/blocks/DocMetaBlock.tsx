import type { DocMetaBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

const labelMap: Record<string, string> = {
  number: 'Document No.',
  date: 'Date',
  reference: 'Reference',
  salesperson: 'Salesperson',
  creditTerm: 'Credit Term',
  contact: 'Contact',
  project: 'Project',
}

export function DocMetaBlockView({ block, ctx }: { block: DocMetaBlock; ctx: BlockViewContext }) {
  const d = ctx.dto.document

  // Quotation sample: right-side meta box with grid, plus a Salesman area.
  if (ctx.dto.docType === 'quotation') {
    const issueDate = d.date || '-'
    const creditTerm = d.creditTerm || '-'
    const contactName = d.contact || '-'
    const projectName = d.project || '-'
    const salesman = d.salesperson || '-'

    return (
      <div className="overflow-hidden rounded border border-slate-900 bg-white text-[11px]">
        <div className="grid grid-cols-[1fr_180px] border-b border-slate-900">
          <div className="px-2 py-2">
            <div className="d-flex justify-content-between">
              <div>
                <div className="font-semibold">วันที่</div>
                <div className="text-[10px] text-slate-600">Issue Date</div>
              </div>
              <div className="font-medium">{issueDate}</div>
            </div>
            <div className="d-flex justify-content-between mt-2">
              <div>
                <div className="font-semibold">การชำระเงิน</div>
                <div className="text-[10px] text-slate-600">Credit Term</div>
              </div>
              <div className="font-medium">{creditTerm}</div>
            </div>
            <div className="d-flex justify-content-between mt-2">
              <div>
                <div className="font-semibold">ผู้ติดต่อ</div>
                <div className="text-[10px] text-slate-600">Contact Name</div>
              </div>
              <div className="font-medium">{contactName}</div>
            </div>
            <div className="d-flex justify-content-between mt-2">
              <div>
                <div className="font-semibold">ชื่อโปรเจคต์</div>
                <div className="text-[10px] text-slate-600">Project Name</div>
              </div>
              <div className="font-medium">{projectName}</div>
            </div>
          </div>
          <div className="border-l border-slate-900 px-2 py-2">
            <div className="font-semibold">พนักงานขาย</div>
            <div className="text-[10px] text-slate-600">Salesman</div>
            <div className="mt-2 font-medium">{salesman}</div>
          </div>
        </div>
        {d.reference ? (
          <div className="px-2 py-2">
            <span className="text-slate-600">Ref:</span> <span className="font-medium">{d.reference}</span>
          </div>
        ) : null}
      </div>
    )
  }

  const rows = block.props.fields.map((f) => {
    const value =
      f === 'number'
        ? d.number
        : f === 'date'
          ? d.date
          : f === 'reference'
            ? d.reference
            : f === 'salesperson'
              ? d.salesperson
              : f === 'creditTerm'
                ? d.creditTerm
                : f === 'contact'
                  ? d.contact
                  : f === 'project'
                    ? d.project
                    : undefined
    return { key: f, label: labelMap[f] || f, value }
  })

  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-[11px]">
      <div className="mb-1 text-xs font-semibold text-slate-900">Document</div>
      <div className="grid gap-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-start justify-between gap-2">
            <div className="text-slate-600">{r.label}</div>
            <div className="text-right font-medium text-slate-900">{r.value || '-'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


