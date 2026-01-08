import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'
import { setAgentToken } from '@/lib/agentToken'

const basePath = '/th/v1/agent'
const frontendBasePath = '/web/adt/th/v1/agent'  // Frontend endpoints (session auth)

// Helper function to convert File to base64 string
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// OCR Response
export interface OcrResponse {
  text: string
  filename: string
  method: 'vision' | 'ocr'
}

export interface OcrRequest {
  file: string // base64 encoded file
  filename: string
  use_vision?: boolean
  prompt?: string
}

// Expense Auto-Post Response
export interface ExpenseAutoPostResponse {
  expense_id: number
  expense_name: string
  amount: number
  state: string
}

export interface ExpenseAutoPostRequest {
  file?: string // base64 encoded receipt
  filename?: string
  extracted_data?: {
    amount?: number
    date?: string
    description?: string
    product_id?: number
    employee_id?: number
  }
  employee_id?: number
  product_id?: number
  auto_submit?: boolean
}

// Quotation Create Response
export interface QuotationCreateResponse {
  quotation_id: number
  quotation_name: string
  customer_id: number
  amount_total: number
}

export interface QuotationLineRequest {
  product_id: number
  quantity: number
  price_unit: number
}

export interface QuotationCreateRequest {
  customer_id?: number
  customer_data?: {
    name: string
    email?: string
    phone?: string
  }
  lines: QuotationLineRequest[]
  file?: string // base64 encoded quotation document
  extracted_data?: {
    customer_name?: string
    customer_email?: string
    customer_phone?: string
    lines?: Array<{
      product_name: string
      quantity: number
      price_unit: number
    }>
    date?: string
  }
}

// Contact Create Response
export interface ContactCreateResponse {
  contact_id: number
  contact_name: string
  email?: string
  phone?: string
  created: boolean // true if new contact, false if updated existing
}

export interface ContactCreateRequest {
  file?: string // base64 encoded business card
  extracted_data?: {
    name?: string
    email?: string
    phone?: string
    mobile?: string
    vat?: string
    website?: string
    address?: string
  }
  contact_data?: {
    name: string
    email?: string
    phone?: string
    mobile?: string
    vat?: string
    website?: string
    street?: string
  }
}

// Invoice Create Response
export interface InvoiceCreateResponse {
  invoice_id: number
  invoice_number?: string
  customer_id: number
  customer_name?: string
  amount_total: number
  status: string
}

export interface InvoiceLineRequest {
  product_id?: number | null
  description: string
  quantity: number
  unit_price: number
  tax_ids?: number[]
}

export interface InvoiceCreateRequest {
  customer_id?: number
  customer_data?: {
    name: string
    email?: string
    phone?: string
    vat?: string
  }
  invoice_date?: string
  due_date?: string
  currency?: string
  lines: InvoiceLineRequest[]
  notes?: string
  file?: string // base64 encoded invoice document
  extracted_data?: {
    customer_name?: string
    customer_email?: string
    customer_phone?: string
    customer_vat?: string
    invoice_date?: string
    due_date?: string
    lines?: Array<{
      product_name?: string
      description: string
      quantity: number
      unit_price: number
    }>
    total?: number
  }
}

// Agent Status Response
export interface AgentStatusResponse {
  agent_name: string
  active: boolean
  agent_token?: string  // Optional: returned from frontend endpoint
  permissions: {
    can_ocr: boolean
    can_post_expense: boolean
    can_create_quotation: boolean
    can_create_contact: boolean
    can_create_invoice?: boolean
    can_update_data: boolean
  }
  usage: {
    requests_today: number
    max_requests_per_day: number
    total_requests: number
    last_used_at: string | null
    last_operation: string | null
  }
  company_id: number | null
  company_name: string | null
}

/**
 * OCR endpoint - Extract text from image/PDF
 */
export async function agentOcr(request: OcrRequest): Promise<OcrResponse> {
  const body = makeRpc(request, { includeDb: false })
  const response = await apiClient.post(`${basePath}/ocr`, body)
  return unwrapResponse<OcrResponse>(response)
}

/**
 * Auto-post expense from receipt/image
 */
export async function agentAutoPostExpense(
  request: ExpenseAutoPostRequest,
): Promise<ExpenseAutoPostResponse> {
  const body = makeRpc(request, { includeDb: false })
  const response = await apiClient.post(`${basePath}/expense/auto-post`, body)
  return unwrapResponse<ExpenseAutoPostResponse>(response)
}

/**
 * Create quotation from document or data
 */
export async function agentCreateQuotation(
  request: QuotationCreateRequest,
): Promise<QuotationCreateResponse> {
  const body = makeRpc(request, { includeDb: false })
  const response = await apiClient.post(`${basePath}/quotation/create`, body)
  return unwrapResponse<QuotationCreateResponse>(response)
}

/**
 * Create contact from business card/image or data
 */
export async function agentCreateContact(
  request: ContactCreateRequest,
): Promise<ContactCreateResponse> {
  const body = makeRpc(request, { includeDb: false })
  const response = await apiClient.post(`${basePath}/contact/create`, body)
  return unwrapResponse<ContactCreateResponse>(response)
}

/**
 * Create invoice from document or data
 */
export async function agentCreateInvoice(
  request: InvoiceCreateRequest,
): Promise<InvoiceCreateResponse> {
  const body = makeRpc(request, { includeDb: false })
  const response = await apiClient.post(`${basePath}/invoice/create`, body)
  return unwrapResponse<InvoiceCreateResponse>(response)
}

/**
 * Get agent status and permissions
 * Uses frontend endpoint (session auth) - no API key or agent token required
 */
export async function getAgentStatus(): Promise<AgentStatusResponse> {
  const body = makeRpc({}, { includeDb: false })
  const response = await apiClient.post(`${frontendBasePath}/status`, body)
  const result = await unwrapResponse<AgentStatusResponse>(response)
  
  // If agent_token is returned, store it for use in API calls
  if (result.agent_token) {
    setAgentToken(result.agent_token)
  }
  
  return result
}

