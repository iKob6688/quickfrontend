import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  executeAssistantPlan,
  getAssistantCapabilities,
  sendAssistantChat,
  type AssistantCapabilities,
  type AssistantChatResponse,
} from '@/api/services/ai-assistant.service'
import { toast } from '@/lib/toastStore'
import './avatar-assistant.css'

type ChatItem = {
  role: 'user' | 'assistant'
  text: string
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

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await getAssistantCapabilities()
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
  }, [])

  const reportRouteSet = useMemo(() => new Set((caps?.reports || []).map((r) => r.route)), [caps?.reports])
  const perms = caps?.permissions || {}

  const applyUiActions = (actions: Array<{ type: string; payload: Record<string, unknown> }>) => {
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
        if (route && (reportRouteSet.has(route) || route.startsWith('/customers') || route.startsWith('/sales/'))) {
          navigate(route)
        } else {
          toast.info('Assistant', `Blocked route: ${route}`)
        }
        return
      }
      if (action.type === 'OPEN_RECORD') {
        const route = String(payload.route || '')
        if (route) navigate(route)
      }
    })
  }

  const onSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setHistory((prev) => [...prev, { role: 'user', text }])
    setInput('')
    try {
      const res = await sendAssistantChat(text, {
        ui: { route: location.pathname },
      })
      setLastChat(res)
      setHistory((prev) => [...prev, { role: 'assistant', text: res.reply || 'Done.' }])
      if ((res.permission_explanations || []).length > 0) {
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `Permission explanation: ${(res.permission_explanations || []).join(' | ')}`,
          },
        ])
      }
      const needApprove = (res.plan || []).filter((p) => p.requires_approval).map((p) => p.id)
      const autoRunSteps = (res.plan || []).filter((p) => !p.requires_approval).map((p) => p.id)
      setPendingApprovalIds(needApprove)
      applyUiActions(res.ui_actions || [])

      // In approve_required mode, execute safe steps immediately and keep only restricted steps for explicit approval.
      if ((caps?.mode || 'approve_required') === 'approve_required' && autoRunSteps.length > 0) {
        const autoRes = await executeAssistantPlan(res.session_id, autoRunSteps, res.nonce)
        applyUiActions(autoRes.ui_actions || [])
        const denied = (autoRes.results || []).filter((r) => r.status === 'denied')
        const errors = (autoRes.results || []).filter((r) => r.status === 'error')
        const created = (autoRes.records || []).map((r) => `${r.model}#${r.id}${r.name ? ` (${r.name})` : ''}`)
        if (denied.length > 0 || errors.length > 0) {
          const msg = [
            ...denied.map((d) => `${d.tool}: ${d.error || 'denied'}`),
            ...errors.map((d) => `${d.tool}: ${d.error || 'error'}`),
          ].join(' | ')
          setHistory((prev) => [...prev, { role: 'assistant', text: `Auto-run restrictions: ${msg}` }])
        } else {
          setHistory((prev) => [
            ...prev,
            {
              role: 'assistant',
              text:
                created.length > 0
                  ? `Auto-run completed. Created/used: ${created.join(' | ')}`
                  : 'Auto-run completed for safe steps.',
            },
          ])
        }
      }
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${String((err as Error)?.message || err)}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onApprove = async () => {
    if (!lastChat?.session_id || pendingApprovalIds.length === 0 || loading) return
    setLoading(true)
    try {
      const res = await executeAssistantPlan(lastChat.session_id, pendingApprovalIds)
      setPendingApprovalIds([])
      const denied = (res.results || []).filter((r) => r.status === 'denied')
      const errors = (res.results || []).filter((r) => r.status === 'error')
      if (denied.length > 0 || errors.length > 0) {
        const deniedMsg = denied.map((d) => `${d.tool}: ${d.error || 'denied'}`).join(' | ')
        const errorMsg = errors.map((d) => `${d.tool}: ${d.error || 'error'}`).join(' | ')
        const permExplain = (res.permission_explanations || []).join(' | ')
        setHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `Execution finished with restrictions. ${deniedMsg} ${errorMsg} ${permExplain}`.trim(),
          },
        ])
      } else {
        setHistory((prev) => [...prev, { role: 'assistant', text: 'Approved steps executed.' }])
      }
      applyUiActions(res.ui_actions || [])
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: `Approval failed: ${String((err as Error)?.message || err)}` },
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
            <strong>Avatar AI Assistant</strong>
            <button className="btn btn-sm btn-light" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="card-body">
            <div className="avatar-assistant-history mb-2">
              {history.length === 0 ? (
                <div className="text-muted small">Ask me to create contact, product, quotation, or open reports.</div>
              ) : (
                history.map((item, idx) => (
                  <div key={`${item.role}-${idx}`} className={`avatar-assistant-msg ${item.role}`}>
                    <span>{item.text}</span>
                  </div>
                ))
              )}
            </div>
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
            <div className="d-flex gap-2">
              <input
                className="form-control"
                placeholder="Type your request..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSend()
                }}
                disabled={loading}
              />
              <button className="btn btn-primary" onClick={() => void onSend()} disabled={loading}>
                Send
              </button>
            </div>
            {pendingApprovalIds.length > 0 && (
              <div className="mt-2">
                <button className="btn btn-warning btn-sm" onClick={() => void onApprove()} disabled={loading}>
                  Approve ({pendingApprovalIds.length})
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
