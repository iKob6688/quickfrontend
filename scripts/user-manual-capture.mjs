import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.ERPTH_MANUAL_BASE_URL || 'http://localhost:5173'
const outRoot = path.resolve('Users Manaul Qacc')
const screenshotDir = path.join(outRoot, 'screenshots')
const dataDir = path.join(outRoot, 'data')
const runDate = new Date().toISOString().slice(0, 10)

const credentials = {
  login: process.env.ERPTH_MANUAL_LOGIN || 'admin',
  password: process.env.ERPTH_MANUAL_PASSWORD || 'qadmin',
}

const routeInventory = [
  { id: 'login', title: 'เข้าสู่ระบบ', chapter: 'เริ่มต้นใช้งาน', route: '/login', auth: false },
  { id: 'dashboard', title: 'แดชบอร์ด', chapter: 'เริ่มต้นใช้งาน', route: '/dashboard' },
  { id: 'customers-list', title: 'รายชื่อติดต่อ', chapter: 'ข้อมูลหลัก', route: '/customers' },
  { id: 'customers-new', title: 'สร้างรายชื่อติดต่อ', chapter: 'ข้อมูลหลัก', route: '/customers/new' },
  { id: 'customers-detail', title: 'รายละเอียดรายชื่อติดต่อ', chapter: 'ข้อมูลหลัก', route: '/customers/1', dynamic: true },
  { id: 'customers-edit', title: 'แก้ไขรายชื่อติดต่อ', chapter: 'ข้อมูลหลัก', route: '/customers/1/edit', dynamic: true },
  { id: 'products-list', title: 'สินค้า/บริการ', chapter: 'ข้อมูลหลัก', route: '/products' },
  { id: 'products-new', title: 'สร้างสินค้า/บริการ', chapter: 'ข้อมูลหลัก', route: '/products/new' },
  { id: 'products-edit', title: 'แก้ไขสินค้า/บริการ', chapter: 'ข้อมูลหลัก', route: '/products/1/edit', dynamic: true },
  { id: 'sales-orders-list', title: 'ใบเสนอราคา/SO', chapter: 'การขาย', route: '/sales/orders' },
  { id: 'sales-orders-new', title: 'สร้างใบเสนอราคา/SO', chapter: 'การขาย', route: '/sales/orders/new' },
  { id: 'sales-orders-detail', title: 'รายละเอียดใบเสนอราคา/SO', chapter: 'การขาย', route: '/sales/orders/1', dynamic: true },
  { id: 'sales-orders-edit', title: 'แก้ไขใบเสนอราคา/SO', chapter: 'การขาย', route: '/sales/orders/1/edit', dynamic: true },
  { id: 'sales-orders-print', title: 'Print Preview ใบเสนอราคา/SO', chapter: 'การขาย', route: '/sales/orders/1/print-preview', dynamic: true },
  { id: 'sales-delivery-detail', title: 'รายละเอียด Delivery', chapter: 'การขาย', route: '/sales/deliveries/1', dynamic: true },
  { id: 'sales-invoices-list', title: 'ใบแจ้งหนี้', chapter: 'การขาย', route: '/sales/invoices' },
  { id: 'sales-receipts-list', title: 'ใบเสร็จรับเงิน', chapter: 'การขาย', route: '/sales/receipts' },
  { id: 'sales-invoices-new', title: 'สร้างใบแจ้งหนี้', chapter: 'การขาย', route: '/sales/invoices/new' },
  { id: 'sales-invoices-detail', title: 'รายละเอียดใบแจ้งหนี้', chapter: 'การขาย', route: '/sales/invoices/1', dynamic: true },
  { id: 'sales-invoices-edit', title: 'แก้ไขใบแจ้งหนี้', chapter: 'การขาย', route: '/sales/invoices/1/edit', dynamic: true },
  { id: 'notes-list', title: 'ใบเพิ่ม/ลดหนี้', chapter: 'การขาย', route: '/notes' },
  { id: 'sales-notes-alias', title: 'ใบเพิ่ม/ลดหนี้ฝั่งขาย', chapter: 'การขาย', route: '/sales/notes' },
  { id: 'sales-notes-detail', title: 'รายละเอียดใบเพิ่ม/ลดหนี้ขาย', chapter: 'การขาย', route: '/sales/notes/1', dynamic: true },
  { id: 'purchase-orders-list', title: 'ใบสั่งซื้อ', chapter: 'การซื้อ', route: '/purchases/orders' },
  { id: 'purchase-orders-new', title: 'สร้างใบสั่งซื้อ', chapter: 'การซื้อ', route: '/purchases/orders/new' },
  { id: 'purchase-orders-detail', title: 'รายละเอียดใบสั่งซื้อ', chapter: 'การซื้อ', route: '/purchases/orders/1', dynamic: true },
  { id: 'purchase-orders-edit', title: 'แก้ไขใบสั่งซื้อ', chapter: 'การซื้อ', route: '/purchases/orders/1/edit', dynamic: true },
  { id: 'purchase-receipts-detail', title: 'รายละเอียดรับสินค้า', chapter: 'การซื้อ', route: '/purchases/receipts/1', dynamic: true },
  { id: 'purchase-bills-detail', title: 'รายละเอียด Vendor Bill', chapter: 'การซื้อ', route: '/purchases/bills/1', dynamic: true },
  { id: 'purchase-notes-alias', title: 'ใบเพิ่ม/ลดหนี้ฝั่งซื้อ', chapter: 'การซื้อ', route: '/purchases/notes' },
  { id: 'purchase-notes-detail', title: 'รายละเอียดใบเพิ่ม/ลดหนี้ซื้อ', chapter: 'การซื้อ', route: '/purchases/notes/1', dynamic: true },
  { id: 'purchase-requests-list', title: 'คำขอซื้อ', chapter: 'การซื้อ', route: '/purchases/requests' },
  { id: 'purchase-requests-new', title: 'สร้างคำขอซื้อ', chapter: 'การซื้อ', route: '/purchases/requests/new' },
  { id: 'purchase-requests-detail', title: 'รายละเอียดคำขอซื้อ', chapter: 'การซื้อ', route: '/purchases/requests/1', dynamic: true },
  { id: 'purchase-requests-edit', title: 'แก้ไขคำขอซื้อ', chapter: 'การซื้อ', route: '/purchases/requests/1/edit', dynamic: true },
  { id: 'expenses-list', title: 'รายจ่าย', chapter: 'รายจ่ายและเอกสารตรวจสอบ', route: '/expenses' },
  { id: 'expenses-new', title: 'บันทึกรายจ่าย', chapter: 'รายจ่ายและเอกสารตรวจสอบ', route: '/expenses/new' },
  { id: 'expenses-detail', title: 'รายละเอียดรายจ่าย', chapter: 'รายจ่ายและเอกสารตรวจสอบ', route: '/expenses/1', dynamic: true },
  { id: 'document-review', title: 'กล่องงานตรวจสอบเอกสาร', chapter: 'รายจ่ายและเอกสารตรวจสอบ', route: '/accounting/document-review' },
  { id: 'accounting-reports', title: 'รายงานบัญชี', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports' },
  { id: 'profit-loss', title: 'รายงานกำไรขาดทุน', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/profit-loss' },
  { id: 'balance-sheet', title: 'งบดุล', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/balance-sheet' },
  { id: 'general-ledger', title: 'บัญชีแยกประเภท', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/general-ledger' },
  { id: 'trial-balance', title: 'งบทดลอง', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/trial-balance' },
  { id: 'partner-ledger', title: 'Partner Ledger', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/partner-ledger' },
  { id: 'partner-ledger-drilldown', title: 'Partner Ledger Drilldown', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/partner-ledger/partner/1', dynamic: true },
  { id: 'aged-receivables', title: 'ลูกหนี้ค้างชำระ', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/aged-receivables' },
  { id: 'aged-payables', title: 'เจ้าหนี้ค้างชำระ', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/aged-payables' },
  { id: 'cash-book', title: 'สมุดเงินสด', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/cash-book' },
  { id: 'bank-book', title: 'สมุดธนาคาร', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/bank-book' },
  { id: 'vat-report', title: 'รายงาน VAT', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/vat' },
  { id: 'wht-report', title: 'รายงาน WHT', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/wht' },
  { id: 'tax-settings', title: 'ตั้งค่า VAT/ภาษี', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/tax-settings' },
  { id: 'etax-dashboard', title: 'เอกสาร e-Tax', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/etax' },
  { id: 'etax-settings', title: 'ตั้งค่า e-Tax', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/etax-settings' },
  { id: 'gl-account-drilldown', title: 'GL Account Drilldown', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/general-ledger/account/1', dynamic: true },
  { id: 'move-line-detail', title: 'รายละเอียดรายการบัญชี', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/reports/move-lines/1', dynamic: true },
  { id: 'accounting-admin', title: 'Accounting Admin', chapter: 'บัญชี/ภาษี/e-Tax', route: '/accounting/admin' },
  { id: 'excel-import', title: 'นำเข้า Excel', chapter: 'เครื่องมือ', route: '/excel-import' },
  { id: 'backend-connection', title: 'ตั้งค่าการเชื่อมต่อ', chapter: 'เครื่องมือ', route: '/backend-connection' },
  { id: 'agent-dashboard', title: 'Agent Dashboard', chapter: 'เครื่องมือ', route: '/agent' },
  { id: 'agent-ocr', title: 'Agent OCR', chapter: 'เครื่องมือ', route: '/agent/ocr' },
  { id: 'agent-expense', title: 'Agent Expense Auto Post', chapter: 'เครื่องมือ', route: '/agent/expense' },
  { id: 'agent-quotation', title: 'Agent Quotation', chapter: 'เครื่องมือ', route: '/agent/quotation' },
  { id: 'agent-contact', title: 'Agent Contact', chapter: 'เครื่องมือ', route: '/agent/contact' },
  { id: 'agent-invoice', title: 'Agent Invoice', chapter: 'เครื่องมือ', route: '/agent/invoice' },
  { id: 'reports-studio', title: 'Reports Studio Dashboard', chapter: 'เครื่องมือ', route: '/reports-studio' },
  { id: 'reports-studio-branding', title: 'Reports Studio Branding', chapter: 'เครื่องมือ', route: '/reports-studio/branding' },
  { id: 'reports-studio-templates', title: 'Reports Studio Templates', chapter: 'เครื่องมือ', route: '/reports-studio/templates' },
  { id: 'reports-studio-editor', title: 'Reports Studio Editor', chapter: 'เครื่องมือ', route: '/reports-studio/editor/quotation_default_v1', dynamic: true },
  { id: 'reports-studio-preview', title: 'Reports Studio Preview', chapter: 'เครื่องมือ', route: '/reports-studio/preview/quotation_default_v1', dynamic: true },
  { id: 'reports-studio-settings', title: 'Reports Studio Settings', chapter: 'เครื่องมือ', route: '/reports-studio/settings' },
  { id: 'reports-studio-print', title: 'Reports Studio Print', chapter: 'เครื่องมือ', route: '/reports-studio/print/quotation_default_v1', dynamic: true },
]

await fs.mkdir(screenshotDir, { recursive: true })
await fs.mkdir(dataDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()
page.setDefaultTimeout(12000)

async function loginIfNeeded() {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#login', credentials.login)
  await page.fill('#password', credentials.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 25000 })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
}

async function collectState(route, id, started, error = null) {
  const state = await page.evaluate(() => {
    const text = document.body.innerText || ''
    const hasVisible = (selector) =>
      [...document.querySelectorAll(selector)].some((el) => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      })
    const h1 = document.querySelector('h1')?.textContent?.trim() || ''
    const title = h1 || document.querySelector('[class*="page-title"], h2, h3')?.textContent?.trim() || ''
    const lower = text.toLowerCase()
    let status = 'loaded'
    if (location.pathname === '/login') status = 'login'
    if (/ไม่พบ|not found|404/.test(text)) status = 'not-found'
    if (/ไม่มีสิทธิ์|unauthorized|forbidden|restricted/.test(lower + text)) status = 'restricted'
    if (/error|failed|traceback|ไม่สำเร็จ|เกิดข้อผิดพลาด/.test(lower + text)) status = 'error'
    if (/ยังไม่มี|no data|empty|ไม่พบข้อมูล/.test(lower + text)) status = status === 'loaded' ? 'empty-state' : status
    return {
      finalUrl: location.pathname + location.search,
      title,
      status,
      textSample: text.replace(/\s+/g, ' ').trim().slice(0, 260),
      hasTable: hasVisible('table'),
      hasForm: hasVisible('form, input, textarea, select'),
      hasModal: hasVisible('.modal.show, [role="dialog"]'),
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    }
  })
  return {
    id,
    route,
    ...state,
    error,
    elapsedMs: Date.now() - started,
  }
}

async function captureRoute(item) {
  const started = Date.now()
  let error = null
  try {
    await page.goto(`${baseUrl}${item.route}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {})
    await page.waitForTimeout(900)
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }
  const screenshot = path.join(screenshotDir, `${item.id}.png`)
  await page.screenshot({ path: screenshot, fullPage: true }).catch(async () => {
    error = error || 'screenshot failed'
  })
  const state = await collectState(item.route, item.id, started, error)
  return {
    ...item,
    screenshot: path.relative(outRoot, screenshot),
    ...state,
  }
}

const coverage = []

const loginShot = path.join(screenshotDir, 'login.png')
await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
await page.screenshot({ path: loginShot, fullPage: true })

await loginIfNeeded()

for (const item of routeInventory.filter((item) => item.id !== 'login')) {
  coverage.push(await captureRoute(item))
}
coverage.unshift({
  ...routeInventory[0],
  screenshot: path.relative(outRoot, loginShot),
  finalUrl: '/login',
  status: 'login',
  title: 'เข้าสู่ระบบ',
  textSample: 'หน้าเข้าสู่ระบบ ERPTH',
  hasTable: false,
  hasForm: true,
  hasModal: false,
  hasHorizontalOverflow: false,
  elapsedMs: 0,
})

await browser.close()

const result = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  runDate,
  demoDataPrefix: `MANUAL_DEMO_${runDate.replaceAll('-', '')}`,
  note: 'Capture uses local q01 admin through Vite proxy. Dynamic routes use sample id/template ids and are recorded with their real loaded/error/empty/restricted state.',
  coverage,
  mobileShots: [],
  videoResults: [],
}

await fs.writeFile(path.join(dataDir, 'manual-capture-results.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify({
  screenshots: coverage.length,
  outRoot,
}, null, 2))
