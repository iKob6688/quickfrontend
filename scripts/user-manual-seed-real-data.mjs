import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const baseUrl = process.env.ERPTH_MANUAL_BASE_URL || 'https://qacc.erpth.net'
const credentials = {
  login: process.env.ERPTH_MANUAL_LOGIN || 'admin',
  password: process.env.ERPTH_MANUAL_PASSWORD || 'qadmin',
}
const runDate = new Date().toISOString().slice(0, 10).replaceAll('-', '')
const prefix = process.env.ERPTH_MANUAL_DEMO_PREFIX || `MANUAL_REAL_${runDate}`

async function readApiKey() {
  if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY
  const env = await fs.readFile('.env', 'utf8').catch(() => '')
  const line = env.split(/\r?\n/).find((row) => row.startsWith('VITE_API_KEY='))
  return line ? line.slice('VITE_API_KEY='.length).trim() : ''
}

function rpc(params) {
  return { jsonrpc: '2.0', method: 'call', params }
}

function unwrap(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (parsed?.error) {
    const message = parsed.error?.data?.message || parsed.error?.message || 'API request failed'
    throw new Error(message)
  }
  const result = parsed?.result ?? parsed
  if (result?.success === false) {
    const message = typeof result.error === 'string'
      ? result.error
      : result.error?.message || 'API request failed'
    throw new Error(message)
  }
  return result?.data ?? result
}

async function main() {
  const apiKey = await readApiKey()
  if (!apiKey) throw new Error('Missing VITE_API_KEY in environment or .env')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } })
  page.setDefaultTimeout(20000)

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#login', credentials.login)
  await page.fill('#password', credentials.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

  async function api(path, params, method = 'POST') {
    return page.evaluate(
      async ({ path, params, method, apiKey }) => {
        const token = localStorage.getItem('qf18_access_token')
        const instanceId = localStorage.getItem('qf18_instance_public_id')
        const response = await fetch(`/api${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Instance-ID': instanceId || '',
            'X-ADT-API-Key': apiKey,
          },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params }),
        })
        const text = await response.text()
        return { status: response.status, text }
      },
      { path, params, method, apiKey },
    ).then((res) => {
      if (res.status < 200 || res.status >= 300) throw new Error(`${path} returned ${res.status}: ${res.text}`)
      return unwrap(res.text)
    })
  }

  async function firstOrCreatePartner(kind, suffix) {
    const name = `${prefix} ${suffix}`
    const listed = await api('/th/v1/partners/list', { q: name, search: name, limit: 5 }).catch(() => ({ items: [] }))
    const items = Array.isArray(listed) ? listed : listed.items || []
    const found = items.find((item) => String(item.name || item.display_name || '').includes(name))
    if (found?.id) return found
    return api('/th/v1/partners/create', {
      company_type: 'company',
      name,
      email: `${suffix.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      phone: '020000000',
      street: 'Manual demo address',
      city: 'Bangkok',
      zip: '10110',
      tags: [kind],
      active: true,
    })
  }

  async function firstOrCreateProduct() {
    const name = `${prefix} Service`
    const listed = await api('/th/v1/products/list', { q: name, search: name, limit: 5 }).catch(() => ({ items: [] }))
    const items = Array.isArray(listed) ? listed : listed.items || []
    const found = items.find((item) => String(item.name || item.display_name || '').includes(name))
    if (found?.id) return found
    return api('/th/v1/products', {
      name,
      defaultCode: `${prefix}_SVC`,
      barcode: `${runDate}001`,
      listPrice: 12500,
      saleOk: true,
      purchaseOk: true,
      active: true,
      description: 'Service item for ERPTH Qacc manual screenshots',
      productType: 'service',
      saleTaxIds: [],
      purchaseTaxIds: [],
      taxes_id: [],
      tax_ids: [],
      supplier_taxes_id: [],
    })
  }

  const customer = await firstOrCreatePartner('customer', 'Customer')
  const vendor = await firstOrCreatePartner('vendor', 'Vendor')
  const product = await firstOrCreateProduct()
  const today = new Date().toISOString().slice(0, 10)

  const created = { prefix, customer, vendor, product, invoice: null, postedInvoice: null, payment: null, purchaseOrder: null }

  try {
    created.invoice = await api('/th/v1/sales/invoices', {
      customerId: Number(customer.id),
      invoiceDate: today,
      dueDate: today,
      currency: 'THB',
      notes: `${prefix} invoice for user manual screenshots`,
      lines: [
        {
          productId: Number(product.id),
          description: `${prefix} Service`,
          quantity: 1,
          unitPrice: 12500,
          taxRate: 0,
          subtotal: 12500,
        },
      ],
    })
    if (created.invoice?.id) {
      created.postedInvoice = await api(`/th/v1/sales/invoices/${created.invoice.id}/post`, { id: Number(created.invoice.id) }).catch((err) => ({ error: err.message }))
      created.payment = await api(`/th/v1/sales/invoices/${created.invoice.id}/register-payment`, {
        id: Number(created.invoice.id),
        amount: 12500,
        grossAmount: 12500,
        netAmount: 12500,
        date: today,
        method: 'manual',
        reference: `${prefix}-PAY`,
        whtCode: 'none',
        whtRate: 0,
        whtAmount: 0,
      }).catch((err) => ({ error: err.message }))
    }
  } catch (err) {
    created.invoice = { error: err instanceof Error ? err.message : String(err) }
  }

  try {
    created.purchaseOrder = await api('/th/v1/purchases/orders', {
      vendorId: Number(vendor.id),
      orderDate: today,
      expectedDate: today,
      currency: 'THB',
      notes: `${prefix} purchase order for user manual screenshots`,
      lines: [
        {
          productId: Number(product.id),
          description: `${prefix} Service`,
          quantity: 1,
          unitPrice: 8500,
          taxIds: [],
          subtotal: 8500,
          totalTax: 0,
          total: 8500,
        },
      ],
    })
  } catch (err) {
    created.purchaseOrder = { error: err instanceof Error ? err.message : String(err) }
  }

  await browser.close()
  await fs.mkdir('Users Manaul Qacc/data', { recursive: true })
  await fs.writeFile('Users Manaul Qacc/data/manual-real-demo-seed.json', JSON.stringify(created, null, 2))
  console.log(JSON.stringify(created, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
