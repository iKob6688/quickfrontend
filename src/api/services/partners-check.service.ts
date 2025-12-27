/**
 * Utility functions to check if Partners API is available
 */
import { apiClient } from '@/api/client'
import { makeRpc } from '@/api/services/rpc'

const basePath = '/th/v1/partners'

/**
 * Test if Partners API endpoint is available
 * Returns true if endpoint exists and is accessible, false otherwise
 */
export async function checkPartnersApiAvailable(): Promise<{
  available: boolean
  error?: string
  statusCode?: number
}> {
  try {
    const response = await apiClient.post(
      `${basePath}/list`,
      makeRpc({
        limit: 1, // Just test with minimal data
      }),
    )
    
    // If we get a response (even if empty), the endpoint exists
    return {
      available: true,
      statusCode: response.status,
    }
  } catch (error: any) {
    const status = error?.response?.status
    const message = error?.message || 'Unknown error'
    
    // 404 means endpoint doesn't exist
    if (status === 404) {
      return {
        available: false,
        error: 'API endpoint ไม่พบ (404) - Backend ยังไม่ได้ implement',
        statusCode: 404,
      }
    }
    
    // 401 means auth issue
    if (status === 401) {
      return {
        available: false,
        error: 'Unauthorized (401) - API Key หรือ Bearer token ไม่ถูกต้อง',
        statusCode: 401,
      }
    }
    
    // 500 means server error (endpoint exists but has issues)
    if (status === 500) {
      return {
        available: false,
        error: 'Server Error (500) - Backend มีปัญหา',
        statusCode: 500,
      }
    }
    
    // Other errors
    return {
      available: false,
      error: `Error ${status || 'Unknown'}: ${message}`,
      statusCode: status,
    }
  }
}

