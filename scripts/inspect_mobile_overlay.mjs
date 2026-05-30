import playwright from 'playwright'
const { chromium, devices } = playwright
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ ...devices['iPhone 14 Pro'] })
const page = await context.newPage()
await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' })
await page.fill('#login', 'admin')
await page.fill('#password', 'qadmin')
await page.click('button[type="submit"]')
await page.waitForURL(/\/dashboard/, { timeout: 20000 })
await page.waitForLoadState('networkidle')
const data = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('*'))
  const fixed = els
    .map((el) => {
      const s = window.getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if ((s.position === 'fixed' || s.position === 'sticky') && rect.width > 20 && rect.height > 20) {
        return {
          tag: el.tagName,
          id: el.id,
          cls: el.className,
          pos: s.position,
          z: s.zIndex,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
          text: (el.textContent || '').trim().slice(0, 120),
        }
      }
      return null
    })
    .filter(Boolean)
    .sort((a,b)=> (Number(b.z||0)-Number(a.z||0)))
  return fixed.slice(0, 20)
})
console.log(JSON.stringify(data, null, 2))
await browser.close()
