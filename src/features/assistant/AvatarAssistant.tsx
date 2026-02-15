import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  confirmAssistantDocument,
  executeAssistantPlan,
  getAssistantCapabilities,
  sendAssistantChat,
  type AssistantCapabilities,
  type AssistantChatResponse,
} from '@/api/services/ai-assistant.service'
import {
  buildAssistantInsight,
  isAssistantDataQuery,
  type AssistantInsight,
  type AssistantInsightSource,
} from '@/features/assistant/assistantInsights'
import {
  getAssistantLanguage,
  getAssistantLanguageEventName,
  type AssistantLanguage,
} from '@/lib/assistantLanguage'
import { toast } from '@/lib/toastStore'
import './avatar-assistant.css'

type ChatItem = {
  role: 'user' | 'assistant'
  text: string
}

type AssistantSourceLink = {
  label: string
  route: string
}

type AssistantResultCard = {
  id: string
  title: string
  summary: string
  confidence?: number
  generatedAt?: string
  explain?: string
  rows: Array<{ label: string; value: string; route?: string }>
  sources: AssistantSourceLink[]
}

const AVATAR_SRC = '/avatar-assistant.png'

export function AvatarAssistant() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [caps, setCaps] = useState<AssistantCapabilities | null>(null)
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<ChatItem[]>([])
  const [lastChat, setLastChat] = useState<AssistantChatResponse | null>(null)
  const [pendingApprovalIds, setPendingApprovalIds] = useState<string[]>([])
  const [pendingRunIds, setPendingRunIds] = useState<string[]>([])
  const [assistantLang, setAssistantLang] = useState<AssistantLanguage>(() => getAssistantLanguage())
  const [resultCards, setResultCards] = useState<AssistantResultCard[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<{
    session_id: string
    nonce?: string
    doc_type: string
    contact_name: string
    product_name: string
    contact_id?: number
    product_id?: number
    contact_candidates?: Array<{ id: number; name: string; vat?: string }>
    product_candidates?: Array<{ id: number; name: string; code?: string; barcode?: string }>
    qty: number
    summary: string
  } | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await getAssistantCapabilities(assistantLang)
        if (mounted) {
          setCaps(data)
          if (!data.show_bot && import.meta.env.DEV) {
            console.warn('[AvatarAssistant] Bot hidden by backend capabilities', data)
          }
        }
      } catch {
        if (mounted) {
          setCaps(null)
          if (import.meta.env.DEV) {
            console.error('[AvatarAssistant] Failed to load capabilities')
          }
        }
      }
    })()
    return () => {
      mounted = false
    }
  }, [assistantLang])

  useEffect(() => {
    const eventName = getAssistantLanguageEventName()
    const onLangChange = () => setAssistantLang(getAssistantLanguage())
    window.addEventListener(eventName, onLangChange as EventListener)
    return () => window.removeEventListener(eventName, onLangChange as EventListener)
  }, [])

  const reportRouteSet = useMemo(() => new Set((caps?.reports || []).map((r) => r.route)), [caps?.reports])
  const perms = caps?.permissions || {}
  const previewPlan = lastChat?.plan || []
  const showDebugBlocks = import.meta.env.DEV

  const safeNavigate = (route: string) => {
    if (!route) return
    if (
      reportRouteSet.has(route) ||
      route.startsWith('/customers') ||
      route.startsWith('/products') ||
      route.startsWith('/sales/') ||
      route.startsWith('/purchases/') ||
      route.startsWith('/accounting/reports') ||
      route.startsWith('/reports-studio')
    ) {
      navigate(route)
      return
    }
    toast.info('Assistant', `Blocked route: ${route}`)
  }

  const mapRecordRoute = (model: string, id: number): string => {
    if (!model || !id) return ''
    if (model === 'res.partner') return `/customers/${id}`
    if (model === 'product.product' || model === 'product.template') return `/products/${id}/edit`
    if (model === 'sale.order') return `/sales/orders/${id}`
    if (model === 'account.move') return `/sales/invoices/${id}`
    if (model === 'purchase.order') return `/purchases/orders/${id}`
    if (model === 'purchase.request') return `/purchases/requests/${id}`
    return ''
  }

  const dedupeSources = (links: AssistantSourceLink[]) => {
    const seen = new Set<string>()
    return links.filter((item) => {
      const key = `${item.label}|${item.route}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const appendResultCards = (nextCards: AssistantResultCard[]) => {
    if (!nextCards.length) return
    setResultCards((prev) => [...nextCards, ...prev].slice(0, 5))
  }

  const insightToCard = (insight: AssistantInsight): AssistantResultCard => ({
    id: `insight-${Date.now()}`,
    title: insight.title,
    summary: insight.summary,
    confidence: insight.confidence,
    generatedAt: insight.generatedAt,
    explain: insight.explain,
    rows: insight.rows,
    sources: insight.sources.map((src: AssistantInsightSource) => ({
      label: src.label,
      route: src.route,
    })),
  })

  const applyUiActions = (actions: Array<{ type: string; payload: Record<string, unknown> }>) => {
    const routeNotes: string[] = []
    const sourceLinks: AssistantSourceLink[] = []
    actions.forEach((action) => {
      const payload = action.payload || {}
      if (action.type === 'SHOW_TOAST') {
        const level = String(payload.level || 'info')
        const title = 'Assistant'
        const message = String(payload.message || '')
        if (level === 'error') toast.error(title, message)
        else if (level === 'success') toast.success(title, message)
        else toast.info(title, message)
        return
      }
      if (action.type === 'OPEN_ROUTE') {
        const route = String(payload.route || '')
        if (route) {
          safeNavigate(route)
          routeNotes.push(route)
          sourceLinks.push({
            label: String(payload.label || payload.title || route),
            route,
          })
        }
        return
      }
      if (action.type === 'OPEN_RECORD') {
        const route = String(payload.route || '')
        if (route) {
          safeNavigate(route)
          routeNotes.push(route)
          sourceLinks.push({
            label: String(payload.label || payload.title || 'Open record'),
            route,
          })
        }
      }
    })
    if (routeNotes.length > 0) {
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: `กำลังเปิดหน้า: ${routeNotes.join(' -> ')}` },
      ])
    }
    return dedupeSources(sourceLinks)
  }

  const onSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setHistory((prev) => [...prev, { role: 'user', text }])
    setInput('')
    try {
      const isDataQuery = isAssistantDataQuery(text)
      let localInsight: AssistantInsight | null = null
      if (isDataQuery) {
        try {
          localInsight = await buildAssistantInsight(text)
        } catch {
          localInsight = null
        }
      }

      if (localInsight) {
        appendResultCards([insightToCard(localInsight)])
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: localInsight.summary || 'สรุปผลลัพธ์ให้แล้ว สามารถกดเปิดดูข้อมูลต้นทางได้ทันที',
          },
        ])
        setLastChat(null)
        setPendingApprovalIds([])
        setPendingRunIds([])
        setPendingConfirm(null)
        return
      }

      if (isDataQuery) {
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'ยังไม่พบข้อมูลตามเงื่อนไข ลองระบุชื่อสินค้า/ลูกค้า หรือช่วงเวลาให้ชัดขึ้น เช่น "สรุปยอดซื้อรายลูกค้า เดือนนี้"',
          },
        ])
        setLastChat(null)
        setPendingApprovalIds([])
        setPendingRunIds([])
        setPendingConfirm(null)
        return
      }

      const res = await sendAssistantChat(text, {
        ui: { route: location.pathname },
        lang: assistantLang,
        language: assistantLang.startsWith('th') ? 'th' : 'en',
        reply_language: assistantLang.startsWith('th') ? 'th' : 'en',
        plan_only: true,
      })
      setLastChat(res)
      setHistory((prev) => [...prev, { role: 'assistant', text: res.reply || 'รับทราบ กำลังเตรียมขั้นตอนให้' }])
      if ((res.plan || []).length > 0) {
        const planCount = (res.plan || []).length
        const restricted = (res.plan || []).filter((p) => p.requires_approval).length
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text:
              restricted > 0
                ? `เตรียมแผนงาน ${planCount} ขั้นตอน (มี ${restricted} ขั้นตอนที่ต้องยืนยันก่อนทำงาน)`
                : `เตรียมแผนงาน ${planCount} ขั้นตอนแล้ว`,
          },
        ])
      }
      if (showDebugBlocks && (res.permission_explanations || []).length > 0) {
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `Permission explanation: ${(res.permission_explanations || []).join(' | ')}`,
          },
        ])
      }
      const needApprove = (res.plan || []).filter((p) => p.requires_approval).map((p) => p.id)
      const runnableSteps = (res.plan || []).filter((p) => !p.requires_approval).map((p) => p.id)
      setPendingApprovalIds(needApprove)
      setPendingRunIds(runnableSteps)
      const responseSources = dedupeSources([
        ...(Array.isArray((res as any).sources)
          ? (res as any).sources
              .map((src: any) => ({
                label: String(src?.label || src?.title || src?.route || 'Source'),
                route: String(src?.route || ''),
              }))
              .filter((src: AssistantSourceLink) => !!src.route)
          : []),
        ...(res.records || [])
          .map((r) => ({
            label: r.name ? `${r.model}: ${r.name}` : `${r.model} #${r.id}`,
            route: mapRecordRoute(r.model, r.id),
          }))
          .filter((x) => !!x.route),
      ])
      if (responseSources.length > 0 || (res.records || []).length > 0) {
        appendResultCards([
          {
            id: `records-${Date.now()}`,
            title: 'ผลลัพธ์จาก Assistant',
            summary:
              (res.records || []).length > 0
                ? `สร้าง/พบข้อมูล ${(res.records || []).length} รายการ`
                : 'มีลิงก์สำหรับเปิด source',
            rows: (res.records || []).map((r) => ({
              label: r.name || `${r.model} #${r.id}`,
              value: r.model,
              route: mapRecordRoute(r.model, r.id),
            })),
            sources: responseSources,
          },
        ])
      }
      if (res.confirmation_request) {
        setPendingConfirm({
          session_id: res.session_id,
          nonce: res.nonce,
          doc_type: String(res.confirmation_request.doc_type || ''),
          contact_name: String(res.confirmation_request.contact_name || ''),
          product_name: String(res.confirmation_request.product_name || ''),
          contact_id: Number(res.confirmation_request.contact_id || 0) || undefined,
          product_id: Number(res.confirmation_request.product_id || 0) || undefined,
          contact_candidates: Array.isArray(res.confirmation_request.contact_candidates)
            ? res.confirmation_request.contact_candidates
            : [],
          product_candidates: Array.isArray(res.confirmation_request.product_candidates)
            ? res.confirmation_request.product_candidates
            : [],
          qty: Number(res.confirmation_request.qty || 1),
          summary: String(res.confirmation_request.summary || ''),
        })
        return
      }
      setHistory((prev) => [...prev, { role: 'assistant', text: 'พร้อมทำงานแล้ว กด "เริ่มทำงาน" ได้เลย' }])
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: 'ขออภัย ตอนนี้ประมวลผลไม่สำเร็จ ลองใหม่อีกครั้งได้เลย' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onApprove = async () => {
    if (!lastChat?.session_id || pendingApprovalIds.length === 0 || loading) return
    setLoading(true)
    try {
      const res = await executeAssistantPlan(lastChat.session_id, pendingApprovalIds, lastChat.nonce)
      setPendingApprovalIds([])
      const denied = (res.results || []).filter((r) => r.status === 'denied')
      const errors = (res.results || []).filter((r) => r.status === 'error')
      if (denied.length > 0 || errors.length > 0) {
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'บางขั้นตอนถูกจำกัดสิทธิ์หรือผิดพลาด กรุณาตรวจสอบสิทธิ์ก่อนดำเนินการต่อ',
          },
        ])
      } else {
        setHistory((prev) => [...prev, { role: 'assistant', text: 'ยืนยันและดำเนินการเรียบร้อยแล้ว' }])
      }
      const actionSources = applyUiActions(res.ui_actions || [])
      const recordSources = (res.records || [])
        .map((r) => ({
          label: r.name || `${r.model} #${r.id}`,
          route: mapRecordRoute(r.model, r.id),
        }))
        .filter((x) => !!x.route)
      const mergedSources = dedupeSources([...(actionSources || []), ...recordSources])
      if (mergedSources.length > 0 || (res.records || []).length > 0) {
        appendResultCards([
          {
            id: `approve-${Date.now()}`,
            title: 'ผลการอนุมัติและดำเนินการ',
            summary: `ดำเนินการแล้ว ${(res.results || []).length} ขั้นตอน`,
            rows: (res.results || []).map((r) => ({
              label: r.tool,
              value: r.status,
            })),
            sources: mergedSources,
          },
        ])
      }
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: 'ไม่สามารถยืนยันขั้นตอนนี้ได้ในขณะนี้' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onRunWorkflow = async () => {
    if (!lastChat?.session_id || pendingRunIds.length === 0 || loading) return
    setLoading(true)
    try {
      const res = await executeAssistantPlan(lastChat.session_id, pendingRunIds, lastChat.nonce)
      setPendingRunIds([])
      const actionSources = applyUiActions(res.ui_actions || [])
      const denied = (res.results || []).filter((r) => r.status === 'denied')
      const errors = (res.results || []).filter((r) => r.status === 'error')
      const created = (res.records || []).map((r) => `${r.model}#${r.id}${r.name ? ` (${r.name})` : ''}`)
      const recordSources = (res.records || [])
        .map((r) => ({
          label: r.name || `${r.model} #${r.id}`,
          route: mapRecordRoute(r.model, r.id),
        }))
        .filter((x) => !!x.route)
      const mergedSources = dedupeSources([...(actionSources || []), ...recordSources])
      if (denied.length > 0 || errors.length > 0) {
        setHistory((prev) => [...prev, { role: 'assistant', text: 'ทำงานบางส่วนสำเร็จ แต่มีบางขั้นตอนติดข้อจำกัด' }])
      } else {
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: created.length > 0 ? `ทำงานสำเร็จ ${created.length} รายการ` : 'ทำงานสำเร็จ',
          },
        ])
      }
      if (mergedSources.length > 0 || created.length > 0) {
        appendResultCards([
          {
            id: `run-${Date.now()}`,
            title: 'ผลการทำงาน Workflow',
            summary: created.length > 0 ? `สร้าง/อัปเดต ${created.length} รายการ` : 'ดำเนินการสำเร็จ',
            rows: (res.results || []).map((r) => ({
              label: r.tool,
              value: r.status,
            })),
            sources: mergedSources,
          },
        ])
      }
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: 'ไม่สามารถเริ่มทำงานได้ในขณะนี้' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onConfirmDocument = async (confirmed: boolean) => {
    if (!pendingConfirm || loading) return
    setLoading(true)
    try {
      const res = await confirmAssistantDocument({
        session_id: pendingConfirm.session_id,
        nonce: pendingConfirm.nonce,
        confirmed,
        contact_name: pendingConfirm.contact_name,
        product_name: pendingConfirm.product_name,
        contact_id: pendingConfirm.contact_id,
        product_id: pendingConfirm.product_id,
        qty: pendingConfirm.qty,
      })
      setPendingConfirm(null)
      if (res.reply) {
        setHistory((prev) => [...prev, { role: 'assistant', text: res.reply as string }])
      }
      const actionSources = applyUiActions(res.ui_actions || [])
      if ((actionSources || []).length > 0) {
        appendResultCards([
          {
            id: `confirm-${Date.now()}`,
            title: 'ผลการยืนยันเอกสาร',
            summary: confirmed ? 'ยืนยันและดำเนินการแล้ว' : 'ยกเลิกการดำเนินการ',
            rows: [],
            sources: actionSources || [],
          },
        ])
      }
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: 'ไม่สามารถยืนยันรายการได้ในขณะนี้' },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!caps?.show_bot) return null

  return (
    <div className="avatar-assistant-root">
      {open ? (
        <div className="avatar-assistant-panel card shadow">
          <div className="card-header d-flex align-items-center justify-content-between">
            <strong>iMeaw Assistant</strong>
            <button className="btn btn-sm btn-light" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="card-body">
            <div className="avatar-assistant-quick mb-2">
              <button className="btn btn-sm btn-light" disabled={loading} onClick={() => setInput('ค้นลูกค้า')}>
                ค้นลูกค้า
              </button>
              <button className="btn btn-sm btn-light" disabled={loading} onClick={() => setInput('ค้นสินค้า')}>
                ค้นสินค้า
              </button>
              <button
                className="btn btn-sm btn-light"
                disabled={loading}
                onClick={() => setInput('สรุปยอดซื้อรายลูกค้า เดือนนี้')}
              >
                สรุปยอดซื้อรายลูกค้า
              </button>
              <button
                className="btn btn-sm btn-light"
                disabled={loading}
                onClick={() => setInput('สรุปยอดขายสินค้า "Demo Product" เดือนนี้')}
              >
                สรุปยอดขายสินค้า
              </button>
            </div>
            <div className="avatar-assistant-history mb-2">
              {history.length === 0 ? (
                <div className="text-muted small">
                  คุยกับฉันเพื่อค้นข้อมูล, สรุปรายงาน หรือสั่งงานเอกสาร พร้อมลิงก์ไปยังข้อมูลต้นทาง
                </div>
              ) : (
                history.map((item, idx) => (
                  <div key={`${item.role}-${idx}`} className={`avatar-assistant-msg ${item.role}`}>
                    <span>{item.text}</span>
                  </div>
                ))
              )}
            </div>
            {resultCards.length > 0 && (
              <div className="avatar-results-box mb-2">
                <div className="avatar-preview-title mb-1">Search / Summary Results</div>
                <div className="avatar-results-list">
                  {resultCards.map((card) => (
                    <div key={card.id} className="avatar-result-card">
                      <div className="d-flex align-items-center justify-content-between gap-2">
                        <div className="fw-semibold small">{card.title}</div>
                        {typeof card.confidence === 'number' ? (
                          <span className="badge text-bg-light border">
                            มั่นใจ {Math.round(card.confidence * 100)}%
                          </span>
                        ) : null}
                      </div>
                      <div className="small text-muted mb-1">{card.summary}</div>
                      {card.explain ? <div className="small text-muted mb-1">วิธีค้นหา: {card.explain}</div> : null}
                      {card.generatedAt ? (
                        <div className="small text-muted mb-1">
                          อัปเดต: {new Date(card.generatedAt).toLocaleString('th-TH')}
                        </div>
                      ) : null}
                      {card.rows.length > 0 && (
                        <div className="avatar-result-rows">
                          {card.rows.map((row, idx) => (
                            <div className="avatar-result-row" key={`${card.id}-row-${idx}`}>
                              <div className="avatar-result-label">{row.label}</div>
                              <div className="avatar-result-value">{row.value}</div>
                              {row.route ? (
                                <button
                                  className="btn btn-link btn-sm p-0 text-decoration-none"
                                  onClick={() => safeNavigate(row.route || '')}
                                >
                                  เปิด
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                      {card.sources.length > 0 && (
                        <div className="avatar-result-sources mt-1">
                          {card.sources.map((src, idx) => (
                            <button
                              key={`${card.id}-src-${idx}`}
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => safeNavigate(src.route)}
                            >
                              {src.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {showDebugBlocks && (
              <div className="avatar-assistant-perm mb-2">
                <div className="small text-muted mb-1">Your Odoo permissions</div>
                <div className="d-flex flex-wrap gap-1">
                  {Object.entries(perms).map(([key, value]) => (
                    <span key={key} className="badge text-bg-light border">
                      {key}: R{value.read ? 'Y' : 'N'}/C{value.create ? 'Y' : 'N'}/W{value.write ? 'Y' : 'N'}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {showDebugBlocks && previewPlan.length > 0 && (
              <div className="avatar-preview-box mb-2">
                <div className="avatar-preview-title">Workflow Preview</div>
                <div className="avatar-preview-subtitle">ตรวจสอบก่อนกด Run Workflow</div>
                <div className="avatar-preview-steps">
                  {previewPlan.map((step, idx) => (
                    <div key={step.id || `${step.tool}-${idx}`} className="avatar-preview-step">
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="fw-semibold small">
                          {idx + 1}. {step.tool}
                        </div>
                        <span className={`badge ${step.requires_approval ? 'text-bg-warning' : 'text-bg-success'}`}>
                          {step.requires_approval ? 'approval' : 'safe'}
                        </span>
                      </div>
                      {step.args ? (
                        <div className="avatar-preview-args">
                          {Object.entries(step.args || {})
                            .filter(([k]) => ['customer_name', 'customer_id', 'product_name', 'product_id', 'qty', 'route'].includes(k))
                            .map(([k, v]) => (
                              <div key={k}>
                                <span className="text-muted">{k}:</span> {String(v)}
                              </div>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {pendingConfirm ? (
                  <div className="avatar-preview-picked mt-2">
                    <div className="small fw-semibold">Selected for confirm</div>
                    <div className="small">contact: {pendingConfirm.contact_name}{pendingConfirm.contact_id ? ` (#${pendingConfirm.contact_id})` : ''}</div>
                    <div className="small">product: {pendingConfirm.product_name}{pendingConfirm.product_id ? ` (#${pendingConfirm.product_id})` : ''}</div>
                    <div className="small">qty: {pendingConfirm.qty}</div>
                  </div>
                ) : null}
              </div>
            )}
            {pendingConfirm && (
              <div className="avatar-confirm-box mb-2">
                <div className="small fw-semibold mb-1">Confirm {pendingConfirm.doc_type}</div>
                <div className="small text-muted mb-2">{pendingConfirm.summary}</div>
                <div className="d-flex flex-column gap-2">
                  <input
                    className="form-control form-control-sm"
                    value={pendingConfirm.contact_name}
                    onChange={(e) =>
                      setPendingConfirm((prev) => (prev ? { ...prev, contact_name: e.target.value } : prev))
                    }
                    placeholder="Contact"
                    disabled={loading}
                  />
                  {(pendingConfirm.contact_candidates || []).length > 0 && (
                    <select
                      className="form-select form-select-sm"
                      value={pendingConfirm.contact_id || ''}
                      onChange={(e) => {
                        const id = Number(e.target.value || 0)
                        const row = (pendingConfirm.contact_candidates || []).find((c) => c.id === id)
                        setPendingConfirm((prev) =>
                          prev
                            ? {
                                ...prev,
                                contact_id: id || undefined,
                                contact_name: row?.name || prev.contact_name,
                              }
                            : prev,
                        )
                      }}
                      disabled={loading}
                    >
                      <option value="">เลือก contact ที่จะใช้</option>
                      {(pendingConfirm.contact_candidates || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.vat ? `(VAT: ${c.vat})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    className="form-control form-control-sm"
                    value={pendingConfirm.product_name}
                    onChange={(e) =>
                      setPendingConfirm((prev) => (prev ? { ...prev, product_name: e.target.value } : prev))
                    }
                    placeholder="Product"
                    disabled={loading}
                  />
                  {(pendingConfirm.product_candidates || []).length > 0 && (
                    <select
                      className="form-select form-select-sm"
                      value={pendingConfirm.product_id || ''}
                      onChange={(e) => {
                        const id = Number(e.target.value || 0)
                        const row = (pendingConfirm.product_candidates || []).find((c) => c.id === id)
                        setPendingConfirm((prev) =>
                          prev
                            ? {
                                ...prev,
                                product_id: id || undefined,
                                product_name: row?.name || prev.product_name,
                              }
                            : prev,
                        )
                      }}
                      disabled={loading}
                    >
                      <option value="">เลือกสินค้า/บริการที่จะใช้</option>
                      {(pendingConfirm.product_candidates || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.code ? `[${p.code}]` : ''} {p.barcode ? `(BC: ${p.barcode})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    min={1}
                    value={pendingConfirm.qty}
                    onChange={(e) =>
                      setPendingConfirm((prev) =>
                        prev ? { ...prev, qty: Math.max(Number(e.target.value || 1), 1) } : prev,
                      )
                    }
                    placeholder="Qty"
                    disabled={loading}
                  />
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-success btn-sm"
                      disabled={loading}
                      onClick={() => void onConfirmDocument(true)}
                    >
                      Confirm
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      disabled={loading}
                      onClick={() => void onConfirmDocument(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="d-flex gap-2">
              <input
                className="form-control"
                placeholder="พิมพ์คำสั่ง เช่น ค้นลูกค้า / สรุปยอดขายสินค้า..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSend()
                }}
                disabled={loading}
              />
              <button className="btn btn-primary" onClick={() => void onSend()} disabled={loading}>
                ส่ง
              </button>
            </div>
            {pendingApprovalIds.length > 0 && (
              <div className="mt-2">
                <button className="btn btn-warning btn-sm" onClick={() => void onApprove()} disabled={loading}>
                  ยืนยันก่อนทำงาน ({pendingApprovalIds.length})
                </button>
              </div>
            )}
            {pendingRunIds.length > 0 && (
              <div className="mt-2">
                <button className="btn btn-success btn-sm" onClick={() => void onRunWorkflow()} disabled={loading}>
                  เริ่มทำงาน ({pendingRunIds.length})
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="avatar-assistant-trigger"
        title="Open AI Assistant"
        onClick={() => setOpen((v) => !v)}
      >
        <img
          src={AVATAR_SRC}
          alt="AI Avatar"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src = '/favicon.png'
          }}
        />
      </button>
    </div>
  )
}
