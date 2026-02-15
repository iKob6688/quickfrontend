import { getInvoice, listInvoices } from '@/api/services/invoices.service'
import { listPartners } from '@/api/services/partners.service'
import { getProduct, listProducts } from '@/api/services/products.service'
import { getPurchaseOrder, listPurchaseOrders } from '@/api/services/purchases.service'
import { getSalesOrder, listSalesOrders } from '@/api/services/sales-orders.service'

export type AssistantInsightRow = {
  label: string
  value: string
  route?: string
}

export type AssistantInsightSource = {
  label: string
  route: string
}

export type AssistantInsight = {
  kind: 'search' | 'summary'
  title: string
  summary: string
  rows: AssistantInsightRow[]
  sources: AssistantInsightSource[]
  confidence?: number
  generatedAt?: string
  explain?: string
}

type DateRange = {
  from?: string
  to?: string
  label: string
}

const INSIGHT_CACHE_MS = 20_000
const insightCache = new Map<string, { at: number; data: AssistantInsight | null }>()

function stampInsight(insight: AssistantInsight, confidence = 0.9): AssistantInsight {
  return {
    ...insight,
    confidence: Math.max(0, Math.min(confidence, 1)),
    generatedAt: new Date().toISOString(),
  }
}

function lower(text: string) {
  return text.toLowerCase().trim()
}

function hasAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w))
}

function formatMoney(value: number) {
  return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatQty(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function parseDateRange(raw: string): DateRange {
  const text = raw.trim()
  const low = lower(text)
  const today = new Date()
  const toIso = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  if (hasAny(low, ['วันนี้', 'today'])) {
    const d = toIso(today)
    return { from: d, to: d, label: 'วันนี้' }
  }

  if (hasAny(low, ['เดือนนี้', 'this month'])) {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: toIso(first), to: toIso(today), label: 'เดือนนี้' }
  }

  if (hasAny(low, ['เดือนก่อน', 'last month'])) {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const last = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: toIso(first), to: toIso(last), label: 'เดือนก่อน' }
  }

  if (hasAny(low, ['สัปดาห์นี้', 'this week'])) {
    const day = today.getDay()
    const offset = day === 0 ? 6 : day - 1
    const first = new Date(today)
    first.setDate(today.getDate() - offset)
    return { from: toIso(first), to: toIso(today), label: 'สัปดาห์นี้' }
  }

  if (hasAny(low, ['สัปดาห์ก่อน', 'last week'])) {
    const day = today.getDay()
    const offset = day === 0 ? 6 : day - 1
    const thisWeekFirst = new Date(today)
    thisWeekFirst.setDate(today.getDate() - offset)
    const first = new Date(thisWeekFirst)
    first.setDate(thisWeekFirst.getDate() - 7)
    const last = new Date(thisWeekFirst)
    last.setDate(thisWeekFirst.getDate() - 1)
    return { from: toIso(first), to: toIso(last), label: 'สัปดาห์ก่อน' }
  }

  if (hasAny(low, ['ปีนี้', 'this year'])) {
    const first = new Date(today.getFullYear(), 0, 1)
    return { from: toIso(first), to: toIso(today), label: 'ปีนี้' }
  }

  const isoMatches = text.match(/\d{4}-\d{2}-\d{2}/g) || []
  if (isoMatches.length >= 2) {
    return { from: isoMatches[0], to: isoMatches[1], label: `${isoMatches[0]} ถึง ${isoMatches[1]}` }
  }
  if (isoMatches.length === 1) {
    return { from: isoMatches[0], to: isoMatches[0], label: isoMatches[0] }
  }

  const localMatches = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g) || []
  if (localMatches.length >= 2) {
    const d0 = normalizeLocalDate(localMatches[0] || '')
    const d1 = normalizeLocalDate(localMatches[1] || '')
    if (d0 && d1) return { from: d0, to: d1, label: `${d0} ถึง ${d1}` }
  }

  return { label: 'ล่าสุด' }
}

function normalizeLocalDate(input: string): string | null {
  const parts = input.split('/').map((v) => Number(v))
  if (parts.length !== 3) return null
  const [d, m, yRaw] = parts
  if (!d || !m || !yRaw) return null
  const y = yRaw < 100 ? 2000 + yRaw : yRaw > 2500 ? yRaw - 543 : yRaw
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function extractQuotedTerm(raw: string): string {
  const quote = raw.match(/"([^"]+)"/) || raw.match(/'([^']+)'/)
  return quote?.[1]?.trim() || ''
}

