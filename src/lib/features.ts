import { getAllowedScopes, isScopesConfigured } from '@/lib/scopes'

export type FeatureKey =
  | 'accounting_reports'
  | 'working_papers'
  | 'working_papers.sampling'
  | 'audit'
  | 'audit.ai'
  | 'audit.sampling'
  | 'audit.rollForward'
  | 'audit.export'
  | 'audit.admin'

const FEATURE_SCOPES: Record<FeatureKey, readonly string[]> = {
  accounting_reports: ['accounting_reports'],
  // The legacy audit scopes remain accepted during the package migration.  The
  // server profile is still the only authority for both names.
  working_papers: ['working_papers', 'working.papers', 'audit'],
  'working_papers.sampling': ['working_papers_sampling', 'working_papers.sampling', 'audit_sampling', 'audit.sampling'],
  audit: ['audit'],
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
  // A Work File links to canonical accounting reports. Do not present a package
  // combination that cannot open those report links; the backend still decides
  // every read/action request independently.
  if (feature === 'working_papers') return enabled && FEATURE_SCOPES.accounting_reports.some((scope) => allowed.has(scope))
  return enabled
}

export function featureUnavailableMessage(feature: FeatureKey): string {
  if (feature === 'accounting_reports') return 'ฟีเจอร์ Accounting Reports ไม่ได้รวมอยู่ในแพ็กเกจหรือสิทธิ์ของบริษัทปัจจุบัน'
  if (feature === 'working_papers') return 'ฟีเจอร์ Working Papers ไม่ได้รวมอยู่ในแพ็กเกจหรือสิทธิ์ของบริษัทปัจจุบัน'
  return 'สิทธิ์ของคุณยังไม่ครอบคลุมความสามารถนี้'
}
