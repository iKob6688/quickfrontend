import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { listTaxes } from '@/api/services/taxes.service'
import { getVatReport, getWhtReport, openVatReportExport, openWhtReportExport } from '@/api/services/accounting-reports.service'
import { toISODate, firstDayOfThisMonth, lastDayOfThisMonth, firstDayOfLastMonth, lastDayOfLastMonth, firstDayOfThisYear, lastDayOfThisYear } from '@/lib/datePresets'

function saveWorkbook(filename: string, sheets: Array<{ name: string; rows: Record<string, unknown>[] }>) {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}

async function exportSimplePdf(filename: string, title: string, meta: string[], rows: Record<string, unknown>[]) {
  const mod = (await import('html2pdf.js')) as any
  const html2pdf = mod.default || mod
  const container = document.createElement('div')
  container.style.padding = '16px'
  container.style.fontFamily = 'Arial, sans-serif'
  container.innerHTML = `
    <h2 style="margin:0 0 8px 0;">${title}</h2>
    <div style="font-size:12px;color:#555;margin-bottom:12px;">${meta.join(' | ')}</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr>${Object.keys(rows[0] || { no_data: 'ไม่มีข้อมูล' })
          .map((k) => `<th style="border:1px solid #ccc;padding:6px;text-align:left;background:#f5f5f5">${k}</th>`)
          .join('')}</tr>
      </thead>
      <tbody>
        ${rows.length
          ? rows
              .map(
                (r) =>
                  `<tr>${Object.values(r)
                    .map((v) => `<td style="border:1px solid #ddd;padding:6px;vertical-align:top">${String(v ?? '')}</td>`)
                    .join('')}</tr>`,
              )
              .join('')
          : `<tr><td style="border:1px solid #ddd;padding:6px;">ไม่มีข้อมูล</td></tr>`}
      </tbody>
    </table>
  `
  document.body.appendChild(container)
  try {
    await html2pdf()
      .from(container)
      .set({
        margin: 8,
        filename,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      })
      .save()
  } finally {
    document.body.removeChild(container)
  }
}

