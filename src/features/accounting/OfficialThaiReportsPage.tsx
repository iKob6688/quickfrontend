import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import {
  generateMonthlyOfficialPack,
  generateOfficialForm,
  listOfficialExportLogs,
  listOfficialForms,
  listWhtCertificates,
  type OfficialExportLog,
  type OfficialFormListItem,
  type WhtCertificateListItem,
} from '@/api/services/official-reports.service'
import {
  getMonthlyOfficialWorkspace,
  type OfficialWorkItem,
} from '@/api/services/official-reports-workspace.service'
import { toApiError } from '@/api/response'
import { toast } from '@/lib/toastStore'
import { useAuthStore } from '@/features/auth/store'

type ReportTab = 'guided' | 'advanced' | 'history'

function isoMonthValue(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${year}-${month}`
}

function parseMonthValue(value: string) {
  const [yearText, monthText] = value.split('-')
  return {
    year: Number(yearText || 0),
    month: Number(monthText || 0),
  }
}

function statusBadgeClass(status?: string) {
  if (status === 'official_form') return 'text-bg-success'
  if (status === 'accounting_review') return 'text-bg-info'
  if (status === 'need_verification') return 'text-bg-warning'
  return 'text-bg-secondary'
}

function stateBadgeClass(state?: string) {
  if (state === 'generated' || state === 'accepted') return 'text-bg-success'
  if (state === 'validated') return 'text-bg-info'
  if (state === 'failed') return 'text-bg-danger'
  return 'text-bg-secondary'
}

function workspaceBadgeClass(code?: string) {
  if (code === 'generated') return 'text-bg-success'
  if (code === 'generated_needs_review' || code === 'ready_for_rd_prep') return 'text-bg-info'
  if (code === 'ready_to_generate') return 'text-bg-primary'
  if (code === 'blocked_setup' || code === 'blocked_template' || code === 'blocked_source_document') return 'text-bg-warning'
  return 'text-bg-secondary'
}

function formatPeriod(log: OfficialExportLog) {
  if (!log.periodFrom && !log.periodTo) return '-'
  return `${log.periodFrom || '-'} - ${log.periodTo || '-'}`
}

function isWhtCertificateForm(item: OfficialFormListItem) {
  return item.template.formCode === 'wht_certificate'
}

function certificateOptionLabel(cert: WhtCertificateListItem) {
  const paymentLabel = cert.paymentName || cert.moveName || cert.name || `CERT-${cert.id}`
  const partnerLabel = cert.partnerName || '-'
  const dateLabel = cert.date || '-'
  const amountLabel = Number(cert.totalWht || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${paymentLabel} | ${partnerLabel} | ${dateLabel} | WHT ${amountLabel}`
}

function tabButtonClass(active: boolean) {
  return active ? 'btn btn-primary btn-sm' : 'btn btn-outline-secondary btn-sm'
}

function summarizeLogs(logs: OfficialExportLog[]) {
  return logs.reduce(
    (acc, log) => {
      acc.total += 1
      if (log.attachmentId) acc.withAttachment += 1
      if (log.noData) acc.noData += 1
      if (log.officialStatus === 'official_form') acc.official += 1
      if (log.hasErrors) acc.errors += 1
      return acc
    },
    { total: 0, withAttachment: 0, noData: 0, official: 0, errors: 0 },
  )
}

function workspaceItemDescription(item: OfficialWorkItem) {
  if (item.issues.length > 0) return item.issues[0]?.message || item.subtitle || '-'
  if (item.status.code === 'generated' || item.status.code === 'generated_needs_review') {
    return 'มีไฟล์ล่าสุดพร้อมเปิดตรวจ'
  }
  return item.subtitle || '-'
}

