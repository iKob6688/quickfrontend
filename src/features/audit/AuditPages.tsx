import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { createAuditEngagement, getAuditEngagement, listAuditEngagements, type AuditEngagement } from '@/api/services/audit.service'
import { toApiError } from '@/api/response'
import { toast } from '@/lib/toastStore'
import { hasFeature } from '@/lib/features'

function ApiState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  if (!error) return null
  return <Card className="border-warning-subtle bg-warning-subtle mb-3"><div className="d-flex flex-wrap align-items-center justify-content-between gap-3"><div><strong>ไม่สามารถโหลดข้อมูล Audit ได้</strong><div className="small mt-1">{toApiError(error).message}</div></div>{onRetry ? <Button variant="secondary" size="sm" onClick={onRetry}>ลองอีกครั้ง</Button> : null}</div></Card>
}
function Status({ value }: { value?: string }) { return <span className="badge rounded-pill text-bg-light border">{value || 'ไม่ระบุสถานะ'}</span> }
const engagementColumns: Column<AuditEngagement>[] = [
  { key: 'name', header: 'Engagement', cell: (item) => <Link className="fw-semibold" to={`/audit/engagements/${item.id}`}>{item.name}</Link> },
  { key: 'client', header: 'ลูกค้า', cell: (item) => item.clientName || '-' },
  { key: 'period', header: 'รอบบัญชี', cell: (item) => item.fiscalYear || [item.dateFrom, item.dateTo].filter(Boolean).join(' - ') || '-' },
  { key: 'owner', header: 'Lead auditor', cell: (item) => item.leadAuditorName || '-' },
  { key: 'status', header: 'สถานะ', cell: (item) => <Status value={item.status} /> },
  { key: 'progress', header: 'ความคืบหน้า', cell: (item) => item.progress == null ? '-' : `${item.progress}%` },
  { key: 'notes', header: 'Review notes', cell: (item) => item.openReviewNotes ?? '-' },
]

export function AuditDashboardPage() {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['audit', 'engagements'], queryFn: () => listAuditEngagements(), staleTime: 30_000 })
  const summary = useMemo(() => { const items = query.data?.items ?? []; return [['Active engagements', items.filter((item) => !['completed', 'locked'].includes((item.status || '').toLowerCase())).length], ['In review', items.filter((item) => (item.status || '').toLowerCase().includes('review')).length], ['Open review notes', items.reduce((sum, item) => sum + (item.openReviewNotes || 0), 0)]] }, [query.data])
  return <div className="qf-audit-page"><PageHeader title="Audit Workspace" subtitle="ข้อมูลและสถานะทั้งหมดมาจาก Odoo ของบริษัทที่กำลังใช้งาน" actions={<Button onClick={() => navigate('/audit/engagements/new')}><i className="bi bi-plus-lg me-1" />สร้าง Engagement</Button>} /><ApiState error={query.error} onRetry={() => void query.refetch()} />{query.isLoading ? <Card>กำลังโหลดข้อมูล Audit…</Card> : <><div className="row g-3 mb-4">{summary.map(([label, value]) => <div className="col-12 col-md-4" key={label}><Card className="qf-audit-summary"><div className="text-muted small">{label}</div><div className="fs-3 fw-bold mt-1">{value}</div></Card></div>)}</div><DataTable title="Engagement ล่าสุด" right={<Button variant="secondary" size="sm" onClick={() => navigate('/audit/engagements')}>ดูทั้งหมด</Button>} columns={engagementColumns} rows={(query.data?.items ?? []).slice(0, 8)} rowKey={(item) => item.id} empty="ยังไม่มี Engagement ที่ backend ส่งกลับมา" /></>}</div>
}

export function AuditEngagementsPage() {
  const navigate = useNavigate(); const [search, setSearch] = useState('')
  const query = useQuery({ queryKey: ['audit', 'engagements', search], queryFn: () => listAuditEngagements({ search }), staleTime: 30_000 })
  return <div className="qf-audit-page"><PageHeader title="Audit Engagements" subtitle="รายการงานตรวจสอบของบริษัทปัจจุบัน" actions={<Button onClick={() => navigate('/audit/engagements/new')}><i className="bi bi-plus-lg me-1" />สร้าง Engagement</Button>} /><Card className="p-3 mb-3"><label className="form-label" htmlFor="audit-engagement-search">ค้นหา Engagement หรือลูกค้า</label><Input id="audit-engagement-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="พิมพ์คำค้นหา" /></Card><ApiState error={query.error} onRetry={() => void query.refetch()} /><DataTable columns={engagementColumns} rows={query.data?.items ?? []} rowKey={(item) => item.id} empty={query.isLoading ? 'กำลังโหลดข้อมูล…' : 'ยังไม่มี Engagement'} /></div>
}

