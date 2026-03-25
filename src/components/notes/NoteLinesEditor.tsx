import { ProductCombobox } from '@/features/sales/ProductCombobox'
import { Button } from '@/components/ui/Button'

export type NoteLineInput = {
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  taxRate?: number
}

export function NoteLinesEditor({
  lines,
  setLines,
}: {
  lines: NoteLineInput[]
  setLines: (next: NoteLineInput[]) => void
}) {
  return (
    <div>
      <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
        <div className="small text-muted">เพิ่มรายการ (Odoo จะคำนวณยอด/ภาษี/รวมทั้งหมดหลังบันทึก)</div>
        <Button
          size="sm"
          type="button"
          onClick={() =>
            setLines([
              ...lines,
              {
                productId: null,
                description: '',
                quantity: 1,
                unitPrice: 0,
                taxRate: 0,
              },
            ])
          }
        >
          <i className="bi bi-plus-lg me-1" />
          เพิ่มรายการ
        </Button>
      </div>

      {lines.length === 0 ? (
        <div className="alert alert-warning small mb-0">กรุณาเพิ่มอย่างน้อย 1 รายการ</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0" style={{ tableLayout: 'fixed', minWidth: 980 }}>
            <thead className="table-light">
              <tr className="text-muted small fw-semibold">
                <th style={{ width: 240, whiteSpace: 'nowrap' }}>สินค้า/บริการ</th>
                <th style={{ width: 260, whiteSpace: 'nowrap' }}>รายละเอียด</th>
                <th style={{ width: 110 }} className="text-end">
                  จำนวน
                </th>
                <th style={{ width: 140 }} className="text-end">
                  ราคาต่อหน่วย
                </th>
                <th style={{ width: 110 }} className="text-end">
                  VAT%
                </th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td>
                    <ProductCombobox
                      valueId={line.productId ?? null}
                      onPick={(p) => {
                        const next = [...lines]
                        const prev = next[idx]
                        const pickedTaxRate =
                          Array.isArray(p.taxes) && p.taxes.length ? Number(p.taxes[0]?.amount || 0) : prev.taxRate ?? 0
                        next[idx] = {
                          ...prev,
                          productId: p.id,
                          description: (prev.description || '').trim() ? prev.description : p.name,
                          taxRate: Number.isFinite(pickedTaxRate) ? pickedTaxRate : 0,
                        }
                        setLines(next)
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="form-control form-control-sm"
                      value={line.description || ''}
                      onChange={(e) => {
                        const next = [...lines]
                        next[idx] = { ...next[idx], description: e.target.value }
                        setLines(next)
                      }}
                      placeholder="เช่น ค่าบริการ / สินค้า"
                    />
                  </td>
                  <td className="text-end">
                    <input
                      className="form-control form-control-sm text-end"
                      type="number"
                      value={line.quantity ?? 1}
                      onChange={(e) => {
                        const next = [...lines]
                        next[idx] = { ...next[idx], quantity: Number.parseFloat(e.target.value || '0') }
                        setLines(next)
                      }}
                      min={0}
                      step="0.01"
                    />
                  </td>
                  <td className="text-end">
                    <input
                      className="form-control form-control-sm text-end"
                      type="number"
                      value={line.unitPrice ?? 0}
                      onChange={(e) => {
                        const next = [...lines]
                        next[idx] = { ...next[idx], unitPrice: Number.parseFloat(e.target.value || '0') }
                        setLines(next)
                      }}
                      min={0}
                      step="0.01"
                    />
                  </td>
                  <td className="text-end">
                    <input
                      className="form-control form-control-sm text-end"
                      type="number"
                      value={line.taxRate ?? 0}
                      onChange={(e) => {
                        const next = [...lines]
                        next[idx] = { ...next[idx], taxRate: Number.parseFloat(e.target.value || '0') }
                        setLines(next)
                      }}
                      min={0}
                      step="0.01"
                    />
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => {
                        const ok = window.confirm('ยืนยันการลบรายการนี้?')
                        if (!ok) return
                        const next = [...lines]
                        next.splice(idx, 1)
                        setLines(next)
                      }}
                      title="ลบรายการ"
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

