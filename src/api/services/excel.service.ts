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

// Backend reality (adt_th_api): upload is HTTP multipart, status/result are JSON GET
const basePath = '/th/v1/excel'

export async function uploadExcelFile(params: { file: File; importType: ImportType }) {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('import_type', params.importType)

  const response = await apiClient.post(`${basePath}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return unwrapResponse<ExcelImportJob>(response)
}

export async function getImportJobStatus(jobId: string) {
  const response = await apiClient.get(`${basePath}/import/${jobId}`)
  return unwrapResponse<ExcelImportJob>(response)
}

export async function getImportResult(jobId: string) {
  const response = await apiClient.get(`${basePath}/import/${jobId}/result`)
  return unwrapResponse<ExcelImportResult>(response)
}


