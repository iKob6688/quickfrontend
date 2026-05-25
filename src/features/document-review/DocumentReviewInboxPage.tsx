import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Form, Spinner } from 'react-bootstrap'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { toast } from '@/lib/toastStore'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { toApiError } from '@/api/response'
import { approvalAction, listApprovalTasks } from '@/api/services/approval.service'
import { listPartners, type PartnerSummary } from '@/api/services/partners.service'
import { sendAssistantChat } from '@/api/services/ai-assistant.service'
import {
  createDocumentDraft,
  getDocumentReviewDetail,
  listDocumentReviewItems,
  markDocumentUnsupported,
  retryDocumentReview,
  updateAccountingSuggestion,
  type DocumentReviewAttachment,
  type AccountingSuggestion,
  type DocumentReviewDetail,
  type DocumentReviewIssue,
  type DocumentReviewListItem,
  type DocumentReviewStatus,
  type DocumentReviewUpdatePayload,
} from '@/api/services/document-review.service'
import './document-review.css'

type FilterKey = 'all' | 'new' | 'needs_review' | 'validation_issue' | 'draft_ready' | 'linked' | 'error'
type InboxViewMode = 'all' | 'approvals' | 'documents'

type EditorState = {
  vendor_name: string
  vendor_tax_id: string
  document_number: string
  document_date: string
  subtotal_amount: string
  tax_amount: string
  total_amount: string
  document_type: DocumentReviewDetail['document_type']
  review_state: DocumentReviewStatus
  matched_partner_id: number | null
}

type SuggestionEditorState = {
  suggested_account_id: number | null
  suggested_tax_ids: number[]
  suggested_journal_id: number | null
  suggested_analytic_account_id: number | null
}

type CopilotMessage = {
  role: 'user' | 'assistant'
  text: string
  meta?: string
}

const PAGE_SIZE = 20

const FILTER_CONFIG: Record<
  FilterKey,
  { label: string; states?: DocumentReviewDetail['state'][]; reviewStates?: DocumentReviewStatus[] }
> = {
  all: { label: 'ทั้งหมด' },
  new: { label: 'เข้าใหม่', states: ['pending', 'classifying', 'extracting', 'normalizing', 'validating', 'suggesting'] },
  needs_review: { label: 'ต้องตรวจสอบ', states: ['ready_for_review'], reviewStates: ['pending_review', 'in_review'] },
  validation_issue: { label: 'มีประเด็นตรวจสอบ', states: ['ready_for_review', 'error'] },
  draft_ready: { label: 'พร้อมสร้าง draft', states: ['ready_for_review'], reviewStates: ['confirmed', 'draft_created'] },
  linked: { label: 'เชื่อมเอกสารแล้ว', states: ['linked'] },
  error: { label: 'ผิดพลาด', states: ['error'] },
}

const DOCUMENT_TYPE_OPTIONS: Array<{ value: DocumentReviewDetail['document_type']; label: string }> = [
  { value: 'receipt', label: 'ใบเสร็จรับเงิน' },
  { value: 'tax_invoice', label: 'ใบกำกับภาษี' },
  { value: 'vendor_invoice', label: 'ใบแจ้งหนี้ผู้ขาย' },
  { value: 'payment_slip', label: 'สลิปชำระเงิน' },
  { value: 'unknown_document', label: 'ยังไม่ทราบประเภท' },
]

const REVIEW_STATUS_OPTIONS: Array<{ value: DocumentReviewStatus; label: string }> = [
  { value: 'pending_review', label: 'รอตรวจสอบ' },
  { value: 'in_review', label: 'กำลังตรวจสอบ' },
  { value: 'confirmed', label: 'ยืนยันแล้ว' },
  { value: 'unsupported', label: 'ไม่รองรับ' },
  { value: 'draft_created', label: 'สร้าง draft แล้ว' },
]

function getStateTone(item: Pick<DocumentReviewListItem, 'state' | 'blocking_issue_count' | 'issue_count'>) {
  if (item.state === 'error') return 'red' as const
  if (item.state === 'linked') return 'green' as const
  if (item.blocking_issue_count > 0) return 'red' as const
  if (item.issue_count > 0) return 'amber' as const
  if (item.state === 'ready_for_review') return 'blue' as const
  return 'gray' as const
}

function getStateLabel(state: string) {
  switch (state) {
    case 'pending':
      return 'รอประมวลผล'
    case 'classifying':
      return 'กำลังแยกประเภท'
    case 'extracting':
      return 'กำลังดึงข้อมูล'
    case 'normalizing':
      return 'กำลังจัดรูปแบบข้อมูล'
    case 'validating':
      return 'กำลังตรวจสอบข้อมูล'
    case 'suggesting':
      return 'กำลังสร้างคำแนะนำ'
    case 'ready_for_review':
      return 'พร้อมให้ตรวจสอบ'
    case 'linked':
      return 'เชื่อมเอกสารแล้ว'
    case 'error':
      return 'ผิดพลาด'
    default:
      return state
  }
}

function getTargetLabel(target?: string) {
  switch (target) {
    case 'vendor_bill':
      return 'สร้างบิลผู้ขาย'
    case 'expense':
      return 'สร้างค่าใช้จ่าย'
    default:
      return 'ตรวจสอบอย่างเดียว'
  }
}

function getIssueTone(issue: DocumentReviewIssue) {
  if (issue.severity === 'blocking') return 'red' as const
  if (issue.severity === 'warning') return 'amber' as const
  return 'blue' as const
}

function asCurrency(value?: number, currency = 'THB') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ` ${currency}`
}