function extractTerm(raw: string, stopWords: string[]) {
  const quoted = extractQuotedTerm(raw)
  if (quoted) return quoted
  let clean = raw
  stopWords.forEach((w) => {
    if (!w) return
    clean = clean.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
  })
  const text = clean
    .replace(/[?.,!]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !stopWords.includes(lower(w)))
  return text.join(' ').trim()
}

function normalizeName(value: string) {
  return lower(value).replace(/\s+/g, ' ')
}

function tokenize(value: string): string[] {
  return normalizeName(value)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
}

function scoreByTerm(value: string, term: string): number {
  const v = normalizeName(value)
  const t = normalizeName(term)
  if (!t) return 1
  if (v === t) return 120
  if (v.startsWith(t)) return 90
  if (v.includes(t)) return 75
  const terms = tokenize(t)
  if (terms.length > 1) {
    const hit = terms.filter((tk) => v.includes(tk)).length
    return hit > 0 ? 40 + hit * 10 : 0
  }
  return 0
}

function productMatches(description: string, term: string) {
  if (!term) return true
  const d = normalizeName(description)
  const t = normalizeName(term)
  return d.includes(t)
}

function orderDeliveryLabel(status: string) {
  if (status === 'done') return 'ส่งแล้ว'
  if (status === 'sale') return 'ยืนยันแล้ว / รอส่ง'
  if (status === 'sent') return 'เสนอราคาแล้ว / ยังไม่ส่ง'
  if (status === 'cancel') return 'ยกเลิก'
  return 'ร่าง / ยังไม่ส่ง'
}

