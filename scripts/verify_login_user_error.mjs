import playwright from 'playwright'
const { chromium, devices } = playwright
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ ...devices['iPhone 14 Pro'] })
const page = await context.newPage()
await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' })
await page.fill('#login', 'admin')
await page.fill('#password', 'wrongpass')
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)
await page.screenshot({ path: '/private/tmp/erpth-mobile-login-user-error.png', fullPage: false })
await browser.close()
console.log('done')
