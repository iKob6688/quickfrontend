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
import { toApiError } from '@/api/response'
import { toast } from '@/lib/toastStore'

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

export function OfficialThaiReportsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [periodMonth, setPeriodMonth] = useState(() => isoMonthValue(new Date()))
  const [selectedWhtCertificateId, setSelectedWhtCertificateId] = useState<number | null>(null)

  const { year, month } = useMemo(() => parseMonthValue(periodMonth), [periodMonth])
  const dateFrom = `${periodMonth}-01`
  const dateTo = `${periodMonth}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`

  const formsQuery = useQuery({
    queryKey: ['official-reports', 'forms'],
    queryFn: () => listOfficialForms(),
    staleTime: 60_000,
  })

  const logsQuery = useQuery({
    queryKey: ['official-reports', 'logs'],
    queryFn: () => listOfficialExportLogs({ limit: 20 }),
    staleTime: 15_000,
  })

  const whtCertificatesQuery = useQuery({
    queryKey: ['official-reports', 'wht-certificates', dateFrom, dateTo],
    queryFn: () =>
      listWhtCertificates({
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
        year,
        month,
        includeDraft: false,
        includeEtax: true,
      }),
    onSuccess: (data) => {
      toast.success(
        'สร้าง monthly pack แล้ว',
        `ได้ ${data.summary.withAttachment} ไฟล์, ข้ามแบบไม่มีข้อมูล ${data.summary.noData} รายการ`,
      )
      void invalidateOfficial()
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
        dateFrom,
        dateTo,
        ...(sourceId !== undefined
          ? {
              sourceModel: 'withholding.tax.cert',
              sourceId,
            }
          : {}),
      }),
    onSuccess: (data) => {
      toast.success('สร้างแบบทางการแล้ว', data.exportLog.name)
      if (data.exportLog.attachmentUrl) {
        window.open(data.exportLog.attachmentUrl, '_blank', 'noopener,noreferrer')
      }
      void invalidateOfficial()
    },
    onError: (error) => {
      const apiError = toApiError(error)
      toast.error('สร้างแบบทางการไม่สำเร็จ', apiError.message)
    },
  })

  const forms = formsQuery.data?.forms ?? []
  const logs = logsQuery.data?.logs ?? []
  const whtCertificates = whtCertificatesQuery.data?.certificates ?? []
  const formsError = formsQuery.error instanceof Error ? formsQuery.error.message : ''
  const logsError = logsQuery.error instanceof Error ? logsQuery.error.message : ''
  const whtCertificatesError =
    whtCertificatesQuery.error instanceof Error ? whtCertificatesQuery.error.message : ''

  useEffect(() => {
    if (!whtCertificates.length) {
      setSelectedWhtCertificateId(null)
      return
    }
    setSelectedWhtCertificateId((current) => {
      if (current && whtCertificates.some((cert) => cert.id === current)) {
        return current
      }
      return whtCertificates[0]?.id ?? null
    })
  }, [whtCertificates])

  const summary = useMemo(() => {
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
  }, [logs])

  return (
    <div>
      <PageHeader
        title="Official Thai Forms"
        subtitle="ศูนย์กลางแบบฟอร์มราชการไทย, monthly pack, และไฟล์ล่าสุดที่พร้อมใช้ต่อใน RD e-Filing"
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

      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <Card className="p-3 h-100">
            <div className="small text-muted">ไฟล์ล่าสุด</div>
            <div className="fs-4 fw-semibold">{summary.total}</div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="p-3 h-100">
            <div className="small text-muted">มี attachment</div>
            <div className="fs-4 fw-semibold">{summary.withAttachment}</div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="p-3 h-100">
            <div className="small text-muted">พร้อมใช้เป็น official form</div>
            <div className="fs-4 fw-semibold">{summary.official}</div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="p-3 h-100">
            <div className="small text-muted">ไม่มีข้อมูลในงวด</div>
            <div className="fs-4 fw-semibold">{summary.noData}</div>
          </Card>
        </div>
      </div>

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
              ระบบจะใช้ช่วงวันที่ {dateFrom} ถึง {dateTo} สำหรับ generate แบบและ monthly pack
            </div>
          </div>
          <div className="col-md-4 d-flex gap-2 justify-content-md-end flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => void formsQuery.refetch()}>
              รีเฟรชแบบฟอร์ม
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void logsQuery.refetch()}>
              รีเฟรช log
            </Button>
            <Button
              size="sm"
              onClick={() => packMutation.mutate()}
              disabled={packMutation.isPending || !year || !month}
            >
              {packMutation.isPending ? 'กำลังสร้าง...' : 'Generate Monthly Pack'}
            </Button>
          </div>
        </div>
      </Card>

      {formsError ? (
        <Card className="p-3 mb-3 border border-danger-subtle">
          <div className="fw-semibold text-danger mb-1">โหลด official templates ไม่สำเร็จ</div>
          <div className="small text-muted">{formsError}</div>
        </Card>
      ) : null}

      {logsError ? (
        <Card className="p-3 mb-3 border border-danger-subtle">
          <div className="fw-semibold text-danger mb-1">โหลด export logs ไม่สำเร็จ</div>
          <div className="small text-muted">{logsError}</div>
        </Card>
      ) : null}

      {whtCertificatesError ? (
        <Card className="p-3 mb-3 border border-danger-subtle">
          <div className="fw-semibold text-danger mb-1">โหลด WHT certificates ไม่สำเร็จ</div>
          <div className="small text-muted">{whtCertificatesError}</div>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden mb-3">
        <div className="p-3 border-bottom">
          <div className="fw-semibold">Official Form Templates</div>
          <div className="small text-muted">ดึงจาก adt_th_official_reports โดยตรง เพื่อไม่ให้ React ถือ logic mapping เอง</div>
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
              {forms.map((item) => {
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
                              setSelectedWhtCertificateId(
                                e.target.value ? Number(e.target.value) : null,
                              )
                            }
                            disabled={whtCertificatesQuery.isLoading || generateMutation.isPending}
                          >
                            <option value="">เลือก WHT certificate</option>
                            {whtCertificates.map((cert) => (
                              <option key={cert.id} value={cert.id}>
                                {certificateOptionLabel(cert)}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void whtCertificatesQuery.refetch()}
                            disabled={whtCertificatesQuery.isFetching}
                          >
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
                            Generate
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!item.canGenerate || generateMutation.isPending}
                          onClick={() => generateMutation.mutate({ templateId: item.template.id })}
                        >
                          Generate
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
              {logs.map((log) => (
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
              {!logsQuery.isLoading && logs.length === 0 ? (
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
  )
}
