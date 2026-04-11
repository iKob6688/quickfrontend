import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { toast } from '@/lib/toastStore'
import {
  getEtaxConfig,
  updateEtaxConfig,
  type EtaxConfigUpdatePayload,
} from '@/api/services/etax.service'

type ConfigDraft = EtaxConfigUpdatePayload & { active?: boolean }

function formatMs(value: number | undefined) {
  if (!value && value !== 0) return '—'
  return `${Math.round(value)} ms`
}

function formatFieldLabel(field: string) {
  const roleMap: Record<string, string> = {
    seller: 'Seller',
    buyer: 'Buyer',
    shipTo: 'Ship-to',
  }
  const map: Record<string, string> = {
    street: 'Street',
    subdistrict: 'Subdistrict',
    district: 'District',
    province: 'Province',
    zip: 'Postal Code',
    country: 'Country',
  }
  if (field.includes('.')) {
    const [role, rawField] = field.split('.', 2)
    const roleLabel = roleMap[role] || role
    return `${roleLabel} ${map[rawField] || rawField}`
  }
  return map[field] || field
}

export function EtaxSettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ConfigDraft | null>(null)

  const configQuery = useQuery({
    queryKey: ['etax', 'config'],
    queryFn: getEtaxConfig,
    staleTime: 30_000,
  })

  useEffect(() => {
    const cfg = configQuery.data?.config
    if (!cfg) {
      setDraft(null)
      return
    }
    setDraft({
      name: cfg.name,
      environment: cfg.environment,
      serviceCode: cfg.serviceCode,
      autoSubmitEnabled: cfg.autoSubmitEnabled,
      requestTimeout: cfg.requestTimeout,
      maxPollAttempts: cfg.maxPollAttempts,
      active: cfg.active,
      emailDeliveryEnabled: cfg.emailDeliveryEnabled,
      emailSenderName: cfg.emailSenderName || '',
      emailSenderAddress: cfg.emailSenderAddress || '',
      emailReplyTo: cfg.emailReplyTo || '',
    })
  }, [configQuery.data])

  const updateMutation = useMutation({
    mutationFn: updateEtaxConfig,
    onSuccess: async (cfg) => {
      toast.success('บันทึก e-Tax settings สำเร็จ')
      setDraft({
        name: cfg.name,
        environment: cfg.environment,
        serviceCode: cfg.serviceCode,
        autoSubmitEnabled: cfg.autoSubmitEnabled,
        requestTimeout: cfg.requestTimeout,
        maxPollAttempts: cfg.maxPollAttempts,
        active: cfg.active,
        emailDeliveryEnabled: cfg.emailDeliveryEnabled,
        emailSenderName: cfg.emailSenderName || '',
        emailSenderAddress: cfg.emailSenderAddress || '',
        emailReplyTo: cfg.emailReplyTo || '',
      })
      await queryClient.invalidateQueries({ queryKey: ['etax'] })
    },
    onError: (err) => toast.error('บันทึก e-Tax settings ไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const configState = configQuery.data
  const config = configState?.config || null
  const usage = config?.usage

  const isDirty = useMemo(() => {
    if (!draft || !config) return false
    return (
      draft.name !== config.name ||
      draft.environment !== config.environment ||
      draft.serviceCode !== config.serviceCode ||
      draft.autoSubmitEnabled !== config.autoSubmitEnabled ||
      draft.requestTimeout !== config.requestTimeout ||
      draft.maxPollAttempts !== config.maxPollAttempts ||
      draft.active !== config.active ||
      draft.emailDeliveryEnabled !== config.emailDeliveryEnabled ||
      (draft.emailSenderName || '') !== (config.emailSenderName || '') ||
      (draft.emailSenderAddress || '') !== (config.emailSenderAddress || '') ||
      (draft.emailReplyTo || '') !== (config.emailReplyTo || '')
    )
  }, [config, draft])

  return (
    <div>
      <PageHeader
        title="e-Tax Settings"
        subtitle="ตั้งค่าการทำงานที่ปลอดภัยและ backend-managed โดยไม่เปิดเผย credential ใน browser"
        breadcrumb="Accounting · e-Tax · Settings"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/etax')}>
              กลับ Workspace
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void configQuery.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
          </div>
        }
      />

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <Card
            header={
              <div className="d-flex align-items-center justify-content-between gap-2">
                <div>
                  <div className="fw-semibold">Configuration</div>
                  <div className="small text-muted">ปรับเฉพาะค่าที่ปลอดภัยสำหรับ UX และ workflow</div>
                </div>
                {config ? <Badge tone={config.active ? 'green' : 'gray'}>{config.active ? 'Active' : 'Inactive'}</Badge> : null}
              </div>
            }
          >
            {!draft || !config ? (
              <div className="py-4 text-center text-muted">
                {configQuery.isLoading
                  ? 'กำลังโหลด configuration...'
                  : configState?.configMissing
                    ? 'ยังไม่มี active ETax configuration สำหรับบริษัทนี้'
                    : 'ไม่พบ configuration'}
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                <div className="row g-3">
                  <div className="col-md-6">
                    <Label htmlFor="etax-name">Configuration Name</Label>
                    <Input
                      id="etax-name"
                      value={draft.name ?? ''}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                    />
                  </div>
                  <div className="col-md-6">
                    <Label htmlFor="etax-env">Environment</Label>
                    <select
                      id="etax-env"
                      className="form-select"
                      value={draft.environment ?? 'uat'}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, environment: e.target.value as 'uat' | 'prod' } : prev))}
                    >
                      <option value="uat">UAT</option>
                      <option value="prod">Production</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <Label htmlFor="etax-service">Service Code</Label>
                    <select
                      id="etax-service"
                      className="form-select"
                      value={draft.serviceCode ?? 'S03'}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, serviceCode: e.target.value as 'S03' | 'S06' } : prev))}
                    >
                      <option value="S03">S03 - CSV</option>
                      <option value="S06">S06 - CSV + PDF</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <Label htmlFor="etax-timeout">Request Timeout (sec)</Label>
                    <Input
                      id="etax-timeout"
                      type="number"
                      min={5}
                      max={600}
                      value={draft.requestTimeout ?? 60}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, requestTimeout: Number(e.target.value || 0) } : prev))}
                    />
                  </div>
                  <div className="col-md-6">
                    <Label htmlFor="etax-poll">Max Poll Attempts</Label>
                    <Input
                      id="etax-poll"
                      type="number"
                      min={1}
                      max={100}
                      value={draft.maxPollAttempts ?? 20}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, maxPollAttempts: Number(e.target.value || 0) } : prev))}
                    />
                  </div>
                  <div className="col-md-6 d-flex align-items-end">
                    <div className="form-check form-switch">
                      <input
                        id="etax-auto-submit"
                        className="form-check-input"
                        type="checkbox"
                        checked={Boolean(draft.autoSubmitEnabled)}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, autoSubmitEnabled: e.target.checked } : prev))}
                      />
                      <label htmlFor="etax-auto-submit" className="form-check-label">
                        Enable Auto Submit
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6 d-flex align-items-end">
                    <div className="form-check form-switch">
                      <input
                        id="etax-active"
                        className="form-check-input"
                        type="checkbox"
                        checked={Boolean(draft.active)}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, active: e.target.checked } : prev))}
                      />
                      <label htmlFor="etax-active" className="form-check-label">
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="rounded-3 border bg-light p-3">
                      <div className="fw-semibold mb-2">Email Delivery</div>
                      <div className="form-check form-switch mb-3">
                        <input
                          id="etax-email-enabled"
                          className="form-check-input"
                          type="checkbox"
                          checked={Boolean(draft.emailDeliveryEnabled)}
                          onChange={(e) => setDraft((prev) => (prev ? { ...prev, emailDeliveryEnabled: e.target.checked } : prev))}
                        />
                        <label htmlFor="etax-email-enabled" className="form-check-label">
                          Enable Odoo-owned email delivery
                        </label>
                      </div>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <Label htmlFor="etax-email-name">Sender Name</Label>
                          <Input
                            id="etax-email-name"
                            placeholder="e.g. Chonlatee Innovation"
                            value={draft.emailSenderName ?? ''}
                            onChange={(e) => setDraft((prev) => (prev ? { ...prev, emailSenderName: e.target.value } : prev))}
                          />
                        </div>
                        <div className="col-md-6">
                          <Label htmlFor="etax-email-address">Sender Email</Label>
                          <Input
                            id="etax-email-address"
                            type="email"
                            placeholder="e.g. etax@company.co.th"
                            value={draft.emailSenderAddress ?? ''}
                            onChange={(e) => setDraft((prev) => (prev ? { ...prev, emailSenderAddress: e.target.value } : prev))}
                          />
                        </div>
                        <div className="col-12">
                          <Label htmlFor="etax-email-reply">Reply-To</Label>
                          <Input
                            id="etax-email-reply"
                            type="email"
                            placeholder="Optional reply-to address"
                            value={draft.emailReplyTo ?? ''}
                            onChange={(e) => setDraft((prev) => (prev ? { ...prev, emailReplyTo: e.target.value } : prev))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3 border bg-light p-3">
                  <div className="fw-semibold mb-2">Backend-only credentials</div>
                  <div className="small text-muted mb-2">
                    Authorization code, API key, user code, and access key are stored in Odoo backend only.
                  </div>
                  <div className="small">
                    Credentials configured: {config.credentialsConfigured ? <Badge tone="green">Yes</Badge> : <Badge tone="red">No</Badge>}
                  </div>
                  <div className="small mt-2">
                    Credential tax ID: <span className="font-monospace">{config.authCodeTaxId || '—'}</span>{' '}
                    <Badge tone="gray">Reference only</Badge>
                  </div>
                <div className="small text-muted mt-2">
                  Provider / middleware setups can use a shared credential whose tax ID differs from the seller company.
                </div>
                <div className="small text-muted mt-2">
                  Provider company: <span className="font-monospace">{config.companyName || '—'}</span>
                </div>
                <div className="small text-muted mt-2">
                  Email delivery: {config.emailDeliveryEnabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="gray">Disabled</Badge>}
                </div>
                <div className="small text-muted mt-1">
                  Sender: <span className="font-monospace">{config.emailSenderAddress || '—'}</span>
                </div>
                <div className="small text-muted mt-1">
                  If sender email is blank, the company email from Odoo will be used.
                </div>
              </div>

                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    onClick={() => {
                      if (!draft) return
                      updateMutation.mutate(draft)
                    }}
                    disabled={!draft || !isDirty || updateMutation.isPending}
                    isLoading={updateMutation.isPending}
                  >
                    บันทึกการตั้งค่า
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!config) return
                      setDraft({
                        name: config.name,
                        environment: config.environment,
                        serviceCode: config.serviceCode,
                        autoSubmitEnabled: config.autoSubmitEnabled,
                        requestTimeout: config.requestTimeout,
                        maxPollAttempts: config.maxPollAttempts,
                        active: config.active,
                        emailDeliveryEnabled: config.emailDeliveryEnabled,
                        emailSenderName: config.emailSenderName || '',
                        emailSenderAddress: config.emailSenderAddress || '',
                        emailReplyTo: config.emailReplyTo || '',
                      })
                    }}
                    disabled={!config}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="col-12 col-xl-5">
          <div className="d-flex flex-column gap-3">
            {!config ? (
              <Card className="qf-report-card qf-report-card--amber">
                <div className="small text-muted mb-1">e-Tax Onboarding</div>
                <div className="h5 fw-semibold mb-2">ยังไม่มี active ETax configuration</div>
                <div className="small text-muted mb-3">
                  ขั้นถัดไปคือไปผูกหรือสร้าง e-Tax configuration ที่ Odoo backend ก่อน แล้วค่อยกลับมาส่ง e-Tax จากหน้าเอกสาร
                </div>
                <div className="small text-muted">
                  Recommended action: Open Odoo e-Tax configuration หรือให้ Admin ตั้งค่า company/provider credential ให้เรียบร้อย
                </div>
              </Card>
            ) : null}
            <Card className="qf-report-card qf-report-card--blue">
              <div className="small text-muted mb-1">Seller Tax ID</div>
              <div className="h5 fw-semibold mb-0 font-monospace">{config?.sellerTaxId || '—'}</div>
              <div className="small text-muted mt-2">Branch: {config?.sellerBranchId || '—'}</div>
              <div className="small text-muted mt-2">
                Credential Tax ID: <span className="font-monospace">{config?.authCodeTaxId || '—'}</span>
              </div>
              <div className="small text-muted mt-1">Reference only for the INET provider credential.</div>
              <div className="small text-muted mt-2">
                Mode: <span className="font-monospace">{config?.submissionMode || '—'}</span>
                {' · '}
                CSV style: <span className="font-monospace">{config?.csvPayloadStyle || '—'}</span>
              </div>
              <div className="small mt-2">
                Address status:{' '}
                {config?.sellerAddressReviewNeeded ? <Badge tone="amber">Needs review</Badge> : <Badge tone="green">Ready</Badge>}
              </div>
              <div className="small text-muted mt-2">
                {config?.sellerAddressMissingFields?.length
                  ? config.sellerAddressMissingFields.map(formatFieldLabel).join(', ')
                  : config?.sellerAddressText || 'Address validated from backend partner data'}
              </div>
              <div className="small mt-2">
                Credentials:{' '}
                {config?.configReady ? <Badge tone="green">Ready</Badge> : <Badge tone="amber">Needs review</Badge>}
              </div>
            </Card>
            <Card className="qf-report-card qf-report-card--green">
              <div className="small text-muted mb-1">Usage Summary</div>
              <div className="row g-2">
                <div className="col-6">
                  <div className="rounded-3 bg-light p-3">
                    <div className="small text-muted">Total Docs</div>
                    <div className="fw-semibold">{usage?.totalDocuments ?? '—'}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="rounded-3 bg-light p-3">
                    <div className="small text-muted">Queue Depth</div>
                    <div className="fw-semibold">{usage?.queueDepth ?? '—'}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="rounded-3 bg-light p-3">
                    <div className="small text-muted">Done</div>
                    <div className="fw-semibold">{usage?.doneCount ?? '—'}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="rounded-3 bg-light p-3">
                    <div className="small text-muted">Errors</div>
                    <div className="fw-semibold">{usage?.errorCount ?? '—'}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="rounded-3 bg-light p-3">
                    <div className="small text-muted">Success Rate</div>
                    <div className="fw-semibold">{usage ? `${usage.successRate.toFixed(1)}%` : '—'}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="rounded-3 bg-light p-3">
                    <div className="small text-muted">API Logs</div>
                    <div className="fw-semibold">{usage?.apiLogCount ?? '—'}</div>
                  </div>
                </div>
              </div>
            </Card>
            <Card className="qf-report-card qf-report-card--purple">
              <div className="small text-muted mb-1">Latency</div>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between">
                  <span>Submit</span>
                  <span className="fw-semibold">{formatMs(usage?.averageSubmitMs)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Poll</span>
                  <span className="fw-semibold">{formatMs(usage?.averagePollMs)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Last Submit</span>
                  <span className="fw-semibold">{usage?.lastSubmitDate ? new Date(usage.lastSubmitDate).toLocaleString('th-TH') : '—'}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Last Poll</span>
                  <span className="fw-semibold">{usage?.lastPollDate ? new Date(usage.lastPollDate).toLocaleString('th-TH') : '—'}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
