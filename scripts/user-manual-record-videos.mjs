import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const baseUrl = process.env.ERPTH_MANUAL_BASE_URL || 'http://127.0.0.1:5173'
const outRoot = path.resolve('Users Manaul Qacc')
const videoDir = path.join(outRoot, 'videos')
const dataDir = path.join(outRoot, 'data')
const rawDir = path.join(videoDir, '_raw-webm')
const ffmpeg = process.env.FFMPEG_PATH || '/opt/homebrew/opt/ffmpeg/bin/ffmpeg'
const credentials = {
  login: process.env.ERPTH_MANUAL_LOGIN || 'admin',
  password: process.env.ERPTH_MANUAL_PASSWORD || 'qadmin',
}

await fs.mkdir(videoDir, { recursive: true })
await fs.mkdir(rawDir, { recursive: true })
await fs.mkdir(dataDir, { recursive: true })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (buf) => {
      stderr += buf.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited ${code}: ${stderr}`))
    })
  })
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#login', credentials.login)
  await page.fill('#password', credentials.password)
  await sleep(350)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 25000 })
  await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {})
  await sleep(900)
}

async function goto(page, route, pause = 1300) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {})
  await sleep(pause)
}

async function clickText(page, text, pause = 900) {
  await page.getByText(text, { exact: false }).first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await sleep(pause)
}

async function typeInFirstInput(page, value, pause = 900) {
  const input = page.locator('input:visible').first()
  if ((await input.count()) > 0) {
    await input.click().catch(() => {})
    await input.fill(value).catch(() => {})
    await sleep(pause)
  }
}

const flows = [
  {
    id: '01-login-dashboard-navigation',
    title: 'Login, Dashboard และ Navigation',
    run: async (page) => {
      await login(page)
      await clickText(page, 'ค้นหาเมนู')
      await typeInFirstInput(page, 'รายงาน')
      await page.keyboard.press('Escape').catch(() => {})
      await goto(page, '/sales/orders')
      await goto(page, '/sales/invoices')
      await goto(page, '/backend-connection')
    },
  },
  {
    id: '02-master-data-customers-products',
    title: 'ข้อมูลหลัก ลูกค้า และสินค้า',
    run: async (page) => {
      await login(page)
      await goto(page, '/customers')
      await typeInFirstInput(page, 'MANUAL_DEMO')
      await goto(page, '/customers/new')
      await typeInFirstInput(page, 'MANUAL_DEMO Customer')
      await goto(page, '/products')
      await typeInFirstInput(page, 'MANUAL_DEMO')
      await goto(page, '/products/new')
      await typeInFirstInput(page, 'MANUAL_DEMO Service')
    },
  },
  {
    id: '03-sales-quotation-to-invoice',
    title: 'การขาย ใบเสนอราคา ถึงใบแจ้งหนี้',
    run: async (page) => {
      await login(page)
      await goto(page, '/sales/orders')
      await typeInFirstInput(page, 'MANUAL_DEMO')
      await goto(page, '/sales/orders/new')
      await typeInFirstInput(page, 'MANUAL_DEMO Customer')
      await goto(page, '/sales/orders/1')
      await goto(page, '/sales/invoices')
    },
  },
  {
    id: '04-invoice-receipt-payment',
    title: 'ใบแจ้งหนี้ ใบเสร็จ และรับชำระ',
    run: async (page) => {
      await login(page)
      await goto(page, '/sales/invoices')
      await typeInFirstInput(page, 'MANUAL_DEMO')
      await goto(page, '/sales/invoices/new')
      await typeInFirstInput(page, 'MANUAL_DEMO Customer')
      await goto(page, '/sales/invoices/1')
      await clickText(page, 'รับชำระ', 1000)
      await page.keyboard.press('Escape').catch(() => {})
      await goto(page, '/sales/receipts')
    },
  },
  {
    id: '05-purchase-expense-flow',
    title: 'การซื้อและรายจ่าย',
    run: async (page) => {
      await login(page)
      await goto(page, '/purchases/requests')
      await goto(page, '/purchases/requests/new')
      await typeInFirstInput(page, 'MANUAL_DEMO')
      await goto(page, '/purchases/orders')
      await goto(page, '/purchases/orders/new')
      await typeInFirstInput(page, 'MANUAL_DEMO Vendor')
      await goto(page, '/expenses')
      await goto(page, '/expenses/new')
      await typeInFirstInput(page, 'MANUAL_DEMO Expense')
    },
  },
  {
    id: '06-accounting-etax-reports',
    title: 'รายงานบัญชี ภาษี e-Tax และตรวจเอกสาร',
    run: async (page) => {
      await login(page)
      await goto(page, '/accounting/reports')
      await goto(page, '/accounting/reports/profit-loss')
      await goto(page, '/accounting/reports/balance-sheet')
      await goto(page, '/accounting/reports/vat')
      await goto(page, '/accounting/etax')
      await goto(page, '/accounting/document-review')
    },
  },
]

const browser = await chromium.launch({ headless: true })
const results = []

for (const flow of flows) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1440, height: 900 } },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  let error = null
  try {
    await flow.run(page)
    await sleep(1000)
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }
  const rawVideo = await page.video()?.path()
  await context.close()
  if (!rawVideo) {
    results.push({ id: flow.id, title: flow.title, error: error || 'No raw video path' })
    continue
  }
  const mp4Path = path.join(videoDir, `${flow.id}.mp4`)
  await run(ffmpeg, [
    '-y',
    '-i',
    rawVideo,
    '-vf',
    'fps=30,format=yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    mp4Path,
  ])
  results.push({
    id: flow.id,
    title: flow.title,
    path: path.relative(outRoot, mp4Path),
    raw: path.relative(outRoot, rawVideo),
    error,
    type: 'real-browser-recording',
  })
}

await browser.close()

await fs.writeFile(
  path.join(dataDir, 'manual-video-results.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, results }, null, 2),
)

console.log(JSON.stringify({ videos: results.length, videoDir }, null, 2))
