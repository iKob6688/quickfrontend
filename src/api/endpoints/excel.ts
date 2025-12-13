import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'

export type ImportType =
  | 'customers'
  | 'products'
  | 'expenses'
  | 'invoices'
  | 'other'

export interface ExcelImportJob {
  jobId: string
  importType: ImportType
  totalRows: number
  acceptedRows: number
  failedRows: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
}

export interface ExcelImportResult {
  summary: {
    totalRows: number
    acceptedRows: number
    failedRows: number
  }
  failedFileUrl?: string
}

// NOTE: axios baseURL is VITE_API_BASE_URL (= '/api'), so endpoint paths here must NOT start with '/api'
const basePath = '/th/v1/excel'

/**
 * Creates a JSON-RPC 2.0 request body for Odoo endpoints
 */
function makeRpc(params: Record<string, unknown>) {
  return {
    jsonrpc: '2.0' as const,
    method: 'call' as const,
    params,
  }
}

/**
 * Uploads Excel file for import.
 * Note: FormData is sent directly (not wrapped in JSON-RPC) as it's multipart/form-data.
 * Backend should handle this appropriately.
 */
export async function uploadExcelFile(params: {
  file: File
  importType: ImportType
}) {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('import_type', params.importType)

  const response = await apiClient.post(
    `${basePath}/import`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )

  return unwrapResponse<ExcelImportJob>(response)
}

export async function getImportJobStatus(jobId: string) {
  const body = makeRpc({ job_id: jobId })
  const response = await apiClient.post(`${basePath}/import/${jobId}`, body)
  return unwrapResponse<ExcelImportJob>(response)
}

export async function getImportResult(jobId: string) {
  const body = makeRpc({ job_id: jobId })
  const response = await apiClient.post(`${basePath}/import/${jobId}/result`, body)
  return unwrapResponse<ExcelImportResult>(response)
}


