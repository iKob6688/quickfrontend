import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { agentAutoPostExpense, fileToBase64, type ExpenseAutoPostResponse } from '@/api/services/agent.service'
import { toApiError } from '@/api/response'
import { toast } from '@/lib/toastStore'

export function AgentExpenseAutoPostPage() {
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [autoSubmit, setAutoSubmit] = useState(false)
  const [result, setResult] = useState<ExpenseAutoPostResponse | null>(null)

  const expenseMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file)
      return await agentAutoPostExpense({
        file: base64,
        filename: file.name,
        auto_submit: autoSubmit,
      })
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success('สร้างรายจ่ายสำเร็จ', `รายจ่าย #${data.expense_id} - ${data.expense_name}`)
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => setPreview(reader.result as string)
        reader.readAsDataURL(file)
      } else {
        setPreview(null)
      }
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => setPreview(reader.result as string)
        reader.readAsDataURL(file)
      } else {
        setPreview(null)
      }
    }
  }

  const handleSubmit = async () => {
    if (!selectedFile) return
    expenseMutation.mutate(selectedFile)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreview(null)
    setResult(null)
    expenseMutation.reset()
  }

  return (
    <div>
      <PageHeader
        title="Auto-post Expense - รายจ่ายจากใบเสร็จ"
        subtitle="อัปโหลดใบเสร็จเพื่อสร้างรายจ่ายอัตโนมัติด้วย AI"
        breadcrumb="Agent · Expense"
        actions={
          <Button size="sm" variant="ghost" onClick={() => navigate('/agent')}>
            กลับ
          </Button>
        }
      />

      <div className="row">
        <div className="col-lg-6">
          <Card className="p-4 mb-3">
            <h6 className="mb-3">อัปโหลดใบเสร็จ</h6>
            
            <div className="mb-3">
              <div
                className="border border-dashed rounded p-4 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                style={{ minHeight: '200px', cursor: 'pointer' }}
              >
                {preview ? (
                  <div>
                    <img
                      src={preview}
                      alt="Preview"
                      style={{ maxWidth: '100%', maxHeight: '300px' }}
                      className="mb-2"
                    />
                    <div className="small text-muted">{selectedFile?.name}</div>
                  </div>
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '200px' }}>
                    <div className="text-muted mb-2">
                      ลากใบเสร็จมาวาง หรือคลิกเพื่อเลือกไฟล์
                    </div>
                    <div className="small text-muted">
                      รองรับภาพ (JPG, PNG)
                    </div>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="form-control mt-2"
              />
            </div>

            <div className="mb-3">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="autoSubmit"
                  checked={autoSubmit}
                  onChange={(e) => setAutoSubmit(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="autoSubmit">
                  ส่งอัตโนมัติ (Auto-submit expense sheet)
                </label>
              </div>
            </div>

            <div className="d-flex gap-2">
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!selectedFile || expenseMutation.isPending}
                isLoading={expenseMutation.isPending}
              >
                สร้างรายจ่าย
              </Button>
              {selectedFile && (
                <Button variant="secondary" onClick={handleReset}>
                  ล้าง
                </Button>
              )}
            </div>

            {expenseMutation.isError && (
              <div className="alert alert-danger mt-3 mb-0">
                <div className="fw-semibold mb-1">เกิดข้อผิดพลาด</div>
                <div className="small">
                  {toApiError(expenseMutation.error).message}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="col-lg-6">
          <Card className="p-4">
            <h6 className="mb-3">ผลลัพธ์</h6>
            
            {expenseMutation.isPending && (
              <div className="text-center text-muted py-4">
                กำลังสร้างรายจ่าย...
              </div>
            )}

            {result && (
              <div>
                <div className="alert alert-success">
                  <div className="fw-semibold mb-2">สร้างรายจ่ายสำเร็จ</div>
                  <div className="small">
                    <div>เลขที่: {result.expense_name}</div>
                    <div>จำนวนเงิน: {result.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                    <div>สถานะ: {result.state}</div>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/expenses/${result.expense_id}`)}
                  >
                    ดูรายละเอียด
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/expenses')}
                  >
                    ไปที่รายการรายจ่าย
                  </Button>
                </div>
              </div>
            )}

            {!expenseMutation.isPending && !result && (
              <div className="text-center text-muted py-4">
                อัปโหลดใบเสร็จและคลิก "สร้างรายจ่าย" เพื่อดูผลลัพธ์
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

