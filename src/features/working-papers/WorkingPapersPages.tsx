import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/ui/DataTable'
import {
  applyMappings,
  createAdjustment,
  createReviewNote,
  createSample,
  deleteEvidence,
  downloadEvidence,
  generateSample,
  getAdjustments,
  getLeadsheets,
  getMappings,
  getReviewNotes,
  getSamples,
  getTrialBalance,
  getWorkFile,
  getWorkpaper,
  getWorkpapers,
  glDrilldown,
  listEvidence,
  listWorkFiles,
  postAdjustment,
  runReviewNoteAction,
  runWorkFileAction,
  runWorkpaperAction,
  saveWorkpaper,
  updateAdjustment,
  updateMapping,
  uploadEvidence,
  type Adjustment,
  type Evidence,
  type Leadsheet,
  type MappingRow,
  type RecordValue,
  type ReviewNote,
  type Sample,
  type TbLine,
  type WorkFile,
  type Workpaper,
} from '@/api/services/working-papers.service'
import { toApiError } from '@/api/response'
import { toast } from '@/lib/toastStore'

type TabKey = 'overview' | 'trial-balance' | 'mappings' | 'leadsheets' | 'workpapers' | 'adjustments' | 'review-notes' | 'sampling'

const money = (value?: number) => value == null ? '-' : new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
const text = (value?: string | number | null) => value == null || value === '' ? '-' : String(value)
const statusBadge = (value?: string) => <span className="badge rounded-pill text-bg-light border">{text(value)}</span>
const capability = (record: { capabilities?: Record<string, boolean> } | undefined, ...keys: string[]) => keys.some((key) => Boolean(record?.capabilities?.[key] ?? record?.capabilities?.[`can_${key}`]))

function ErrorState({ error, retry }: { error?: unknown; retry?: () => void }) {
  if (!error) return null
  return (
    <Card className="border-warning-subtle bg-warning-subtle mb-3">
      <strong>ไม่สามารถโหลดข้อมูลได้</strong>
      <div className="small mt-1">{toApiError(error).message}</div>
      {retry ? <Button size="sm" variant="secondary" className="mt-2" onClick={retry}>ลองอีกครั้ง</Button> : null}
    </Card>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="qf-audit-summary h-100">
      <div className="text-muted small">{label}</div>
      <div className="fs-3 fw-bold mt-1">{value}</div>
      {hint ? <div className="text-muted small mt-1">{hint}</div> : null}
    </Card>
  )
}

const workFileColumns: Column<WorkFile>[] = [
  { key: 'reference', header: 'Reference', cell: (item) => <Link className="fw-semibold" to={`/working-papers/files/${item.id}`}>{item.reference || item.name}</Link> },
  { key: 'client', header: 'Client', cell: (item) => text(item.clientName) },
  { key: 'company', header: 'Company', cell: (item) => text(item.companyName) },
  { key: 'period', header: 'Period', cell: (item) => item.period || [item.dateFrom, item.dateTo].filter(Boolean).join(' - ') || '-' },
  { key: 'status', header: 'Status', cell: (item) => statusBadge(item.status) },
  { key: 'preparer', header: 'Preparer', cell: (item) => text(item.preparerName) },
  { key: 'reviewer', header: 'Reviewer', cell: (item) => text(item.reviewerName) },
  { key: 'tb', header: 'TB', cell: (item) => [item.tbVersion, item.tbStatus].filter(Boolean).join(' / ') || '-' },
  { key: 'notes', header: 'Open Notes', cell: (item) => item.openReviewNotes ?? '-' },
  { key: 'updated', header: 'Updated', cell: (item) => text(item.updatedAt) },
]

export function WorkingPapersHomePage() {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['working-papers', 'files', { limit: 50 }], queryFn: () => listWorkFiles({ limit: 50 }), staleTime: 30_000 })
  const files = query.data?.items ?? []
  const completed = files.filter((file) => ['completed', 'locked', 'done'].includes((file.status || '').toLowerCase()))
  const needsReview = files.filter((file) => (file.status || '').toLowerCase().includes('review') || (file.reviewedProgress ?? 0) < 100)

  return (
    <div className="qf-audit-page">
      <PageHeader
        title="Working Papers"
        subtitle="Operational workpaper workspace for the active company. Feature Access and action rights come from Odoo."
        actions={<Button onClick={() => navigate('/working-papers/files')}>ดู Work Files</Button>}
      />
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-3"><MetricCard label="My Work Files" value={files.length} hint="จาก API บริษัทปัจจุบัน" /></div>
        <div className="col-12 col-md-3"><MetricCard label="Needs Review" value={needsReview.length} /></div>
        <div className="col-12 col-md-3"><MetricCard label="Open Review Notes" value={files.reduce((n, file) => n + (file.openReviewNotes || 0), 0)} /></div>
        <div className="col-12 col-md-3"><MetricCard label="Completed" value={completed.length} /></div>
      </div>
      <DataTable title="My Work Queue" columns={workFileColumns} rows={files.slice(0, 10)} rowKey={(item) => item.id} empty={query.isLoading ? 'กำลังโหลด...' : 'ไม่มี Work Files'} />
    </div>
  )
}

