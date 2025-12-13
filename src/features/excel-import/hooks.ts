import { useState } from 'react'
import * as XLSX from 'xlsx'

export interface ExcelSheetPreview {
  name: string
  rowCount: number
  columns: string[]
}

export interface ExcelPreviewState {
  file: File | null
  sheets: ExcelSheetPreview[]
}

const MAX_FILE_SIZE_MB = 10

export function useExcelPreview() {
  const [state, setState] = useState<ExcelPreviewState>({
    file: null,
    sheets: [],
  })
  const [error, setError] = useState<string | null>(null)

  const loadFile = async (file: File) => {
    setError(null)

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('รองรับเฉพาะไฟล์ .xlsx เท่านั้น')
      return
    }

    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`ขนาดไฟล์ต้องไม่เกิน ${MAX_FILE_SIZE_MB} MB`)
      return
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })

    const sheets: ExcelSheetPreview[] = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
      const headerRow = (rows[0] ?? []) as string[]
      return {
        name,
        rowCount: rows.length - 1,
        columns: headerRow.map((h) => String(h)),
      }
    })

    setState({ file, sheets })
  }

  return { state, error, loadFile }
}

export interface ExcelValidationIssue {
  sheet: string
  message: string
  column?: string
}

export function useExcelValidator() {
  const [issues, setIssues] = useState<ExcelValidationIssue[]>([])

  const validate = (preview: ExcelPreviewState, requiredColumns: string[]) => {
    const nextIssues: ExcelValidationIssue[] = []

    for (const sheet of preview.sheets) {
      for (const col of requiredColumns) {
        if (!sheet.columns.includes(col)) {
          nextIssues.push({
            sheet: sheet.name,
            column: col,
            message: `ไม่พบคอลัมน์ ${col} ในชีต ${sheet.name}`,
          })
        }
      }
    }

    setIssues(nextIssues)
    return nextIssues.length === 0
  }

  return { issues, validate }
}