function formatTaxRowsForExport(report: any, type: 'vat' | 'wht'): Record<string, unknown>[] {
  const rows = report?.data ?? report?.reportData?.data ?? report?.reportData?.rows ?? []
  if (!Array.isArray(rows)) return []
  if (type === 'vat') {
    return rows.map((r: any, idx: number) => ({
      ลำดับ: r.rowNumber ?? idx + 1,
      เลขที่ใบกำกับ: r.taxInvoiceNumber ?? '',
      วันที่: r.taxDate ?? '',
      คู่ค้า: r.partner?.name ?? '',
      VAT: r.partner?.vat ?? '',
      ฐานภาษี: Number(r.taxBaseAmount ?? 0),
      ภาษี: Number(r.taxAmount ?? 0),
      รายละเอียด: r.name ?? '',
    }))
  }
  return rows.map((r: any, idx: number) => ({
    ลำดับ: idx + 1,
    เลขที่หนังสือรับรอง: r.certificateNumber ?? '',
    วันที่หนังสือรับรอง: r.certificateDate ?? '',
    คู่ค้า: r.partner?.name ?? '',
    VAT: r.partner?.vat ?? '',
    ประเภทเงินได้: r.incomeType ?? r.incomeCode ?? '',
    ฐานภาษี: Number(r.baseAmount ?? 0),
    'อัตรา(%)': Number(r.whtPercent ?? 0),
    'ภาษีหัก ณ ที่จ่าย': Number(r.whtAmount ?? 0),
  }))
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function formatAmount(value: unknown): string {
  return num(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ReportRowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <div className="text-muted">ไม่พบรายการในช่วงวันที่ที่เลือก</div>
  }
  const headers = Object.keys(rows[0] || {})
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              {headers.map((h) => (
                <td key={h} className="text-nowrap">
                  {String(r[h] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function VatReportPage() {
  const navigate = useNavigate()
  const [taxType, setTaxType] = useState<'sale' | 'purchase'>('sale')
  const [dateFrom, setDateFrom] = useState(() => toISODate(firstDayOfThisMonth()))
  const [dateTo, setDateTo] = useState(() => toISODate(lastDayOfThisMonth()))
  const [taxId, setTaxId] = useState<number | null>(null)

  const applyPreset = (preset: 'thisMonth' | 'prevMonth' | 'thisYear') => {
    if (preset === 'thisMonth') {
      setDateFrom(toISODate(firstDayOfThisMonth()))
      setDateTo(toISODate(lastDayOfThisMonth()))
    } else if (preset === 'prevMonth') {
      setDateFrom(toISODate(firstDayOfLastMonth()))
      setDateTo(toISODate(lastDayOfLastMonth()))
    } else {
      setDateFrom(toISODate(firstDayOfThisYear()))
      setDateTo(toISODate(lastDayOfThisYear()))
    }
  }

  // Hotkeys: Alt+1 เดือนนี้, Alt+2 เดือนก่อน, Alt+3 ปีนี้
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return
      if (e.key === '1') {
        e.preventDefault()
        applyPreset('thisMonth')
      } else if (e.key === '2') {
        e.preventDefault()
        applyPreset('prevMonth')
      } else if (e.key === '3') {
        e.preventDefault()
        applyPreset('thisYear')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const taxesQuery = useQuery({
    queryKey: ['taxes', 'list', 'vat', taxType],
    queryFn: () => listTaxes({ type: taxType, active: true, includeVat: true, limit: 200 }),
    staleTime: 60_000,
  })

  const options = useMemo(() => {
    const raw = taxesQuery.data as unknown
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object') {
      const maybeItems = (raw as { items?: unknown }).items
      if (Array.isArray(maybeItems)) return maybeItems
    }
    return []
  }, [taxesQuery.data])

  // auto select first tax if none selected
  useEffect(() => {
    if (taxId == null && options.length > 0) setTaxId(options[0].id)
  }, [taxId, options])

  const reportQuery = useQuery({
    queryKey: ['taxReports', 'vat', taxType, taxId, dateFrom, dateTo],
    enabled: taxId != null,
    queryFn: () => getVatReport({ taxId: taxId!, taxType, dateFrom, dateTo, showCancel: true, format: 'json' }),
    staleTime: 60_000,
    retry: 1,
  })

  const handleExportVatXlsx = () => {
    const report: any = reportQuery.data || {}
    const rows = formatTaxRowsForExport(report, 'vat')
    const totals = report?.totals ?? report?.reportData?.totals ?? {}
    saveWorkbook(`vat-report-${taxType}-${dateFrom}-to-${dateTo}.xlsx`, [
      { name: 'VAT', rows },
      {
        name: 'Summary',
        rows: [
          {
            ประเภท: taxType,
            เริ่ม: dateFrom,
            สิ้นสุด: dateTo,
            จำนวนรายการ: Number(totals.recordCount ?? rows.length ?? 0),
            ฐานภาษีรวม: Number(totals.totalBase ?? 0),
            ภาษีรวม: Number(totals.totalTax ?? 0),
          },
        ],
      },
    ])
  }

  const handleExportVatPdf = async () => {
    const report: any = reportQuery.data || {}
    const rows = formatTaxRowsForExport(report, 'vat')
    await exportSimplePdf(
      `vat-report-${taxType}-${dateFrom}-to-${dateTo}.pdf`,
      `VAT Report (${taxType})`,
      [`ช่วงวันที่ ${dateFrom} ถึง ${dateTo}`],
      rows,
    )
  }

  const handleBackendVatExport = async (format: 'pdf' | 'xlsx') => {
    if (!taxId) return
    await openVatReportExport({
      taxId,
      taxType,
      dateFrom,
      dateTo,
      showCancel: true,
      format,
    })
  }

  return (
    <div>
      <PageHeader
        title="รายงาน VAT"
        subtitle="ภาษีซื้อ/ภาษีขาย ตามช่วงวันที่"
        breadcrumb="Home · Accounting · Reports"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports')}>
              กลับไปรายงานบัญชี
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/tax-settings')}>
              VAT Settings Admin
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void reportQuery.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExportVatXlsx} disabled={reportQuery.isLoading || reportQuery.isError}>
              Export XLSX (UI)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void handleExportVatPdf()} disabled={reportQuery.isLoading || reportQuery.isError}>
              Export PDF (UI)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handleBackendVatExport('xlsx')} disabled={reportQuery.isLoading || reportQuery.isError || taxId == null}>
              Export XLSX (Backend)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handleBackendVatExport('pdf')} disabled={reportQuery.isLoading || reportQuery.isError || taxId == null}>
              Export PDF (Backend)
            </Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label">ประเภท</label>
            <select className="form-select" value={taxType} onChange={(e) => setTaxType(e.target.value as any)}>
              <option value="sale">ภาษีขาย</option>
              <option value="purchase">ภาษีซื้อ</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">ภาษี</label>
            <select
              className="form-select"
              value={taxId ?? ''}
              onChange={(e) => setTaxId(e.target.value ? Number(e.target.value) : null)}
              disabled={taxesQuery.isLoading || options.length === 0}
            >
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.amount}%)
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">ตั้งแต่</label>
            <input className="form-control" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">ถึง</label>
            <input className="form-control" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap mt-3">
          <Button size="sm" variant="ghost" onClick={() => applyPreset('thisMonth')}>
            เดือนนี้ (Alt+1)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyPreset('prevMonth')}>
            เดือนก่อน (Alt+2)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyPreset('thisYear')}>
            ปีนี้ (Alt+3)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void reportQuery.refetch()}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
            รีเฟรช
          </Button>
        </div>
        {taxesQuery.isError ? (
          <div className="alert alert-warning mt-3 mb-0">
            โหลดรายการภาษีไม่สำเร็จ: {taxesQuery.error instanceof Error ? taxesQuery.error.message : 'Unknown error'}
          </div>
        ) : null}
      </Card>

      {reportQuery.isError ? (
        <div className="alert alert-danger">
          โหลดรายงานไม่สำเร็จ: {reportQuery.error instanceof Error ? reportQuery.error.message : 'Unknown error'}
        </div>
      ) : reportQuery.isLoading ? (
        <Card className="p-3 text-muted">กำลังโหลดรายงาน...</Card>
      ) : (
        <>
          <Card className="p-3 mb-3">
            <div className="row g-3">
              <div className="col-md-4">
                <div className="small text-muted">จำนวนรายการ</div>
                <div className="h5 mb-0">
                  {num((reportQuery.data as any)?.totals?.recordCount ?? (reportQuery.data as any)?.reportData?.totals?.recordCount ?? formatTaxRowsForExport(reportQuery.data, 'vat').length).toLocaleString('en-US')}
                </div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">ฐานภาษีรวม</div>
                <div className="h5 mb-0">
                  {formatAmount((reportQuery.data as any)?.totals?.totalBase ?? (reportQuery.data as any)?.reportData?.totals?.totalBase)}
                </div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">ภาษีรวม</div>
                <div className="h5 mb-0">
                  {formatAmount((reportQuery.data as any)?.totals?.totalTax ?? (reportQuery.data as any)?.reportData?.totals?.totalTax)}
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="fw-semibold mb-2">รายการ VAT</div>
            <ReportRowsTable rows={formatTaxRowsForExport(reportQuery.data, 'vat')} />
          </Card>
        </>
      )}
    </div>
  )
}

