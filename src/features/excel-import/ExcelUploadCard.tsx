import { useState } from 'react'
import { ExcelIcon } from '@/components/icons/ExcelIcon'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useExcelPreview, useExcelValidator } from './hooks'
import {
  uploadExcelFile,
  getImportJobStatus,
  getImportResult,
  type ImportType,
} from '@/api/services/excel.service'
import { toast } from '@/lib/toastStore'

type UploadPhase = 'idle' | 'preview' | 'uploading' | 'processing' | 'completed'

interface Props {
  importType: ImportType
}

export function ExcelUploadCard({ importType }: Props) {
  const { state, error, loadFile } = useExcelPreview()
  const { issues, validate } = useExcelValidator()

  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [summary, setSummary] = useState<
    | {
        totalRows: number
        acceptedRows: number
        failedRows: number
        failedFileUrl?: string
      }
    | undefined
  >(undefined)

  const onFileSelected = async (file: File) => {
    await loadFile(file)
    setPhase('preview')
  }

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      await onFileSelected(file)
    }
  }

  const handleDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      await onFileSelected(file)
    }
  }

  const handleUpload = async () => {
    if (!state.file) return

    const ok = validate(state, []) // feature modules can pass required columns; empty here as generic
    if (!ok) return

    setPhase('uploading')
    try {
      const job = await uploadExcelFile({ file: state.file, importType })
      setJobId(job.jobId)
      setPhase('processing')

      // simple polling – can be extracted to dedicated hook later
      const poll = async () => {
        if (!job.jobId) return
        const latest = await getImportJobStatus(job.jobId)
        if (latest.status === 'completed' || latest.status === 'failed') {
          const result = await getImportResult(job.jobId)
          setSummary(result.summary)
          setSummary((prev) =>
            prev
              ? { ...prev, failedFileUrl: result.failedFileUrl }
              : {
                  ...result.summary,
                  failedFileUrl: result.failedFileUrl,
                },
          )
          setPhase('completed')
          if (latest.status === 'completed') {
            toast.success('นำเข้า Excel สำเร็จ')
          } else {
            toast.error('นำเข้า Excel ไม่สำเร็จ', 'กรุณาตรวจสอบไฟล์ผลลัพธ์')
          }
          return
        }

        setTimeout(poll, 2000)
      }

      void poll()
    } catch (e) {
      setPhase('preview')
      toast.error('อัปโหลดไฟล์ไม่สำเร็จ', e instanceof Error ? e.message : undefined)
      throw e
    }
  }

  const hasFile = !!state.file

  return (
    <Card
      header={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ExcelIcon size={20} />
            <div>
              <p className="text-sm font-medium text-surfaceDark">
                อัปโหลดไฟล์ Excel
              </p>
              <p className="text-[11px] text-surfaceDark/70">
                รองรับ .xlsx เท่านั้น — import type: {importType}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-primary/40 bg-bgLight/60 px-4 py-6 text-center text-xs text-surfaceDark/70"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <p className="font-medium text-surfaceDark">
          ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์
        </p>
        <p className="text-[11px] text-surfaceDark/70">
          สูงสุด 10 MB · .xlsx เท่านั้น
        </p>
        <input
          type="file"
          accept=".xlsx"
          className="mt-3"
          onChange={handleInputChange}
        />
      </div>

      {error && (
        <p className="mt-2 text-xs text-accentPink">
          {error}
        </p>
      )}

      {hasFile && (
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-surfaceDark">
              ไฟล์ที่เลือก: {state.file?.name}
            </span>
            <span className="text-surfaceDark/70">
              {Math.round((state.file!.size / 1024 / 1024) * 10) / 10} MB
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {state.sheets.map((sheet) => (
              <div
                key={sheet.name}
                className="rounded-2xl bg-white/70 px-3 py-2 shadow-soft"
              >
                <p className="text-xs font-medium text-surfaceDark">
                  {sheet.name}
                </p>
                <p className="text-[11px] text-surfaceDark/70">
                  {sheet.rowCount} แถว · {sheet.columns.length} คอลัมน์
                </p>
              </div>
            ))}
          </div>
          {issues.length > 0 && (
            <div className="rounded-2xl bg-accentPink/5 px-3 py-2 text-[11px] text-accentPink">
              <p className="mb-1 font-medium">พบปัญหาโครงสร้างไฟล์</p>
              <ul className="list-disc pl-4">
                {issues.map((issue, idx) => (
                  <li key={idx}>
                    {issue.message}
                    {issue.column ? ` (${issue.column})` : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          size="md"
          disabled={!hasFile || !!error}
          isLoading={phase === 'uploading' || phase === 'processing'}
          onClick={handleUpload}
        >
          ส่งไฟล์ไปยังเซิร์ฟเวอร์
        </Button>
        {phase === 'processing' && (
          <p className="text-[11px] text-surfaceDark/70">
            กำลังประมวลผลบนเซิร์ฟเวอร์ (Job: {jobId})
          </p>
        )}
      </div>

      {phase === 'completed' && summary && (
        <div className="mt-4 rounded-2xl bg-secondary/5 px-3 py-3 text-[11px] text-surfaceDark/90">
          <p className="mb-1 font-medium">ผลการนำเข้า</p>
          <p>
            ทั้งหมด {summary.totalRows} แถว · ผ่าน{' '}
            {summary.acceptedRows} แถว · ไม่ผ่าน {summary.failedRows} แถว
          </p>
          {summary.failedFileUrl && (
            <a
              href={summary.failedFileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[11px] font-medium text-primary underline"
            >
              ดาวน์โหลดไฟล์แถวที่ไม่ผ่าน
            </a>
          )}
        </div>
      )}
    </Card>
  )
}


