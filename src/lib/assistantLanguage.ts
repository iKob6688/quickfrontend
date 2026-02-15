export type AssistantLanguage = 'th_TH' | 'en_US'

const ASSISTANT_LANG_KEY = 'assistant_lang'
const ASSISTANT_LANG_EVENT = 'assistant-language-change'

export function getAssistantLanguage(): AssistantLanguage {
  if (typeof window === 'undefined') return 'th_TH'
  const raw = window.localStorage.getItem(ASSISTANT_LANG_KEY)
  return raw === 'en_US' ? 'en_US' : 'th_TH'
}

export function setAssistantLanguage(lang: AssistantLanguage) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ASSISTANT_LANG_KEY, lang)
  window.dispatchEvent(new CustomEvent(ASSISTANT_LANG_EVENT, { detail: { lang } }))
}

export function getAssistantLanguageEventName() {
  return ASSISTANT_LANG_EVENT
}