export function OfficialThaiReportsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [periodMonth, setPeriodMonth] = useState(() => isoMonthValue(new Date()))
  const [selectedWhtCertificateId, setSelectedWhtCertificateId] = useState<number | null>(null)
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<ReportTab>('guided')

  const { year, month } = useMemo(() => parseMonthValue(periodMonth), [periodMonth])
  const dateFrom = `${periodMonth}-01`
  const dateTo = `${periodMonth}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`

  const workspaceQuery = useQuery({
    queryKey: ['official-reports', 'workspace', user?.companyId, year, month],
    queryFn: () =>
      getMonthlyOfficialWorkspace({
        companyId: user?.companyId,
        year,
        month,
        includeDraft: false,
      }),
    enabled: Boolean(user?.companyId && year && month),
    staleTime: 15_000,
  })

  const formsQuery = useQuery({
    queryKey: ['official-reports', 'forms', user?.companyId],
    queryFn: () => listOfficialForms({ companyId: user?.companyId }),
    staleTime: 60_000,
  })

  const logsQuery = useQuery({
    queryKey: ['official-reports', 'logs', user?.companyId],
    queryFn: () => listOfficialExportLogs({ companyId: user?.companyId, limit: 50 }),
    staleTime: 15_000,
  })

  const whtCertificatesQuery = useQuery({
    queryKey: ['official-reports', 'wht-certificates', user?.companyId, dateFrom, dateTo],
    queryFn: () =>
      listWhtCertificates({
        companyId: user?.companyId,
        dateFrom,
        dateTo,
        limit: 100,
      }),
    staleTime: 15_000,
  })

  const invalidateOfficial = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['official-reports'] }),
      queryClient.invalidateQueries({ queryKey: ['rd-efiling'] }),
    ])
  }

  const packMutation = useMutation({
    mutationFn: () =>
      generateMonthlyOfficialPack({
        companyId: user?.companyId,
        year,
        month,
        includeDraft: false,
        includeEtax: true,
      }),
    onSuccess: async (data) => {
      toast.success(
        'สร้าง monthly pack แล้ว',
        `ได้ ${data.summary.withAttachment} ไฟล์, ข้ามแบบไม่มีข้อมูล ${data.summary.noData} รายการ`,
      )
      await invalidateOfficial()
      setActiveTab('history')
    },
    onError: (error) => {
      const apiError = toApiError(error)
      toast.error('สร้าง monthly pack ไม่สำเร็จ', apiError.message)
    },
  })

  const generateMutation = useMutation({
    mutationFn: ({ templateId, sourceId }: { templateId: number; sourceId?: number }) =>
      generateOfficialForm({
        templateId,
        companyId: user?.companyId,
        dateFrom,
        dateTo,
        ...(sourceId !== undefined
          ? {
              sourceModel: 'withholding.tax.cert',
              sourceId,
            }
          : {}),
      }),
    onMutate: ({ templateId }) => {
      setActiveTemplateId(templateId)
    },
    onSuccess: async (data) => {
      const attachmentUrl = data.exportLog.attachmentUrl
      toast.success(
        attachmentUrl ? 'สร้างแบบทางการแล้ว' : 'สร้างรายการส่งออกแล้ว',
        attachmentUrl ? data.exportLog.name : `${data.exportLog.name} ยังไม่มีไฟล์แนบจาก server`,
      )
      if (data.exportLog.attachmentUrl) {
        window.open(data.exportLog.attachmentUrl, '_blank', 'noopener,noreferrer')
      }
      await invalidateOfficial()
      setActiveTab('history')
    },
    onError: (error) => {
      const apiError = toApiError(error)
      toast.error('สร้างแบบทางการไม่สำเร็จ', apiError.message)
    },
    onSettled: () => {
      setActiveTemplateId(null)
    },
  })

  const workspace = workspaceQuery.data
  const forms = formsQuery.data?.forms ?? []
  const logs = logsQuery.data?.logs ?? []
  const recentLogs = workspace?.recentLogs ?? logs.slice(0, 10)
  const whtCertificates = whtCertificatesQuery.data?.certificates ?? []
  const workspaceSummary = workspace?.summary
  const formsSummary = useMemo(() => summarizeLogs(recentLogs), [recentLogs])

  useEffect(() => {
    if (!whtCertificates.length) {
      setSelectedWhtCertificateId(null)
      return
    }
    setSelectedWhtCertificateId((current) => {
      if (current && whtCertificates.some((cert) => cert.id === current)) return current
      return whtCertificates[0]?.id ?? null
    })
  }, [whtCertificates])

  const workspaceError = workspaceQuery.error instanceof Error ? workspaceQuery.error.message : ''
  const formsError = formsQuery.error instanceof Error ? formsQuery.error.message : ''
  const logsError = logsQuery.error instanceof Error ? logsQuery.error.message : ''
  const whtCertificatesError = whtCertificatesQuery.error instanceof Error ? whtCertificatesQuery.error.message : ''

  const advancedSummary = formsSummary
  const workItems = workspace?.workItems ?? []

  const triggerWorkspaceItem = (item: OfficialWorkItem) => {
    if (item.code === 'monthly_pack') {
      packMutation.mutate()
      return
    }
    if (item.code === 'rd_efiling') {
      navigate('/accounting/rd-efiling')
      return
    }
    if (!item.templateId) {
      toast.info('ยังไม่มี template พร้อมใช้', 'ตรวจ readiness หรือเปิดแท็บ Advanced เพื่อดูรายละเอียด')
      return
    }
    if (item.code === 'wht_certificate') {
      if (!selectedWhtCertificateId) {
        toast.info('เลือก WHT certificate ก่อน', 'ระบบต้องใช้ source document สำหรับหนังสือรับรองหัก ณ ที่จ่าย')
        return
      }
      generateMutation.mutate({
        templateId: item.templateId,
        sourceId: selectedWhtCertificateId,
      })
      return
    }
    generateMutation.mutate({ templateId: item.templateId })
  }

  return (
    <div>
      <PageHeader
        title="Official Thai Forms"
        subtitle="workspace สำหรับปิดงวด, สร้างแบบราชการไทย, ตรวจ readiness, และไปต่อ RD e-Filing"
        breadcrumb="Home · Accounting · Official Thai Forms"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports')}>
              กลับไปรายงานบัญชี
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/rd-efiling')}>
              ไปหน้า RD e-Filing
            </Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="row g-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label">งวดรายงาน</label>
            <input
              type="month"
              className="form-control"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              onInput={(e) => setPeriodMonth((e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="col-md-5">
            <div className="small text-muted mb-2">
              ระบบจะใช้ช่วงวันที่ {dateFrom} ถึง {dateTo} สำหรับ workspace, generate แบบ, และ monthly pack
            </div>
            <div className="small text-muted">
              บริษัทปัจจุบัน: {user?.companyName || '-'} {user?.companyId ? `(ID ${user.companyId})` : ''}
            </div>
            {workspace ? (
              <div className="small text-muted">
                Auth mode: <code>{workspace.authMode}</code>
              </div>
            ) : null}
          </div>
          <div className="col-md-4 d-flex gap-2 justify-content-md-end flex-wrap">
            <button type="button" className={tabButtonClass(activeTab === 'guided')} onClick={() => setActiveTab('guided')}>
              Guided Workspace
            </button>
            <button type="button" className={tabButtonClass(activeTab === 'advanced')} onClick={() => setActiveTab('advanced')}>
              Advanced
            </button>
            <button type="button" className={tabButtonClass(activeTab === 'history')} onClick={() => setActiveTab('history')}>
              Export History
            </button>
          </div>
        </div>
      </Card>

      {workspaceError ? (
        <Card className="p-3 mb-3 border border-danger-subtle">
          <div className="fw-semibold text-danger mb-1">โหลด guided workspace ไม่สำเร็จ</div>
          <div className="small text-muted">{workspaceError}</div>
        </Card>
      ) : null}

      {activeTab === 'guided' ? (
        <div>
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <Card className="p-3 h-100">
                <div className="small text-muted">พร้อม generate</div>
                <div className="fs-4 fw-semibold">{workspaceSummary?.readyToGenerate ?? 0}</div>
              </Card>
            </div>
            <div className="col-md-3">
              <Card className="p-3 h-100">
                <div className="small text-muted">ติด setup</div>
                <div className="fs-4 fw-semibold">{workspaceSummary?.blockedSetup ?? 0}</div>
              </Card>
            </div>
            <div className="col-md-3">
              <Card className="p-3 h-100">
                <div className="small text-muted">มี WHT certificate</div>
                <div className="fs-4 fw-semibold">{workspace?.wht.certificateCount ?? 0}</div>
              </Card>
            </div>
            <div className="col-md-3">
              <Card className="p-3 h-100">
                <div className="small text-muted">พร้อมยื่น RD</div>
                <div className="fs-4 fw-semibold">{workspaceSummary?.readyForRdPrep ?? 0}</div>
              </Card>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-8">
              <Card className="p-0 overflow-hidden">
                <div className="p-3 border-bottom">
                  <div className="fw-semibold">Guided Month-End Workflow</div>
                  <div className="small text-muted">
                    เรียงตาม flow ที่ผู้ใช้ต้องทำจริง: readiness, แบบภาษี, WHT certificate, monthly pack, แล้วไปต่อ RD e-Filing
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th>งาน</th>
                        <th>สถานะ</th>
                        <th>ปัญหา/บริบท</th>
                        <th>ล่าสุด</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workItems.map((item: OfficialWorkItem) => {
                        const lastLog = recentLogs.find((log: OfficialExportLog) => log.id === item.lastExportLogId)
                        const isWhtItem = item.code === 'wht_certificate'
                        const canRun =
                          item.status.canGenerate &&
                          !generateMutation.isPending &&
                          !packMutation.isPending &&
                          (!isWhtItem || Boolean(selectedWhtCertificateId))
                        return (
                          <tr key={item.code}>
                            <td>
                              <div className="fw-semibold">{item.title}</div>
                              <div className="small text-muted">{item.subtitle}</div>
                              {item.formCode ? <div className="small text-muted">{item.formCode}</div> : null}
                            </td>
                            <td>
                              <span className={`badge ${workspaceBadgeClass(item.status.code)}`}>{item.status.label}</span>
                            </td>
                            <td className="small">
                              <div>{workspaceItemDescription(item)}</div>
                              {item.templateStatus ? (
                                <div className="text-muted">
                                  Template: {item.templateStatus} / {item.resolvedOfficialStatus || '-'}
                                </div>
                              ) : null}
                              {isWhtItem ? (
                                <div className="text-muted">
                                  WHT certificates ในงวด: {item.sourceSummary.certificateCount}
                                </div>
                              ) : null}
                            </td>
                            <td className="small">
                              {lastLog ? (
                                <div>
                                  <div>{lastLog.name}</div>
                                  <div className="text-muted">{lastLog.officialStatus}</div>
                                </div>
                              ) : (
                                <span className="text-muted">ยังไม่มีไฟล์ล่าสุด</span>
                              )}
                            </td>
                            <td className="text-end">
                              {isWhtItem ? (
                                <div className="d-flex justify-content-end gap-2 flex-wrap">
                                  <select
                                    className="form-select form-select-sm"
                                    style={{ width: 340 }}
                                    value={selectedWhtCertificateId ?? ''}
                                    onChange={(e) => setSelectedWhtCertificateId(e.target.value ? Number(e.target.value) : null)}
                                    disabled={whtCertificatesQuery.isLoading || generateMutation.isPending}
                                  >
                                    <option value="">เลือก WHT certificate</option>
                                    {whtCertificates.map((cert) => (
                                      <option key={cert.id} value={cert.id}>
                                        {certificateOptionLabel(cert)}
                                      </option>
                                    ))}
                                  </select>
                                  <Button size="sm" variant="secondary" onClick={() => void whtCertificatesQuery.refetch()}>
                                    รีเฟรช
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={!canRun}
                                    onClick={() => triggerWorkspaceItem(item)}
                                  >
                                    {activeTemplateId === item.templateId && generateMutation.isPending ? 'Generating...' : 'Generate'}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={!canRun && item.code !== 'rd_efiling'}
                                  onClick={() => triggerWorkspaceItem(item)}
                                >
                                  {item.code === 'monthly_pack'
                                    ? packMutation.isPending
                                      ? 'กำลังสร้าง...'
                                      : 'Generate Monthly Pack'
                                    : item.code === 'rd_efiling'
                                      ? 'Open RD Queue'
                                      : activeTemplateId === item.templateId && generateMutation.isPending
                                        ? 'Generating...'
                                        : 'Generate'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {!workspaceQuery.isLoading && workItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">
                            ไม่พบ guided workspace item
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div className="col-lg-4">
              <Card className="p-3 mb-3">
                <div className="fw-semibold mb-2">What users do next</div>
                {workspace?.actionHints?.length ? (
                  <div className="d-flex flex-column gap-2">
                    {workspace.actionHints.map((hint) => (
                      <div key={hint.code} className="border rounded p-2">
                        <div className="fw-semibold">{hint.label}</div>
                        <div className="small text-muted">{hint.description || '-'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="small text-muted">ยังไม่มี action hint เพิ่มเติมสำหรับงวดนี้</div>
                )}
              </Card>

              <Card className="p-3">
                <div className="fw-semibold mb-2">Missing data / readiness blockers</div>
                {workspace?.missingDataItems?.length ? (
                  <ul className="small text-muted mb-0 ps-3">
                    {workspace.missingDataItems.slice(0, 8).map((item: string, index: number) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="small text-muted">ไม่พบ blocker สำคัญจาก company/WHT data ในงวดนี้</div>
                )}
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'advanced' ? (
        <div>
          {formsError ? (
            <Card className="p-3 mb-3 border border-danger-subtle">
              <div className="fw-semibold text-danger mb-1">โหลด official templates ไม่สำเร็จ</div>
              <div className="small text-muted">{formsError}</div>
            </Card>
          ) : null}

          {whtCertificatesError ? (
            <Card className="p-3 mb-3 border border-danger-subtle">
              <div className="fw-semibold text-danger mb-1">โหลด WHT certificates ไม่สำเร็จ</div>
              <div className="small text-muted">{whtCertificatesError}</div>
            </Card>
          ) : null}

          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <Card className="p-3 h-100">
                <div className="small text-muted">ไฟล์ล่าสุด</div>
                <div className="fs-4 fw-semibold">{advancedSummary.total}</div>
              </Card>
            </div>
            <div className="col-md-3">
              <Card className="p-3 h-100">
                <div className="small text-muted">มี attachment</div>
                <div className="fs-4 fw-semibold">{advancedSummary.withAttachment}</div>
              </Card>
            </div>
            <div className="col-md-3">
              <Card className="p-3 h-100">
                <div className="small text-muted">พร้อมใช้เป็น official form</div>
                <div className="fs-4 fw-semibold">{advancedSummary.official}</div>
              </Card>
            </div>
            <div className="col-md-3">
              <Card className="p-3 h-100">
                <div className="small text-muted">ไม่มีข้อมูลในงวด</div>
                <div className="fs-4 fw-semibold">{advancedSummary.noData}</div>
              </Card>
            </div>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-3 border-bottom">
              <div className="fw-semibold">Advanced Template Console</div>
              <div className="small text-muted">มุมมอง expert สำหรับตรวจ template, mapping, source requirement, และ generate รายแบบ</div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>แบบฟอร์ม</th>
                    <th>สถานะ</th>
                    <th>Template</th>
                    <th>Mapping</th>
                    <th>พร้อม generate</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((item: OfficialFormListItem) => {
                    const whtForm = isWhtCertificateForm(item)
                    const canGenerateWht =
                      whtForm &&
                      item.template.requiresSourceDocument &&
                      Boolean(selectedWhtCertificateId) &&
                      !generateMutation.isPending
                    const whtMessage = whtCertificatesQuery.isLoading
                      ? 'กำลังโหลด WHT certificate'
                      : whtCertificates.length
                        ? `${whtCertificates.length} certificate ในงวด`
                        : 'ไม่พบ WHT certificate ในงวด'
                    return (
                      <tr key={item.template.id}>
                        <td>
                          <div className="fw-semibold">{item.template.name}</div>
                          <div className="small text-muted">{item.template.formCode}</div>
                        </td>
                        <td>
                          <span className={`badge ${statusBadgeClass(item.resolvedOfficialStatus)}`}>
                            {item.resolvedOfficialStatus}
                          </span>
                        </td>
                        <td className="small">
                          <div>PDF: {item.template.hasPdf ? 'พร้อม' : 'ยังไม่มี'}</div>
                          <div>Master: {item.template.masterPdfAvailable ? 'พร้อม' : 'ยังไม่มี'}</div>
                        </td>
                        <td className="small">
                          <div>{item.template.fieldMapCount || 0} fields</div>
                          <div>{item.template.renderMode || '-'}</div>
                        </td>
                        <td className="small">
                          {item.canGenerate ? (
                            <span className="text-success">พร้อม</span>
                          ) : item.template.requiresSourceDocument ? (
                            <div>
                              <div className="text-warning">ต้องมี source document</div>
                              {whtForm ? <div className="text-muted">{whtMessage}</div> : null}
                            </div>
                          ) : (
                            <span className="text-danger">
                              {[...item.companyErrors, ...item.templateErrors].join(' | ') || 'ต้องตรวจข้อมูล'}
                            </span>
                          )}
                        </td>
                        <td className="text-end">
                          {whtForm ? (
                            <div className="d-flex justify-content-end gap-2 flex-wrap">
                              <select
                                className="form-select form-select-sm"
                                style={{ width: 360 }}
                                value={selectedWhtCertificateId ?? ''}
                                onChange={(e) =>
                                  setSelectedWhtCertificateId(e.target.value ? Number(e.target.value) : null)
                                }
                                disabled={whtCertificatesQuery.isLoading || generateMutation.isPending}
                              >
                                <option value="">เลือก WHT certificate</option>
                                {whtCertificates.map((cert: WhtCertificateListItem) => (
                                  <option key={cert.id} value={cert.id}>
                                    {certificateOptionLabel(cert)}
                                  </option>
                                ))}
                              </select>
                              <Button size="sm" variant="secondary" onClick={() => void whtCertificatesQuery.refetch()}>
                                รีเฟรช
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!canGenerateWht}
                                onClick={() => {
                                  if (!selectedWhtCertificateId) return
                                  generateMutation.mutate({
                                    templateId: item.template.id,
                                    sourceId: selectedWhtCertificateId,
                                  })
                                }}
                              >
                                {activeTemplateId === item.template.id && generateMutation.isPending ? 'Generating...' : 'Generate'}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!item.canGenerate || generateMutation.isPending}
                              onClick={() => generateMutation.mutate({ templateId: item.template.id })}
                            >
                              {activeTemplateId === item.template.id && generateMutation.isPending ? 'Generating...' : 'Generate'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!formsQuery.isLoading && forms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        ไม่พบ official template
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'history' ? (
        <div>
          {logsError ? (
            <Card className="p-3 mb-3 border border-danger-subtle">
              <div className="fw-semibold text-danger mb-1">โหลด export logs ไม่สำเร็จ</div>
              <div className="small text-muted">{logsError}</div>
            </Card>
          ) : null}

          <div className="row g-3 mb-3">
            <div className="col-lg-8">
              <Card className="p-0 overflow-hidden">
                <div className="p-3 border-bottom">
                  <div className="fw-semibold">Recent Export Logs</div>
                  <div className="small text-muted">ใช้ตรวจ readiness, no-data, และเปิดไฟล์ล่าสุดได้ทันที</div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th>รายการ</th>
                        <th>ช่วงวันที่</th>
                        <th>State</th>
                        <th>Official</th>
                        <th>ผลลัพธ์</th>
                        <th className="text-end">ไฟล์</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((log: OfficialExportLog) => (
                        <tr key={log.id}>
                          <td>
                            <div className="fw-semibold">{log.name}</div>
                            <div className="small text-muted">{log.reportType}</div>
                          </td>
                          <td className="small">{formatPeriod(log)}</td>
                          <td>
                            <span className={`badge ${stateBadgeClass(log.state)}`}>{log.state}</span>
                          </td>
                          <td>
                            <span className={`badge ${statusBadgeClass(log.officialStatus)}`}>{log.officialStatus}</span>
                          </td>
                          <td className="small">
                            {log.noData ? (
                              <span className="text-muted">ไม่มีข้อมูลในงวด</span>
                            ) : log.hasErrors ? (
                              <span className="text-danger">{log.validationErrors || 'validation error'}</span>
                            ) : (
                              <span className="text-success">พร้อมใช้งาน</span>
                            )}
                          </td>
                          <td className="text-end">
                            {log.attachmentUrl ? (
                              <a href={log.attachmentUrl} target="_blank" rel="noreferrer">
                                ดาวน์โหลด
                              </a>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!logsQuery.isLoading && recentLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center text-muted py-4">
                            ยังไม่มี export log
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
            <div className="col-lg-4">
              <Card className="p-3">
                <div className="fw-semibold mb-2">RD e-Filing Queue Snapshot</div>
                {workspace?.rdEfiling.submissions.length ? (
                  <div className="d-flex flex-column gap-2">
                    {workspace.rdEfiling.submissions.slice(0, 5).map((submission) => (
                      <div key={submission.id} className="border rounded p-2">
                        <div className="fw-semibold">{submission.name}</div>
                        <div className="small text-muted">
                          {submission.reportType || '-'} · {submission.state || '-'}
                        </div>
                        <div className="small text-muted">
                          {submission.periodFrom || '-'} - {submission.periodTo || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="small text-muted">ยังไม่มี submission ในงวดนี้</div>
                )}
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
