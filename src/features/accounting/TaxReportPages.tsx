import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { listTaxes } from '@/api/services/taxes.service'
import { getVatReport, getWhtReport } from '@/api/services/accounting-reports.service'
import { toISODate, firstDayOfThisMonth, lastDayOfThisMonth, firstDayOfLastMonth, lastDayOfLastMonth, firstDayOfThisYear, lastDayOfThisYear } from '@/lib/datePresets'

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

  const options = useMemo(() => taxesQuery.data ?? [], [taxesQuery.data])

  // auto select first tax if none selected
  useMemo(() => {
    if (taxId == null && options.length > 0) setTaxId(options[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length])

  const reportQuery = useQuery({
    queryKey: ['taxReports', 'vat', taxType, taxId, dateFrom, dateTo],
    enabled: taxId != null,
    queryFn: () => getVatReport({ taxId: taxId!, taxType, dateFrom, dateTo, showCancel: true, format: 'json' }),
    staleTime: 60_000,
    retry: 1,
  })

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
            <Button size="sm" variant="ghost" onClick={() => void reportQuery.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
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
      ) : (
        <Card className="p-3">
          <div className="fw-semibold mb-2">Raw reportData</div>
          <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {reportQuery.isLoading ? 'กำลังโหลด...' : JSON.stringify(reportQuery.data?.reportData ?? {}, null, 2)}
          </pre>
        </Card>
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
            <Button size="sm" variant="ghost" onClick={() => void reportQuery.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
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
      ) : (
        <Card className="p-3">
          <div className="fw-semibold mb-2">Raw reportData</div>
          <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {reportQuery.isLoading ? 'กำลังโหลด...' : JSON.stringify(reportQuery.data?.reportData ?? {}, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}