function toInputNumber(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function formatPartnerContext({
  vat,
  stateName,
}: {
  vat?: string | null
  stateName?: string | null
}) {
  return [vat ? `VAT ${vat}` : '', stateName || ''].filter(Boolean).join(' • ')
}

function summarizeSuggestionCandidates(suggestion?: AccountingSuggestion | false) {
  if (!suggestion) return undefined
  return {
    partner_candidates: suggestion.partner_candidates.slice(0, 3).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      confidence: candidate.confidence,
      reason: candidate.reason,
      context: formatPartnerContext({
        vat: candidate.vat,
        stateName: candidate.state_name,
      }),
    })),
    account_candidates: suggestion.account_candidates.slice(0, 3).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      code: candidate.code,
      confidence: candidate.confidence,
      reason: candidate.reason,
    })),
    tax_candidates: suggestion.tax_candidates.slice(0, 3).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      amount: candidate.amount,
      confidence: candidate.confidence,
      reason: candidate.reason,
    })),
    journal_candidates: suggestion.journal_candidates.slice(0, 3).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      confidence: candidate.confidence,
      reason: candidate.reason,
    })),
    duplicate_summary: suggestion.duplicate_summary,
    confidence_score: suggestion.confidence_score,
    explanation: suggestion.suggestion_explanation,
  }
}

function getDocumentReviewErrorMessage(error: unknown) {
  const apiError = toApiError(error)
  const message = (apiError.message || '').toLowerCase()
  if (apiError.code === 'ACCESS_DENIED' || apiError.status === 403 || message.includes('review access denied')) {
    return 'คุณไม่มีสิทธิ์ตรวจเอกสารบัญชีหรือสร้าง draft จากเอกสารนี้'
  }
  return apiError.message
}

function buildEditorState(detail: DocumentReviewDetail): EditorState {
  return {
    vendor_name: detail.vendor_name || '',
    vendor_tax_id: detail.vendor_tax_id || '',
    document_number: detail.document_number || '',
    document_date: detail.document_date || '',
    subtotal_amount: toInputNumber(detail.subtotal_amount),
    tax_amount: toInputNumber(detail.tax_amount),
    total_amount: toInputNumber(detail.total_amount),
    document_type: detail.document_type,
    review_state: detail.review_state,
    matched_partner_id: detail.matched_partner_id || null,
  }
}

function buildSuggestionEditorState(suggestion?: AccountingSuggestion | false): SuggestionEditorState {
  return {
    suggested_account_id: suggestion && suggestion.suggested_account_id ? suggestion.suggested_account_id : null,
    suggested_tax_ids: suggestion && suggestion.suggested_tax_ids ? suggestion.suggested_tax_ids : [],
    suggested_journal_id: suggestion && suggestion.suggested_journal_id ? suggestion.suggested_journal_id : null,
    suggested_analytic_account_id:
      suggestion && suggestion.suggested_analytic_account_id ? suggestion.suggested_analytic_account_id : null,
  }
}

function parseNumericInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function isImageAttachment(attachment?: DocumentReviewAttachment) {
  return !!attachment?.mimetype?.startsWith('image/')
}

function isPdfAttachment(attachment?: DocumentReviewAttachment) {
  return attachment?.mimetype === 'application/pdf'
}

function buildLocalCopilotFallback(prompt: string, detail: DocumentReviewDetail | undefined) {
  if (!detail) return 'เลือกเอกสารก่อน แล้วฉันจะช่วยอธิบายบริบทของผลการดึงข้อมูลให้'
  const lower = prompt.toLowerCase()
  const issueSummary =
    detail.issues.length > 0
      ? detail.issues.map((issue) => `${issue.severity}: ${issue.message}`).join(' | ')
      : 'No validation issues are currently stored.'
  if (lower.includes('vendor')) {
    const partnerContext = formatPartnerContext({
      vat: detail.matched_partner_vat,
      stateName: detail.matched_partner_state_name,
    })
    const topCandidate = detail.accounting_suggestion?.partner_candidates?.[0]
    const topCandidateContext = topCandidate
      ? formatPartnerContext({
          vat: topCandidate.vat,
          stateName: topCandidate.state_name,
        })
      : ''
    return detail.matched_partner_name
      ? `Backend currently matches this document to ${detail.matched_partner_name}${partnerContext ? ` (${partnerContext})` : ''}. Please verify VAT, document number, total, and province before confirming the draft.`
      : `No partner match is confirmed yet. Review the detected vendor "${detail.vendor_name || 'unknown'}" and search contacts by tax ID first.${topCandidate ? ` Top candidate is ${topCandidate.name}${topCandidateContext ? ` (${topCandidateContext})` : ''} at confidence ${topCandidate.confidence.toFixed(2)}.` : ''}`
  }
  if (lower.includes('tax')) {
    return detail.tax_amount
      ? `Detected tax amount is ${asCurrency(detail.tax_amount, detail.currency_name || 'THB')}. Confirm that subtotal + tax matches the total before using the draft suggestion.`
      : 'No reliable tax amount is stored yet, so this document should stay review-first.'
  }
  if (lower.includes('class')) {
    return `Current classification is ${detail.document_type} with confidence ${(detail.classification_confidence || 0).toFixed(2)}. Review signals come from the normalized fields and the raw text preserved in Odoo.`
  }
  return `AI backend is unavailable right now, so here is a rule-based review summary. Suggested action: ${getTargetLabel(detail.suggested_target)}. Validation: ${issueSummary}`
}

