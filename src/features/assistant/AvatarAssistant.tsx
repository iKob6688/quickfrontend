import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  confirmAssistantDocument,
  executeAssistantPlan,
  getAssistantCapabilities,
  sendAssistantChat,
  type AssistantCapabilities,
  type AssistantChatResponse,
  type AssistantExecuteResponse,
  type AssistantTokenUsage,
} from '@/api/services/ai-assistant.service'
import {
  getAssistantLanguage,
  getAssistantLanguageEventName,
  type AssistantLanguage,
} from '@/lib/assistantLanguage'
import { readAssistantPageContext } from '@/lib/assistantPageContext'
import { getInstanceId } from '@/lib/instanceId'
import { toast, useToastStore } from '@/lib/toastStore'
import { toApiError } from '@/api/response'
import './avatar-assistant.css'

type ChatItem = {
  role: 'user' | 'assistant'
  text: string
}

type AssistantSourceLink = {
  label: string
  route?: string
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
  actions?: Array<{ label: string; query: string; tone?: 'primary' | 'secondary' | 'light' }>
}

type UsageSummary = {
  prompt: number
  completion: number
  total: number
  calls: number
  lastModel?: string
}

type AssistantTraceMeta = {
  mode?: string
  traceId?: string
  warnings: string[]
  sources: Array<{ label: string; route?: string }>
  safety?: { db_only_enforced?: boolean; company_id?: number; approval_required_count?: number }
  scopeContext?: { db?: string; company_id?: number }
  toolProposals?: Array<{
    id?: string
    tool?: string
    category?: string
    allowed?: boolean
    requires_approval?: boolean
    auto_safe?: boolean
    policy?: { deny_reason?: string | false }
  }>
}

const RISKY_APPROVAL_CATEGORIES = new Set(['write_posting'])

const isRiskyToolName = (tool?: string): boolean => {
  const t = String(tool || '').toLowerCase()
  return (
    t.includes('confirm_') ||
    t.startsWith('confirm') ||
    t.includes('validate_') ||
    t.startsWith('validate') ||
    t.includes('post_') ||
    t.startsWith('post') ||
    t.includes('payment') ||
    t.includes('register_')
  )
}

