import playwright from 'playwright'

const { chromium } = playwright

const baseUrl = process.env.ERPTH_AUDIT_BASE_URL || 'http://localhost:5173'
const routes = [
  '/dashboard',
  '/sales/invoices',
  '/sales/receipts',
  '/sales/invoices/new',
  '/sales/orders',
  '/sales/orders/new',
  '/notes',
  '/purchases/orders',
  '/purchases/orders/new',
  '/purchases/requests',
  '/purchases/requests/new',
  '/expenses',
  '/expenses/new',
  '/customers',
  '/customers/new',
  '/products',
  '/products/new',
  '/accounting/document-review',
  '/accounting/reports',
  '/accounting/reports/profit-loss',
  '/accounting/reports/balance-sheet',
  '/accounting/reports/trial-balance',
  '/accounting/reports/aged-receivables',
  '/accounting/reports/vat',
  '/accounting/tax-settings',
  '/accounting/etax',
  '/excel-import',
  '/backend-connection',
  '/agent',
  '/agent/ocr',
  '/agent/expense',
  '/agent/quotation',
  '/agent/contact',
  '/agent/invoice',
  '/reports-studio',
  '/reports-studio/templates',
  '/reports-studio/branding',
  '/reports-studio/settings',
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 360, height: 800 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()

async function auditCurrentPage(route, error, started) {
  const metrics = await page.evaluate(() => {
    const visible = (selector) =>
      [...document.querySelectorAll(selector)].filter((el) => {
        const style = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }).length
    const text = document.body.innerText || ''
    return {
      url: location.pathname + location.search,
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      tableCount: visible('table'),
      mobileCardCount: visible('.qf-data-table-mobile__card, .qf-invoice-mobile-card'),
      actionDockCount: visible('.qf-page-actions-dock'),
      bottomNavCount: visible('.qf-mobile-nav'),
      moreMenuCount: visible('.qf-mobile-more'),
      buttonCount: visible('button, a.btn'),
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      hasTofuIcon: /□|�/.test(text),
      heading: document.querySelector('h1')?.textContent?.trim() || '',
      textSample: text.slice(0, 180).replace(/\s+/g, ' ').trim(),
    }
  })
  return { route, error, elapsedMs: Date.now() - started, ...metrics }
}

await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#login', 'admin')
await page.fill('#password', 'qadmin')
await page.click('button[type="submit"]')
await page.waitForURL(/\/dashboard/, { timeout: 20000 })

const results = []
for (const route of routes) {
  const started = Date.now()
  let error = null
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(900)
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  results.push(await auditCurrentPage(route, error, started))
}

const detailJourneys = [
  { route: '/sales/invoices', selector: '.qf-invoice-mobile-card__number' },
  { route: '/sales/orders', selector: '.qf-data-table-mobile__primary-value button, .qf-data-table-mobile__primary-value a' },
  { route: '/notes', selector: '.qf-data-table-mobile__primary-value button, .qf-data-table-mobile__primary-value a' },
  { route: '/purchases/orders', selector: '.qf-data-table-mobile__primary-value button, .qf-data-table-mobile__primary-value a' },
  { route: '/purchases/requests', selector: '.qf-data-table-mobile__primary-value button, .qf-data-table-mobile__primary-value a' },
  { route: '/expenses', selector: '.qf-data-table-mobile__primary-value button, .qf-data-table-mobile__primary-value a' },
  { route: '/customers', selector: '.qf-data-table-mobile__field button.btn-link, .qf-data-table-mobile__field a.btn-link' },
]

for (const journey of detailJourneys) {
  const started = Date.now()
  let error = null
  try {
    await page.goto(`${baseUrl}${journey.route}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(900)
    const target = page.locator(journey.selector).first()
    if ((await target.count()) === 0) {
      throw new Error(`No detail target found for selector ${journey.selector}`)
    }
    await target.click()
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(900)
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }
  results.push(await auditCurrentPage(`${journey.route} -> detail`, error, started))
}

await browser.close()

const failures = results.filter((r) => r.error || r.hasHorizontalOverflow || r.hasTofuIcon)
console.log(JSON.stringify({ failures, results }, null, 2))
if (failures.length > 0) {
  process.exitCode = 1
}