export function DocumentReviewInboxPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedIdParam = searchParams.get('id')
  const initialSelectedId = selectedIdParam ? Number.parseInt(selectedIdParam, 10) : null
  const [selectedId, setSelectedId] = useState<number | null>(Number.isFinite(initialSelectedId) ? initialSelectedId : null)
  const [viewMode, setViewMode] = useState<InboxViewMode>('all')
  const [filter, setFilter] = useState<FilterKey>('needs_review')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [suggestionEditor, setSuggestionEditor] = useState<SuggestionEditorState | null>(null)
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<number | null>(null)
  const [partnerSearch, setPartnerSearch] = useState('')
  const [copilotOpen, setCopilotOpen] = useState(true)
  const [copilotInput, setCopilotInput] = useState('')
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      role: 'assistant',
      text: 'ฉันช่วยอธิบายผลการดึงข้อมูล ประเด็นตรวจสอบ การจับคู่คู่ค้า และขั้นตอนถัดไปที่เหมาะสมสำหรับเอกสารที่เลือกได้',
    },
  ])

  const debouncedSearch = useDebouncedValue(search, 300)
  const debouncedPartnerSearch = useDebouncedValue(partnerSearch, 250)
  const currentFilter = FILTER_CONFIG[filter]
  const shouldShowApprovals = viewMode === 'all' || viewMode === 'approvals'
  const shouldShowDocuments = viewMode === 'all' || viewMode === 'documents'

  const queueQuery = useQuery({
    queryKey: ['document-review', 'items', filter, debouncedSearch, offset],
    queryFn: () =>
      listDocumentReviewItems({
        limit: PAGE_SIZE,
        offset,
        states: currentFilter.states,
        review_states: currentFilter.reviewStates,
        search: debouncedSearch || undefined,
      }),
  })

  const approvalTasksQuery = useQuery({
    queryKey: ['approvalTasks', 'review-inbox'],
    queryFn: () => listApprovalTasks(20),
    staleTime: 20_000,
  })

  const approvalMutation = useMutation({
    mutationFn: ({ model, id, action }: { model: string; id: number; action: 'approve' | 'reject' }) =>
      approvalAction(model, id, action),
    onSuccess: async (_, variables) => {
      toast.success(variables.action === 'approve' ? 'อนุมัติรายการสำเร็จ' : 'ปฏิเสธรายการสำเร็จ')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['approvalTasks'] }),
        queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] }),
      ])
    },
    onError: (error) => {
      toast.error('ดำเนินการอนุมัติไม่สำเร็จ', toApiError(error).message)
    },
  })

  const items = queueQuery.data?.items || []
  const total = queueQuery.data?.total || 0
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (!items.length) return
    if (selectedId && items.some((item) => item.id === selectedId)) return
    const firstId = items[0].id
    setSelectedId(firstId)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('id', String(firstId))
      return next
    })
  }, [items, selectedId, setSearchParams])

  const detailQuery = useQuery({
    queryKey: ['document-review', 'detail', selectedId],
    queryFn: () => getDocumentReviewDetail(selectedId!),
    enabled: !!selectedId,
  })

  const detail = detailQuery.data

  useEffect(() => {
    if (!detail) return
    setEditor(buildEditorState(detail))
    setSuggestionEditor(buildSuggestionEditorState(detail.accounting_suggestion))
    setSelectedAttachmentId(detail.attachments[0]?.id || null)
  }, [detail])

  const selectedAttachment = useMemo(
    () => detail?.attachments.find((attachment) => attachment.id === selectedAttachmentId) || detail?.attachments[0],
    [detail?.attachments, selectedAttachmentId],
  )

  const partnerOptionsQuery = useQuery({
    queryKey: ['document-review', 'partners', debouncedPartnerSearch],
    queryFn: () => listPartners({ q: debouncedPartnerSearch, limit: 8, active: true }),
    enabled: debouncedPartnerSearch.trim().length >= 2,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId || !editor || !suggestionEditor) throw new Error('No extraction selected')
      const payload: DocumentReviewUpdatePayload = {
        vendor_name: editor.vendor_name || undefined,
        vendor_tax_id: editor.vendor_tax_id || undefined,
        document_number: editor.document_number || undefined,
        document_date: editor.document_date || null,
        subtotal_amount: parseNumericInput(editor.subtotal_amount),
        tax_amount: parseNumericInput(editor.tax_amount),
        total_amount: parseNumericInput(editor.total_amount),
        document_type: editor.document_type,
        review_state: editor.review_state,
        matched_partner_id: editor.matched_partner_id,
      }
      return updateAccountingSuggestion(
        selectedId,
        {
          suggested_account_id: suggestionEditor.suggested_account_id,
          suggested_tax_ids: suggestionEditor.suggested_tax_ids,
          suggested_journal_id: suggestionEditor.suggested_journal_id,
          suggested_analytic_account_id: suggestionEditor.suggested_analytic_account_id,
        },
        payload,
      )
    },
    onSuccess: async () => {
      toast.success('บันทึกการแก้ไขแล้ว')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['document-review', 'items'] }),
        queryClient.invalidateQueries({ queryKey: ['document-review', 'detail', selectedId] }),
      ])
    },
    onError: (error) => {
      toast.error('บันทึกการตรวจเอกสารไม่สำเร็จ', getDocumentReviewErrorMessage(error))
    },
  })

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('No extraction selected')
      return retryDocumentReview(selectedId)
    },
    onSuccess: async () => {
      toast.success('ส่งคิวให้ประมวลผลใหม่แล้ว')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['document-review', 'items'] }),
        queryClient.invalidateQueries({ queryKey: ['document-review', 'detail', selectedId] }),
      ])
    },
    onError: (error) => {
      toast.error('สั่งประมวลผลใหม่ไม่สำเร็จ', getDocumentReviewErrorMessage(error))
    },
  })

  const unsupportedMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('No extraction selected')
      return markDocumentUnsupported(selectedId)
    },
    onSuccess: async () => {
      toast.success('ทำเครื่องหมายว่าเอกสารนี้ไม่รองรับแล้ว')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['document-review', 'items'] }),
        queryClient.invalidateQueries({ queryKey: ['document-review', 'detail', selectedId] }),
      ])
    },
    onError: (error) => {
      toast.error('ทำเครื่องหมายว่าไม่รองรับไม่สำเร็จ', getDocumentReviewErrorMessage(error))
    },
  })

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('No extraction selected')
      return createDocumentDraft(selectedId)
    },
    onSuccess: async (result) => {
      toast.success('สร้าง draft บิลผู้ขายแล้ว')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['document-review', 'items'] }),
        queryClient.invalidateQueries({ queryKey: ['document-review', 'detail', selectedId] }),
      ])
      if (result.linked_move_id) {
        navigate(`/purchases/bills/${result.linked_move_id}`)
      }
    },
    onError: (error) => {
      toast.error('สร้าง draft ไม่สำเร็จ', getDocumentReviewErrorMessage(error))
    },
  })

  const copilotMutation = useMutation({
    mutationFn: async (prompt: string) => {
      if (!detail) throw new Error('กรุณาเลือกเอกสารก่อน')
      return sendAssistantChat(prompt, {
        workspace: 'document_review',
        extraction: {
          id: detail.id,
          name: detail.name,
          state: detail.state,
          review_state: detail.review_state,
          document_type: detail.document_type,
          vendor_name: detail.vendor_name,
          vendor_tax_id: detail.vendor_tax_id,
          document_number: detail.document_number,
          document_date: detail.document_date,
          currency_name: detail.currency_name,
          subtotal_amount: detail.subtotal_amount,
          tax_amount: detail.tax_amount,
          total_amount: detail.total_amount,
          suggested_target: detail.suggested_target,
          suggestion_confidence: detail.suggestion_confidence,
          matched_partner_name: detail.matched_partner_name,
          matched_partner_vat: detail.matched_partner_vat,
          matched_partner_state_name: detail.matched_partner_state_name,
          matched_partner_context: formatPartnerContext({
            vat: detail.matched_partner_vat,
            stateName: detail.matched_partner_state_name,
          }),
          matching_summary: detail.matching_summary,
          validation_summary: detail.validation_summary,
          accounting_suggestion: detail.accounting_suggestion,
          accounting_candidates: summarizeSuggestionCandidates(detail.accounting_suggestion),
          raw_text_excerpt: detail.raw_text?.slice(0, 3000),
        },
        issues: detail.issues,
      })
    },
    onSuccess: (result, prompt) => {
      setCopilotMessages((prev) => [
        ...prev,
        { role: 'user', text: prompt },
        {
          role: 'assistant',
          text: result.business_reply || result.reply,
          meta: result.mode ? `Mode: ${result.mode}` : undefined,
        },
      ])
      setCopilotInput('')
    },
    onError: (error, prompt) => {
      const apiError = toApiError(error)
      setCopilotMessages((prev) => [
        ...prev,
        { role: 'user', text: prompt },
        {
          role: 'assistant',
          text: buildLocalCopilotFallback(prompt, detail),
          meta: `Fallback guidance • ${apiError.message}`,
        },
      ])
      setCopilotInput('')
    },
  })

  const partnerOptions = partnerOptionsQuery.data?.items || []
  const selectedPartner = partnerOptions.find((partner) => partner.id === editor?.matched_partner_id)
  const currentMatchedPartnerLabel =
    selectedPartner?.name || detail?.matched_partner_name || (editor?.matched_partner_id ? `Partner #${editor.matched_partner_id}` : '')
  const matchedPartnerContext = formatPartnerContext({
    vat: selectedPartner?.vat || detail?.matched_partner_vat,
    stateName: selectedPartner?.stateName || detail?.matched_partner_state_name,
  })

  const saveDisabled = !editor || saveMutation.isPending || !detail

  const openExtraction = (id: number) => {
    setSelectedId(id)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('id', String(id))
      return next
    })
  }

  const handleEditorChange = <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setEditor((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSuggestionChange = <K extends keyof SuggestionEditorState>(key: K, value: SuggestionEditorState[K]) => {
    setSuggestionEditor((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const sendCopilotPrompt = async (prompt: string) => {
    await copilotMutation.mutateAsync(prompt)
  }

  const renderPreview = () => {
    if (!selectedAttachment) {
      return <div className="text-muted small">ไม่มีไฟล์แนบสำหรับแสดงตัวอย่าง</div>
    }
    if (isImageAttachment(selectedAttachment)) {
      return <img src={selectedAttachment.preview_url} alt={selectedAttachment.name} className="document-review__image" />
    }
    if (isPdfAttachment(selectedAttachment)) {
      return (
        <iframe
          src={selectedAttachment.preview_url}
          title={selectedAttachment.name}
          className="document-review__iframe"
        />
      )
    }
    return (
      <div className="document-review__generic-file">
        <i className="bi bi-file-earmark-text fs-2 text-muted" aria-hidden="true" />
        <div className="fw-semibold">{selectedAttachment.name}</div>
        <div className="small text-muted">ไฟล์ประเภทนี้ยังไม่รองรับการแสดงตัวอย่าง</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="กล่องงานตรวจสอบ"
        subtitle="รวมงานรออนุมัติและเอกสารที่ต้องตรวจไว้ในที่เดียว เพื่อให้จัดการงานค้างได้เร็วขึ้น"
        breadcrumb="บัญชี · กล่องงานตรวจสอบ"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => detailQuery.refetch()} disabled={!selectedId || detailQuery.isFetching}>
              รีเฟรชรายละเอียด
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveDisabled} isLoading={saveMutation.isPending}>
              บันทึกการแก้ไข
            </Button>
          </div>
        }
      />

      <div className="document-review__toolbar">
        <div className="document-review__filters">
          {([
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'approvals', label: `รออนุมัติ (${approvalTasksQuery.data?.pendingCount || 0})` },
            { key: 'documents', label: `เอกสาร review (${total})` },
          ] as Array<{ key: InboxViewMode; label: string }>).map((item) => (
            <button
              key={item.key}
              type="button"
              className={`document-review__filter-chip ${viewMode === item.key ? 'is-active' : ''}`}
              onClick={() => setViewMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {shouldShowApprovals ? <Card className="mb-4">
        <div className="document-review__section-head">
          <div>
            <div className="fw-semibold">Approval Queue</div>
            <div className="small text-muted">งานรออนุมัติจาก backend approval queue เดียวกับ dashboard</div>
          </div>
          <Badge tone={(approvalTasksQuery.data?.pendingCount || 0) > 0 ? 'amber' : 'green'}>
            {approvalTasksQuery.data?.pendingCount || 0}
          </Badge>
        </div>

        {approvalTasksQuery.isLoading ? (
          <div className="small text-muted">กำลังโหลด approval queue...</div>
        ) : approvalTasksQuery.isError ? (
          <Alert variant="danger" className="mb-0 mt-3">
            {toApiError(approvalTasksQuery.error).message}
          </Alert>
        ) : (approvalTasksQuery.data?.items.length || 0) === 0 ? (
          <div className="small text-muted">ไม่มีงานรออนุมัติในขณะนี้</div>
        ) : (
          <div className="d-flex flex-column gap-3 mt-3">
            {approvalTasksQuery.data?.items.map((task) => (
              <div key={`${task.model}:${task.id}`} className="document-review__issue">
                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                  <div>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <Badge tone="amber">รออนุมัติ</Badge>
                      <Badge tone="blue">{task.typeLabel || task.type}</Badge>
                    </div>
                    <div className="fw-semibold">{task.name}</div>
                    <div className="small text-muted mt-1">
                      {task.requestedByName ? `ผู้ขอ: ${task.requestedByName}` : 'ผู้ขอ: -'}
                      {task.approvalTeamName ? ` • ทีม: ${task.approvalTeamName}` : ''}
                      {task.company ? ` • บริษัท: ${task.company}` : ''}
                    </div>
                    {task.description ? <div className="small mt-2">{task.description}</div> : null}
                  </div>
                  <div className="text-lg-end">
                    <div className="fw-semibold">{asCurrency(task.amountTotal, task.currency || 'THB')}</div>
                    <div className="small text-muted">มูลค่ารวม</div>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => approvalMutation.mutate({ model: task.model, id: task.id, action: 'approve' })}
                    isLoading={
                      approvalMutation.isPending &&
                      approvalMutation.variables?.model === task.model &&
                      approvalMutation.variables?.id === task.id &&
                      approvalMutation.variables?.action === 'approve'
                    }
                  >
                    อนุมัติ
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => approvalMutation.mutate({ model: task.model, id: task.id, action: 'reject' })}
                    isLoading={
                      approvalMutation.isPending &&
                      approvalMutation.variables?.model === task.model &&
                      approvalMutation.variables?.id === task.id &&
                      approvalMutation.variables?.action === 'reject'
                    }
                  >
                    ปฏิเสธ
                  </Button>
                  {task.route ? (
                    <Button size="sm" variant="ghost" onClick={() => navigate(task.route!)}>
                      เปิดเอกสาร
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card> : null}

      {shouldShowDocuments ? <div className="document-review__toolbar">
        <div className="document-review__filters">
          {(Object.keys(FILTER_CONFIG) as FilterKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`document-review__filter-chip ${filter === key ? 'is-active' : ''}`}
              onClick={() => {
                setFilter(key)
                setOffset(0)
              }}
            >
              {FILTER_CONFIG[key].label}
            </button>
          ))}
        </div>
        <div className="document-review__search">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOffset(0)
            }}
            placeholder="ค้นหาชื่อผู้ขาย เลขเอกสาร หรือเลขรับเข้า"
            leftAdornment={<i className="bi bi-search" />}
          />
        </div>
      </div> : null}

      {shouldShowDocuments ? <div className="document-review__layout">
        <Card className="document-review__queue">
          <div className="document-review__section-head">
            <div>
              <div className="fw-semibold">คิวเอกสาร</div>
              <div className="small text-muted">เรียงจากรายการล่าสุด และแสดงเอกสารที่มีประเด็นตรวจสอบให้เห็นชัด</div>
            </div>
            <Badge tone="gray">{total}</Badge>
          </div>

          {queueQuery.isLoading ? (
            <div className="py-5 text-center">
              <Spinner animation="border" />
            </div>
          ) : queueQuery.isError ? (
            <Alert variant="danger" className="m-3">
              {getDocumentReviewErrorMessage(queueQuery.error)}
            </Alert>
          ) : items.length === 0 ? (
            <div className="p-4 text-muted small">ไม่พบเอกสารตามตัวกรองที่เลือก</div>
          ) : (
            <div className="document-review__queue-list">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`document-review__queue-item ${selectedId === item.id ? 'is-active' : ''}`}
                  onClick={() => openExtraction(item.id)}
                >
                  <div className="d-flex justify-content-between gap-2 align-items-start mb-2">
                    <div className="text-start">
                      <div className="fw-semibold text-dark">{item.vendor_name || item.document_number || item.name}</div>
                      <div className="small text-muted">{item.document_date || 'ไม่ระบุวันที่'} · {item.document_type.replace(/_/g, ' ')}</div>
                    </div>
                    <Badge tone={getStateTone(item)}>{getStateLabel(item.state)}</Badge>
                  </div>
                  <div className="small text-muted text-start mb-2">
                    {item.total_amount ? asCurrency(item.total_amount, item.currency_name || 'THB') : 'รอยอดเงินจากการประมวลผล'}
                  </div>
                  <div className="d-flex flex-wrap gap-2 text-start">
                    <span className="document-review__meta-pill">
                      ความมั่นใจ {(item.classification_confidence || 0).toFixed(2)}
                    </span>
                    <span className="document-review__meta-pill">
                      ประเด็น {item.issue_count}
                    </span>
                    <span className="document-review__meta-pill">
                      {getTargetLabel(item.suggested_target)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="document-review__pager">
            <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}>
              ก่อนหน้า
            </Button>
            <span className="small text-muted">
              หน้า {page} / {pageCount}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            >
              ถัดไป
            </Button>
          </div>
        </Card>

        <div className="document-review__center">
          {!selectedId ? (
            <Card>
              <div className="text-muted">เลือกเอกสารจากคิวทางซ้ายเพื่อเริ่มตรวจสอบ</div>
            </Card>
          ) : detailQuery.isLoading ? (
            <Card>
              <div className="py-5 text-center">
                <Spinner animation="border" />
              </div>
            </Card>
          ) : detailQuery.isError || !detail || !editor || !suggestionEditor ? (
            <Card>
              <Alert variant="danger" className="mb-0">
                {detailQuery.isError ? getDocumentReviewErrorMessage(detailQuery.error) : 'ยังไม่สามารถแสดงรายละเอียดเอกสารได้'}
              </Alert>
            </Card>
          ) : (
            <>
              <Card className="mb-4">
                <div className="document-review__section-head">
                  <div>
                    <div className="fw-semibold">เอกสารต้นฉบับ</div>
                    <div className="small text-muted">ดูตัวอย่างเอกสารไปพร้อมกับแก้ไขข้อมูลได้ในหน้าเดียว</div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {detail.attachments.map((attachment) => (
                      <button
                        key={attachment.id}
                        type="button"
                        className={`document-review__attachment-chip ${selectedAttachment?.id === attachment.id ? 'is-active' : ''}`}
                        onClick={() => setSelectedAttachmentId(attachment.id)}
                      >
                        {attachment.name}
                      </button>
                    ))}
                    {selectedAttachment ? (
                      <a
                        href={selectedAttachment.download_url}
                        className="btn btn-sm btn-outline-secondary"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="document-review__preview">{renderPreview()}</div>
              </Card>

              <Card className="mb-4">
                <div className="document-review__section-head">
                  <div>
                    <div className="fw-semibold">ข้อมูลที่ดึงออกมา</div>
                    <div className="small text-muted">
                      ผู้ให้บริการ {detail.provider_key || 'ไม่ทราบ'} {detail.provider_version || ''}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Badge tone="blue">{detail.document_type.replace(/_/g, ' ')}</Badge>
                    <Badge tone={detail.issues.some((issue) => issue.severity === 'blocking') ? 'red' : 'gray'}>
                      {(detail.classification_confidence || 0).toFixed(2)}
                    </Badge>
                  </div>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small text-muted">ผู้ขาย</label>
                    <Input value={editor.vendor_name} onChange={(event) => handleEditorChange('vendor_name', event.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted">เลขผู้เสียภาษีผู้ขาย</label>
                    <Input value={editor.vendor_tax_id} onChange={(event) => handleEditorChange('vendor_tax_id', event.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted">เลขที่เอกสาร</label>
                    <Input value={editor.document_number} onChange={(event) => handleEditorChange('document_number', event.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted">วันที่เอกสาร</label>
                    <Input type="date" value={editor.document_date} onChange={(event) => handleEditorChange('document_date', event.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted">ประเภทเอกสาร</label>
                    <Form.Select value={editor.document_type} onChange={(event) => handleEditorChange('document_type', event.target.value as EditorState['document_type'])}>
                      {DOCUMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted">ยอดก่อนภาษี</label>
                    <Input value={editor.subtotal_amount} onChange={(event) => handleEditorChange('subtotal_amount', event.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted">ยอดภาษี</label>
                    <Input value={editor.tax_amount} onChange={(event) => handleEditorChange('tax_amount', event.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted">ยอดรวม</label>
                    <Input value={editor.total_amount} onChange={(event) => handleEditorChange('total_amount', event.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted">สถานะการตรวจสอบ</label>
                    <Form.Select value={editor.review_state} onChange={(event) => handleEditorChange('review_state', event.target.value as DocumentReviewStatus)}>
                      {REVIEW_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted">คู่ค้าที่จับคู่ได้</label>
                    <div className="document-review__partner-box">
                      <Input
                        value={partnerSearch}
                        onChange={(event) => setPartnerSearch(event.target.value)}
                        placeholder={currentMatchedPartnerLabel || 'ค้นหาคู่ค้าด้วยชื่อหรือเลขผู้เสียภาษี'}
                        leftAdornment={<i className="bi bi-building" />}
                      />
                      {editor.matched_partner_id ? (
                        <div className="small text-muted mt-2">
                          เลือกแล้ว: <span className="fw-semibold">{currentMatchedPartnerLabel}</span>{' '}
                          {matchedPartnerContext ? <span>• {matchedPartnerContext} </span> : null}
                          <button type="button" className="btn btn-link btn-sm p-0 ms-2" onClick={() => handleEditorChange('matched_partner_id', null)}>
                            ล้างค่า
                          </button>
                        </div>
                      ) : null}
                      {partnerOptionsQuery.isFetching ? (
                        <div className="small text-muted mt-2">กำลังค้นหาคู่ค้า...</div>
                      ) : partnerOptions.length > 0 ? (
                        <div className="document-review__partner-results mt-2">
                          {partnerOptions.map((partner: PartnerSummary) => (
                            <button
                              key={partner.id}
                              type="button"
                              className={`document-review__partner-option ${editor.matched_partner_id === partner.id ? 'is-active' : ''}`}
                              onClick={() => {
                                handleEditorChange('matched_partner_id', partner.id)
                                if (!editor.vendor_name) handleEditorChange('vendor_name', partner.name)
                              }}
                            >
                              <span className="fw-semibold">{partner.name}</span>
                              <span className="small text-muted">
                                {[partner.vat || 'ไม่มีเลขผู้เสียภาษี', partner.stateName || ''].filter(Boolean).join(' • ')}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>

              <div className="row g-4">
                <div className="col-lg-6">
                  <Card className="h-100">
                    <div className="document-review__section-head">
                      <div>
                        <div className="fw-semibold">ประเด็นที่ต้องตรวจสอบ</div>
                        <div className="small text-muted">แยกคำเตือนและจุดที่บล็อกการทำงานให้เห็นชัดเจน</div>
                      </div>
                      <Badge tone={detail.issues.some((issue) => issue.severity === 'blocking') ? 'red' : 'amber'}>
                        {detail.issues.length}
                      </Badge>
                    </div>
                    {detail.issues.length === 0 ? (
                      <div className="small text-muted">ยังไม่มีประเด็นตรวจสอบในเอกสารนี้</div>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {detail.issues.map((issue) => (
                          <div key={issue.id} className="document-review__issue">
                            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                              <div className="fw-semibold">{issue.code}</div>
                              <Badge tone={getIssueTone(issue)}>{issue.severity}</Badge>
                            </div>
                            <div className="small mb-1">{issue.message}</div>
                            {issue.field_name ? <div className="small text-muted">ฟิลด์: {issue.field_name}</div> : null}
                            {issue.suggested_action ? <div className="small text-muted">วิธีแก้: {issue.suggested_action}</div> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
                <div className="col-lg-6">
                  <Card className="h-100">
                    <div className="document-review__section-head">
                      <div>
                        <div className="fw-semibold">คำแนะนำการดำเนินการ</div>
                        <div className="small text-muted">ระบบจะไม่โพสต์รายการอัตโนมัติ ต้องให้ผู้ใช้ยืนยันทุกครั้ง</div>
                      </div>
                      <Badge tone={detail.suggested_target === 'vendor_bill' ? 'blue' : detail.suggested_target === 'expense' ? 'amber' : 'gray'}>
                        {getTargetLabel(detail.suggested_target)}
                      </Badge>
                    </div>
                    <div className="document-review__summary-grid">
                      <div>
                        <div className="small text-muted">คู่ค้าที่แนะนำ</div>
                        <div className="fw-semibold">{detail.accounting_suggestion?.suggested_partner_name || detail.matched_partner_name || 'ต้องตรวจสอบ'}</div>
                        {matchedPartnerContext ? <div className="small text-muted">{matchedPartnerContext}</div> : null}
                      </div>
                      <div>
                        <div className="small text-muted">Total</div>
                        <div className="fw-semibold">{asCurrency(detail.total_amount, detail.currency_name || 'THB')}</div>
                      </div>
                      <div>
                        <div className="small text-muted">สรุปผลการตรวจสอบ</div>
                        <div>{detail.validation_summary || 'ยังไม่มีสรุปผลการตรวจสอบ'}</div>
                      </div>
                      <div>
                        <div className="small text-muted">สรุปการจับคู่ข้อมูล</div>
                        <div>{detail.matching_summary || 'ยังไม่มีสรุปการจับคู่ข้อมูล'}</div>
                      </div>
                    </div>
                    {detail.accounting_suggestion ? (
                      <div className="mt-4">
                        <div className="document-review__section-head mb-3">
                          <div>
                            <div className="fw-semibold">คำแนะนำการลงบัญชีจาก AI</div>
                            <div className="small text-muted">
                              ความมั่นใจ {(detail.accounting_suggestion.confidence_score || 0).toFixed(2)} • ปรับแก้ได้ทุกค่า
                            </div>
                          </div>
                        </div>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label small text-muted">บัญชีที่แนะนำ</label>
                            <Form.Select
                              value={suggestionEditor.suggested_account_id || ''}
                              onChange={(event) =>
                                handleSuggestionChange(
                                  'suggested_account_id',
                                  event.target.value ? Number(event.target.value) : null,
                                )}
                            >
                              <option value="">ต้องตรวจสอบ</option>
                              {detail.accounting_suggestion.account_candidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.code ? `${candidate.code} · ` : ''}
                                  {candidate.name} ({candidate.confidence.toFixed(2)})
                                </option>
                              ))}
                            </Form.Select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small text-muted">สมุดรายวันที่แนะนำ</label>
                            <Form.Select
                              value={suggestionEditor.suggested_journal_id || ''}
                              onChange={(event) =>
                                handleSuggestionChange(
                                  'suggested_journal_id',
                                  event.target.value ? Number(event.target.value) : null,
                                )}
                            >
                              <option value="">ต้องตรวจสอบ</option>
                              {detail.accounting_suggestion.journal_candidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name} ({candidate.confidence.toFixed(2)})
                                </option>
                              ))}
                            </Form.Select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small text-muted">ภาษีที่แนะนำ</label>
                            <Form.Select
                              value={suggestionEditor.suggested_tax_ids[0] || ''}
                              onChange={(event) =>
                                handleSuggestionChange(
                                  'suggested_tax_ids',
                                  event.target.value ? [Number(event.target.value)] : [],
                                )}
                            >
                              <option value="">ยังไม่ได้จับคู่ภาษี</option>
                              {detail.accounting_suggestion.tax_candidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name} ({candidate.confidence.toFixed(2)})
                                </option>
                              ))}
                            </Form.Select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small text-muted">บัญชีวิเคราะห์ที่แนะนำ</label>
                            <Form.Select
                              value={suggestionEditor.suggested_analytic_account_id || ''}
                              onChange={(event) =>
                                handleSuggestionChange(
                                  'suggested_analytic_account_id',
                                  event.target.value ? Number(event.target.value) : null,
                                )}
                            >
                              <option value="">ยังไม่ได้จับคู่บัญชีวิเคราะห์</option>
                              {detail.accounting_suggestion.analytic_candidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name} ({candidate.confidence.toFixed(2)})
                                </option>
                              ))}
                            </Form.Select>
                          </div>
                          <div className="col-12">
                          <div className="document-review__issue">
                              <div className="small text-muted mb-2">เหตุผลของคำแนะนำ</div>
                              <div>{detail.accounting_suggestion.suggestion_explanation || 'ยังไม่มีคำอธิบายที่บันทึกไว้'}</div>
                              {detail.accounting_suggestion.partner_candidates.length > 0 ? (
                                <div className="small text-muted mt-2">
                                  คู่ค้าที่เข้าเงื่อนไขมากที่สุด:{' '}
                                  {detail.accounting_suggestion.partner_candidates
                                    .slice(0, 3)
                                    .map((candidate) => {
                                      const candidateContext = formatPartnerContext({
                                        vat: candidate.vat,
                                        stateName: candidate.state_name,
                                      })
                                      return `${candidate.name}${candidateContext ? ` (${candidateContext})` : ''} ${candidate.confidence.toFixed(2)}`
                                    })
                                    .join(' • ')}
                                </div>
                              ) : null}
                              {detail.accounting_suggestion.duplicate_summary ? (
                                <div className="small text-muted mt-2">
                                  ผลตรวจรายการซ้ำ: {detail.accounting_suggestion.duplicate_summary}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="d-flex flex-wrap gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => createDraftMutation.mutate()}
                        disabled={detail.suggested_target === 'review_only' || detail.issues.some((issue) => issue.severity === 'blocking')}
                        isLoading={createDraftMutation.isPending}
                      >
                        ยืนยันสร้าง draft
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => retryMutation.mutate()} isLoading={retryMutation.isPending}>
                        ประมวลผลใหม่
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => unsupportedMutation.mutate()} isLoading={unsupportedMutation.isPending}>
                        ทำเครื่องหมายว่าไม่รองรับ
                      </Button>
                      {detail.linked_model && detail.linked_res_id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (detail.linked_model === 'account.move') {
                              navigate(`/purchases/bills/${detail.linked_res_id}`)
                              return
                            }
                            window.open(`/web#id=${detail.linked_res_id}&model=${detail.linked_model}&view_type=form`, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          เปิดเอกสารที่เชื่อมไว้
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>

        <Card className={`document-review__copilot ${copilotOpen ? 'is-open' : 'is-collapsed'}`}>
          <div className="document-review__section-head">
            <div>
              <div className="fw-semibold">AI Copilot</div>
              <div className="small text-muted">ช่วยอธิบายบริบทและให้คำแนะนำ โดยยังคงให้ผู้ใช้เป็นผู้ยืนยันทุกขั้นตอน</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setCopilotOpen((prev) => !prev)}>
              {copilotOpen ? 'ย่อ' : 'เปิด'}
            </Button>
          </div>

          {copilotOpen ? (
            <>
              <div className="document-review__copilot-actions">
                <button type="button" className="document-review__meta-pill" onClick={() => sendCopilotPrompt('Explain this extraction result.')}>
                  อธิบายผลการดึงข้อมูล
                </button>
                <button type="button" className="document-review__meta-pill" onClick={() => sendCopilotPrompt('Explain the validation issues on this document.')}>
                  อธิบายประเด็นตรวจสอบ
                </button>
                <button type="button" className="document-review__meta-pill" onClick={() => sendCopilotPrompt('Suggest the best vendor match for this document.')}>
                  แนะนำการจับคู่ผู้ขาย
                </button>
                <button type="button" className="document-review__meta-pill" onClick={() => sendCopilotPrompt('Suggest the safest accounting path for this document.')}>
                  แนะนำขั้นตอนทางบัญชี
                </button>
              </div>

              <div className="document-review__copilot-feed">
                {copilotMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`document-review__copilot-message is-${message.role}`}>
                    <div className="small fw-semibold mb-1">{message.role === 'assistant' ? 'Copilot' : 'คุณ'}</div>
                    <div>{message.text}</div>
                    {message.meta ? <div className="small text-muted mt-2">{message.meta}</div> : null}
                  </div>
                ))}
                {copilotMutation.isPending ? (
                  <div className="document-review__copilot-message is-assistant">
                    <div className="small fw-semibold mb-1">Copilot</div>
                    <div className="d-flex align-items-center gap-2">
                      <Spinner animation="border" size="sm" />
                      <span>กำลังวิเคราะห์เอกสารที่เลือก...</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={copilotInput}
                  onChange={(event) => setCopilotInput(event.target.value)}
                  placeholder="ถามเหตุผลของการจัดประเภทเอกสาร ขอคำอธิบายการจับคู่ผู้ขาย หรือถามขั้นตอนถัดไปที่ปลอดภัยที่สุด"
                />
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <div className="small text-muted">Copilot ช่วยแนะนำ แต่ผู้ใช้เป็นผู้ยืนยันทุกครั้ง</div>
                  <Button
                    size="sm"
                    onClick={() => sendCopilotPrompt(copilotInput)}
                    disabled={!copilotInput.trim() || copilotMutation.isPending || !detail}
                  >
                    ส่งคำถาม
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="small text-muted">เปิดแผงนี้อีกครั้งเพื่อขอคำอธิบายผลการดึงข้อมูลและคำแนะนำในการตรวจสอบ</div>
          )}
        </Card>
      </div> : null}
    </div>
  )
}