export function WhtReportPage() {
  const navigate = useNavigate()
  const [whtType, setWhtType] = useState<'pnd1' | 'pnd1a' | 'pnd2' | 'pnd3' | 'pnd53'>('pnd53')
  const [dateFrom, setDateFrom] = useState(() => toISODate(firstDayOfThisMonth()))
  const [dateTo, setDateTo] = useState(() => toISODate(lastDayOfThisMonth()))

  const applyPreset = (preset: 'thisMonth' | 'prevMonth' | 'thisYear') => {
    if (preset === 'thisMonth') {
      setDateFrom(toISODate(firstDayOfThisMonth()))
      setDateTo(toISODate(lastDayOfThisMonth()))
    } else if (preset === 'prevMonth') {
      setDateFrom(toISODate(firstDayOfLastMonth()))
      setDateTo(toISODate(lastDayOfLastMonth()))
    } else {
      setDateFrom(toISODate(firstDayOfThisYear()))
      setDateTo(toISODate(lastDayOfThisYear()))
    }
  }

  // Hotkeys: Alt+1 เดือนนี้, Alt+2 เดือนก่อน, Alt+3 ปีนี้
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return
      if (e.key === '1') {
        e.preventDefault()
        applyPreset('thisMonth')
      } else if (e.key === '2') {
        e.preventDefault()
        applyPreset('prevMonth')
      } else if (e.key === '3') {
        e.preventDefault()
        applyPreset('thisYear')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const reportQuery = useQuery({
    queryKey: ['taxReports', 'wht', whtType, dateFrom, dateTo],
    queryFn: () => getWhtReport({ whtType, dateFrom, dateTo, showCancel: true, format: 'json' }),
    staleTime: 60_000,
    retry: 1,
  })

  const handleExportWhtXlsx = () => {
    const report: any = reportQuery.data || {}
    const rows = formatTaxRowsForExport(report, 'wht')
    const totals = report?.totals ?? report?.reportData?.totals ?? {}
    saveWorkbook(`wht-report-${whtType}-${dateFrom}-to-${dateTo}.xlsx`, [
      { name: 'WHT', rows },
      {
        name: 'Summary',
        rows: [
          {
            แบบ: whtType.toUpperCase(),
            เริ่ม: dateFrom,
            สิ้นสุด: dateTo,
            จำนวนรายการ: Number(totals.recordCount ?? rows.length ?? 0),
            ฐานภาษีรวม: Number(totals.totalBase ?? 0),
            ภาษีหักรวม: Number(totals.totalWht ?? 0),
          },
        ],
      },
    ])
  }

  const handleExportWhtPdf = async () => {
    const report: any = reportQuery.data || {}
    const rows = formatTaxRowsForExport(report, 'wht')
    await exportSimplePdf(
      `wht-report-${whtType}-${dateFrom}-to-${dateTo}.pdf`,
      `WHT Report (${whtType.toUpperCase()})`,
      [`ช่วงวันที่ ${dateFrom} ถึง ${dateTo}`],
      rows,
    )
  }

  const handleBackendWhtExport = async (format: 'pdf' | 'xlsx' | 'text') => {
    await openWhtReportExport({
      whtType,
      dateFrom,
      dateTo,
      showCancel: true,
      format,
    })
  }

  return (
    <div>
      <PageHeader
        title="รายงานภาษีหัก ณ ที่จ่าย (WHT)"
        subtitle="สรุปรายการตามแบบภงด. (Phase 2)"
        breadcrumb="Home · Accounting · Reports"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports')}>
              กลับไปรายงานบัญชี
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/tax-settings')}>
              VAT Settings Admin
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void reportQuery.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExportWhtXlsx} disabled={reportQuery.isLoading || reportQuery.isError}>
              Export XLSX (UI)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void handleExportWhtPdf()} disabled={reportQuery.isLoading || reportQuery.isError}>
              Export PDF (UI)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handleBackendWhtExport('xlsx')} disabled={reportQuery.isLoading || reportQuery.isError}>
              Export XLSX (Backend)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handleBackendWhtExport('pdf')} disabled={reportQuery.isLoading || reportQuery.isError}>
              Export PDF (Backend)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handleBackendWhtExport('text')} disabled={reportQuery.isLoading || reportQuery.isError}>
              Export TXT (Backend)
            </Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">แบบ</label>
            <select className="form-select" value={whtType} onChange={(e) => setWhtType(e.target.value as any)}>
              <option value="pnd1">PND1</option>
              <option value="pnd1a">PND1A</option>
              <option value="pnd2">PND2</option>
              <option value="pnd3">PND3</option>
              <option value="pnd53">PND53</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">ตั้งแต่</label>
            <input className="form-control" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">ถึง</label>
            <input className="form-control" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap mt-3">
          <Button size="sm" variant="ghost" onClick={() => applyPreset('thisMonth')}>
            เดือนนี้ (Alt+1)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyPreset('prevMonth')}>
            เดือนก่อน (Alt+2)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyPreset('thisYear')}>
            ปีนี้ (Alt+3)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void reportQuery.refetch()}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
            รีเฟรช
          </Button>
        </div>
      </Card>

      {reportQuery.isError ? (
        <div className="alert alert-danger">
          โหลดรายงานไม่สำเร็จ: {reportQuery.error instanceof Error ? reportQuery.error.message : 'Unknown error'}
        </div>
      ) : reportQuery.isLoading ? (
        <Card className="p-3 text-muted">กำลังโหลดรายงาน...</Card>
      ) : (
        <>
          <Card className="p-3 mb-3">
            <div className="row g-3">
              <div className="col-md-4">
                <div className="small text-muted">จำนวนรายการ</div>
                <div className="h5 mb-0">
                  {num((reportQuery.data as any)?.totals?.recordCount ?? (reportQuery.data as any)?.reportData?.totals?.recordCount ?? formatTaxRowsForExport(reportQuery.data, 'wht').length).toLocaleString('en-US')}
                </div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">ฐานภาษีรวม</div>
                <div className="h5 mb-0">
                  {formatAmount((reportQuery.data as any)?.totals?.totalBase ?? (reportQuery.data as any)?.reportData?.totals?.totalBase)}
                </div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">ภาษีหักรวม</div>
                <div className="h5 mb-0">
                  {formatAmount((reportQuery.data as any)?.totals?.totalWht ?? (reportQuery.data as any)?.reportData?.totals?.totalWht)}
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="fw-semibold mb-2">รายการภาษีหัก ณ ที่จ่าย</div>
            <ReportRowsTable rows={formatTaxRowsForExport(reportQuery.data, 'wht')} />
          </Card>
        </>
      )}
    </div>
  )
}