export function WorkFilesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 25
  const query = useQuery({
    queryKey: ['working-papers', 'files', { search, status, offset, limit }],
    queryFn: () => listWorkFiles({ search, status, limit, offset }),
    staleTime: 30_000,
  })
  useEffect(() => setOffset(0), [search, status])

  return (
    <div className="qf-audit-page">
      <PageHeader title="Work Files" subtitle="ค้นหาและเปิดแฟ้มงานในบริษัทปัจจุบันจาก Odoo" />
      <Card className="mb-3">
        <div className="row g-3">
          <div className="col-12 col-lg-8">
            <label className="form-label" htmlFor="work-file-search">Search</label>
            <Input id="work-file-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, client, company, period" />
          </div>
          <div className="col-12 col-lg-4">
            <label className="form-label" htmlFor="work-file-status">Status</label>
            <select id="work-file-status" className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
              <option value="locked">Locked</option>
            </select>
          </div>
        </div>
      </Card>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      <DataTable
        columns={workFileColumns}
        rows={query.data?.items || []}
        rowKey={(item) => item.id}
        empty={query.isLoading ? 'กำลังโหลด...' : 'ไม่พบ Work Files'}
        right={<span className="small text-muted">Total {query.data?.total ?? 0}</span>}
      />
      <div className="d-flex justify-content-end gap-2 mt-3">
        <Button size="sm" variant="secondary" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</Button>
        <Button size="sm" variant="secondary" disabled={(query.data?.items.length ?? 0) < limit || query.isFetching} onClick={() => setOffset(offset + limit)}>Next</Button>
      </div>
    </div>
  )
}

