import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { getAgentStatus } from '@/api/services/agent.service'
import { toApiError } from '@/api/response'
import { getAgentToken, setAgentToken } from '@/lib/agentToken'

export function AgentDashboardPage() {
  const navigate = useNavigate()
  const [agentTokenInput, setAgentTokenInput] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(!getAgentToken())

  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey: ['agent', 'status'],
    queryFn: () => getAgentStatus(),
    retry: false,
    enabled: !!getAgentToken(), // Only fetch if token exists
  })

  const handleSetToken = () => {
    if (agentTokenInput.trim()) {
      setAgentToken(agentTokenInput.trim())
      setShowTokenInput(false)
      setAgentTokenInput('')
      // Refetch status after setting token
      setTimeout(() => {
        refetch()
      }, 100)
    }
  }

  const handleClearToken = () => {
    setAgentToken(null)
    setShowTokenInput(true)
    setAgentTokenInput('')
  }

  // Show token input if no token is set
  if (showTokenInput || !getAgentToken()) {
    return (
      <div>
        <PageHeader
          title="Agent Dashboard"
          subtitle="AI-powered operations"
          breadcrumb="Agent"
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard')}>
              กลับ
            </Button>
          }
        />
        <Card className="p-4">
          <h6 className="mb-3">ตั้งค่า Agent Token</h6>
          <div className="alert alert-info mb-3">
            <div className="fw-semibold mb-2">ต้องการ Agent Token</div>
            <div className="small">
              เพื่อใช้งาน AI features คุณต้องมี Agent Token จาก Odoo
              <br />
              <strong>วิธีหา Agent Token:</strong>
              <ol className="mt-2 mb-0">
                <li>ไปที่ Odoo → <strong>ADT API → Agent Users</strong></li>
                <li>สร้างหรือเลือก Agent User ที่ต้องการ</li>
                <li>Copy <strong>Agent Token</strong> จากฟิลด์ "Agent Token"</li>
                <li>วาง Token ด้านล่างและคลิก "บันทึก"</li>
              </ol>
            </div>
          </div>
          <div className="mb-3">
            <Label htmlFor="agentToken" required>
              Agent Token
            </Label>
            <Input
              id="agentToken"
              type="text"
              value={agentTokenInput}
              onChange={(e) => setAgentTokenInput(e.target.value)}
              placeholder="วาง Agent Token ที่นี่"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && agentTokenInput.trim()) {
                  handleSetToken()
                }
              }}
            />
            <div className="small text-muted mt-1">
              Token จะถูกเก็บใน localStorage ของเบราว์เซอร์
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="primary"
              onClick={handleSetToken}
              disabled={!agentTokenInput.trim()}
            >
              บันทึก Token
            </Button>
            <Button variant="secondary" onClick={() => navigate('/dashboard')}>
              ยกเลิก
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Agent Dashboard" subtitle="AI-powered operations" breadcrumb="Agent" />
        <Card className="p-4">
          <div className="text-center text-muted">กำลังโหลด...</div>
        </Card>
      </div>
    )
  }

  if (error) {
    const apiError = toApiError(error)
    return (
      <div>
        <PageHeader
          title="Agent Dashboard"
          subtitle="AI-powered operations"
          breadcrumb="Agent"
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard')}>
              กลับ
            </Button>
          }
        />
        <Card className="p-4 mb-3">
          <div className="alert alert-danger">
            <div className="fw-semibold mb-2">โหลดข้อมูล Agent ไม่สำเร็จ</div>
            <div>{apiError.message}</div>
            {apiError.code && (
              <div className="small text-muted mt-2">Error code: {apiError.code}</div>
            )}
            {apiError.code === 'TOKEN_REQUIRED' && (
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={handleClearToken}>
                  ตั้งค่า Token ใหม่
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  }

  if (!status) {
    return (
      <div>
        <PageHeader title="Agent Dashboard" subtitle="AI-powered operations" breadcrumb="Agent" />
        <Card className="p-4">
          <div className="alert alert-warning">ไม่พบข้อมูล Agent</div>
        </Card>
      </div>
    )
  }

  const { permissions, usage, agent_name, active, company_name } = status

  return (
    <div>
      <PageHeader
        title="Agent Dashboard"
        subtitle="AI-powered operations"
        breadcrumb="Agent"
        actions={
          <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard')}>
            กลับ
          </Button>
        }
      />

      {/* Agent Info */}
      <Card className="p-4 mb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 className="mb-1">{agent_name}</h5>
            <div className="text-muted small">
              {company_name && <div>บริษัท: {company_name}</div>}
              <div>สถานะ: {active ? <span className="text-success">ใช้งานได้</span> : <span className="text-danger">ไม่ใช้งาน</span>}</div>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={handleClearToken}>
            เปลี่ยน Token
          </Button>
        </div>
      </Card>

      {/* Permissions */}
      <Card className="p-4 mb-3">
        <h6 className="mb-3">สิทธิ์การใช้งาน</h6>
        <div className="d-flex flex-column gap-2">
          <div className="d-flex justify-content-between align-items-center">
            <span>OCR</span>
            <span className={permissions.can_ocr ? 'text-success' : 'text-muted'}>
              {permissions.can_ocr ? '✓ ใช้งานได้' : '✗ ไม่สามารถใช้งาน'}
            </span>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <span>Auto-post Expense</span>
            <span className={permissions.can_post_expense ? 'text-success' : 'text-muted'}>
              {permissions.can_post_expense ? '✓ ใช้งานได้' : '✗ ไม่สามารถใช้งาน'}
            </span>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <span>Create Quotation</span>
            <span className={permissions.can_create_quotation ? 'text-success' : 'text-muted'}>
              {permissions.can_create_quotation ? '✓ ใช้งานได้' : '✗ ไม่สามารถใช้งาน'}
            </span>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <span>Create Contact</span>
            <span className={permissions.can_create_contact ? 'text-success' : 'text-muted'}>
              {permissions.can_create_contact ? '✓ ใช้งานได้' : '✗ ไม่สามารถใช้งาน'}
            </span>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <span>Create Invoice</span>
            <span className={permissions.can_create_invoice ? 'text-success' : 'text-muted'}>
              {permissions.can_create_invoice ? '✓ ใช้งานได้' : '✗ ไม่สามารถใช้งาน'}
            </span>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <span>Update Data</span>
            <span className={permissions.can_update_data ? 'text-success' : 'text-muted'}>
              {permissions.can_update_data ? '✓ ใช้งานได้' : '✗ ไม่สามารถใช้งาน'}
            </span>
          </div>
        </div>
      </Card>

      {/* Usage Stats */}
      <Card className="p-4 mb-3">
        <h6 className="mb-3">สถิติการใช้งาน</h6>
        <div className="d-flex flex-column gap-2">
          <div className="d-flex justify-content-between align-items-center">
            <span>คำขอด่วนวันนี้</span>
            <span className="fw-semibold">{usage.requests_today} / {usage.max_requests_per_day}</span>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <span>คำขอทั้งหมด</span>
            <span className="fw-semibold">{usage.total_requests}</span>
          </div>
          {usage.last_used_at && (
            <div className="d-flex justify-content-between align-items-center">
              <span>ใช้งานล่าสุด</span>
              <span className="text-muted small">
                {new Date(usage.last_used_at).toLocaleString('th-TH')}
              </span>
            </div>
          )}
          {usage.last_operation && (
            <div className="d-flex justify-content-between align-items-center">
              <span>การทำงานล่าสุด</span>
              <span className="text-muted small">{usage.last_operation}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-4">
        <h6 className="mb-3">เมนู</h6>
        <div className="d-grid gap-2">
          {permissions.can_ocr && (
            <Button
              variant="secondary"
              onClick={() => navigate('/agent/ocr')}
              className="w-100"
            >
              OCR - สแกนเอกสาร
            </Button>
          )}
          {permissions.can_post_expense && (
            <Button
              variant="secondary"
              onClick={() => navigate('/agent/expense')}
              className="w-100"
            >
              Auto-post Expense - รายจ่ายจากใบเสร็จ
            </Button>
          )}
          {permissions.can_create_quotation && (
            <Button
              variant="secondary"
              onClick={() => navigate('/agent/quotation')}
              className="w-100"
            >
              Create Quotation - สร้างใบเสนอราคา
            </Button>
          )}
          {permissions.can_create_contact && (
            <Button
              variant="secondary"
              onClick={() => navigate('/agent/contact')}
              className="w-100"
            >
              Create Contact - เพิ่มผู้ติดต่อจากนามบัตร
            </Button>
          )}
          {permissions.can_create_invoice && (
            <Button
              variant="secondary"
              onClick={() => navigate('/agent/invoice')}
              className="w-100"
            >
              Create Invoice - สร้างใบแจ้งหนี้
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

