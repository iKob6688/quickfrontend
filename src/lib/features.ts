import { getAllowedScopes, isScopesConfigured } from '@/lib/scopes'

export type FeatureKey =
  | 'accounting_reports'
  | 'working_papers'
  | 'working_papers.sampling'
  | 'audit'
  | 'audit.create'
  | 'audit.ai'
  | 'audit.sampling'
  | 'audit.rollForward'
  | 'audit.export'
  | 'audit.admin'

const FEATURE_SCOPES: Record<FeatureKey, readonly string[]> = {
  accounting_reports: ['accounting_reports'],
  working_papers: ['working_papers'],
  'working_papers.sampling': ['working_papers_sampling', 'working_papers.sampling', 'audit_sampling', 'audit.sampling'],
  // `audit_workspace` is the currently deployed Odoo API scope. `audit` is
  // retained as the public package name for future backend compatibility.
  audit: ['audit', 'audit_workspace', 'working_papers'],
  // Engagement creation is exposed by the Audit Workspace controller, while
  // the Working Papers controller intentionally provides read/workflow APIs.
  'audit.create': ['audit_workspace'],
  'audit.ai': ['audit_ai', 'audit.ai'],
  'audit.sampling': ['audit_sampling', 'audit.sampling'],
  'audit.rollForward': ['audit_roll_forward', 'audit.roll_forward'],
  'audit.export': ['audit_export', 'audit.export'],
  'audit.admin': ['audit_admin', 'audit.admin'],
}

/** Commercial features fail closed when the backend did not advertise scopes. */
export function hasFeature(feature: FeatureKey): boolean {
  if (!isScopesConfigured()) return false
  const allowed = new Set(getAllowedScopes().map((scope) => scope.trim().toLowerCase()))
  const enabled = FEATURE_SCOPES[feature].some((scope) => allowed.has(scope))
  // A Work File links to canonical accounting reports. Do not present a Feature
  // Access combination that cannot open those report links; the backend still decides
  // every read/action request independently.
  if (feature === 'working_papers') return enabled && FEATURE_SCOPES.accounting_reports.some((scope) => allowed.has(scope))
  return enabled
}

export function featureUnavailableMessage(feature: FeatureKey): string {
  if (feature === 'accounting_reports') return 'Feature Access สำหรับ Accounting Reports ยังไม่ได้เปิดให้ผู้ใช้หรือบริษัทปัจจุบัน'
  if (feature === 'working_papers') return 'Feature Access สำหรับ Working Papers ยังไม่ได้เปิดให้ผู้ใช้หรือบริษัทปัจจุบัน'
  return 'สิทธิ์ของคุณยังไม่ครอบคลุมความสามารถนี้'
}