export function WorkFilePage() {
  const { workFileId = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('overview')
  const [reason, setReason] = useState('')
  const file = useQuery({ queryKey: ['working-papers', 'file', workFileId], queryFn: () => getWorkFile(workFileId), enabled: Boolean(workFileId) })
  const action = useMutation({
    mutationFn: ({ name, payload = {} }: { name: 'generate-snapshot' | 'complete' | 'reopen' | 'roll-forward'; payload?: RecordValue }) => runWorkFileAction(workFileId, name, payload),
    onSuccess: async (value, variables) => {
      await qc.invalidateQueries({ queryKey: ['working-papers'] })
      toast.success('ดำเนินการสำเร็จ')
      if (variables.name === 'roll-forward' && value.id) navigate(`/working-papers/files/${value.id}`)
    },
    onError: (error) => toast.error('ดำเนินการไม่สำเร็จ', toApiError(error).message),
  })
  const workFile = file.data
  const run = (name: 'generate-snapshot' | 'complete' | 'reopen' | 'roll-forward') => {
    if (name === 'reopen' && !reason.trim()) return toast.error('กรุณาระบุเหตุผลในการ Reopen')
    action.mutate({ name, payload: name === 'reopen' ? { reason } : {} })
  }

  return (
    <div className="qf-audit-page">
      <PageHeader
        title={workFile?.reference || workFile?.name || 'Work File'}
        subtitle={[workFile?.clientName, workFile?.companyName, workFile?.period || [workFile?.dateFrom, workFile?.dateTo].filter(Boolean).join(' - ')].filter(Boolean).join(' · ')}
        breadcrumb={<Link to="/working-papers/files">Work Files</Link>}
        actions={
          <div className="d-flex gap-2 flex-wrap">
            {capability(workFile, 'generate_snapshot') ? <Button size="sm" variant="secondary" isLoading={action.isPending} onClick={() => run('generate-snapshot')}>Generate Snapshot</Button> : null}
            {capability(workFile, 'complete') ? <Button size="sm" isLoading={action.isPending} onClick={() => run('complete')}>Complete</Button> : null}
            {capability(workFile, 'roll_forward') ? <Button size="sm" variant="secondary" isLoading={action.isPending} onClick={() => run('roll-forward')}>Roll Forward</Button> : null}
          </div>
        }
      />
      <ErrorState error={file.error} retry={() => void file.refetch()} />
      {file.isLoading ? <Card>กำลังโหลด Work File...</Card> : (
        <>
          <Card className="mb-3">
            <div className="d-flex flex-wrap gap-3 align-items-center">
              {statusBadge(workFile?.status)}
              <span className="small text-muted">Preparer {text(workFile?.preparerName)} · Reviewer {text(workFile?.reviewerName)}</span>
              <span className="small text-muted">Prepared {workFile?.preparedProgress ?? 0}% · Reviewed {workFile?.reviewedProgress ?? 0}% · TB {workFile?.tbVersion || '-'}</span>
              {capability(workFile, 'reopen') ? (
                <div className="ms-auto d-flex gap-2">
                  <Input aria-label="Reopen reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เหตุผลในการ Reopen" />
                  <Button size="sm" variant="secondary" isLoading={action.isPending} onClick={() => run('reopen')}>Reopen</Button>
                </div>
              ) : null}
            </div>
          </Card>
          <nav className="nav nav-pills qf-audit-tabs mb-3" aria-label="Work File sections">
            {(['overview', 'trial-balance', 'mappings', 'leadsheets', 'workpapers', 'adjustments', 'review-notes', 'sampling'] as TabKey[]).map((key) => (
              <button type="button" key={key} className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{tabLabel(key)}</button>
            ))}
          </nav>
          {tab === 'overview' ? <OverviewTab workFile={workFile} /> : null}
          {tab === 'trial-balance' ? <TrialBalanceTab workFileId={workFileId} /> : null}
          {tab === 'mappings' ? <MappingsTab workFileId={workFileId} workFile={workFile} /> : null}
          {tab === 'leadsheets' ? <LeadsheetsTab workFileId={workFileId} /> : null}
          {tab === 'workpapers' ? <WorkpapersTab workFileId={workFileId} /> : null}
          {tab === 'adjustments' ? <AdjustmentsTab workFileId={workFileId} workFile={workFile} /> : null}
          {tab === 'review-notes' ? <ReviewNotesTab workFileId={workFileId} workFile={workFile} /> : null}
          {tab === 'sampling' ? <SamplingTab workFileId={workFileId} workFile={workFile} /> : null}
        </>
      )}
    </div>
  )
}

function tabLabel(tab: TabKey) {
  const labels: Record<TabKey, string> = {
    overview: 'Overview',
    'trial-balance': 'Trial Balance',
    mappings: 'Mappings',
    leadsheets: 'Leadsheets',
    workpapers: 'Workpapers',
    adjustments: 'Adjustments',
    'review-notes': 'Review Notes',
    sampling: 'Sampling',
  }
  return labels[tab]
}

function OverviewTab({ workFile }: { workFile?: WorkFile }) {
  return (
    <div className="row g-3">
      <div className="col-12 col-md-3"><MetricCard label="Status" value={statusBadge(workFile?.status)} /></div>
      <div className="col-12 col-md-3"><MetricCard label="Prepared" value={`${workFile?.preparedProgress ?? 0}%`} /></div>
      <div className="col-12 col-md-3"><MetricCard label="Reviewed" value={`${workFile?.reviewedProgress ?? 0}%`} /></div>
      <div className="col-12 col-md-3"><MetricCard label="Open Notes" value={workFile?.openReviewNotes ?? 0} /></div>
      <div className="col-12">
        <Card>
          <h2 className="h5">Canonical state</h2>
          <p className="text-muted mb-0">Amounts, workflow status, lock state, sign-off users, and action availability are read from the backend after every mutation. The frontend does not calculate TB or audited balances.</p>
        </Card>
      </div>
    </div>
  )
}

function TrialBalanceTab({ workFileId }: { workFileId: string }) {
  const [drilldown, setDrilldown] = useState<unknown>(null)
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'trial-balance'], queryFn: () => getTrialBalance(workFileId) })
  const gl = useMutation({
    mutationFn: (line: TbLine) => glDrilldown(workFileId, { account_id: line.accountId, tb_line_id: line.id, limit: 100 }),
    onSuccess: setDrilldown,
    onError: (error) => toast.error('GL drilldown failed', toApiError(error).message),
  })
  const rows = query.data?.rows ?? []
  return (
    <>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      <Card className="mb-3">
        <div className="d-flex flex-wrap gap-3 small text-muted">
          <span>Version {text(query.data?.version)}</span>
          <span>Status {text(query.data?.status)}</span>
          <span>Generated {text(query.data?.generatedAt)}</span>
          <span>Sealed {text(query.data?.sealedAt)}</span>
          <span>Rows {query.data?.total ?? 0}</span>
          <Button size="sm" variant="secondary" disabled={query.isFetching} onClick={() => void qc.invalidateQueries({ queryKey: ['working-papers', 'file', workFileId, 'trial-balance'] })}>Refresh</Button>
        </div>
      </Card>
      <DataTable<TbLine>
        title="Trial Balance Snapshot"
        columns={[
          { key: 'code', header: 'Account Code', cell: (row) => text(row.accountCode) },
          { key: 'name', header: 'Account Name', cell: (row) => text(row.accountName) },
          { key: 'debit', header: 'Debit', cell: (row) => money(row.debit), className: 'text-end' },
          { key: 'credit', header: 'Credit', cell: (row) => money(row.credit), className: 'text-end' },
          { key: 'net', header: 'Net', cell: (row) => money(row.net ?? row.closing), className: 'text-end' },
          { key: 'mapping', header: 'Mapping', cell: (row) => text(row.mapping) },
          { key: 'leadsheet', header: 'Leadsheet', cell: (row) => text(row.leadsheet) },
          { key: 'gl', header: '', cell: (row) => <Button size="sm" variant="ghost" isLoading={gl.isPending} onClick={() => gl.mutate(row)}>GL</Button> },
        ]}
        rows={rows}
        rowKey={(row, index) => row.id || index}
        empty={query.isLoading ? 'กำลังโหลด...' : 'No TB Snapshot'}
      />
      {drilldown ? <RawResult title="GL Drilldown" value={drilldown} /> : null}
    </>
  )
}

