import { Card } from '@/components/ui/Card'

type TableRow = Record<string, string | number>

const shortText = (value: string, max = 80): string => {
  const v = value.trim()
  if (v.length <= max) return v
  return `${v.slice(0, max)}...`
}

const conciseObject = (obj: Record<string, unknown>): string => {
  const name = (obj.name ?? obj.display_name ?? obj.moveName ?? obj.move_name ?? obj.ref ?? obj.code) as string | undefined
  const date = (obj.date ?? obj.date_maturity) as string | undefined
  const debit = obj.debit
  const credit = obj.credit
  const amount = obj.amount ?? obj.amount_currency
  const parts: string[] = []
  if (typeof name === 'string' && name.trim()) parts.push(name.trim())
  if (typeof date === 'string' && date.trim()) parts.push(date.trim())
  if (debit != null || credit != null) parts.push(`Dr ${Number(debit ?? 0).toLocaleString('en-US')} / Cr ${Number(credit ?? 0).toLocaleString('en-US')}`)
  else if (amount != null) parts.push(Number(amount).toLocaleString('en-US'))
  if (!parts.length && typeof obj.id === 'number') parts.push(`#${obj.id}`)
  return shortText(parts.join(' · ') || 'ข้อมูล', 110)
}

const toPrimitive = (value: unknown): string | number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value == null) return ''
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[1] === 'string') return value[1]
    if (!value.length) return ''
    if (value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
      const first = value[0] as Record<string, unknown>
      return `${value.length} รายการ · ${conciseObject(first)}`
    }
    return shortText(value.map((v) => (typeof v === 'object' ? conciseObject(v as Record<string, unknown>) : String(v))).join(', '), 110)
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.name === 'string') return o.name
    if (typeof o.display_name === 'string') return o.display_name
    return conciseObject(o)
  }
  return String(value)
}

const flattenObject = (obj: Record<string, unknown>): TableRow => {
  const row: TableRow = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>
      const nestedKeys = Object.keys(nested)
      if (nestedKeys.length > 5) {
        row[key] = conciseObject(nested)
        continue
      }
      let nestedCount = 0
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        row[`${key}.${nestedKey}`] = toPrimitive(nestedValue)
        nestedCount += 1
        if (nestedCount >= 5) break
      }
      continue
    }
    row[key] = toPrimitive(value)
  }
  return row
}

const toRows = (reportData: unknown): TableRow[] => {
  if (!reportData) return []
  const rows: TableRow[] = []
  if (Array.isArray(reportData)) {
    for (const item of reportData) {
      if (item && typeof item === 'object' && !Array.isArray(item)) rows.push(flattenObject(item as Record<string, unknown>))
      else rows.push({ value: toPrimitive(item) })
    }
    return rows
  }
  if (typeof reportData !== 'object') return [{ value: toPrimitive(reportData) }]

  for (const [section, value] of Object.entries(reportData as Record<string, unknown>)) {
    if (section === 'analyticIds' || section === 'accountTotals' || section === 'moveLinesTotal') {
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && !Array.isArray(item)) rows.push({ section, ...flattenObject(item as Record<string, unknown>) })
        else rows.push({ section, value: toPrimitive(item) })
      }
      continue
    }
    if (value && typeof value === 'object') {
      const o = value as Record<string, unknown>
      const entries = Array.isArray(o.entries) ? o.entries : Array.isArray(o.items) ? o.items : null
      if (entries) {
        for (const item of entries) {
          if (item && typeof item === 'object' && !Array.isArray(item)) rows.push({ section, ...flattenObject(item as Record<string, unknown>) })
          else rows.push({ section, value: toPrimitive(item) })
        }
        continue
      }
      rows.push({ section, ...flattenObject(o) })
      continue
    }
    rows.push({ section, value: toPrimitive(value) })
  }
  return rows
}

export function ReportDataTable(props: { title: string; reportData: unknown; loading?: boolean }) {
  const rows = toRows(props.reportData)
  if (props.loading) return <Card className="p-3 text-muted">กำลังโหลดรายงาน...</Card>
  if (!rows.length) return <Card className="p-3 text-muted">ไม่พบข้อมูลในช่วงที่เลือก</Card>

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k))
      return set
    }, new Set<string>()),
  )
    .filter((column) => rows.some((row) => String(row[column] ?? '').trim() !== ''))
    .sort((a, b) => {
      const priority = ['section', 'date', 'moveName', 'name', 'partner', 'debit', 'credit', 'balance', 'amount', 'ref']
      const ia = priority.findIndex((p) => a.toLowerCase().includes(p))
      const ib = priority.findIndex((p) => b.toLowerCase().includes(p))
      const sa = ia === -1 ? 99 : ia
      const sb = ib === -1 ? 99 : ib
      if (sa !== sb) return sa - sb
      return a.localeCompare(b)
    })
    .slice(0, 12)

  return (
    <>
      <Card className="p-3 mb-3">
        <div className="row g-3">
          <div className="col-md-6">
            <div className="small text-muted">จำนวนรายการ</div>
            <div className="h5 mb-0">{rows.length.toLocaleString('en-US')}</div>
          </div>
          <div className="col-md-6">
            <div className="small text-muted">จำนวนคอลัมน์</div>
            <div className="h5 mb-0">{columns.length.toLocaleString('en-US')}</div>
          </div>
        </div>
      </Card>
      <Card className="p-3">
        <div className="fw-semibold mb-2">{props.title}</div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} className="text-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column} style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '320px' }}>
                      {String(row[column] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
