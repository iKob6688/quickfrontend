import type { SalesOrderLine } from '@/api/services/sales-orders.service'

export type SalesOrderTaxLike = {
  amount?: number | string
  amountType?: string
  type?: string
  priceInclude?: boolean
}

export type SalesOrderTotalsLine = {
  line: SalesOrderLine
  gross: number
  discountAmount: number
  subtotal: number
  totalTax: number
  total: number
}

export type SalesOrderTotals = {
  lineTotals: SalesOrderTotalsLine[]
  grossSubtotal: number
  discountAmount: number
  afterDiscount: number
  vatAmount: number
  withholdingAmount: number
  grandTotal: number
}

function toNumberLike(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export function calculateSalesOrderTotals(
  lines: SalesOrderLine[],
  options: {
    taxMap?: Map<number, SalesOrderTaxLike>
    vatEnabled?: boolean
    vatRate?: number
    withholdingTaxEnabled?: boolean
    withholdingTaxRate?: number
  } = {},
): SalesOrderTotals {
  const taxMap = options.taxMap ?? new Map<number, SalesOrderTaxLike>()
  const vatEnabled = options.vatEnabled ?? false
  const vatRate = options.vatRate ?? 0
  const withholdingTaxEnabled = options.withholdingTaxEnabled ?? false
  const withholdingTaxRate = options.withholdingTaxRate ?? 0

  const lineTotals = (lines || []).map((line) => {
    const kind = line.lineType || 'normal'
    if (kind !== 'normal') {
      return {
        line: {
          ...line,
          subtotal: 0,
          totalTax: 0,
          total: 0,
        },
        gross: 0,
        discountAmount: 0,
        subtotal: 0,
        totalTax: 0,
        total: 0,
      }
    }

    const quantity = toNumberLike(line.quantity, 0)
    const unitPrice = toNumberLike(line.unitPrice, 0)
    const gross = quantity * unitPrice
    const discountAmount = Math.max(0, toNumberLike(line.discount, 0))
    const afterDiscount = Math.max(0, gross - discountAmount)

    let subtotal = afterDiscount
    let totalTax = 0
    if (vatEnabled) {
      const firstTaxId = Array.isArray(line.taxIds) ? Number(line.taxIds[0] || 0) : 0
      const firstTax = firstTaxId > 0 ? taxMap.get(firstTaxId) : undefined
      if (firstTax && String(firstTax.amountType || firstTax.type || 'percent') === 'percent') {
        const rate = Number(firstTax.amount || 0)
        if (rate > 0) {
          if (firstTax.priceInclude) {
            subtotal = afterDiscount / (1 + rate / 100)
            totalTax = afterDiscount - subtotal
          } else {
            totalTax = subtotal * (rate / 100)
          }
        }
      } else if (vatRate > 0) {
        totalTax = subtotal * (vatRate / 100)
      }
    }

    return {
      line: {
        ...line,
        subtotal,
        totalTax,
        total: subtotal + totalTax,
      },
      gross,
      discountAmount,
      subtotal,
      totalTax,
      total: subtotal + totalTax,
    }
  })

  const grossSubtotal = lineTotals.reduce((sum, row) => sum + row.gross, 0)
  const discountAmount = lineTotals.reduce((sum, row) => sum + row.discountAmount, 0)
  const afterDiscount = Math.max(0, grossSubtotal - discountAmount)
  const vatAmount = vatEnabled ? lineTotals.reduce((sum, row) => sum + row.totalTax, 0) : 0
  const withholdingAmount = withholdingTaxEnabled ? (afterDiscount * withholdingTaxRate) / 100 : 0
  const grandTotal = afterDiscount + vatAmount - withholdingAmount

  return {
    lineTotals,
    grossSubtotal,
    discountAmount,
    afterDiscount,
    vatAmount,
    withholdingAmount,
    grandTotal,
  }
}