function MappingsTab({ workFileId, workFile }: { workFileId: string; workFile?: WorkFile }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<RecordValue>({})
  const query = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'mappings'], queryFn: () => getMappings(workFileId) })
  const save = useMutation({
    mutationFn: () => updateMapping(workFileId, draft),
    onSuccess: async () => { setDraft({}); await qc.invalidateQueries({ queryKey: ['working-papers', 'file', workFileId] }); toast.success('Mapping saved') },
    onError: (error) => toast.error('Mapping failed', toApiError(error).message),
  })
  const apply = useMutation({
    mutationFn: () => applyMappings(workFileId),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['working-papers'] }); toast.success('Mappings applied') },
    onError: (error) => toast.error('Apply failed', toApiError(error).message),
  })
  const canMaintain = capability(workFile, 'manage_mapping', 'update_mapping', 'create_mapping')
  return (
    <>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      {canMaintain ? (
        <Card className="mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-3"><Input placeholder="account_id" value={String(draft.account_id ?? '')} onChange={(event) => setDraft({ ...draft, account_id: Number(event.target.value) || undefined })} /></div>
            <div className="col-12 col-md-3"><Input placeholder="leadsheet_code" value={String(draft.leadsheet_code ?? '')} onChange={(event) => setDraft({ ...draft, leadsheet_code: event.target.value })} /></div>
            <div className="col-12 col-md-3"><Input placeholder="workpaper_reference" value={String(draft.workpaper_reference ?? '')} onChange={(event) => setDraft({ ...draft, workpaper_reference: event.target.value })} /></div>
            <div className="col-12 col-md-3 d-flex gap-2"><Button size="sm" isLoading={save.isPending} onClick={() => save.mutate()}>Save Mapping</Button><Button size="sm" variant="secondary" isLoading={apply.isPending} onClick={() => apply.mutate()}>Apply</Button></div>
          </div>
        </Card>
      ) : null}
      <DataTable<MappingRow>
        title="Mapping Maintenance"
        columns={[
          { key: 'account', header: 'Account', cell: (row) => [row.accountCode, row.accountName].filter(Boolean).join(' ') || '-' },
          { key: 'lead', header: 'Leadsheet', cell: (row) => [row.leadsheetCode, row.leadsheetName].filter(Boolean).join(' ') || '-' },
          { key: 'wp', header: 'Workpaper', cell: (row) => text(row.workpaperReference) },
          { key: 'active', header: 'Active', cell: (row) => row.active == null ? '-' : row.active ? 'Yes' : 'No' },
        ]}
        rows={query.data?.rows ?? []}
        rowKey={(row, index) => row.id || `${row.accountId}-${index}`}
        empty={query.isLoading ? 'กำลังโหลด...' : 'No mappings'}
      />
    </>
  )
}

function LeadsheetsTab({ workFileId }: { workFileId: string }) {
  const [drilldown, setDrilldown] = useState<unknown>(null)
  const query = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'leadsheets'], queryFn: () => getLeadsheets(workFileId) })
  const gl = useMutation({
    mutationFn: (row: Leadsheet) => glDrilldown(workFileId, { leadsheet_id: row.id, limit: 100 }),
    onSuccess: setDrilldown,
    onError: (error) => toast.error('GL drilldown failed', toApiError(error).message),
  })
  return (
    <>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      <DataTable<Leadsheet>
        title="Leadsheets"
        columns={[
          { key: 'reference', header: 'Reference', cell: (row) => text(row.reference) },
          { key: 'name', header: 'Name', cell: (row) => text(row.name) },
          { key: 'books', header: 'Per Books', cell: (row) => money(row.currentAmount), className: 'text-end' },
          { key: 'py', header: 'PY', cell: (row) => money(row.priorAmount), className: 'text-end' },
          { key: 'adj', header: 'Adjustments', cell: (row) => money(row.adjustmentAmount), className: 'text-end' },
          { key: 'audited', header: 'Audited Amount', cell: (row) => money(row.auditedAmount), className: 'text-end' },
          { key: 'diff', header: 'Difference', cell: (row) => money(row.difference), className: 'text-end' },
          { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
          { key: 'gl', header: '', cell: (row) => <Button size="sm" variant="ghost" isLoading={gl.isPending} onClick={() => gl.mutate(row)}>GL</Button> },
        ]}
        rows={query.data?.rows ?? []}
        rowKey={(row, index) => row.id || index}
        empty={query.isLoading ? 'กำลังโหลด...' : 'No Leadsheets'}
      />
      {drilldown ? <RawResult title="GL Drilldown" value={drilldown} /> : null}
    </>
  )
}

