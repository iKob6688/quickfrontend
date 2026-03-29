export type AssistantPageSelectionRecord = {
  id: number
  name: string
  model: string
  route?: string
  ref?: string
  code?: string
  barcode?: string
  vat?: string
  companyType?: string
}

export type AssistantPageContext = {
  route: string
  search: string
  page_kind: string
  q: string
  tab?: string
  filter?: string
  selected_records: AssistantPageSelectionRecord[]
  selected_count: number
  all_matching_selected?: boolean
  selection_scope?: string
  updated_at: number
}

const ASSISTANT_PAGE_CONTEXT_KEY = 'erpth.assistant.page_context'

function safeParse(value: string | null): AssistantPageContext | null {
  if (!value) return null
  try {
    return JSON.parse(value) as AssistantPageContext
  } catch {
    return null
  }
}

export function readAssistantPageContext(): AssistantPageContext | null {
  if (typeof window === 'undefined') return null
  return safeParse(window.localStorage.getItem(ASSISTANT_PAGE_CONTEXT_KEY))
}

export function writeAssistantPageContext(context: Omit<AssistantPageContext, 'updated_at'> | null) {
  if (typeof window === 'undefined') return
  if (!context) {
    window.localStorage.removeItem(ASSISTANT_PAGE_CONTEXT_KEY)
    return
  }
  window.localStorage.setItem(
    ASSISTANT_PAGE_CONTEXT_KEY,
    JSON.stringify({
      ...context,
      updated_at: Date.now(),
    }),
  )
}

