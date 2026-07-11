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
  discountPercent: number
  discountAmount: number
  untaxedAmount: number
  taxAmount: number
  totalIncludingTax: number
  subtotal: number
  totalTax: number
  total: number
}

export type SalesOrderTotals = {
  lineTotals: SalesOrderTotalsLine[]
  grossSubtotal: number
  discountAmount: number
  untaxedAmount: number
  taxAmount: number
  totalIncludingTax: number
  withholdingAmount: number
  amountDue: number
  afterDiscount: number
  vatAmount: number
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
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
          discount: 0,
          subtotal: 0,
          totalTax: 0,
          total: 0,
        },
        gross: 0,
        discountPercent: 0,
        discountAmount: 0,
        untaxedAmount: 0,
        taxAmount: 0,
        totalIncludingTax: 0,
        subtotal: 0,
        totalTax: 0,
        total: 0,
      }
    }

    const quantity = toNumberLike(line.quantity, 0)
    const unitPrice = toNumberLike(line.unitPrice, 0)
    const gross = roundMoney(quantity * unitPrice)
    const discountPercent = clampNumber(toNumberLike(line.discountPercent ?? line.discount, 0), 0, 100)
    const discountAmount = roundMoney((gross * discountPercent) / 100)
    const grossAfterDiscount = roundMoney(Math.max(0, gross - discountAmount))

    let untaxedAmount = grossAfterDiscount
    let taxAmount = 0
    const taxIds = Array.isArray(line.taxIds) ? line.taxIds.filter((taxId) => Number.isFinite(Number(taxId)) && Number(taxId) > 0) : []
    if (vatEnabled) {
      const taxes = taxIds
        .map((taxId) => ({ taxId, tax: taxMap.get(Number(taxId)) }))
        .filter((entry): entry is { taxId: number; tax: SalesOrderTaxLike } => Boolean(entry.tax))

      if (taxes.length > 0) {
        let runningBase = grossAfterDiscount
        for (const { tax } of taxes) {
          const rate = clampNumber(toNumberLike(tax.amount, 0), 0, 100)
          const amountType = String(tax.amountType || tax.type || 'percent')
          if (amountType !== 'percent' || rate <= 0) {
            continue
          }

          if (tax.priceInclude) {
            const untaxedBefore = runningBase
            runningBase = roundMoney(runningBase / (1 + rate / 100))
            taxAmount = roundMoney(taxAmount + (untaxedBefore - runningBase))
          } else {
            const taxForLine = roundMoney(runningBase * (rate / 100))
            taxAmount = roundMoney(taxAmount + taxForLine)
          }
        }
        untaxedAmount = roundMoney(runningBase)
      } else if (vatRate > 0) {
        taxAmount = roundMoney(grossAfterDiscount * (vatRate / 100))
      }
    }

    const totalIncludingTax = roundMoney(untaxedAmount + taxAmount)

    return {
      line: {
        ...line,
        subtotal: untaxedAmount,
        totalTax: taxAmount,
        total: totalIncludingTax,
      },
      gross,
      discountPercent,
      discountAmount,
      untaxedAmount,
      taxAmount,
      totalIncludingTax,
      subtotal: untaxedAmount,
      totalTax: taxAmount,
      total: totalIncludingTax,
    }
  })

  const grossSubtotal = lineTotals.reduce((sum, row) => sum + row.gross, 0)
  const discountAmount = lineTotals.reduce((sum, row) => sum + row.discountAmount, 0)
  const untaxedAmount = lineTotals.reduce((sum, row) => sum + row.untaxedAmount, 0)
  const taxAmount = vatEnabled ? lineTotals.reduce((sum, row) => sum + row.taxAmount, 0) : 0
  const totalIncludingTax = roundMoney(untaxedAmount + taxAmount)
  const withholdingAmount = withholdingTaxEnabled ? roundMoney((untaxedAmount * withholdingTaxRate) / 100) : 0
  const amountDue = roundMoney(totalIncludingTax - withholdingAmount)

  return {
    lineTotals,
    grossSubtotal,
    discountAmount,
    untaxedAmount,
    taxAmount,
    totalIncludingTax,
    withholdingAmount,
    amountDue,
    afterDiscount: untaxedAmount,
    vatAmount: taxAmount,
    grandTotal: amountDue,
  }
}