function WorkpapersTab({ workFileId }: { workFileId: string }) {
  const query = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'workpapers'], queryFn: () => getWorkpapers(workFileId) })
  return (
    <>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      <DataTable<Workpaper>
        title="Workpapers"
        columns={[
          { key: 'ref', header: 'Reference', cell: (row) => <Link className="fw-semibold" to={`/working-papers/files/${workFileId}/workpapers/${row.id}`}>{text(row.reference)}</Link> },
          { key: 'name', header: 'Name', cell: (row) => row.name },
          { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
          { key: 'prepared', header: 'Prepared', cell: (row) => [row.preparedBy, row.preparedAt].filter(Boolean).join(' / ') || '-' },
          { key: 'reviewed', header: 'Reviewed', cell: (row) => [row.reviewedBy, row.reviewedAt].filter(Boolean).join(' / ') || '-' },
          { key: 'evidence', header: 'Evidence', cell: (row) => row.evidenceCount ?? '-' },
          { key: 'notes', header: 'Open Notes', cell: (row) => row.openReviewNotes ?? '-' },
        ]}
        rows={query.data?.rows ?? []}
        rowKey={(row) => row.id}
        empty={query.isLoading ? 'กำลังโหลด...' : 'No Workpapers'}
      />
    </>
  )
}

