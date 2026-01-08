import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { agentOcr, fileToBase64, type OcrResponse } from '@/api/services/agent.service'
import { toApiError } from '@/api/response'

export function AgentOCRUploadPage() {
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [useVision, setUseVision] = useState(false)
  const [prompt, setPrompt] = useState('Extract all text from this document')
  const [result, setResult] = useState<OcrResponse | null>(null)

  const ocrMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file)
      return await agentOcr({
        file: base64,
        filename: file.name,
        use_vision: useVision,
        prompt: useVision ? prompt : undefined,
      })
    },
    onSuccess: (data) => {
      setResult(data)
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
      
      // Create preview for images
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
    ocrMutation.mutate(selectedFile)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreview(null)
    setResult(null)
    ocrMutation.reset()
  }

  return (
    <div>
      <PageHeader
        title="OCR - สแกนเอกสาร"
        subtitle="สแกนข้อความจากภาพหรือ PDF"
        breadcrumb="Agent · OCR"
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate('/agent')}>
              กลับ
            </Button>
          </div>
        }
      />

      <div className="row">
        <div className="col-lg-6">
          <Card className="p-4 mb-3">
            <h6 className="mb-3">อัปโหลดไฟล์</h6>
            
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
                      ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์
                    </div>
                    <div className="small text-muted">
                      รองรับภาพ (JPG, PNG) และ PDF
                    </div>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="form-control mt-2"
              />
            </div>

            <div className="mb-3">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="useVision"
                  checked={useVision}
                  onChange={(e) => setUseVision(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="useVision">
                  ใช้ GPT-4 Vision (สำหรับการดึงข้อมูลแบบโครงสร้าง)
                </label>
              </div>
            </div>

            {useVision && (
              <div className="mb-3">
                <Label htmlFor="prompt">Prompt (คำสั่ง)</Label>
                <Input
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Extract all text from this document"
                />
              </div>
            )}

            <div className="d-flex gap-2">
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!selectedFile || ocrMutation.isPending}
                isLoading={ocrMutation.isPending}
              >
                สแกนข้อความ
              </Button>
              {selectedFile && (
                <Button variant="secondary" onClick={handleReset}>
                  ล้าง
                </Button>
              )}
            </div>

            {ocrMutation.isError && (
              <div className="alert alert-danger mt-3 mb-0">
                <div className="fw-semibold mb-1">เกิดข้อผิดพลาด</div>
                <div className="small">
                  {toApiError(ocrMutation.error).message}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="col-lg-6">
          <Card className="p-4">
            <h6 className="mb-3">ผลลัพธ์</h6>
            
            {ocrMutation.isPending && (
              <div className="text-center text-muted py-4">
                กำลังสแกนข้อความ...
              </div>
            )}

            {result && (
              <div>
                <div className="small text-muted mb-2">
                  ไฟล์: {result.filename} | วิธี: {result.method === 'vision' ? 'GPT-4 Vision' : 'OCR'}
                </div>
                <div
                  className="border rounded p-3 bg-light"
                  style={{ minHeight: '200px', maxHeight: '500px', overflow: 'auto', whiteSpace: 'pre-wrap' }}
                >
                  {result.text || '(ไม่มีข้อความที่สแกนได้)'}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    navigator.clipboard.writeText(result.text)
                  }}
                >
                  คัดลอกข้อความ
                </Button>
              </div>
            )}

            {!ocrMutation.isPending && !result && (
              <div className="text-center text-muted py-4">
                อัปโหลดไฟล์และคลิก "สแกนข้อความ" เพื่อดูผลลัพธ์
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