async function searchContacts(term: string): Promise<AssistantInsight> {
  const result = await listPartners({ q: term, active: true, limit: 20, offset: 0 })
  const ranked = (result.items || [])
    .map((row) => {
      const score = Math.max(
        scoreByTerm(row.name || '', term),
        scoreByTerm(row.vat || '', term),
        scoreByTerm(row.email || '', term),
      )
      return { row, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.row)
  const rows = ranked.map((row) => ({
    label: row.name || `Contact #${row.id}`,
    value: [row.vat, row.email, row.phone].filter(Boolean).join(' | ') || 'ไม่มีข้อมูลเสริม',
    route: `/customers/${row.id}`,
  }))
  return stampInsight({
    kind: 'search',
    title: 'ผลการค้นหารายชื่อติดต่อ',
    summary: rows.length > 0 ? `พบ ${rows.length} รายการ` : 'ไม่พบข้อมูล',
    rows,
    sources: [{ label: 'ไปหน้ารายชื่อติดต่อ', route: '/customers' }],
    explain: term
      ? 'จับคู่จาก ชื่อ/VAT/อีเมล แล้วจัดอันดับความใกล้เคียง'
      : 'แสดงรายชื่อติดต่อล่าสุดในระบบ',
  }, rows.length > 0 ? 0.95 : 0.7)
}

async function searchProducts(term: string): Promise<AssistantInsight> {
  const result = await listProducts({ q: term, active: true, limit: 20, offset: 0 })
  const ranked = (result.items || [])
    .map((row) => {
      const score = Math.max(
        scoreByTerm(row.name || '', term),
        scoreByTerm(row.defaultCode || '', term) + 10,
        scoreByTerm(row.barcode || '', term) + 8,
      )
      return { row, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.row)
  const rows = ranked.map((row) => ({
    label: row.name || `Product #${row.id}`,
    value: [row.defaultCode, row.barcode, row.listPrice != null ? `${formatMoney(row.listPrice)} THB` : '']
      .filter(Boolean)
      .join(' | ') || 'ไม่มีข้อมูลเสริม',
    route: `/products/${row.id}/edit`,
  }))
  return stampInsight({
    kind: 'search',
    title: 'ผลการค้นหาสินค้า',
    summary: rows.length > 0 ? `พบ ${rows.length} รายการ` : 'ไม่พบข้อมูล',
    rows,
    sources: [{ label: 'ไปหน้ารายการสินค้า', route: '/products' }],
    explain: term
      ? 'จับคู่จาก ชื่อสินค้า/รหัสสินค้า/บาร์โค้ด แล้วจัดอันดับความใกล้เคียง'
      : 'แสดงสินค้าที่ใช้งานล่าสุดในระบบ',
  }, rows.length > 0 ? 0.94 : 0.7)
}

async function searchInvoices(term: string, range: DateRange): Promise<AssistantInsight> {
  const items = await listInvoices({
    search: term || undefined,
    dateFrom: range.from,
    dateTo: range.to,
    limit: 10,
    offset: 0,
  })
  const rows = (items || []).slice(0, 10).map((row) => ({
    label: row.number || `INV#${row.id}`,
    value: `${row.customerName || '—'} | ${formatMoney(row.total || 0)} ${row.currency || 'THB'}`,
    route: `/sales/invoices/${row.id}`,
  }))
  return stampInsight({
    kind: 'search',
    title: 'ผลการค้นหาใบแจ้งหนี้',
    summary: rows.length > 0 ? `พบ ${rows.length} รายการ (${range.label})` : `ไม่พบข้อมูล (${range.label})`,
    rows,
    sources: [{ label: 'ไปหน้าใบแจ้งหนี้', route: '/sales/invoices' }],
    explain: term
      ? 'จับคู่จากเลขเอกสาร/ชื่อลูกค้า และกรองตามช่วงเวลา'
      : 'กรองรายการตามช่วงเวลาที่ระบุ',
  }, rows.length > 0 ? 0.92 : 0.68)
}

async function summarizeCustomer(text: string): Promise<AssistantInsight> {
  const range = parseDateRange(text)
  const term = extractTerm(text, [
    'สรุป',
    'ยอดซื้อ',
    'ยอดขาย',
    'ลูกค้า',
    'รายคน',
    'ช่วงเวลา',
    'ระหว่าง',
    'ถึง',
    'ของ',
    'ใน',
    'ช่วง',
    'customer',
    'summary',
  ])
  const items = await listInvoices({
    search: term || undefined,
    dateFrom: range.from,
    dateTo: range.to,
    limit: 300,
    offset: 0,
  })

  const agg = new Map<string, { customerId: number; count: number; total: number; paid: number }>()
  ;(items || []).forEach((inv) => {
    const key = inv.customerName || `Customer #${inv.customerId}`
    const row = agg.get(key) || {
      customerId: inv.customerId,
      count: 0,
      total: 0,
      paid: 0,
    }
    row.count += 1
    row.total += Number(inv.total || 0)
    row.paid += Number(inv.amountPaid || 0)
    agg.set(key, row)
  })

  const ranked = Array.from(agg.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)

  const rows: AssistantInsightRow[] = ranked.map(([customerName, v]) => ({
    label: customerName,
    value: `ยอดรวม ${formatMoney(v.total)} THB | ${v.count} เอกสาร`,
    route: v.customerId ? `/customers/${v.customerId}` : '/customers',
  }))

  const grandTotal = ranked.reduce((sum, [, row]) => sum + row.total, 0)
  return stampInsight({
    kind: 'summary',
    title: 'สรุปยอดซื้อรายลูกค้า',
    summary:
      rows.length > 0
        ? `ช่วง ${range.label} | รวม ${formatMoney(grandTotal)} THB | ลูกค้า ${rows.length} ราย`
        : `ไม่พบข้อมูลช่วง ${range.label}`,
    rows,
    sources: [
      {
        label: 'ดูรายการใบแจ้งหนี้',
        route: '/sales/invoices',
      },
    ],
  }, rows.length > 0 ? 0.9 : 0.66)
}

async function summarizeProductSales(text: string): Promise<AssistantInsight> {
  const range = parseDateRange(text)
  const term = extractTerm(text, [
    'สรุป',
    'ยอดขาย',
    'ยอดซื้อ',
    'สินค้า',
    'บางตัว',
    'ช่วงเวลา',
    'ใน',
    'ของ',
    'product',
    'sales',
    'purchase',
    'ขาย',
    'ซื้อ',
  ])
  const items = await listInvoices({
    dateFrom: range.from,
    dateTo: range.to,
    limit: 80,
    offset: 0,
  })

  const invoiceIds = (items || []).slice(0, 40).map((row) => row.id)
  const details = await Promise.allSettled(invoiceIds.map((invoiceId) => getInvoice(invoiceId)))
  const agg = new Map<string, { qty: number; amount: number; invoiceId?: number }>()

  details.forEach((res) => {
    if (res.status !== 'fulfilled') return
    const inv = res.value
    ;(inv.lines || []).forEach((line) => {
      const name = String(line.description || '').trim() || `Product #${line.productId || 'N/A'}`
      if (!productMatches(name, term)) return
      const row = agg.get(name) || { qty: 0, amount: 0, invoiceId: inv.id }
      row.qty += Number(line.quantity || 0)
      row.amount += Number(line.subtotal || 0)
      agg.set(name, row)
    })
  })

  const ranked = Array.from(agg.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 8)

  const rows: AssistantInsightRow[] = ranked.map(([name, row]) => ({
    label: name,
    value: `จำนวน ${formatQty(row.qty)} | ยอดขาย ${formatMoney(row.amount)} THB`,
    route: row.invoiceId ? `/sales/invoices/${row.invoiceId}` : '/sales/invoices',
  }))
  const total = ranked.reduce((sum, [, row]) => sum + row.amount, 0)
  return stampInsight({
    kind: 'summary',
    title: term ? `สรุปยอดขายสินค้า: ${term}` : 'สรุปยอดขายสินค้า',
    summary:
      rows.length > 0
        ? `ช่วง ${range.label} | รวม ${formatMoney(total)} THB`
        : `ไม่พบรายการสินค้าที่ตรงเงื่อนไข (${range.label})`,
    rows,
    sources: [{ label: 'ดูใบแจ้งหนี้ขาย', route: '/sales/invoices' }],
  }, rows.length > 0 ? 0.88 : 0.64)
}

async function summarizeProductPurchase(text: string): Promise<AssistantInsight> {
  const range = parseDateRange(text)
  const term = extractTerm(text, [
    'สรุป',
    'ยอดซื้อ',
    'สินค้า',
    'ช่วงเวลา',
    'ซื้อ',
    'product',
    'purchase',
    'ใน',
    'ของ',
  ])
  const orders = await listPurchaseOrders({
    dateFrom: range.from,
    dateTo: range.to,
    limit: 80,
    offset: 0,
  })
  const orderIds = (orders || []).slice(0, 30).map((row) => row.id)
  const details = await Promise.allSettled(orderIds.map((orderId) => getPurchaseOrder(orderId)))
  const agg = new Map<string, { qty: number; amount: number; poId?: number }>()

  details.forEach((res) => {
    if (res.status !== 'fulfilled') return
    const po = res.value
    ;(po.lines || []).forEach((line) => {
      const name = String(line.description || '').trim() || `Product #${line.productId || 'N/A'}`
      if (!productMatches(name, term)) return
      const row = agg.get(name) || { qty: 0, amount: 0, poId: po.id }
      row.qty += Number(line.quantity || 0)
      row.amount += Number(line.subtotal || 0)
      agg.set(name, row)
    })
  })

  const ranked = Array.from(agg.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 8)

  const rows: AssistantInsightRow[] = ranked.map(([name, row]) => ({
    label: name,
    value: `จำนวน ${formatQty(row.qty)} | ยอดซื้อ ${formatMoney(row.amount)} THB`,
    route: row.poId ? `/purchases/orders/${row.poId}` : '/purchases/orders',
  }))
  const total = ranked.reduce((sum, [, row]) => sum + row.amount, 0)
  return stampInsight({
    kind: 'summary',
    title: term ? `สรุปยอดซื้อสินค้า: ${term}` : 'สรุปยอดซื้อสินค้า',
    summary:
      rows.length > 0
        ? `ช่วง ${range.label} | รวม ${formatMoney(total)} THB`
        : `ไม่พบรายการซื้อที่ตรงเงื่อนไข (${range.label})`,
    rows,
    sources: [{ label: 'ดูใบสั่งซื้อ', route: '/purchases/orders' }],
  }, rows.length > 0 ? 0.88 : 0.64)
}

async function productStatusInsight(text: string): Promise<AssistantInsight | null> {
  const term = extractTerm(text, [
    'สินค้าตัวนี้',
    'สินค้า',
    'เหลือกี่ชิ้น',
    'เหลือ',
    'ราคาเท่าไร',
    'ราคา',
    'ล่าสุดขายให้ใคร',
    'ล่าสุด',
    'ขายให้ใคร',
    'ส่งหรือยัง',
    'ส่งแล้วหรือยัง',
    'เท่าไร',
    'กี่ชิ้น',
    'ของ',
    'what',
    'price',
    'stock',
    'last',
    'sold',
    'shipped',
  ])
  if (!term) return null

  const productList = await listProducts({ q: term, active: true, limit: 10, offset: 0 })
  const picked = productList.items?.[0]
  if (!picked?.id) {
    return stampInsight({
      kind: 'search',
      title: `สถานะสินค้า: ${term}`,
      summary: 'ไม่พบสินค้าในระบบ',
      rows: [],
      sources: [{ label: 'ไปหน้ารายการสินค้า', route: '/products' }],
      explain: 'ค้นจากชื่อสินค้า/รหัสสินค้า/บาร์โค้ด',
    }, 0.6)
  }

  const detail = await getProduct(picked.id)
  const onHand =
    detail.qtyAvailable != null
      ? formatQty(Number(detail.qtyAvailable))
      : detail.virtualAvailable != null
        ? formatQty(Number(detail.virtualAvailable))
        : 'ไม่พบข้อมูลจาก API'
  const uom = detail.uomName || 'หน่วย'

  const orders = await listSalesOrders({
    orderType: 'sale',
    search: term,
    limit: 30,
    offset: 0,
  })
  const sorted = [...(orders || [])].sort((a, b) => {
    const ad = new Date(a.orderDate || '').getTime() || 0
    const bd = new Date(b.orderDate || '').getTime() || 0
    return bd - ad
  })

  let latestMatched:
    | {
        id: number
        number: string
        partnerName: string
        status: string
        orderDate: string
      }
    | undefined

  for (const row of sorted.slice(0, 12)) {
    try {
      const detailOrder = await getSalesOrder(row.id)
      const hasLine = (detailOrder.lines || []).some((line) => {
        const lineName = String(line.description || '')
        const byName = productMatches(lineName, term) || productMatches(lineName, detail.name || '')
        const byProductId = detail.id && line.productId === detail.id
        return byName || byProductId
      })
      if (hasLine) {
        latestMatched = {
          id: detailOrder.id,
          number: detailOrder.number || `SO#${detailOrder.id}`,
          partnerName: detailOrder.partnerName || '—',
          status: detailOrder.status,
          orderDate: detailOrder.orderDate || '',
        }
        break
      }
    } catch {
      // ignore single-order errors and continue
    }
  }

  const rows: AssistantInsightRow[] = [
    {
      label: 'สินค้า',
      value: detail.name || term,
      route: `/products/${detail.id}/edit`,
    },
    {
      label: 'ราคา',
      value: `${formatMoney(Number(detail.listPrice || 0))} THB`,
      route: `/products/${detail.id}/edit`,
    },
    {
      label: 'คงเหลือ',
      value: `${onHand} ${uom}`,
      route: `/products/${detail.id}/edit`,
    },
    {
      label: 'บาร์โค้ด',
      value: detail.barcode || '-',
      route: `/products/${detail.id}/edit`,
    },
  ]

  if (latestMatched) {
    rows.push({
      label: 'ล่าสุดขายให้',
      value: latestMatched.partnerName,
      route: `/sales/orders/${latestMatched.id}`,
    })
    rows.push({
      label: 'สถานะส่งของล่าสุด',
      value: `${orderDeliveryLabel(latestMatched.status)} (${latestMatched.number})`,
      route: `/sales/orders/${latestMatched.id}`,
    })
  } else {
    rows.push({
      label: 'ล่าสุดขายให้',
      value: 'ยังไม่พบประวัติขายที่ตรงเงื่อนไข',
      route: '/sales/orders?type=sale',
    })
  }

  return stampInsight({
    kind: 'search',
    title: `สถานะสินค้า: ${detail.name || term}`,
    summary: latestMatched
      ? `ล่าสุดขายให้ ${latestMatched.partnerName} | ${orderDeliveryLabel(latestMatched.status)}`
      : 'แสดงข้อมูลสินค้าและราคาปัจจุบัน',
    rows,
    sources: [
      { label: 'เปิดสินค้า', route: `/products/${detail.id}/edit` },
      ...(latestMatched
        ? [{ label: 'เปิด Sale Order ล่าสุด', route: `/sales/orders/${latestMatched.id}` }]
        : [{ label: 'ดูรายการ Sale Order', route: '/sales/orders?type=sale' }]),
    ],
    explain: 'อ้างอิงจากข้อมูลสินค้า + ประวัติการขายล่าสุดที่พบ',
  }, latestMatched ? 0.9 : 0.75)
}

export async function buildAssistantInsight(rawInput: string): Promise<AssistantInsight | null> {
  const text = rawInput.trim()
  if (!text) return null
  const cacheKey = normalizeName(text)
  const cached = insightCache.get(cacheKey)
  if (cached && Date.now() - cached.at <= INSIGHT_CACHE_MS) {
    return cached.data
  }
  const low = lower(text)

  const isSearch = hasAny(low, ['ค้น', 'ค้นหา', 'หา', 'search', 'find'])
  const isSummary = hasAny(low, ['สรุป', 'รายงาน', 'summary', 'report', 'ยอดขาย', 'ยอดซื้อ'])
  const hasCustomer = hasAny(low, ['ลูกค้า', 'customer', 'contact'])
  const hasProduct = hasAny(low, ['สินค้า', 'product'])
  const hasInvoice = hasAny(low, ['ใบแจ้งหนี้', 'invoice'])
  const hasSales = hasAny(low, ['ขาย', 'sales'])
  const hasPurchase = hasAny(low, ['ซื้อ', 'purchase'])
  const productStatusAsk = hasProduct && hasAny(low, ['เหลือ', 'ราคา', 'ล่าสุดขาย', 'ส่งหรือยัง', 'คงเหลือ', 'stock', 'sold', 'shipped'])

  let result: AssistantInsight | null = null

  if (isSearch && hasCustomer) {
    const term = extractTerm(text, ['ค้น', 'ค้นหา', 'หา', 'ลูกค้า', 'customer', 'contact'])
    result = await searchContacts(term)
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }
  if (isSearch && hasProduct) {
    const term = extractTerm(text, ['ค้น', 'ค้นหา', 'หา', 'สินค้า', 'product'])
    result = await searchProducts(term)
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }
  if (productStatusAsk) {
    const statusInsight = await productStatusInsight(text)
    if (statusInsight) {
      insightCache.set(cacheKey, { at: Date.now(), data: statusInsight })
      return statusInsight
    }
  }
  if (isSearch && hasInvoice) {
    const term = extractTerm(text, ['ค้น', 'ค้นหา', 'หา', 'ใบแจ้งหนี้', 'invoice'])
    result = await searchInvoices(term, parseDateRange(text))
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }

  if (isSummary && hasCustomer) {
    result = await summarizeCustomer(text)
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }
  if (isSummary && hasProduct && hasPurchase && !hasSales) {
    result = await summarizeProductPurchase(text)
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }
  if (isSummary && hasProduct) {
    result = await summarizeProductSales(text)
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }

  if (hasAny(low, ['ยอดซื้อ ลูกค้า', 'ยอดซื้อรายลูกค้า', 'ยอดขายรายลูกค้า'])) {
    result = await summarizeCustomer(text)
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }

  if (hasAny(low, ['ยอดขายสินค้า', 'ยอดซื้อสินค้า'])) {
    result = hasPurchase ? await summarizeProductPurchase(text) : await summarizeProductSales(text)
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }

  // Quick shortcuts
  if (low === 'ค้นลูกค้า') {
    result = await searchContacts('')
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }
  if (low === 'ค้นสินค้า') {
    result = await searchProducts('')
    insightCache.set(cacheKey, { at: Date.now(), data: result })
    return result
  }

  // Attempt product direct lookup from quoted term
  if (hasProduct) {
    const term = extractQuotedTerm(text)
    if (term) {
      const productList = await listProducts({ q: term, active: true, limit: 5, offset: 0 })
      const first = productList.items?.[0]
      if (first?.id) {
        const detail = await getProduct(first.id)
        result = stampInsight({
          kind: 'search',
          title: `สินค้า: ${detail.name}`,
          summary: `ราคา ${formatMoney(Number(detail.listPrice || 0))} THB`,
          rows: [
            { label: 'รหัสสินค้า', value: detail.defaultCode || '-' },
            { label: 'บาร์โค้ด', value: detail.barcode || '-' },
            { label: 'ราคา', value: `${formatMoney(Number(detail.listPrice || 0))} THB` },
          ],
          sources: [{ label: 'เปิดสินค้านี้', route: `/products/${detail.id}/edit` }],
        }, 0.86)
        insightCache.set(cacheKey, { at: Date.now(), data: result })
        return result
      }
    }
  }

  insightCache.set(cacheKey, { at: Date.now(), data: null })
  return null
}

export function isAssistantDataQuery(rawInput: string): boolean {
  const low = lower(rawInput || '')
  if (!low) return false
  return hasAny(low, [
    'ค้น',
    'ค้นหา',
    'หา',
    'search',
    'find',
    'สรุป',
    'รายงาน',
    'summary',
    'report',
    'เหลือกี่ชิ้น',
    'ราคาเท่าไร',
    'ล่าสุดขาย',
    'ส่งหรือยัง',
    'stock',
    'price',
    'sold',
    'shipped',
  ])
}
