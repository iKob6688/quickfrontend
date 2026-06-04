import playwright from 'playwright'

const { chromium } = playwright
const baseUrl = process.env.ERPTH_AUDIT_BASE_URL || 'http://localhost:5173'

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#login', 'admin')
  await page.fill('#password', 'qadmin')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 20000 })
}

const browser = await chromium.launch({ headless: true })

const desktop = await browser.newContext({ viewport: { width: 1600, height: 768 } })
const desktopPage = await desktop.newPage()
await login(desktopPage)
await desktopPage.goto(`${baseUrl}/sales/orders`, { waitUntil: 'networkidle' })
const desktopMetrics = await desktopPage.evaluate(() => {
  const buttons = [...document.querySelectorAll('.qf-top-nav-btn')]
  const labels = buttons.map((el) => el.textContent?.trim().replace(/\s+/g, ' '))
  const wraps = buttons.map((el) => {
    const rect = el.getBoundingClientRect()
    return {
      label: el.textContent?.trim().replace(/\s+/g, ' '),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      hasWrapped: rect.height > 48,
    }
  })
  return {
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    labels,
    wraps,
    topNavCount: buttons.length,
    hasMore: labels.includes('เพิ่มเติม'),
    hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }
})
const desktopTabMetrics = await desktopPage.evaluate(() => {
  const tabs = [...document.querySelectorAll('.qf-tabs__btn')]
  return tabs.map((el) => {
    const rect = el.getBoundingClientRect()
    return {
      label: el.textContent?.trim().replace(/\s+/g, ' '),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      hasWrapped: rect.height > 48,
      whiteSpace: getComputedStyle(el).whiteSpace,
    }
  })
})
await desktopPage.click('.qf-top-nav-btn--more')
const desktopMoreMetrics = await desktopPage.evaluate(() => ({
  moreVisible: !!document.querySelector('.qf-desktop-more'),
  moreItems: [...document.querySelectorAll('.qf-desktop-more__item')].map((el) =>
    el.textContent?.trim().replace(/\s+/g, ' '),
  ),
}))
await desktop.close()

const mobile = await browser.newContext({
  viewport: { width: 360, height: 800 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const mobilePage = await mobile.newPage()
await login(mobilePage)
await mobilePage.goto(`${baseUrl}/sales/orders`, { waitUntil: 'networkidle' })
const mobileMetrics = await mobilePage.evaluate(() => ({
  width: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  labels: [...document.querySelectorAll('.qf-mobile-nav__item')].map((el) =>
    el.textContent?.trim().replace(/\s+/g, ' '),
  ),
  hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
}))
await mobile.close()
await browser.close()

const result = { desktopMetrics, desktopTabMetrics, desktopMoreMetrics, mobileMetrics }
const failures = []
if (desktopMetrics.hasHorizontalOverflow) failures.push('desktop overflow')
if (!desktopMetrics.hasMore) failures.push('desktop missing more')
if (desktopMetrics.topNavCount > 7) failures.push('desktop too many visible nav items')
if (desktopMetrics.wraps.some((item) => item.hasWrapped)) failures.push('desktop nav label wrapped')
if (desktopTabMetrics.some((item) => item.hasWrapped || item.whiteSpace !== 'nowrap')) failures.push('desktop tab label wrapped')
if (!desktopMoreMetrics.moreVisible || desktopMoreMetrics.moreItems.length < 8) failures.push('desktop more menu incomplete')
if (mobileMetrics.hasHorizontalOverflow) failures.push('mobile overflow')
if (mobileMetrics.labels.join('|') !== 'หน้าหลัก|ใบเสนอ|ใบแจ้งหนี้|ใบเสร็จ|เมนู') {
  failures.push(`mobile order mismatch: ${mobileMetrics.labels.join('|')}`)
}

console.log(JSON.stringify({ failures, ...result }, null, 2))
if (failures.length > 0) process.exitCode = 1
