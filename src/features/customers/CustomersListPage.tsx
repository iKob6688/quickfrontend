import { useMemo, useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { listPartners, setPartnersActive, setPartnersActiveByQuery } from '@/api/services/partners.service'
import { checkPartnersApiAvailable } from '@/api/services/partners-check.service'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toastStore'

type StatusTab = 'active' | 'archived' | 'all'
type CompanyFilter = 'all' | 'company' | 'person'

export function CustomersListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<StatusTab>('active')
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 300)
  const limit = 50
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all')
  const [selected, setSelected] = useState<Record<number, true>>({})
  const [allMatchingSelected, setAllMatchingSelected] = useState(false)
  const [excluded, setExcluded] = useState<Record<number, true>>({})

  // Check if API is available
  const apiCheckQuery = useQuery({
    queryKey: ['partners-api-check'],
    queryFn: checkPartnersApiAvailable,
    staleTime: 60_000, // Cache for 1 minute
    retry: false, // Don't retry, just check once
  })

  const query = useInfiniteQuery({
    queryKey: ['partners', tab, debouncedQ, limit, companyFilter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listPartners({
        q: debouncedQ || undefined,
        active: tab === 'all' ? undefined : tab === 'active',
        company_type: companyFilter === 'all' ? undefined : companyFilter,
        limit,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0)
      if (loaded >= (lastPage?.total ?? 0)) return undefined
      if ((lastPage?.items?.length ?? 0) < limit) return undefined
      return loaded
    },
    staleTime: 30_000,
  })

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data?.pages])
  const total = query.data?.pages[0]?.total ?? 0

  const rows = items.map((p) => ({
    id: p.id,
    name: p.name,
    vat: p.vat ?? '—',
    phone: p.phone ?? '—',
    email: p.email ?? '—',
    active: p.active,
    companyType: p.companyType,
  }))

  type Row = (typeof rows)[number]

  const selectedIds = useMemo(
    () => Object.keys(selected).map((k) => Number(k)).filter((n) => Number.isFinite(n)),
    [selected],
  )

  const excludedIds = useMemo(
    () => Object.keys(excluded).map((k) => Number(k)).filter((n) => Number.isFinite(n)),
    [excluded],
  )

  const bulkMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const queryParams = {
        q: debouncedQ || undefined,
        active: tab === 'all' ? undefined : tab === 'active',
        company_type: companyFilter === 'all' ? undefined : companyFilter,
      }
      if (allMatchingSelected) {
        return setPartnersActiveByQuery(queryParams, active, { excludeIds: excludedIds })
      }
      return setPartnersActive(selectedIds, active)
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['partners'] })
      setSelected({})
      setExcluded({})
      setAllMatchingSelected(false)

      const ok = 'ok' in result ? result.ok.length : 0
      const failed = 'failed' in result ? result.failed.length : 0
      const truncated = 'truncated' in result ? result.truncated : false

      if (failed > 0) {
        toast.info(`สำเร็จ ${ok} รายการ`, `ไม่สำเร็จ ${failed} รายการ`)
      } else {
        toast.success(`สำเร็จ ${ok} รายการ`, truncated ? 'มีจำนวนมาก ระบบทำเฉพาะบางส่วน (max 5000) กรุณาทำซ้ำ' : undefined)
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'ทำรายการไม่สำเร็จ')
    },
  })

  const allSelectedCount = allMatchingSelected
    ? Math.max(0, total - excludedIds.length)
    : selectedIds.length

  const resetSelection = () => {
    setSelected({})
    setExcluded({})
    setAllMatchingSelected(false)
  }

  const columns: Column<Row>[] = [
    {
      // DataTable header typing is string; keep it runtime-correct and cast.
      key: 'select',
      header: (
        <input
          className="form-check-input"
          type="checkbox"
          aria-label="เลือกทั้งหมดในหน้านี้"
          checked={
            rows.length > 0 &&
            rows.every((r: Row) =>
              allMatchingSelected ? !excluded[r.id] : Boolean(selected[r.id]),
            )
          }
          onChange={(e) => {
            const checked = e.target.checked
            if (allMatchingSelected) {
              // Toggle selection for the current page by managing exclusions.
              setExcluded((prev) => {
                const next = { ...prev }
                if (!checked) {
                  for (const r of rows) next[r.id] = true
                } else {
                  for (const r of rows) delete next[r.id]
                }
                return next
              })
            } else {
              setSelected((prev) => {
                const next = { ...prev }
                if (!checked) {
                  for (const r of rows) delete next[r.id]
                } else {
                  for (const r of rows) next[r.id] = true
                }
                return next
              })
            }
          }}
        />
      ) as unknown as string,
      cell: (r: Row) => (
        <input
          className="form-check-input"
          type="checkbox"
          aria-label={`เลือกรายชื่อติดต่อ ${r.name}`}
          checked={allMatchingSelected ? !excluded[r.id] : Boolean(selected[r.id])}
          onChange={(e) => {
            const checked = e.target.checked
            if (allMatchingSelected) {
              setExcluded((prev) => {
                const next = { ...prev }
                // if checked => include (remove from excluded); else exclude
                if (!checked) next[r.id] = true
                else delete next[r.id]
                return next
              })
            } else {
              setSelected((prev) => {
                const next = { ...prev }
                if (!checked) delete next[r.id]
                else next[r.id] = true
                return next
              })
            }
          }}
        />
      ),
    } as unknown as Column<Row>,
    {
      key: 'status',
      header: 'สถานะ',
      className: 'text-nowrap',
      cell: (r: Row) => (
        <Badge tone={r.active ? 'green' : 'gray'}>
          {r.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
        </Badge>
      ),
    },
    {
      key: 'companyType',
      header: 'ประเภท',
      className: 'text-nowrap',
      cell: (r: Row) => (
        <Badge tone={r.companyType === 'company' ? 'blue' : 'gray'}>
          {r.companyType === 'company' ? 'นิติบุคคล' : 'บุคคล'}
        </Badge>
      ),
    },
    {
      key: 'name',
      header: 'ชื่อ',
      className: 'text-nowrap',
      cell: (r: Row) => (
        <button
          type="button"
          className="btn btn-link p-0 fw-semibold text-decoration-none"
          onClick={() => navigate(`/customers/${r.id}`)}
        >
          {r.name}
        </button>
      ),
    },
    {
      key: 'vat',
      header: 'เลขผู้เสียภาษี',
      className: 'text-nowrap',
      cell: (r: Row) => <span className="font-monospace">{r.vat}</span>,
    },
    { key: 'phone', header: 'โทร', className: 'text-nowrap', cell: (r: Row) => <span>{r.phone}</span> },
    { key: 'email', header: 'อีเมล', cell: (r: Row) => <span>{r.email}</span> },
  ]

  return (
    <div>
      <PageHeader
        title="รายชื่อติดต่อ / Contacts"
        subtitle="จัดการข้อมูลรายชื่อผู้ติดต่อ (res.partner) ทั้งลูกค้าและผู้ขาย ผ่าน API"
        breadcrumb="รายรับ · รายชื่อติดต่อ"
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" onClick={() => navigate('/customers/new')}>
              + เพิ่มรายชื่อติดต่อ
            </Button>
          </div>
        }
      />

      <>
          {allSelectedCount > 0 ? (
            <Card className="qf-selection-bar p-3 mb-3">
              <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-sm-between gap-2">
                <div className="small fw-semibold">
                  {allMatchingSelected
                    ? `เลือกทั้งหมด ${allSelectedCount.toLocaleString('th-TH')} รายการ (จาก ${total.toLocaleString('th-TH')} ที่ตรงกับการค้นหา)`
                    : `เลือกแล้ว ${allSelectedCount.toLocaleString('th-TH')} รายการ`}
                </div>
                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={resetSelection}
                    disabled={bulkMutation.isPending}
                  >
                    ล้างการเลือก
                  </Button>
                  {(tab === 'active' || tab === 'all') && (
                    <Button
                      size="sm"
                      onClick={() => bulkMutation.mutate(false)}
                      isLoading={bulkMutation.isPending}
                    >
                      ปิดใช้งาน
                    </Button>
                  )}
                  {(tab === 'archived' || tab === 'all') && (
                    <Button
                      size="sm"
                      onClick={() => bulkMutation.mutate(true)}
                      isLoading={bulkMutation.isPending}
                    >
                      เปิดใช้งาน
                    </Button>
                  )}
                </div>
              </div>
              {!allMatchingSelected &&
                total > rows.length &&
                rows.length > 0 &&
                rows.every((r) => Boolean(selected[r.id])) && (
                  <div className="small text-muted mt-2">
                    เลือกแล้ว {rows.length} รายการในหน้านี้ •{' '}
                    <button
                      type="button"
                      className="btn btn-link p-0 align-baseline"
                      onClick={() => {
                        setAllMatchingSelected(true)
                        setExcluded({})
                        setSelected({})
                      }}
                    >
                      เลือกทั้งหมด {total.toLocaleString('th-TH')} รายการที่ตรงกับการค้นหา
                    </button>
                  </div>
                )}
            </Card>
          ) : null}

          <div className="mb-4 d-flex flex-column gap-3 flex-sm-row align-items-sm-center justify-content-sm-between">
            <Tabs
              value={tab}
              onChange={(next) => {
                setTab(next)
                resetSelection()
              }}
              items={[
                { key: 'active', label: 'ใช้งาน' },
                { key: 'archived', label: 'ปิดใช้งาน' },
                { key: 'all', label: 'ทั้งหมด' },
              ]}
            />
            <div className="d-flex gap-2 w-100 justify-content-end">
              <div style={{ maxWidth: 220 }}>
                <select
                  className="form-select"
                  value={companyFilter}
                  onChange={(e) => {
                    setCompanyFilter(e.target.value as CompanyFilter)
                    resetSelection()
                  }}
                >
                  <option value="all">ทุกประเภท</option>
                  <option value="company">นิติบุคคล</option>
                  <option value="person">บุคคล</option>
                </select>
              </div>
              <div className="w-100" style={{ maxWidth: 360 }}>
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    resetSelection()
                  }}
                  placeholder="ค้นหาชื่อ/เลขผู้เสียภาษี/อีเมล"
                  leftAdornment={<i className="bi bi-search"></i>}
                />
              </div>
            </div>
          </div>

          {/* API Availability Check */}
          {apiCheckQuery.data && !apiCheckQuery.data.available ? (
            <div className="alert alert-warning small">
              <div className="fw-semibold mb-1">⚠️ API Endpoint ไม่พร้อมใช้งาน</div>
              <div className="mb-2">
                <strong>Status:</strong> {apiCheckQuery.data.statusCode || 'Unknown'}
              </div>
              <div className="mb-2">
                <strong>Error:</strong> {apiCheckQuery.data.error || 'Unknown error'}
              </div>
              <div className="small">
                <div className="mb-1">
                  <strong>วิธีแก้ไข:</strong>
                </div>
                <ol className="mt-1 mb-0">
                  {apiCheckQuery.data.statusCode === 404 && (
                    <>
                      <li>Backend ต้องสร้าง controller <code>adt_th_api/controllers/partners.py</code></li>
                      <li>Register routes <code>/api/th/v1/partners/*</code></li>
                      <li>Upgrade module: <code>sudo -u odoo18 ... -u adt_th_api --stop-after-init</code></li>
                      <li>Restart service: <code>sudo systemctl restart odoo18-api</code></li>
                    </>
                  )}
                  {apiCheckQuery.data.statusCode === 401 && (
                    <>
                      <li>ตรวจสอบ API Key (X-ADT-API-Key) ใน <code>.env</code></li>
                      <li>ตรวจสอบ Bearer token</li>
                      <li>ตรวจสอบว่า API client มี scope <code>contacts</code></li>
                    </>
                  )}
                  {apiCheckQuery.data.statusCode === 500 && (
                    <>
                      <li>ตรวจสอบ Odoo logs: <code>sudo journalctl -u odoo18-api -n 100</code></li>
                      <li>ตรวจสอบว่า model <code>res.partner</code> มีอยู่</li>
                      <li>ตรวจสอบ permissions ของ API user</li>
                    </>
                  )}
                </ol>
              </div>
            </div>
          ) : null}

          {query.isError ? (
            <div className="alert alert-danger small">
              <div className="fw-semibold mb-1">โหลดรายชื่อติดต่อไม่สำเร็จ</div>
              <div className="mb-2">
                {query.error instanceof Error ? query.error.message : 'Unknown error'}
              </div>
              {!apiCheckQuery.data?.available && (
                <div className="small mt-2">
                  <div className="mb-1">
                    <strong>สาเหตุที่เป็นไปได้:</strong>
                  </div>
                  <ul className="mb-2">
                    <li>API endpoint <code>/api/th/v1/partners/list</code> ยังไม่มีใน backend</li>
                    <li>API Key (X-ADT-API-Key) หรือ Bearer token ไม่ถูกต้อง</li>
                    <li>Odoo API Client ไม่มี scope <code>contacts</code></li>
                    <li>Backend service ยังไม่ได้ restart หลังจากเพิ่ม routes</li>
                  </ul>
                  <div className="mt-2">
                    <strong>วิธีแก้ไข:</strong>
                    <ol className="mt-1 mb-0">
                      <li>ตรวจสอบว่า backend มี controller <code>adt_th_api/controllers/partners.py</code></li>
                      <li>ตรวจสอบว่า routes <code>/api/th/v1/partners/*</code> ถูก register แล้ว</li>
                      <li>Run <code>sudo -u odoo18 ... -u adt_th_api --stop-after-init</code></li>
                      <li>Restart service: <code>sudo systemctl restart odoo18-api</code></li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DataTable<Row>
            title={`รายชื่อติดต่อ (${total.toLocaleString('th-TH')})`}
            columns={columns}
            rows={rows}
            empty={
              <div>
                <p className="h6 fw-semibold mb-2">ยังไม่มีข้อมูล</p>
                <p className="small text-muted mb-0">
                  {q ? 'ไม่พบข้อมูลที่ค้นหา' : 'ไม่มีรายชื่อติดต่อในระบบ'}
                </p>
              </div>
            }
          />

          <div className="d-flex align-items-center justify-content-between mt-3">
            <div className="small text-muted">
              แสดงแล้ว {rows.length.toLocaleString('th-TH')} / {total.toLocaleString('th-TH')}
            </div>
            {query.hasNextPage ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => query.fetchNextPage()}
                isLoading={query.isFetchingNextPage}
                disabled={query.isFetchingNextPage}
              >
                โหลดเพิ่ม
              </Button>
            ) : null}
          </div>

          <div className="small text-muted mt-2">
            Tip: คลิกชื่อรายชื่อติดต่อเพื่อดูรายละเอียด • ใช้ checkbox เพื่อทำ bulk actions • เลือกทั้งหมดได้ทั้งผลการค้นหา
          </div>

      </>
    </div>
  )
}


