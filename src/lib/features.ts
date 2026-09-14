import { getAllowedScopes, isScopesConfigured } from '@/lib/scopes'

export type FeatureKey = 'audit' | 'audit.ai' | 'audit.sampling' | 'audit.rollForward' | 'audit.export' | 'audit.admin'

const FEATURE_SCOPES: Record<FeatureKey, readonly string[]> = {
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
  return FEATURE_SCOPES[feature].some((scope) => allowed.has(scope))
}

export function featureUnavailableMessage(feature: FeatureKey): string {
  return feature === 'audit'
    ? 'ฟีเจอร์ ERPTH Audit ไม่ได้รวมอยู่ในแพ็กเกจหรือสิทธิ์ของบริษัทปัจจุบัน'
    : 'สิทธิ์ของคุณยังไม่ครอบคลุมความสามารถ Audit นี้'
}
