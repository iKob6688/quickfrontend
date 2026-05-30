import playwright from 'playwright'

const { chromium, devices } = playwright

async function run(deviceName, outPrefix) {
  const browser = await chromium.launch({ headless: true })
  const device = devices[deviceName]
  const context = await browser.newContext({ ...device })
  const page = await context.newPage()

  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' })
  await page.fill('#login', 'admin')
  await page.fill('#password', 'qadmin')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `/private/tmp/${outPrefix}-dashboard.png`, fullPage: true })

  await page.goto('http://localhost:5173/accounting/reports', { waitUntil: 'networkidle' })
  await page.screenshot({ path: `/private/tmp/${outPrefix}-reports.png`, fullPage: true })

  await page.goto('http://localhost:5173/products', { waitUntil: 'networkidle' })
  await page.screenshot({ path: `/private/tmp/${outPrefix}-products.png`, fullPage: true })

  await browser.close()
}

await run('iPhone 14 Pro', 'erpth-mobile-iphone14pro-in')
await run('Galaxy S9+', 'erpth-mobile-galaxys9-in')
console.log('done')
