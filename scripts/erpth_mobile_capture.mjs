import playwright from 'playwright'

const { chromium, devices } = playwright
const browser = await chromium.launch({ headless: true })

const ios = devices['iPhone 14 Pro']
const context1 = await browser.newContext({ ...ios })
const page1 = await context1.newPage()
await page1.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page1.screenshot({ path: '/private/tmp/erpth-mobile-iphone14pro.png', fullPage: true })
await context1.close()

const context2 = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page2 = await context2.newPage()
await page2.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page2.screenshot({ path: '/private/tmp/erpth-mobile-360x800.png', fullPage: true })
await context2.close()

await browser.close()
console.log('saved screenshots')