function AdjustmentsTab({ workFileId, workFile }: { workFileId: string; workFile?: WorkFile }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<RecordValue>({})
  const query = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'adjustments'], queryFn: () => getAdjustments(workFileId) })
  const leadsheets = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'leadsheets', 'adjustment-picker'], queryFn: () => getLeadsheets(workFileId) })
  const trialBalance = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'trial-balance', 'adjustment-picker'], queryFn: () => getTrialBalance(workFileId) })
  const accountOptions = useMemo(() => {
    const seen = new Set<number>()
    return (trialBalance.data?.rows ?? []).filter((row) => {
      if (!row.accountId || seen.has(row.accountId)) return false
      seen.add(row.accountId)
      return true
    })
  }, [trialBalance.data?.rows])
  const create = useMutation({
    mutationFn: () => {
      const accountId = Number(draft.account_id)
      const offsetAccountId = Number(draft.offset_account_id)
      const amount = Number(draft.amount)
      const leadsheetId = draft.leadsheet_id ? Number(draft.leadsheet_id) : undefined
      const lines = accountId && offsetAccountId && amount > 0 ? [
        { account_id: accountId, leadsheet_id: leadsheetId, debit: amount, credit: 0 },
        { account_id: offsetAccountId, credit: amount, debit: 0 },
      ] : []
      return createAdjustment(workFileId, { ...draft, lines })
    },
    onSuccess: async () => { setDraft({}); await qc.invalidateQueries({ queryKey: ['working-papers', 'file', workFileId] }); toast.success('Adjustment created') },
    onError: (error) => toast.error('Adjustment failed', toApiError(error).message),
  })
  const update = useMutation({
    mutationFn: (row: Adjustment) => updateAdjustment(row.id, { description: row.description }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['working-papers', 'file', workFileId] }); toast.success('Adjustment updated') },
    onError: (error) => toast.error('Update failed', toApiError(error).message),
  })
  const post = useMutation({
    mutationFn: (row: Adjustment) => postAdjustment(row.id),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['working-papers'] }); toast.success('Adjustment posted') },
    onError: (error) => toast.error('Post failed', toApiError(error).message),
  })
  const canCreate = capability(workFile, 'create_adjustment')
  return (
    <>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      {canCreate ? (
        <Card className="mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-2"><Input aria-label="Adjustment date" type="date" value={String(draft.date ?? '')} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></div>
            <div className="col-12 col-md-4"><Input aria-label="Adjustment description" placeholder="Description" value={String(draft.description ?? '')} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
            <div className="col-12 col-md-2">
              <select aria-label="Debit account" className="form-select" value={String(draft.account_id ?? '')} onChange={(event) => setDraft({ ...draft, account_id: Number(event.target.value) || undefined })}>
                <option value="">Debit account</option>
                {accountOptions.map((row) => <option key={row.accountId} value={row.accountId}>{[row.accountCode, row.accountName].filter(Boolean).join(' ')}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-2">
              <select aria-label="Credit account" className="form-select" value={String(draft.offset_account_id ?? '')} onChange={(event) => setDraft({ ...draft, offset_account_id: Number(event.target.value) || undefined })}>
                <option value="">Credit account</option>
                {accountOptions.map((row) => <option key={row.accountId} value={row.accountId}>{[row.accountCode, row.accountName].filter(Boolean).join(' ')}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-2"><Input aria-label="Adjustment amount" placeholder="Amount" value={String(draft.amount ?? '')} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) || undefined })} /></div>
            <div className="col-12 col-md-4">
              <select aria-label="Leadsheet" className="form-select" value={String(draft.leadsheet_id ?? '')} onChange={(event) => setDraft({ ...draft, leadsheet_id: Number(event.target.value) || undefined })}>
                <option value="">Optional leadsheet</option>
                {(leadsheets.data?.rows ?? []).map((row) => <option key={row.id} value={row.id}>{[row.reference, row.name].filter(Boolean).join(' ')}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-2"><Button size="sm" isLoading={create.isPending} onClick={() => create.mutate()}>Create</Button></div>
          </div>
        </Card>
      ) : null}
      <DataTable<Adjustment>
        title="Adjustments"
        columns={[
          { key: 'ref', header: 'Reference', cell: (row) => text(row.reference) },
          { key: 'date', header: 'Date', cell: (row) => text(row.date) },
          { key: 'desc', header: 'Description', cell: (row) => text(row.description) },
          { key: 'debit', header: 'Debit', cell: (row) => money(row.debit), className: 'text-end' },
          { key: 'credit', header: 'Credit', cell: (row) => money(row.credit), className: 'text-end' },
          { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
          { key: 'flags', header: 'Accepted / Posted', cell: (row) => `${row.accepted ? 'Yes' : 'No'} / ${row.posted ? 'Yes' : 'No'}` },
          { key: 'actions', header: '', cell: (row) => <div className="d-flex gap-2">{capability(row, 'update') ? <Button size="sm" variant="ghost" isLoading={update.isPending} onClick={() => update.mutate(row)}>Save</Button> : null}{capability(row, 'post') ? <Button size="sm" variant="secondary" isLoading={post.isPending} onClick={() => post.mutate(row)}>Post</Button> : null}</div> },
        ]}
        rows={query.data?.rows ?? []}
        rowKey={(row) => row.id}
        empty={query.isLoading ? 'กำลังโหลด...' : 'No Adjustments'}
      />
    </>
  )
}

function ReviewNotesTab({ workFileId, workFile, workpaperId }: { workFileId: string; workFile?: WorkFile; workpaperId?: string }) {
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [response, setResponse] = useState<Record<string, string>>({})
  const query = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'review-notes'], queryFn: () => getReviewNotes(workFileId), enabled: Boolean(workFileId) })
  const rows = useMemo(() => workpaperId ? (query.data?.rows ?? []).filter((note) => note.workpaperId === workpaperId) : (query.data?.rows ?? []), [query.data?.rows, workpaperId])
  const create = useMutation({
    mutationFn: () => createReviewNote(workFileId, { workpaper_id: workpaperId, body }),
    onSuccess: async () => { setBody(''); await qc.invalidateQueries({ queryKey: ['working-papers'] }); toast.success('Review note created') },
    onError: (error) => toast.error('Review note failed', toApiError(error).message),
  })
  const lifecycle = useMutation({
    mutationFn: ({ note, action }: { note: ReviewNote; action: 'respond' | 'clear' }) => runReviewNoteAction(note.id, action, action === 'respond' ? { response: response[note.id] || '' } : {}),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['working-papers'] }); toast.success('Review note updated') },
    onError: (error) => toast.error('Review note action failed', toApiError(error).message),
  })
  const canCreate = workpaperId || capability(workFile, 'create_review_note')
  return (
    <>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      {canCreate ? (
        <Card className="mb-3">
          <label className="form-label" htmlFor="review-note-body">New Review Note</label>
          <textarea id="review-note-body" className="form-control" rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
          <Button size="sm" className="mt-2" disabled={!body.trim()} isLoading={create.isPending} onClick={() => create.mutate()}>Create Note</Button>
        </Card>
      ) : null}
      <DataTable<ReviewNote>
        title="Review Notes"
        columns={[
          { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
          { key: 'body', header: 'Note', cell: (row) => <div><div>{text(row.title || row.body)}</div><div className="small text-muted">{text(row.createdBy)} · {text(row.createdAt)}</div></div> },
          { key: 'response', header: 'Response', cell: (row) => row.response || <Input aria-label="Response" value={response[row.id] || ''} onChange={(event) => setResponse({ ...response, [row.id]: event.target.value })} /> },
          { key: 'actions', header: '', cell: (row) => <div className="d-flex gap-2">{capability(row, 'respond') ? <Button size="sm" variant="secondary" isLoading={lifecycle.isPending} onClick={() => lifecycle.mutate({ note: row, action: 'respond' })}>Respond</Button> : null}{capability(row, 'clear') ? <Button size="sm" variant="secondary" isLoading={lifecycle.isPending} onClick={() => lifecycle.mutate({ note: row, action: 'clear' })}>Clear</Button> : null}</div> },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        empty={query.isLoading ? 'กำลังโหลด...' : 'No Review Notes'}
      />
    </>
  )
}

function SamplingTab({ workFileId, workFile }: { workFileId: string; workFile?: WorkFile }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<RecordValue>({})
  const query = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'samples'], queryFn: () => getSamples(workFileId) })
  const workpapers = useQuery({ queryKey: ['working-papers', 'file', workFileId, 'workpapers', 'sample-picker'], queryFn: () => getWorkpapers(workFileId) })
  const create = useMutation({
    mutationFn: () => createSample(workFileId, draft),
    onSuccess: async () => { setDraft({}); await qc.invalidateQueries({ queryKey: ['working-papers', 'file', workFileId] }); toast.success('Sample created') },
    onError: (error) => toast.error('Sample failed', toApiError(error).message),
  })
  const generate = useMutation({
    mutationFn: (sample: Sample) => generateSample(sample.id),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['working-papers'] }); toast.success('Sample generated') },
    onError: (error) => toast.error('Generate failed', toApiError(error).message),
  })
  const canCreate = capability(workFile, 'create_sample', 'create_sampling')
  return (
    <>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      {canCreate ? (
        <Card className="mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-3">
              <select aria-label="Sample workpaper" className="form-select" value={String(draft.workpaper_id ?? '')} onChange={(event) => setDraft({ ...draft, workpaper_id: event.target.value || undefined })}>
                <option value="">Workpaper</option>
                {(workpapers.data?.rows ?? []).map((row) => <option key={row.id} value={row.id}>{[row.reference, row.name].filter(Boolean).join(' ')}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-2">
              <select aria-label="Sample method" className="form-select" value={String(draft.method ?? 'random')} onChange={(event) => setDraft({ ...draft, method: event.target.value })}>
                <option value="random">Random</option>
                <option value="systematic">Systematic</option>
                <option value="top_value">Top Value</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div className="col-12 col-md-2"><Input aria-label="Population size" placeholder="Population" value={String(draft.population_size ?? '')} onChange={(event) => setDraft({ ...draft, population_size: Number(event.target.value) || undefined })} /></div>
            <div className="col-12 col-md-2"><Input aria-label="Sample size" placeholder="Sample" value={String(draft.sample_size ?? '')} onChange={(event) => setDraft({ ...draft, sample_size: Number(event.target.value) || undefined })} /></div>
            <div className="col-12 col-md-2"><Input aria-label="Sample seed" placeholder="Seed" value={String(draft.seed ?? '')} onChange={(event) => setDraft({ ...draft, seed: event.target.value })} /></div>
            <div className="col-12 col-md-1"><Button size="sm" isLoading={create.isPending} onClick={() => create.mutate()}>Create</Button></div>
          </div>
        </Card>
      ) : null}
      <DataTable<Sample>
        title="Samples"
        columns={[
          { key: 'name', header: 'Name', cell: (row) => text(row.name) },
          { key: 'method', header: 'Method', cell: (row) => text(row.method) },
          { key: 'seed', header: 'Seed', cell: (row) => text(row.seed) },
          { key: 'population', header: 'Population', cell: (row) => row.populationSize ?? '-' },
          { key: 'sampleSize', header: 'Sample Size', cell: (row) => row.sampleSize ?? '-' },
          { key: 'status', header: 'Status', cell: (row) => statusBadge(row.status) },
          { key: 'generated', header: 'Generated', cell: (row) => text(row.generatedAt) },
          { key: 'selected', header: 'Selected Count', cell: (row) => row.selectedCount ?? '-' },
          { key: 'actions', header: '', cell: (row) => capability(row, 'generate') ? <Button size="sm" variant="secondary" isLoading={generate.isPending} onClick={() => generate.mutate(row)}>Generate</Button> : null },
        ]}
        rows={query.data?.rows ?? []}
        rowKey={(row) => row.id}
        empty={query.isLoading ? 'กำลังโหลด...' : 'No Samples'}
      />
    </>
  )
}

export function WorkpaperPage() {
  const { workFileId = '', workpaperId = '' } = useParams()
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['working-papers', 'workpaper', workpaperId], queryFn: () => getWorkpaper(workpaperId), enabled: Boolean(workpaperId) })
  const [draft, setDraft] = useState({ objective: '', procedure: '', result: '', conclusion: '' })
  useEffect(() => {
    if (query.data) setDraft({ objective: query.data.objective || '', procedure: query.data.procedure || '', result: query.data.result || '', conclusion: query.data.conclusion || '' })
  }, [query.data])
  const item = query.data
  const save = useMutation({
    mutationFn: () => saveWorkpaper(workpaperId, draft),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['working-papers'] }); toast.success('บันทึก Workpaper แล้ว') },
    onError: (error) => toast.error('บันทึกไม่สำเร็จ', toApiError(error).message),
  })
  const workflow = useMutation({
    mutationFn: (action: 'prepare' | 'review') => runWorkpaperAction(workpaperId, action),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['working-papers'] }); toast.success('อัปเดตสถานะแล้ว') },
    onError: (error) => toast.error('อัปเดตสถานะไม่สำเร็จ', toApiError(error).message),
  })
  return (
    <div className="qf-audit-page">
      <PageHeader title={item?.reference || item?.name || 'Workpaper'} subtitle={[item?.status, item?.preparedBy, item?.reviewedBy].filter(Boolean).join(' · ')} breadcrumb={<Link to={`/working-papers/files/${workFileId}`}>Work File</Link>} />
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      {item ? (
        <>
          <Card className="mb-3">
            <div className="row g-3">
              {(['objective', 'procedure', 'result', 'conclusion'] as const).map((field) => (
                <div className="col-12" key={field}>
                  <label className="form-label text-capitalize" htmlFor={`workpaper-${field}`}>{field}</label>
                  <textarea id={`workpaper-${field}`} className="form-control" rows={field === 'procedure' ? 5 : 3} value={draft[field]} disabled={!capability(item, 'edit', 'update')} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
                </div>
              ))}
            </div>
            <div className="d-flex flex-wrap gap-2 mt-3">
              {capability(item, 'edit', 'update') ? <Button isLoading={save.isPending} onClick={() => save.mutate()}>Save</Button> : null}
              {capability(item, 'prepare') ? <Button variant="secondary" isLoading={workflow.isPending} onClick={() => workflow.mutate('prepare')}>Mark Prepared</Button> : null}
              {capability(item, 'review') ? <Button variant="secondary" isLoading={workflow.isPending} onClick={() => workflow.mutate('review')}>Review / Sign Off</Button> : null}
            </div>
          </Card>
          <div className="row g-3">
            <div className="col-12 col-xl-6"><EvidencePanel workpaperId={workpaperId} /></div>
            <div className="col-12 col-xl-6"><ReviewNotesTab workFileId={workFileId} workpaperId={workpaperId} /></div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function EvidencePanel({ workpaperId }: { workpaperId: string }) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['working-papers', 'workpaper', workpaperId, 'evidence'], queryFn: () => listEvidence(workpaperId), enabled: Boolean(workpaperId) })
  const upload = useMutation({
    mutationFn: (file: File) => uploadEvidence(workpaperId, file),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['working-papers', 'workpaper', workpaperId] }); toast.success('Evidence uploaded') },
    onError: (error) => toast.error('Upload failed', toApiError(error).message),
  })
  const remove = useMutation({
    mutationFn: (row: Evidence) => deleteEvidence(row.id),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['working-papers', 'workpaper', workpaperId] }); toast.success('Evidence deleted') },
    onError: (error) => toast.error('Delete failed', toApiError(error).message),
  })
  const download = useMutation({
    mutationFn: (row: Evidence) => downloadEvidence(row.id),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    },
    onError: (error) => toast.error('Download failed', toApiError(error).message),
  })
  return (
    <Card>
      <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
        <h2 className="h5 mb-0">Evidence</h2>
        <input type="file" className="form-control form-control-sm w-auto" disabled={upload.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.currentTarget.value = '' }} />
      </div>
      <ErrorState error={query.error} retry={() => void query.refetch()} />
      <DataTable<Evidence>
        plain
        columns={[
          { key: 'name', header: 'File', cell: (row) => <button type="button" className="btn btn-link p-0" disabled={download.isPending} onClick={() => download.mutate(row)}>{row.name}</button> },
          { key: 'type', header: 'Type', cell: (row) => text(row.mimetype) },
          { key: 'size', header: 'Size', cell: (row) => row.size == null ? '-' : `${row.size} bytes` },
          { key: 'actions', header: '', cell: (row) => capability(row, 'delete') ? <Button size="sm" variant="ghost" isLoading={remove.isPending} onClick={() => remove.mutate(row)}>Delete</Button> : null },
        ]}
        rows={query.data?.rows ?? []}
        rowKey={(row) => row.id}
        empty={query.isLoading ? 'กำลังโหลด...' : 'No Evidence'}
      />
    </Card>
  )
}

function RawResult({ title, value }: { title: string; value: unknown }) {
  return (
    <Card className="mt-3">
      <h3 className="h6">{title}</h3>
      <pre className="small mb-0 text-wrap">{JSON.stringify(value, null, 2)}</pre>
    </Card>
  )
}