export function AuditEngagementCreatePage() {
  const navigate = useNavigate(); const queryClient = useQueryClient(); const [form, setForm] = useState({ clientId: '', name: '', fiscalYear: '', dateFrom: '', dateTo: '' })
  const create = useMutation({ mutationFn: createAuditEngagement, onSuccess: (engagement) => { void queryClient.invalidateQueries({ queryKey: ['audit', 'engagements'] }); toast.success('สร้าง Engagement สำเร็จ'); navigate(`/audit/engagements/${engagement.id}`, { replace: true }) }, onError: (error) => toast.error('สร้าง Engagement ไม่สำเร็จ', toApiError(error).message) })
  const submit = (event: FormEvent) => { event.preventDefault(); const clientId = Number(form.clientId); if (!Number.isInteger(clientId) || clientId <= 0) return toast.error('กรุณาระบุลูกค้าที่ถูกต้อง'); if (!form.name.trim() || !form.dateFrom || !form.dateTo) return toast.error('กรุณากรอกชื่อและช่วงวันที่ให้ครบ'); if (form.dateFrom > form.dateTo) return toast.error('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด'); create.mutate({ clientId, name: form.name.trim(), fiscalYear: form.fiscalYear.trim() || undefined, dateFrom: form.dateFrom, dateTo: form.dateTo }) }
  return <div className="qf-audit-page"><PageHeader title="สร้าง Audit Engagement" subtitle="บันทึกข้อมูลผ่าน Odoo ตามบริษัทที่กำลังใช้งาน" /><Card><form className="row g-3" onSubmit={submit}><div className="col-md-6"><label className="form-label" htmlFor="audit-client-id">รหัสลูกค้า</label><Input id="audit-client-id" inputMode="numeric" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required /></div><div className="col-md-6"><label className="form-label" htmlFor="audit-name">ชื่อ Engagement</label><Input id="audit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div className="col-md-4"><label className="form-label" htmlFor="audit-fy">Fiscal year</label><Input id="audit-fy" value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })} /></div><div className="col-md-4"><label className="form-label" htmlFor="audit-from">ตั้งแต่</label><Input id="audit-from" type="date" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} required /></div><div className="col-md-4"><label className="form-label" htmlFor="audit-to">ถึง</label><Input id="audit-to" type="date" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} required /></div><div className="col-12 d-flex gap-2"><Button type="submit" isLoading={create.isPending}>บันทึก</Button><Button type="button" variant="secondary" onClick={() => navigate('/audit/engagements')}>ยกเลิก</Button></div></form></Card></div>
}

export function AuditEngagementPage() {
  const { engagementId = '' } = useParams(); const query = useQuery({ queryKey: ['audit', 'engagement', engagementId], queryFn: () => getAuditEngagement(engagementId), enabled: Boolean(engagementId), staleTime: 30_000 })
  const tabs = [{ path: '', label: 'Overview' }, { path: '/trial-balance', label: 'Trial Balance' }, { path: '/leadsheets', label: 'Leadsheets' }, { path: '/working-papers', label: 'Working Papers' }, ...(hasFeature('audit.sampling') ? [{ path: '/sampling', label: 'Sampling' }] : []), { path: '/adjustments', label: 'Adjustments' }, { path: '/review-notes', label: 'Review Notes' }, { path: '/files', label: 'Files' }]
  return <div className="qf-audit-page"><PageHeader title={query.data?.name || 'Audit Engagement'} subtitle={[query.data?.clientName, query.data?.fiscalYear, [query.data?.dateFrom, query.data?.dateTo].filter(Boolean).join(' - ')].filter(Boolean).join(' · ')} /><ApiState error={query.error} onRetry={() => void query.refetch()} />{query.isLoading ? <Card>กำลังโหลด Engagement…</Card> : <><Card className="mb-3"><div className="d-flex flex-wrap gap-2 align-items-center"><Status value={query.data?.status} /><span className="text-muted small">ความคืบหน้า {query.data?.progress ?? 0}%</span></div></Card><nav className="nav nav-pills qf-audit-tabs mb-3" aria-label="เมนู Engagement">{tabs.map((tab) => <Link key={tab.path} className="nav-link" to={`/audit/engagements/${engagementId}${tab.path}`}>{tab.label}</Link>)}</nav><Card><h2 className="h5">ข้อมูล Engagement</h2><p className="text-muted mb-0">ข้อมูลรายละเอียดในแต่ละแท็บจะอ่านจาก Audit API ของ Odoo โดยตรง เมื่อ backend เปิด endpoint สำหรับโมดูลนั้น</p></Card></>}</div>
}

export function AuditWorkspaceSectionPage({ title }: { title: string }) { const { engagementId } = useParams(); return <div className="qf-audit-page"><PageHeader title={title} subtitle="ข้อมูล Audit ที่ผูกกับ Engagement ปัจจุบัน" breadcrumb={<Link to={`/audit/engagements/${engagementId}`}>กลับไป Engagement</Link>} /><Card><div className="d-flex gap-3"><i className="bi bi-database-exclamation fs-3 text-muted" aria-hidden="true" /><div><h2 className="h5">รอ Audit API จาก Odoo</h2><p className="text-muted mb-0">หน้านี้ไม่มีข้อมูลจำลอง เพื่อรักษาความถูกต้องของหลักฐานและสถานะการตรวจสอบ เมื่อ backend เปิด contract สำหรับ {title} หน้าจอจะอ่านข้อมูลจาก API โดยตรง.</p></div></div></Card></div> }