const AVATAR_SRC = '/avatar-assistant.png'
  const REPORT_ROUTE_BY_KEY: Record<string, string> = {
  'profit-loss': '/accounting/reports/profit-loss',
  profit_loss: '/accounting/reports/profit-loss',
  balance_sheet: '/accounting/reports/balance-sheet',
  'balance-sheet': '/accounting/reports/balance-sheet',
  general_ledger: '/accounting/reports/general-ledger',
  'general-ledger': '/accounting/reports/general-ledger',
  trial_balance: '/accounting/reports/trial-balance',
  'trial-balance': '/accounting/reports/trial-balance',
  partner_ledger: '/accounting/reports/partner-ledger',
  'partner-ledger': '/accounting/reports/partner-ledger',
  aged_receivables: '/accounting/reports/aged-receivables',
  aged_payables: '/accounting/reports/aged-payables',
  cash_book: '/accounting/reports/cash-book',
  bank_book: '/accounting/reports/bank-book',
  vat: '/accounting/reports/vat',
  wht: '/accounting/reports/wht',
}

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
  const [usageSummary, setUsageSummary] = useState<UsageSummary>({
    prompt: 0,
    completion: 0,
    total: 0,
    calls: 0,
  })
  const [traceMeta, setTraceMeta] = useState<AssistantTraceMeta>({
    warnings: [],
    sources: [],
  })
  const [traceDrawerOpen, setTraceDrawerOpen] = useState(false)
  const [lastUserPrompt, setLastUserPrompt] = useState('')
  const [assistantContextKey, setAssistantContextKey] = useState<string>(() => getInstanceId() || 'no-instance')
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

  const assistantAgentEnabled = useMemo(() => {
    if (!caps) return true
    if (typeof caps.show_bot === 'boolean') return caps.show_bot
    if (typeof caps.assistant_agent?.enabled === 'boolean') return caps.assistant_agent.enabled
    if (typeof caps.runtime?.enabled === 'boolean') return caps.runtime.enabled
    const featureFlags = [
      caps.features?.['openclaw.ai_agent'],
      caps.features?.['ai.agent'],
      caps.features?.['ai_agent'],
    ]
    if (featureFlags.some((value) => value === true)) return true
    return caps.enabled
  }, [caps])

  const assistantAgentLogin = caps?.assistant_agent?.login || 'iadmin'
  const assistantAgentLabel = caps?.assistant_agent?.display_name || 'OpenClaw'
  const assistantIdentityLabel = `${assistantAgentLabel} / ${assistantAgentLogin}`

  const clearAssistantErrorToasts = () => {
    const store = useToastStore.getState()
    store.toasts
      .filter((toastItem) => toastItem.title === 'Assistant error')
      .forEach((toastItem) => store.remove(toastItem.id))
  }

  const describeAssistantApiError = (err: unknown) => {
    const apiErr = toApiError(err)
    const details =
      apiErr.details && typeof apiErr.details === 'object'
        ? (apiErr.details as Record<string, unknown>)
        : null
    const suggested = String(details?.nextSuggestedAction || '')
    if (apiErr.code === 'assistant_session_invalid') {
      return {
        title: 'Assistant session มีปัญหา',
        message: 'เซสชันของผู้ช่วยบน production ไม่ตรงกับ runtime ตอนนี้ ลองเริ่มเซสชันใหม่อีกครั้งได้เลย',
        followUp:
          suggested === 'restart_session'
            ? 'ขั้นต่อไป: ปิดหน้าต่างผู้ช่วยแล้วเปิดใหม่ จากนั้นลองคำสั่งเดิมอีกครั้ง'
            : 'ขั้นต่อไป: ลองเริ่มเซสชันใหม่ หรือให้ผู้ดูแลตรวจ runtime ของ OpenClaw/assistant',
      }
    }
    if (apiErr.code === 'openclaw_session_missing') {
      return {
        title: 'OpenClaw ยังไม่พร้อม',
        message: 'คำสั่งนี้ต้องใช้ OpenClaw session ที่ผูกกับผู้ใช้ก่อน จึงจะทำงานต่อได้',
        followUp: 'ขั้นต่อไป: ลองใหม่อีกครั้ง ถ้ายังไม่ผ่านให้ผู้ดูแลตรวจ binding ของ OpenClaw session',
      }
    }
    if (apiErr.code === 'access_denied') {
      return {
        title: 'สิทธิ์ไม่เพียงพอ',
        message: 'คำสั่งนี้ถูกปฏิเสธตามสิทธิ์ของผู้ใช้ปัจจุบัน',
        followUp: 'ขั้นต่อไป: ใช้บัญชีที่มีสิทธิ์มากขึ้นหรือให้ผู้ดูแลช่วยตรวจ policy',
      }
    }
    if (apiErr.code === 'validation_error') {
      return {
        title: 'ข้อมูลยังไม่ครบ',
        message: apiErr.message,
        followUp: 'ขั้นต่อไป: ตรวจคำสั่งหรือข้อมูลอ้างอิง แล้วลองใหม่อีกครั้ง',
      }
    }
    return {
      title: 'Assistant error',
      message: apiErr.message,
      followUp: 'ขั้นต่อไป: ลองใหม่อีกครั้ง หากยังเกิดซ้ำให้ส่งข้อความนี้ให้ผู้ดูแลตรวจสอบ',
    }
  }

  const GENERIC_SEARCH_QUERY = new Set([
    'active',
    'inactive',
    'all',
    'open',
    'closed',
    'close',
    'yes',
    'no',
    'true',
    'false',
    'ใช้งาน',
    'ปิด',
    'เปิด',
    'ปิดใช้งาน',
    'ทั้งหมด',
    'ค้นหา',
    'search',
    'find',
    'สินค้า',
    'ลูกค้า',
    'customer',
    'company',
    'product',
    'item',
    'invoice',
    'quotation',
    'quote',
    'report',
    'รายงาน',
  ])

  const isGenericAssistantQuery = (value: string) => {
    const text = String(value || '').trim().toLowerCase()
    if (!text) return true
    if (text.length <= 2) return true
    return GENERIC_SEARCH_QUERY.has(text)
  }

  const refreshCapabilities = async () => {
    try {
        const data = await getAssistantCapabilities(assistantLang)
        setCaps(data)
        if (data.show_bot) {
          clearAssistantErrorToasts()
        }
        return data
      } catch {
      // Keep the current capabilities snapshot if the refresh fails.
      return null
    }
  }

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
          // Keep assistant visible in degraded mode when capabilities endpoint fails.
          setCaps({
          enabled: false,
          show_bot: true,
          mode: 'plan_only',
          features: {},
          assistant_agent: { enabled: false, login: 'iadmin', display_name: 'OpenClaw' },
          permissions: {},
          tools: [],
          reports: [],
        })
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
    if (!open) return
    void refreshCapabilities()
  }, [open, assistantLang])

  useEffect(() => {
    const eventName = getAssistantLanguageEventName()
    const onLangChange = () => setAssistantLang(getAssistantLanguage())
    window.addEventListener(eventName, onLangChange as EventListener)
    return () => window.removeEventListener(eventName, onLangChange as EventListener)
  }, [])

  useEffect(() => {
    const readKey = () => getInstanceId() || 'no-instance'
    const maybeReset = () => {
      const next = readKey()
      setAssistantContextKey((prev) => {
        if (prev === next) return prev
        setHistory([])
        setLastChat(null)
        setPendingApprovalIds([])
        setPendingRunIds([])
        setResultCards([])
        setPendingConfirm(null)
        setTraceMeta({ warnings: [], sources: [] })
        setTraceDrawerOpen(false)
        if (open) {
          setHistory([{ role: 'assistant', text: 'Context reset เนื่องจากเปลี่ยนบริษัท/instance' }])
        }
        return next
      })
    }
    maybeReset()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'qf18_instance_public_id') maybeReset()
    }
    const timer = window.setInterval(maybeReset, 2000)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.clearInterval(timer)
    }
  }, [open, location.pathname])

  const reportRouteSet = useMemo(() => new Set((caps?.reports || []).map((r) => r.route)), [caps?.reports])
  const perms = caps?.permissions || {}
  const previewPlan = lastChat?.plan || []
  const showDebugBlocks = false
  const showTechnicalBlocks = showDebugBlocks
  const approvalGroups = useMemo(() => {
    if (!pendingApprovalIds.length) return [] as Array<{ key: string; label: string; count: number }>
    const byId = new Map(
      (traceMeta.toolProposals || [])
        .filter((p) => p?.id)
        .map((p) => [String(p.id), p]),
    )
    const counts = new Map<string, number>()
    const classify = (tool?: string, category?: string) => {
      const t = String(tool || '').toLowerCase()
      const c = String(category || '').toLowerCase()
      if (t.includes('payment')) return ['payment', 'Payment']
      if (c === 'write_posting' || t.startsWith('post_')) return ['posting', 'Posting']
      if (c === 'write_draft' || t.includes('create_') || t.includes('_draft')) return ['draft', 'Draft create']
      if (t.includes('confirm') || t.includes('validate') || t.includes('deliver') || t.includes('receive')) {
        return ['status', 'Status change']
      }
      if (c === 'ui') return ['ui', 'UI action']
      return ['other', 'Other']
    }
    pendingApprovalIds.forEach((id) => {
      const p = byId.get(id)
      const [key] = classify(p?.tool, p?.category)
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const labelByKey: Record<string, string> = {
      draft: 'Draft create',
      status: 'Status change',
      payment: 'Payment',
      posting: 'Posting',
      ui: 'UI action',
      other: 'Other',
    }
    const order = ['draft', 'status', 'payment', 'posting', 'ui', 'other']
    return order
      .filter((k) => (counts.get(k) || 0) > 0)
      .map((k) => ({ key: k, label: labelByKey[k] || k, count: counts.get(k) || 0 }))
  }, [pendingApprovalIds, traceMeta.toolProposals])

  const parseTokenUsage = (usage: unknown): { prompt: number; completion: number; total: number; model?: string } | null => {
    if (!usage || typeof usage !== 'object') return null
    const u = usage as AssistantTokenUsage

    const prompt = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0
    const completion = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0
    const totalRaw = Number(u.total_tokens ?? 0) || 0
    const total = totalRaw || (prompt + completion)

    if (prompt <= 0 && completion <= 0 && total <= 0) return null
    return {
      prompt,
      completion,
      total,
      model: typeof u.model === 'string' ? u.model : undefined,
    }
  }

  const recordUsage = (stage: 'chat' | 'execute' | 'confirm', usage: unknown) => {
    const parsed = parseTokenUsage(usage)
    if (!parsed) return

    setUsageSummary((prev) => ({
      prompt: prev.prompt + parsed.prompt,
      completion: prev.completion + parsed.completion,
      total: prev.total + parsed.total,
      calls: prev.calls + 1,
      lastModel: parsed.model || prev.lastModel,
    }))

    if (showTechnicalBlocks) {
      const logLine = `[AI usage:${stage}] prompt=${parsed.prompt}, completion=${parsed.completion}, total=${parsed.total}${parsed.model ? `, model=${parsed.model}` : ''}`
      console.info(logLine)
      setHistory((prev) => [...prev, { role: 'assistant', text: `Token usage (${stage}): in ${parsed.prompt}, out ${parsed.completion}, total ${parsed.total}` }])
    }
  }

  const normalizeAssistantRoute = (rawRoute: unknown, payload?: Record<string, unknown>): string => {
    const direct = String(rawRoute || '').trim()

    const reportKey = String(payload?.report_key || payload?.key || '').trim().toLowerCase()
    if (reportKey && REPORT_ROUTE_BY_KEY[reportKey]) return REPORT_ROUTE_BY_KEY[reportKey]

    const title = String(payload?.title || payload?.label || payload?.report || '').toLowerCase()
    if (title.includes('profit') && title.includes('loss')) return '/accounting/reports/profit-loss'
    if (title.includes('balance') && title.includes('sheet')) return '/accounting/reports/balance-sheet'
    if (title.includes('trial') && title.includes('balance')) return '/accounting/reports/trial-balance'
    if (title.includes('partner') && title.includes('ledger')) return '/accounting/reports/partner-ledger'

    if (direct.startsWith('/web#') || direct.startsWith('/web?#')) {
      const lower = direct.toLowerCase()
      if (lower.includes('profit') && lower.includes('loss')) return '/accounting/reports/profit-loss'
      if (lower.includes('balance') && lower.includes('sheet')) return '/accounting/reports/balance-sheet'
      if (lower.includes('trial') && lower.includes('balance')) return '/accounting/reports/trial-balance'
      if (lower.includes('partner') && lower.includes('ledger')) return '/accounting/reports/partner-ledger'
    }
    if (direct.startsWith('/')) return direct

    if (!direct) return ''
    try {
      const u = new URL(direct)
      if (u.pathname.startsWith('/accounting/reports')) return `${u.pathname}${u.search}`
    } catch {
      // not an absolute URL
    }
    return direct
  }

  const prettyAssistantRouteLabel = (route: string, fallback = 'Source') => {
    const raw = String(route || '').trim()
    if (!raw) return fallback
    try {
      const parsed = new URL(raw, 'http://assistant.local')
      const path = parsed.pathname || raw
      const q = parsed.searchParams.get('q')
      if (q && !isGenericAssistantQuery(decodeURIComponent(q))) {
        const decoded = decodeURIComponent(q)
        if (path.startsWith('/customers')) return `ค้นหาลูกค้า: ${decoded}`
        if (path.startsWith('/products')) return `ค้นหาสินค้า: ${decoded}`
        return `${path}?q=${decoded}`
      }
      return path.startsWith('/') ? path : raw
    } catch {
      return raw.startsWith('/') ? raw : fallback
    }
  }

  const prettyAssistantRouteNote = (route: string) => {
    const raw = String(route || '').trim()
    if (!raw) return ''
    try {
      const parsed = new URL(raw, 'http://assistant.local')
      const path = parsed.pathname || raw
      const q = parsed.searchParams.get('q')
      if (q && !isGenericAssistantQuery(decodeURIComponent(q))) {
        const decoded = decodeURIComponent(q)
        if (path.startsWith('/customers')) return `ค้นหาลูกค้า: ${decoded}`
        if (path.startsWith('/products')) return `ค้นหาสินค้า: ${decoded}`
        return `${path}?q=${decoded}`
      }
      return path
    } catch {
      return raw
    }
  }

  const safeNavigate = (route: string) => {
    if (!route) return
    if (
      reportRouteSet.has(route) ||
      route.startsWith('/customers') ||
      route.startsWith('/products') ||
      route.startsWith('/sales/') ||
      route.startsWith('/purchases/') ||
      route.startsWith('/accounting/etax') ||
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
    if (model === 'adt.etax.document') return `/accounting/etax?documentId=${id}`
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

  const isHelpOnlyPlan = (res: AssistantChatResponse): boolean => {
    const plan = Array.isArray(res.plan) ? res.plan : []
    if (!plan.length) return false
    const allHelp = plan.every((p) => String(p.tool || '').toLowerCase() === 'get_help')
    return allHelp
  }

  const appendResultCards = (nextCards: AssistantResultCard[]) => {
    if (!nextCards.length) return
    setResultCards((prev) => [...nextCards, ...prev].slice(0, 5))
  }

  const appendClarificationCard = (message: string, options: Array<{ label: string; query: string }>) => {
    appendResultCards([
      {
        id: `clarify-${Date.now()}`,
        title: 'เลือกโฟกัสก่อน',
        summary: message,
        explain: 'Assistant เห็นว่าคำสั่งนี้ผสมหลาย intent ในประโยคเดียว เลือก focus ก่อนเพื่อให้ context ชัด',
        rows: [],
        sources: [],
        actions: options.map((option, idx) => ({
          label: option.label,
          query: option.query,
          tone: idx === 0 ? 'primary' : 'light',
        })),
      },
    ])
  }

  useEffect(() => {
    if (!open || history.length > 0) return
    const pageContext = readAssistantPageContext()
    if (!pageContext) return
    if (!['invoice_detail', 'etax_dashboard'].includes(pageContext.page_kind)) return
    const prompts =
      pageContext.page_kind === 'invoice_detail'
        ? [
            { label: 'เช็กสถานะ e-Tax ใบนี้', query: 'เช็กสถานะ e-Tax ใบนี้' },
            { label: 'เตรียมส่ง e-Tax', query: 'เตรียมส่ง e-Tax' },
            { label: 'ส่ง e-Tax', query: 'ส่ง e-Tax' },
            { label: 'ส่งอีเมล e-Tax อีกครั้ง', query: 'ส่งอีเมล e-Tax อีกครั้ง' },
          ]
        : [
            { label: 'มี e-Tax ไหนผิดพลาดบ้าง', query: 'มี e-Tax ไหนผิดพลาดบ้าง' },
            { label: 'เช็กสถานะเอกสารที่เลือก', query: 'เช็กสถานะ e-Tax ของเอกสารที่เลือก' },
            { label: 'Poll สถานะ e-Tax', query: 'poll e-Tax' },
            { label: 'อธิบาย error ของเอกสารนี้', query: 'อธิบาย error ของเอกสารนี้' },
          ]
    appendResultCards([
      {
        id: `etax-quick-${Date.now()}`,
        title: 'e-Tax Assistant',
        summary: 'พร้อมช่วยดูสถานะ อธิบาย error และเตรียม action ผ่าน approval flow เดียวกับ backend',
        rows: [],
        sources: [],
        actions: prompts.map((item, index) => ({
          label: item.label,
          query: item.query,
          tone: index === 0 ? 'primary' : 'light',
        })),
      },
    ])
  }, [open, history.length])

  const updateTraceMeta = (res: Partial<AssistantChatResponse & AssistantExecuteResponse>) => {
    const sources = Array.isArray((res as any)?.sources)
      ? ((res as any).sources as any[])
          .map((src) => ({
            label: String(src?.label || src?.title || src?.route || 'Source'),
            route: src?.route ? String(src.route) : undefined,
          }))
          .filter((src) => !!src.label)
      : []
    setTraceMeta({
      mode: typeof (res as any)?.mode === 'string' ? String((res as any).mode) : undefined,
      traceId: typeof (res as any)?.trace_id === 'string' ? String((res as any).trace_id) : undefined,
      warnings: Array.isArray((res as any)?.warnings) ? ((res as any).warnings as unknown[]).map(String) : [],
      sources: dedupeSources(sources.filter((s) => !!s.label)),
      safety:
        (res as any)?.safety && typeof (res as any).safety === 'object'
          ? ((res as any).safety as any)
          : undefined,
      scopeContext:
        (res as any)?.scope_context && typeof (res as any).scope_context === 'object'
          ? ((res as any).scope_context as any)
          : undefined,
      toolProposals: Array.isArray((res as any)?.tool_proposals)
        ? ((res as any).tool_proposals as any[]).map((p) => ({
            id: p?.id ? String(p.id) : undefined,
            tool: p?.tool ? String(p.tool) : undefined,
            category: p?.category ? String(p.category) : undefined,
            allowed: typeof p?.allowed === 'boolean' ? p.allowed : undefined,
            requires_approval: typeof p?.requires_approval === 'boolean' ? p.requires_approval : undefined,
            auto_safe: typeof p?.auto_safe === 'boolean' ? p.auto_safe : undefined,
            policy: p?.policy && typeof p.policy === 'object' ? { deny_reason: (p.policy as any).deny_reason || false } : undefined,
          }))
        : [],
    })
  }

  const clearAssistantContext = (message?: string) => {
    setHistory(message ? [{ role: 'assistant', text: message }] : [])
    setLastChat(null)
    setPendingApprovalIds([])
    setPendingRunIds([])
    setPendingConfirm(null)
    setResultCards([])
    setTraceMeta({ warnings: [], sources: [] })
    setTraceDrawerOpen(false)
  }

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
        const route = normalizeAssistantRoute(payload.route, payload)
        if (route) {
          safeNavigate(route)
          routeNotes.push(prettyAssistantRouteNote(route))
          sourceLinks.push({
            label: String(payload.label || payload.title || prettyAssistantRouteLabel(route)),
            route,
          })
        }
        return
      }
      if (action.type === 'OPEN_RECORD') {
        const route = normalizeAssistantRoute(payload.route, payload)
        if (route) {
          safeNavigate(route)
          routeNotes.push(prettyAssistantRouteNote(route))
          sourceLinks.push({
            label: String(payload.label || payload.title || prettyAssistantRouteLabel(route, 'Open record')),
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

  const onSend = async (overrideText?: string) => {
    const text = String(overrideText ?? input).trim()
    if (!text || loading) return
    if (!assistantAgentEnabled) {
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `OpenClaw assistant is disabled in API scope. Enable ${assistantAgentLogin} to allow execution.`,
        },
      ])
      return
    }
    setLastUserPrompt(text)
    setLoading(true)
    setHistory((prev) => [...prev, { role: 'user', text }])
    setInput('')
    const pageKind = location.pathname.startsWith('/customers')
      ? 'customers'
      : location.pathname.startsWith('/products')
        ? 'products'
        : location.pathname.startsWith('/sales/')
          ? 'sales'
          : location.pathname.startsWith('/purchases/')
            ? 'purchases'
            : location.pathname.startsWith('/accounting/')
              ? 'accounting'
              : 'other'
    const pageContext = readAssistantPageContext()
    const activePageContext = pageContext && pageContext.route === location.pathname ? pageContext : null
    try {
      const res = await sendAssistantChat(text, {
        ui: {
          route: location.pathname,
          search: location.search,
          page_kind: pageKind,
          selection: activePageContext?.selected_records || [],
          selection_count: activePageContext?.selected_count || 0,
          selection_scope: activePageContext?.selection_scope || '',
          page_context: activePageContext || undefined,
        },
        lang: assistantLang,
        language: assistantLang.startsWith('th') ? 'th' : 'en',
        reply_language: assistantLang.startsWith('th') ? 'th' : 'en',
      })
      clearAssistantErrorToasts()
      recordUsage('chat', res.usage)
      updateTraceMeta(res)
      setLastChat(res)
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: res.business_reply || res.reply || 'รับทราบ กำลังเตรียมขั้นตอนให้' },
      ])
      const isMixedClarification =
        Boolean((res as any)?.needs_clarification) &&
        !res.confirmation_request &&
        String((res as any)?.classification?.context_mode || '').toLowerCase() === 'mixed'
      if (isMixedClarification) {
        const clarificationOptions = [
          { label: 'สรุปยอดซื้อรายลูกค้า', query: 'สรุปยอดซื้อรายลูกค้า' },
          { label: 'ค้นลูกค้า', query: 'ค้นลูกค้า' },
          { label: 'ค้นสินค้า', query: 'ค้นสินค้า' },
          { label: 'สร้างใบเสนอราคา', query: 'สร้างใบเสนอราคา' },
        ]
        appendClarificationCard(
          String(res.business_reply || res.reply || 'กรุณาเลือกว่าจะให้ช่วยด้านไหนก่อน'),
          clarificationOptions,
        )
        return
      }
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
      const proposalById = new Map(
        (Array.isArray((res as any).tool_proposals) ? ((res as any).tool_proposals as any[]) : [])
          .filter((p) => p?.id)
          .map((p) => [String(p.id), p]),
      )
      const needApproveSet = new Set<string>((res.plan || []).filter((p) => p.requires_approval).map((p) => p.id))
      const runnableCandidates = (res.plan || []).filter((p) => !needApproveSet.has(p.id))
      let promotedByFrontend = 0
      runnableCandidates.forEach((step) => {
        const proposal = proposalById.get(String(step.id))
        const category = String(proposal?.category || '').toLowerCase()
        const shouldForceApprove = RISKY_APPROVAL_CATEGORIES.has(category) || isRiskyToolName(step.tool)
        if (shouldForceApprove) {
          needApproveSet.add(step.id)
          promotedByFrontend += 1
        }
      })
      const needApprove = Array.from(needApproveSet)
      const runnableSteps = (res.plan || [])
        .map((p) => p.id)
        .filter((id) => !needApproveSet.has(id))
      const helpOnly = isHelpOnlyPlan(res)
      setPendingApprovalIds(helpOnly ? [] : needApprove)
      setPendingRunIds(helpOnly ? [] : runnableSteps)
      if (promotedByFrontend > 0) {
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `ย้าย ${promotedByFrontend} ขั้นตอนเข้า approval queue เพิ่มเติม (risk guard ฝั่ง frontend)`,
          },
        ])
      }
      const responseSources = dedupeSources([
        ...(Array.isArray((res as any).sources)
          ? (res as any).sources
              .map((src: any) => ({
                label: prettyAssistantRouteLabel(String(src?.route || ''), String(src?.label || src?.title || 'Source')),
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
      if ((res as any).tool_proposals && Array.isArray((res as any).tool_proposals) && showDebugBlocks) {
        const deniedCount = ((res as any).tool_proposals as any[]).filter((p) => p?.allowed === false).length
        if (deniedCount > 0) {
          setHistory((prev) => [...prev, { role: 'assistant', text: `มี ${deniedCount} ขั้นตอนที่ถูก policy ปฏิเสธก่อน execute` }])
        }
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
      if (!helpOnly) {
        setHistory((prev) => [...prev, { role: 'assistant', text: 'พร้อมทำงานแล้ว กด "เริ่มทำงาน" ได้เลย' }])
      }
    } catch (err) {
      const info = describeAssistantApiError(err)
      toast.error(info.title, info.message)
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: info.message,
        },
        { role: 'assistant', text: info.followUp },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onRetryQuery = async () => {
    if (!lastUserPrompt || loading) return
    setInput(lastUserPrompt)
    setHistory((prev) => [...prev, { role: 'assistant', text: 'กำลังลองใหม่ (retry query)...' }])
    // queue microtask so state updates before onSend reads input
    setTimeout(() => {
      void (async () => {
        setInput(lastUserPrompt)
      })()
    }, 0)
  }

  const onRetryAnswer = async () => {
    if (!lastUserPrompt || loading) return
    setHistory((prev) => [...prev, { role: 'assistant', text: 'กำลังลองสรุปคำตอบใหม่ (retry answer)...' }])
    setInput(lastUserPrompt)
    setTimeout(() => {
      void onSend()
    }, 0)
  }

  const onApprove = async () => {
    if (!lastChat?.session_id || pendingApprovalIds.length === 0 || loading) return
    if (!assistantAgentEnabled) {
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `OpenClaw assistant is disabled in API scope. Enable ${assistantAgentLogin} to allow approval/execution.`,
        },
      ])
      return
    }
    setLoading(true)
    try {
      const res = await executeAssistantPlan(lastChat.session_id, pendingApprovalIds, lastChat.nonce)
      clearAssistantErrorToasts()
      recordUsage('execute', res.usage)
      updateTraceMeta(res)
      setPendingApprovalIds([])
      if (res.business_reply) {
        setHistory((prev) => [...prev, { role: 'assistant', text: res.business_reply as string }])
      }
      const denied = (res.results || []).filter((r) => r.status === 'denied')
      const errors = (res.results || []).filter((r) => r.status === 'error')
      const failReasons = (res.results || [])
        .filter((r) => r.status === 'denied' || r.status === 'error')
        .map((r) => `${r.tool}: ${r.error || r.status}`)
      if (denied.length > 0 || errors.length > 0) {
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'บางขั้นตอนถูกจำกัดสิทธิ์หรือผิดพลาด กรุณาตรวจสอบสิทธิ์ก่อนดำเนินการต่อ',
          },
        ])
        if (failReasons.length > 0) {
          setHistory((prev) => [...prev, { role: 'assistant', text: `สาเหตุ: ${failReasons.join(' | ')}` }])
        }
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
      const traceSources = dedupeSources([
        ...(res.sources || [])
          .map((s: any) => ({
            label: prettyAssistantRouteLabel(String(s?.route || ''), String(s?.label || 'Source')),
            route: s?.route ? String(s.route) : '',
          }))
          .filter((s) => !!s.route),
      ])
      const cardSources = dedupeSources([...mergedSources, ...traceSources])
      appendResultCards([
        {
          id: `approve-${Date.now()}`,
          title: 'ผลการอนุมัติและดำเนินการ',
          summary: `ดำเนินการแล้ว ${(res.results || []).length} ขั้นตอน`,
          rows: (res.results || []).map((r) => ({
            label: r.tool,
            value:
              r.status === 'success'
                ? 'สำเร็จ'
                : `${r.status}${r.error ? `: ${r.error}` : ''}`,
          })),
          sources: cardSources,
        },
      ])
    } catch (err) {
      const info = describeAssistantApiError(err)
      toast.error(info.title, info.message)
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: `ไม่สามารถยืนยันขั้นตอนนี้ได้: ${info.message}` },
        { role: 'assistant', text: info.followUp },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onRunWorkflow = async () => {
    if (!lastChat?.session_id || pendingRunIds.length === 0 || loading) return
    if (!assistantAgentEnabled) {
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `OpenClaw assistant is disabled in API scope. Enable ${assistantAgentLogin} to allow workflow execution.`,
        },
      ])
      return
    }
    const proposalById = new Map(
      (traceMeta.toolProposals || [])
        .filter((p) => p?.id)
        .map((p) => [String(p.id), p]),
    )
    const riskyPending = pendingRunIds.filter((id) => {
      const p = proposalById.get(String(id))
      return RISKY_APPROVAL_CATEGORIES.has(String(p?.category || '').toLowerCase()) || isRiskyToolName(p?.tool)
    })
    if (riskyPending.length > 0) {
      setPendingRunIds((prev) => prev.filter((id) => !riskyPending.includes(id)))
      setPendingApprovalIds((prev) => Array.from(new Set([...prev, ...riskyPending])))
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `บล็อกการรันอัตโนมัติ ${riskyPending.length} ขั้นตอน และย้ายไปคิว approval`,
        },
      ])
      return
    }
    setLoading(true)
    try {
      const res = await executeAssistantPlan(lastChat.session_id, pendingRunIds, lastChat.nonce)
      clearAssistantErrorToasts()
      recordUsage('execute', res.usage)
      updateTraceMeta(res)
      setPendingRunIds([])
      if (res.business_reply) {
        setHistory((prev) => [...prev, { role: 'assistant', text: res.business_reply as string }])
      }
      const actionSources = applyUiActions(res.ui_actions || [])
      const denied = (res.results || []).filter((r) => r.status === 'denied')
      const errors = (res.results || []).filter((r) => r.status === 'error')
      const failReasons = (res.results || [])
        .filter((r) => r.status === 'denied' || r.status === 'error')
        .map((r) => `${r.tool}: ${r.error || r.status}`)
      const created = (res.records || []).map((r) => `${r.model}#${r.id}${r.name ? ` (${r.name})` : ''}`)
      const recordSources = (res.records || [])
        .map((r) => ({
          label: r.name || `${r.model} #${r.id}`,
          route: mapRecordRoute(r.model, r.id),
        }))
        .filter((x) => !!x.route)
      const mergedSources = dedupeSources([...(actionSources || []), ...recordSources])
      const traceSources = dedupeSources([
        ...(res.sources || [])
          .map((s: any) => ({
            label: prettyAssistantRouteLabel(String(s?.route || ''), String(s?.label || 'Source')),
            route: s?.route ? String(s.route) : '',
          }))
          .filter((s) => !!s.route),
      ])
      const cardSources = dedupeSources([...mergedSources, ...traceSources])
      if (denied.length > 0 || errors.length > 0) {
        setHistory((prev) => [...prev, { role: 'assistant', text: 'ทำงานบางส่วนสำเร็จ แต่มีบางขั้นตอนติดข้อจำกัด' }])
        if (failReasons.length > 0) {
          setHistory((prev) => [...prev, { role: 'assistant', text: `สาเหตุ: ${failReasons.join(' | ')}` }])
        }
      } else {
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: created.length > 0 ? `ทำงานสำเร็จ ${created.length} รายการ` : 'ทำงานสำเร็จ',
          },
        ])
      }
      appendResultCards([
        {
          id: `run-${Date.now()}`,
          title: 'ผลการทำงาน Workflow',
          summary: created.length > 0 ? `สร้าง/อัปเดต ${created.length} รายการ` : 'ดำเนินการเสร็จแล้ว',
          rows: (res.results || []).map((r) => ({
            label: r.tool,
            value:
              r.status === 'success'
                ? 'สำเร็จ'
                : `${r.status}${r.error ? `: ${r.error}` : ''}`,
          })),
          sources: cardSources,
        },
      ])
    } catch (err) {
      const info = describeAssistantApiError(err)
      toast.error(info.title, info.message)
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: `ไม่สามารถเริ่มทำงานได้: ${info.message}` },
        { role: 'assistant', text: info.followUp },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onConfirmDocument = async (confirmed: boolean) => {
    if (!pendingConfirm || loading) return
    if (!assistantAgentEnabled) {
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `OpenClaw assistant is disabled in API scope. Enable ${assistantAgentLogin} to allow confirmation.`,
        },
      ])
      return
    }
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
      clearAssistantErrorToasts()
      recordUsage('confirm', res.usage)
      updateTraceMeta(res)
      setPendingConfirm(null)
      if (res.business_reply || res.reply) {
        setHistory((prev) => [...prev, { role: 'assistant', text: String(res.business_reply || res.reply) }])
      }
      const actionSources = applyUiActions(res.ui_actions || [])
      const traceSources = dedupeSources([
        ...(res.sources || [])
          .map((s: any) => ({
            label: prettyAssistantRouteLabel(String(s?.route || ''), String(s?.label || 'Source')),
            route: s?.route ? String(s.route) : '',
          }))
          .filter((s) => !!s.route),
      ])
      const mergedSources = dedupeSources([...(actionSources || []), ...traceSources])
      if (mergedSources.length > 0) {
        appendResultCards([
          {
            id: `confirm-${Date.now()}`,
            title: 'ผลการยืนยันเอกสาร',
            summary: confirmed ? 'ยืนยันและดำเนินการแล้ว' : 'ยกเลิกการดำเนินการ',
            rows: [],
            sources: mergedSources,
          },
        ])
      }
    } catch (err) {
      const info = describeAssistantApiError(err)
      toast.error(info.title, info.message)
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: `ไม่สามารถยืนยันรายการได้: ${info.message}` },
        { role: 'assistant', text: info.followUp },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (caps && !caps.show_bot) return null

  return (
    <div className="avatar-assistant-root">
      {open ? (
        <div className="avatar-assistant-panel card shadow">
          <div className="card-header d-flex align-items-center justify-content-between">
            <div className="avatar-assistant-header-copy">
              <strong>{assistantAgentLabel} Assistant</strong>
              <div className="avatar-assistant-header-subtitle">
                Backend agent: {assistantIdentityLabel}
                {assistantAgentEnabled ? (
                  <span className="avatar-assistant-status avatar-assistant-status-on">active</span>
                ) : (
                  <span className="avatar-assistant-status avatar-assistant-status-off">disabled</span>
                )}
              </div>
            </div>
            <button type="button" className="btn btn-sm btn-light" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="card-body">
            {!assistantAgentEnabled ? (
              <div className="alert alert-warning py-2 px-3 small mb-2">
                Assistant execution is disabled in API scope for <strong>{assistantAgentLogin}</strong>.
              </div>
            ) : null}
            <div className="small text-muted mb-2">
              Context: company {traceMeta.scopeContext?.company_id || caps?.session?.company_id || '-'} · db{' '}
              {traceMeta.scopeContext?.db || '-'}
            </div>
            <div className="avatar-assistant-quick mb-2">
              <button type="button" className="btn btn-sm btn-light" disabled={loading || !assistantAgentEnabled} onClick={() => setInput('ค้นลูกค้า')}>
                ค้นลูกค้า
              </button>
              <button type="button" className="btn btn-sm btn-light" disabled={loading || !assistantAgentEnabled} onClick={() => setInput('ค้นสินค้า')}>
                ค้นสินค้า
              </button>
              <button
                type="button"
                className="btn btn-sm btn-light"
                disabled={loading || !assistantAgentEnabled}
                onClick={() => setInput('สรุปยอดซื้อรายลูกค้า เดือนนี้')}
              >
                สรุปยอดซื้อรายลูกค้า
              </button>
              <button
                type="button"
                className="btn btn-sm btn-light"
                disabled={loading || !assistantAgentEnabled}
                onClick={() => setInput('สรุปยอดขายสินค้าประจำเดือนนี้')}
              >
                สรุปยอดขายสินค้า
              </button>
            </div>
            <div className="avatar-assistant-history mb-2">
              {history.length === 0 ? (
                <div className="text-muted small">
                  คุยกับ {assistantIdentityLabel} เพื่อค้นข้อมูล, สรุปรายงาน หรือสั่งงานเอกสาร พร้อมลิงก์ไปยังข้อมูลต้นทาง
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
                                  type="button"
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
                      {card.actions && card.actions.length > 0 && (
                        <div className="avatar-result-actions mt-2 d-flex flex-wrap gap-2">
                          {card.actions.map((action, idx) => (
                            <button
                              type="button"
                              key={`${card.id}-action-${idx}`}
                              className={`btn btn-sm ${
                                action.tone === 'primary'
                                  ? 'btn-primary'
                                  : action.tone === 'secondary'
                                    ? 'btn-secondary'
                                    : 'btn-outline-secondary'
                              }`}
                              disabled={loading}
                              onClick={() => void onSend(action.query)}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {card.sources.length > 0 && (
                        <div className="avatar-result-sources mt-1">
                          {card.sources.map((src, idx) => (
                            <button
                              type="button"
                              key={`${card.id}-src-${idx}`}
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => src.route && safeNavigate(src.route)}
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
            {showTechnicalBlocks && (
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
            {showTechnicalBlocks && usageSummary.calls > 0 && (
              <div className="small text-muted mb-2">
                Token usage: in {usageSummary.prompt.toLocaleString('en-US')} / out {usageSummary.completion.toLocaleString('en-US')} / total {usageSummary.total.toLocaleString('en-US')}
                {usageSummary.lastModel ? ` (model: ${usageSummary.lastModel})` : ''}
              </div>
            )}
            {showTechnicalBlocks && (traceMeta.mode || traceMeta.traceId || traceMeta.warnings.length > 0 || traceMeta.safety) && (
              <div className="avatar-preview-box mb-2">
                <div className="avatar-preview-title">AI Runtime</div>
                <div className="small text-muted">
                  Mode: {traceMeta.mode || 'unknown'}
                  {traceMeta.traceId ? ` • trace: ${traceMeta.traceId.slice(0, 12)}` : ''}
                  {assistantContextKey ? ` • instance ${assistantContextKey}` : ''}
                </div>
                <div className="small text-muted">
                  Backend agent: {assistantIdentityLabel}
                </div>
                {caps?.runtime?.planner_provider || caps?.runtime?.executor_provider ? (
                  <div className="small text-muted">
                    Planner: {caps.runtime?.planner_provider || 'unknown'}
                    {caps.runtime?.planner_model ? ` • model ${caps.runtime.planner_model}` : ''}
                    {' · '}
                    Executor: {caps.runtime?.executor_provider || 'unknown'}
                    {caps.runtime?.executor_login ? ` / ${caps.runtime.executor_login}` : ''}
                  </div>
                ) : null}
                {traceMeta.safety && (
                  <div className="small text-muted mt-1">
                    Safety: DB-only {traceMeta.safety.db_only_enforced ? 'on' : 'off'}
                    {typeof traceMeta.safety.company_id === 'number' ? ` • company ${traceMeta.safety.company_id}` : ''}
                    {typeof traceMeta.safety.approval_required_count === 'number'
                      ? ` • approvals ${traceMeta.safety.approval_required_count}`
                      : ''}
                  </div>
                )}
                {traceMeta.warnings.length > 0 && (
                  <div className="small text-warning mt-1">Warnings: {traceMeta.warnings.join(' | ')}</div>
                )}
                {traceMeta.sources.length > 0 && (
                  <div className="avatar-result-sources mt-2">
                    {traceMeta.sources.map((src, idx) =>
                      src.route ? (
                        <button
                          key={`trace-src-${idx}`}
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => safeNavigate(src.route || '')}
                        >
                          {src.label}
                        </button>
                      ) : (
                        <span key={`trace-src-${idx}`} className="badge text-bg-light border">
                          {src.label}
                        </span>
                      ),
                    )}
                  </div>
                )}
                <div className="d-flex flex-wrap gap-2 mt-2">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setTraceDrawerOpen((v) => !v)}
                    type="button"
                  >
                    {traceDrawerOpen ? 'ซ่อนที่มาข้อมูล/Trace' : 'ดูที่มาข้อมูล/Trace'}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => void onRetryQuery()} disabled={loading || !lastUserPrompt} type="button">
                    Retry query
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => void onRetryAnswer()} disabled={loading || !lastUserPrompt} type="button">
                    Retry answer
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => clearAssistantContext('ล้าง context assistant แล้ว')} disabled={loading} type="button">
                    ล้าง Context
                  </button>
                </div>
                {traceDrawerOpen && (
                  <div className="mt-2 p-2 border rounded bg-light-subtle">
                    <div className="small fw-semibold mb-1">Trace Details (safe)</div>
                    {traceMeta.toolProposals && traceMeta.toolProposals.length > 0 ? (
                      <div className="d-flex flex-column gap-1">
                        {traceMeta.toolProposals.map((p, idx) => (
                          <div key={`${p.id || p.tool || 't'}-${idx}`} className="small d-flex flex-wrap gap-1 align-items-center">
                            <span className="badge text-bg-light border">{p.tool || 'tool'}</span>
                            {p.category ? <span className="badge text-bg-light border">{p.category}</span> : null}
                            <span className={`badge ${p.allowed === false ? 'text-bg-danger' : 'text-bg-success'}`}>{p.allowed === false ? 'denied' : 'allowed'}</span>
                            {p.requires_approval ? <span className="badge text-bg-warning">approval</span> : null}
                            {p.auto_safe ? <span className="badge text-bg-info">auto-safe</span> : null}
                            {p.policy?.deny_reason ? <span className="text-danger">{String(p.policy.deny_reason)}</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="small text-muted">No tool proposals in latest response.</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {showTechnicalBlocks && previewPlan.length > 0 && (
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
                  <div className="small text-muted fw-semibold">ลูกค้า</div>
                  {(pendingConfirm.contact_candidates || []).length > 0 && (
                    <>
                    <select
                      className="form-select form-select-sm avatar-confirm-select"
                      value={pendingConfirm.contact_id || ''}
                      onChange={(e) => {
                        const selected = e.target.value || ''
                        const row = (pendingConfirm.contact_candidates || []).find((c) => String(c.id) === selected)
                        setPendingConfirm((prev) =>
                          prev
                            ? {
                                ...prev,
                                contact_id: row?.id || undefined,
                                contact_name: row?.name || prev.contact_name,
                              }
                            : prev,
                        )
                      }}
                      disabled={loading}
                    >
                      <option value="">เลือกลูกค้าที่จะใช้</option>
                      {(pendingConfirm.contact_candidates || [])
                        .slice(0, 25)
                        .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.vat ? `(VAT: ${c.vat})` : ''}
                        </option>
                      ))}
                    </select>
                    </>
                  )}
                  <div className="small text-muted fw-semibold">สินค้า/บริการ</div>
                  {(pendingConfirm.product_candidates || []).length > 0 && (
                    <>
                    <select
                      className="form-select form-select-sm avatar-confirm-select"
                      value={pendingConfirm.product_id || ''}
                      onChange={(e) => {
                        const selected = e.target.value || ''
                        const row = (pendingConfirm.product_candidates || []).find((c) => String(c.id) === selected)
                        setPendingConfirm((prev) =>
                          prev
                            ? {
                                ...prev,
                                product_id: row?.id || undefined,
                                product_name: row?.name || prev.product_name,
                              }
                            : prev,
                        )
                      }}
                      disabled={loading}
                    >
                      <option value="">เลือกสินค้า/บริการที่จะใช้</option>
                      {(pendingConfirm.product_candidates || [])
                        .slice(0, 25)
                        .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.code ? `[${p.code}]` : ''} {p.barcode ? `(BC: ${p.barcode})` : ''}
                        </option>
                      ))}
                    </select>
                    </>
                  )}
                  {(pendingConfirm.contact_candidates || []).length === 0 ? (
                    <div className="small text-muted border rounded px-2 py-1 bg-light">{pendingConfirm.contact_name || '-'}</div>
                  ) : null}
                  {(pendingConfirm.product_candidates || []).length === 0 ? (
                    <div className="small text-muted border rounded px-2 py-1 bg-light">{pendingConfirm.product_name || '-'}</div>
                  ) : null}
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
                      type="button"
                      className="btn btn-success btn-sm"
                      disabled={loading}
                      onClick={() => void onConfirmDocument(true)}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
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
                disabled={loading || !assistantAgentEnabled}
              />
              <button type="button" className="btn btn-primary" onClick={() => void onSend()} disabled={loading || !assistantAgentEnabled}>
                ส่ง
              </button>
            </div>
            {!pendingConfirm && pendingApprovalIds.length > 0 && (
              <div className="mt-2">
                {approvalGroups.length > 0 && (
                  <div className="small text-muted mb-1 d-flex flex-wrap gap-1">
                    <span>Approval queue:</span>
                    {approvalGroups.map((g) => (
                      <span key={g.key} className="badge text-bg-light border">
                        {g.label}: {g.count}
                      </span>
                    ))}
                  </div>
                )}
                <button type="button" className="btn btn-warning btn-sm" onClick={() => void onApprove()} disabled={loading || !assistantAgentEnabled}>
                  ยืนยันก่อนทำงาน ({pendingApprovalIds.length})
                </button>
              </div>
            )}
            {!pendingConfirm && pendingRunIds.length > 0 && (
              <div className="mt-2">
                <button type="button" className="btn btn-success btn-sm" onClick={() => void onRunWorkflow()} disabled={loading || !assistantAgentEnabled}>
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
        title={`${assistantIdentityLabel} Assistant`}
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
