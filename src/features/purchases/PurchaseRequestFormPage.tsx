import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ProductCombobox } from '@/features/sales/ProductCombobox'
import { clearDraft, loadDraft, loadRecentNotes, pushRecentNote, saveDraft } from '@/lib/formDrafts'
import { toast } from '@/lib/toastStore'
import {
  createPurchaseRequest,
  getPurchaseRequest,
  getPurchaseRequestMeta,
  submitPurchaseRequest,
  updatePurchaseRequest,
  type PurchaseRequestLine,
  type PurchaseRequestPayload,
} from '@/api/services/purchase-requests.service'
import { useAppDateTimeFormatter } from '@/lib/dateFormat'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function nextWeekISO() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

const EMPTY_LINE: PurchaseRequestLine = {
  productId: null,
  description: '',
  quantity: 1,
  estimatedCost: 0,
}

const PURCHASE_REQUEST_DRAFT_KEY = 'qf:draft:purchase-request-form:create:v1'
const PURCHASE_REQUEST_RECENT_NOTES_KEY = 'qf:recent-notes:purchase-request:v1'

function formatMoney(value: number) {
  return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PurchaseRequestFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const formatDateTime = useAppDateTimeFormatter()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const requestId = id ? Number(id) : null

  const [errorText, setErrorText] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<PurchaseRequestPayload>>({})
  const [recentNotes, setRecentNotes] = useState<string[]>([])
  const [draftPendingRestore, setDraftPendingRestore] = useState<Partial<PurchaseRequestPayload> | null>(null)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [draftGateResolved, setDraftGateResolved] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [submitIntent, setSubmitIntent] = useState<'save' | 'submit'>('save')
  const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>({})
  const [priceInputs, setPriceInputs] = useState<Record<number, string>>({})

  const requestQuery = useQuery({
    queryKey: ['purchaseRequest', requestId],
    enabled: isEdit && Boolean(requestId),
    queryFn: () => getPurchaseRequest(requestId!),
    staleTime: 30_000,
  })

  const metaQuery = useQuery({
    queryKey: ['purchaseRequestMeta'],
    queryFn: getPurchaseRequestMeta,
    staleTime: 60_000,
  })

  const formData = useMemo<PurchaseRequestPayload>(() => {
    if (isEdit && requestQuery.data) {
      return {
        requestedDate: requestQuery.data.requestedDate || todayISO(),
        requiredDate: requestQuery.data.requiredDate || nextWeekISO(),
        origin: requestQuery.data.origin || '',
        assignedToId: requestQuery.data.assignedToId || undefined,
        approvalTeamId: requestQuery.data.approvalTeamId || undefined,
        notes: requestQuery.data.notes || '',
        lines: requestQuery.data.lines || [EMPTY_LINE],
        ...draft,
      }
    }
    return {
      requestedDate: todayISO(),
      requiredDate: nextWeekISO(),
      origin: '',
      assignedToId: undefined,
      approvalTeamId: undefined,
      notes: '',
      lines: [EMPTY_LINE],
      ...draft,
    }
  }, [draft, isEdit, requestQuery.data])

  useEffect(() => {
    setRecentNotes(loadRecentNotes(PURCHASE_REQUEST_RECENT_NOTES_KEY))
  }, [])

  useEffect(() => {
    if (isEdit) {
      setDraftGateResolved(true)
      return
    }
    const saved = loadDraft<Partial<PurchaseRequestPayload>>(PURCHASE_REQUEST_DRAFT_KEY)
    if (saved?.data) {
      setDraftPendingRestore(saved.data)
      setDraftUpdatedAt(saved.updatedAt || null)
    }
    setDraftGateResolved(true)
  }, [isEdit])

  useEffect(() => {
    if (isEdit) return
    if (!draftGateResolved) return
    if (draftPendingRestore) return
    const timer = window.setTimeout(() => {
      saveDraft(PURCHASE_REQUEST_DRAFT_KEY, draft)
      setDraftSavedAt(new Date().toISOString())
    }, 700)
    return () => window.clearTimeout(timer)
  }, [isEdit, draftGateResolved, draftPendingRestore, draft])

  useEffect(() => {
    if (!metaQuery.data) return
    setDraft((prev) => {
      const nextDraft = { ...prev }
      if (!prev.approvalTeamId && metaQuery.data.defaultApprovalTeamId) {
        nextDraft.approvalTeamId = metaQuery.data.defaultApprovalTeamId
      }
      if (!prev.assignedToId) {
        const selectedTeam = metaQuery.data.approvalTeams.find(
          (team) => team.id === (nextDraft.approvalTeamId || prev.approvalTeamId),
        )
        nextDraft.assignedToId =
          selectedTeam?.suggestedApproverId || metaQuery.data.defaultApproverId || undefined
      }
      return nextDraft
    })
  }, [metaQuery.data])

  const saveMutation = useMutation({
    mutationFn: async ({ payload, submit }: { payload: PurchaseRequestPayload; submit: boolean }) => {
      const saved = isEdit && requestId ? await updatePurchaseRequest(requestId, payload) : await createPurchaseRequest(payload)
      if (submit) return submitPurchaseRequest(saved.id)
      return saved
    },
    onSuccess: async (res, variables) => {
      clearDraft(PURCHASE_REQUEST_DRAFT_KEY)
      if ((formData.notes || '').trim()) {
        pushRecentNote(PURCHASE_REQUEST_RECENT_NOTES_KEY, formData.notes || '')
        setRecentNotes(loadRecentNotes(PURCHASE_REQUEST_RECENT_NOTES_KEY))
      }
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] })
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequest', res.id] })
      toast.success(
        variables.submit
          ? 'บันทึกและส่งอนุมัติสำเร็จ'
          : isEdit
            ? 'บันทึกคำขอซื้อสำเร็จ'
            : 'สร้างคำขอซื้อสำเร็จ',
      )
      navigate(`/purchases/requests/${res.id}`, { replace: true })
    },
    onError: (err) => {
      const rawMsg = err instanceof Error ? err.message : 'บันทึกคำขอซื้อไม่สำเร็จ'
      const lowerMsg = rawMsg.toLowerCase()
      const msg =
        lowerMsg.includes('access') ||
        lowerMsg.includes('permission') ||
        lowerMsg.includes('forbidden') ||
        lowerMsg.includes('สิทธิ')
          ? 'คุณยังไม่มีสิทธิ์สร้างคำขอซื้อ กรุณาตรวจสอบสิทธิ์ผู้ใช้ใน Odoo'
          : rawMsg
      setErrorText(msg)
      toast.error(msg)
    },
  })

  const linesSummary = useMemo(() => {
    const lines = formData.lines || []
    const activeLines = lines.filter((line) => line.productId || (line.description || '').trim())
    const totalQuantity = activeLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
    const totalEstimatedCost = activeLines.reduce(
      (sum, line) => sum + Number(line.quantity || 0) * Number(line.estimatedCost || 0),
      0,
    )
    return {
      lineCount: activeLines.length,
      totalQuantity,
      totalEstimatedCost,
    }
  }, [formData.lines])

  const selectedApprovalTeam = useMemo(
    () => metaQuery.data?.approvalTeams.find((team) => team.id === formData.approvalTeamId) ?? null,
    [formData.approvalTeamId, metaQuery.data],
  )

  const selectedApprover = useMemo(
    () => metaQuery.data?.approvers.find((user) => user.id === formData.assignedToId) ?? null,
    [formData.assignedToId, metaQuery.data],
  )

  const updateLine = (index: number, patch: Partial<PurchaseRequestLine>) => {
    setDraft((prev) => {
      const lines = [...(prev.lines || formData.lines || [])]
      if (index < 0 || index >= lines.length) return prev
      lines[index] = { ...lines[index], ...patch }
      return { ...prev, lines }
    })
  }

  const formatQuantity = (value: number) => Number(value || 0).toFixed(2)

  const sanitizeQuantityInput = (value: string) => {
    const normalized = value.replace(',', '.').replace(/[^\d.]/g, '')
    const [integerPart = '', ...rest] = normalized.split('.')
    const decimalPart = rest.join('').slice(0, 2)
    if (normalized.includes('.')) return `${integerPart}.${decimalPart}`
    return integerPart
  }

  const handleQuantityChange = (index: number, rawValue: string) => {
    const nextValue = sanitizeQuantityInput(rawValue)
    setQuantityInputs((prev) => ({ ...prev, [index]: nextValue }))
    if (nextValue === '' || nextValue === '.') return
    const parsed = Number(nextValue)
    if (Number.isFinite(parsed)) updateLine(index, { quantity: parsed })
  }

  const handleQuantityBlur = (index: number, quantity: number) => {
    const fallback = Number(quantity || 0)
    const currentInput = quantityInputs[index]
    const parsed = Number(currentInput)
    const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback > 0 ? fallback : 1
    const normalized = Number(safeValue.toFixed(2))
    updateLine(index, { quantity: normalized })
    setQuantityInputs((prev) => ({ ...prev, [index]: formatQuantity(normalized) }))
  }

  const formatMoneyInput = (value: number) => Number(value || 0).toFixed(2)

  const sanitizeMoneyInput = (value: string) => {
    const normalized = value.replace(',', '.').replace(/[^\d.]/g, '')
    const [integerPart = '', ...rest] = normalized.split('.')
    const decimalPart = rest.join('').slice(0, 2)
    if (normalized.includes('.')) return `${integerPart}.${decimalPart}`
    return integerPart
  }

  const handlePriceChange = (index: number, rawValue: string) => {
    const nextValue = sanitizeMoneyInput(rawValue)
    setPriceInputs((prev) => ({ ...prev, [index]: nextValue }))
    if (nextValue === '' || nextValue === '.') return
    const parsed = Number(nextValue)
    if (Number.isFinite(parsed)) updateLine(index, { estimatedCost: parsed })
  }

  const handlePriceBlur = (index: number, estimatedCost: number) => {
    const fallback = Number(estimatedCost || 0)
    const currentInput = priceInputs[index]
    const parsed = Number(currentInput)
    const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback >= 0 ? fallback : 0
    const normalized = Number(safeValue.toFixed(2))
    updateLine(index, { estimatedCost: normalized })
    setPriceInputs((prev) => ({ ...prev, [index]: formatMoneyInput(normalized) }))
  }

  const addLine = () => {
    setDraft((prev) => ({ ...prev, lines: [...(prev.lines || formData.lines || []), { ...EMPTY_LINE }] }))
  }

  const removeLine = (index: number) => {
    const ok = window.confirm('ยืนยันการลบรายการนี้?')
    if (!ok) return
    setDraft((prev) => {
      const lines = (prev.lines || formData.lines || []).filter((_, i) => i !== index)
      return { ...prev, lines: lines.length ? lines : [{ ...EMPTY_LINE }] }
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorText(null)
    const lines = (formData.lines || []).filter((l) => l.productId || (l.description || '').trim())
    if (!lines.length) {
      setErrorText('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ')
      return
    }
    const invalidQty = lines.find((l) => Number(l.quantity || 0) <= 0)
    if (invalidQty) {
      setErrorText('จำนวนสินค้าต้องมากกว่า 0')
      return
    }

    await saveMutation.mutateAsync({
      payload: {
        origin: (formData.origin || '').trim(),
        assignedToId: formData.assignedToId || undefined,
        approvalTeamId: formData.approvalTeamId || undefined,
        requestedDate: formData.requestedDate,
        requiredDate: formData.requiredDate,
        notes: (formData.notes || '').trim(),
        lines: lines.map((l) => ({
          productId: l.productId,
          description: (l.description || '').trim(),
          quantity: Number(l.quantity || 0),
          estimatedCost: Number(l.estimatedCost || 0),
          uomId: l.uomId || null,
          note: l.note,
        })),
      },
      submit: submitIntent === 'submit',
    })
  }

  const applyRecentNote = (note: string) => setDraft((prev) => ({ ...prev, notes: note }))
  const appendRecentNote = (note: string) =>
    setDraft((prev) => ({ ...prev, notes: (formData.notes || '').trim() ? `${formData.notes}\n${note}` : note }))

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title={isEdit ? 'แก้ไขคำขอซื้อ' : 'สร้างคำขอซื้อ'}
        subtitle="จัดการคำขอซื้อให้พร้อมส่งอนุมัติ"
        breadcrumb={`รายจ่าย · คำขอซื้อ · ${isEdit ? 'แก้ไข' : 'สร้าง'}`}
        actions={
          <div className="d-flex gap-2">
            {!isEdit && draftSavedAt ? (
              <span className="small text-muted align-self-center">
                autosaved {formatDateTime(draftSavedAt)}
              </span>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => navigate('/purchases/requests')}>
              ยกเลิก
            </Button>
            <Button
              size="sm"
              type="submit"
              variant="secondary"
              isLoading={saveMutation.isPending && submitIntent === 'save'}
              onClick={() => setSubmitIntent('save')}
            >
              บันทึกเป็นร่าง
            </Button>
            <Button
              size="sm"
              type="submit"
              isLoading={saveMutation.isPending && submitIntent === 'submit'}
              onClick={() => setSubmitIntent('submit')}
            >
              ส่งอนุมัติ
            </Button>
          </div>
        }
      />

      {errorText ? (
        <Alert variant="danger" className="small">
          {errorText}
        </Alert>
      ) : null}

      {isEdit && requestQuery.isLoading ? <div className="small text-muted">กำลังโหลดข้อมูลคำขอซื้อ...</div> : null}
      {isEdit && requestQuery.isError ? (
        <Alert variant="danger" className="small">
          {requestQuery.error instanceof Error ? requestQuery.error.message : 'โหลดคำขอซื้อไม่สำเร็จ'}
        </Alert>
      ) : null}

      {!isEdit && draftPendingRestore ? (
        <Alert variant="warning" className="small">
          <div className="fw-semibold mb-1">พบ draft คำขอซื้อที่บันทึกไว้</div>
          <div className="mb-2">
            เวลา: {formatDateTime(draftUpdatedAt, 'ไม่ทราบเวลา')}
          </div>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              type="button"
              onClick={() => {
                setDraft((prev) => ({ ...prev, ...draftPendingRestore }))
                setDraftPendingRestore(null)
              }}
            >
              กู้ draft
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => {
                clearDraft(PURCHASE_REQUEST_DRAFT_KEY)
                setDraftPendingRestore(null)
              }}
            >
              ลบ draft
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="row g-4">
        <div className="col-lg-8">
          <Card className="p-4">
            <div className="qf-section-title mb-3">ข้อมูลหลัก</div>
            <div className="row g-3">
              <div className="col-12">
                <Label htmlFor="origin">อ้างอิงเอกสาร / ต้นทาง</Label>
                <Input
                  id="origin"
                  value={formData.origin || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, origin: e.target.value }))}
                  placeholder="เช่น SO-2403, งานลูกค้า, หรือเลขคำร้องภายใน"
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="requestedDate" required>
                  วันที่ขอ
                </Label>
                <Input
                  id="requestedDate"
                  type="date"
                  value={formData.requestedDate}
                  onChange={(e) => setDraft((p) => ({ ...p, requestedDate: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="requiredDate">วันที่ต้องการ</Label>
                <Input
                  id="requiredDate"
                  type="date"
                  value={formData.requiredDate || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, requiredDate: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="approvalTeam">Approval Team</Label>
                <select
                  id="approvalTeam"
                  className="form-select"
                  value={formData.approvalTeamId || ''}
                  onChange={(e) => {
                    const approvalTeamId = e.target.value ? Number(e.target.value) : undefined
                    const team = metaQuery.data?.approvalTeams.find((item) => item.id === approvalTeamId)
                    setDraft((p) => ({
                      ...p,
                      approvalTeamId,
                      assignedToId: team?.suggestedApproverId || metaQuery.data?.defaultApproverId || undefined,
                    }))
                  }}
                >
                  <option value="">เลือกทีมอนุมัติ</option>
                  {(metaQuery.data?.approvalTeams || []).map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <div className="small text-muted mt-2">
                  {selectedApprovalTeam
                    ? `ทีมนี้แนะนำผู้อนุมัติ: ${selectedApprovalTeam.suggestedApproverName || 'ไม่พบผู้อนุมัติอัตโนมัติ'}`
                    : 'ระบบต้องมี approval team ก่อนส่งอนุมัติ'}
                </div>
              </div>
              <div className="col-md-6">
                <Label htmlFor="assignedTo">Approver</Label>
                <select
                  id="assignedTo"
                  className="form-select"
                  value={formData.assignedToId || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, assignedToId: e.target.value ? Number(e.target.value) : undefined }))}
                >
                  <option value="">เลือกผู้อนุมัติ</option>
                  {(metaQuery.data?.approvers || []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <div className="small text-muted mt-2">
                  default: {metaQuery.data?.defaultApproverName || 'Administrator'}
                </div>
              </div>
              <div className="col-12">
                <Label htmlFor="notes">หมายเหตุ</Label>
                <Input
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                />
                {recentNotes.length > 0 ? (
                  <div className="mt-2">
                    <div className="small text-muted mb-1">หมายเหตุล่าสุด</div>
                    <div className="d-flex flex-wrap gap-2">
                      {recentNotes.slice(0, 4).map((note, idx) => (
                        <div key={`${idx}-${note}`} className="d-inline-flex align-items-center gap-1">
                          <Button size="sm" variant="secondary" type="button" onClick={() => applyRecentNote(note)}>
                            ใช้ล่าสุด
                          </Button>
                          <Button size="sm" variant="ghost" type="button" onClick={() => appendRecentNote(note)} title={note}>
                            +
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="p-4 mt-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="qf-section-title mb-0">รายการสินค้า</div>
              <Button size="sm" onClick={addLine}>
                + เพิ่มรายการ
              </Button>
            </div>
            <div className="d-flex flex-column gap-3">
              {(formData.lines || []).map((line, idx) => (
                <div key={idx} className="border rounded p-3 qf-pr-line-card">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="fw-semibold qf-pr-line-title">รายการที่ {idx + 1}</div>
                    <Button size="sm" variant="secondary" onClick={() => removeLine(idx)}>
                      <i className="bi bi-trash me-1"></i>
                      ลบ
                    </Button>
                  </div>
                  <div className="row g-3 align-items-start">
                    <div className="col-12 col-lg-6">
                      <Label>สินค้า/บริการ</Label>
                      <ProductCombobox
                        valueId={line.productId || null}
                        onPick={(product) =>
                          updateLine(idx, {
                            productId: product.id,
                            description: (line.description || '').trim() ? line.description : product.name,
                            estimatedCost: typeof product.listPrice === 'number' ? product.listPrice : line.estimatedCost,
                          })
                        }
                      />
                      <div className="small text-muted mt-2">เลือกจากรายการเดิม หรือสร้างสินค้าใหม่จากฟอร์ม</div>
                    </div>
                    <div className="col-12 col-lg-6">
                      <Label>รายละเอียด</Label>
                      <Input
                        value={line.description || ''}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        placeholder="ระบุรายละเอียดที่ต้องการจัดซื้อ"
                      />
                    </div>
                    <div className="col-12">
                      <div className="row g-3 qf-pr-line-numbers qf-pr-line-numbers--stacked">
                        <div className="col-12 col-sm-4 col-lg-3">
                          <Label>จำนวน</Label>
                          <Input
                            className="text-end qf-pr-line-number-input"
                            type="text"
                            inputMode="decimal"
                            pattern="^[0-9]+([.][0-9]{0,2})?$"
                            value={quantityInputs[idx] ?? formatQuantity(Number(line.quantity || 0))}
                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                            onBlur={() => handleQuantityBlur(idx, Number(line.quantity || 0))}
                          />
                        </div>
                        <div className="col-12 col-sm-8 col-lg-4">
                          <Label>ราคาโดยประมาณ</Label>
                          <Input
                            className="text-end qf-pr-line-number-input qf-pr-line-price-input"
                            type="text"
                            inputMode="decimal"
                            pattern="^[0-9]+([.][0-9]{0,2})?$"
                            value={priceInputs[idx] ?? formatMoneyInput(Number(line.estimatedCost || 0))}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                            onBlur={() => handlePriceBlur(idx, Number(line.estimatedCost || 0))}
                            rightAdornment={<span className="qf-pr-line-currency">บาท</span>}
                          />
                        </div>
                        <div className="col-12 col-lg-5">
                          <div className="small text-muted qf-pr-line-number-help">
                            ใส่จำนวนและราคาต่อหน่วยเพื่อให้ทีมจัดซื้อประเมินงบได้ชัดเจน
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="qf-pr-line-inline-summary">
                            รวมรายการนี้{' '}
                            <span className="fw-semibold">
                              {formatMoney(Number(line.quantity || 0) * Number(line.estimatedCost || 0))}
                            </span>{' '}
                            บาท
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="col-lg-4">
          <Card className="p-4 qf-pr-summary-card">
            <div className="qf-section-title mb-3">สรุปคำขอซื้อ</div>
            <div className="qf-pr-summary-list">
              <div className="qf-pr-summary-row">
                <span>จำนวนรายการ</span>
                <strong>{linesSummary.lineCount}</strong>
              </div>
              <div className="qf-pr-summary-row">
                <span>จำนวนรวม</span>
                <strong>{formatMoney(linesSummary.totalQuantity)}</strong>
              </div>
              <div className="qf-pr-summary-row">
                <span>ราคารวมโดยประมาณ</span>
                <strong>{formatMoney(linesSummary.totalEstimatedCost)} บาท</strong>
              </div>
              <div className="qf-pr-summary-row">
                <span>สถานะที่ต้องการ</span>
                <strong>{submitIntent === 'submit' ? 'บันทึกและส่งอนุมัติ' : 'บันทึกเป็นร่าง'}</strong>
              </div>
              <div className="qf-pr-summary-row">
                <span>Approval Team</span>
                <strong>{selectedApprovalTeam?.name || 'ยังไม่ได้เลือก'}</strong>
              </div>
              <div className="qf-pr-summary-row">
                <span>Approver</span>
                <strong>{selectedApprover?.name || metaQuery.data?.defaultApproverName || 'Administrator'}</strong>
              </div>
            </div>
            <div className="small text-muted mt-3">
              ฟอร์มนี้จะสร้างคำขอซื้อในสถานะ draft ก่อน และถ้าเลือกส่งอนุมัติ ระบบจะเรียก workflow อนุมัติต่อทันที
            </div>
            <div className="d-grid gap-2 mt-4">
              <Button
                type="submit"
                variant="secondary"
                isLoading={saveMutation.isPending && submitIntent === 'save'}
                onClick={() => setSubmitIntent('save')}
              >
                บันทึกเป็นร่าง
              </Button>
              <Button
                type="submit"
                isLoading={saveMutation.isPending && submitIntent === 'submit'}
                onClick={() => setSubmitIntent('submit')}
              >
                Send to Approve
              </Button>
            </div>
            {isEdit && requestQuery.data ? (
              <div className="qf-pr-summary-meta mt-4">
                <div className="small text-muted mb-1">เอกสารนี้</div>
                <div className="fw-semibold">{requestQuery.data.name || `PR #${requestQuery.data.id}`}</div>
                <div className="small text-muted mt-2">สถานะปัจจุบัน: {requestQuery.data.state}</div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </form>
  )
}
