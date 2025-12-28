/**
 * Utility functions to check if Expenses API is available
 */
import { apiClient } from '@/api/client'
import { makeRpc } from '@/api/services/rpc'

const basePath = '/th/v1/expenses'

export async function checkExpensesApiAvailable(): Promise<{
  available: boolean
  error?: string
  statusCode?: number
}> {
  try {
    const response = await apiClient.post(
      `${basePath}/list`,
      makeRpc({
        limit: 1,
      }),
    )

    return {
      available: true,
      statusCode: response.status,
    }
  } catch (error: any) {
    const status = error?.response?.status
    const message = error?.message || 'Unknown error'

    if (status === 404) {
      return {
        available: false,
        error: 'API endpoint ไม่พบ (404) - Backend ยังไม่ได้ implement หรือ routes ยังไม่ถูก register',
        statusCode: 404,
      }
    }

    if (status === 401) {
      return {
        available: false,
        error: 'Unauthorized (401) - API Key หรือ Bearer token ไม่ถูกต้อง',
        statusCode: 401,
      }
    }

    if (status === 403) {
      return {
        available: false,
        error: 'Forbidden (403) - Scope/Permission ไม่พอ (ต้องมี scope: expenses)',
        statusCode: 403,
      }
    }

    if (status === 500) {
      return {
        available: false,
        error: 'Server Error (500) - Backend (Odoo) มีปัญหา (ดู odoo18-api logs)',
        statusCode: 500,
      }
    }

    return {
      available: false,
      error: `Error ${status || 'Unknown'}: ${message}`,
      statusCode: status,
    }
  }
}


