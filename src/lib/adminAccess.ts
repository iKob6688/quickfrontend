import type { AuthUser } from '@/api/services/auth.service'
import { getAllowedScopes } from '@/lib/scopes'

const ADMIN_SCOPES = new Set([
  'admin',
  'auth_admin',
  'company_admin',
  'provisioning',
  'system_admin',
])

const ADMIN_GROUP_MARKERS = [
  'base.group_system',
  'administrator',
  'administration/settings',
  'settings',
  'system',
  'superuser',
]

function isTruthyFlag(value: unknown) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true'
}

function toStringTokens(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.flatMap(toStringTokens)
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return [
      ...toStringTokens(record.xmlid),
      ...toStringTokens(record.xml_id),
      ...toStringTokens(record.name),
      ...toStringTokens(record.display_name),
      ...toStringTokens(record.full_name),
    ]
  }
  return String(value)
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

export function isAdminUser(user: AuthUser | null | undefined) {
  if (!user) return false

  const raw = user as AuthUser & Record<string, unknown>
  const adminFlags = [
    raw.isAdmin,
    raw.is_admin,
    raw.isSystem,
    raw.is_system,
    raw.isSuperuser,
    raw.is_superuser,
  ]
  if (adminFlags.some(isTruthyFlag)) return true

  const roleTokens = toStringTokens([raw.role, raw.userRole, raw.user_role, raw.userType, raw.user_type])
    .map((token) => token.toLowerCase())
  if (roleTokens.some((token) => ADMIN_SCOPES.has(token) || token === 'administrator' || token === 'superuser')) {
    return true
  }

  const scopeTokens = [
    ...toStringTokens(raw.allowed_scopes),
    ...getAllowedScopes(),
  ].map((token) => token.toLowerCase())
  if (scopeTokens.some((token) => ADMIN_SCOPES.has(token) || token === '*' || token === 'all' || token === 'all_scopes')) return true

  const groupTokens = toStringTokens([
    raw.groups,
    raw.groupNames,
    raw.group_names,
    raw.groupXmlIds,
    raw.group_xmlids,
  ]).map((token) => token.toLowerCase())

  return groupTokens.some((token) =>
    ADMIN_GROUP_MARKERS.some((marker) => token === marker || token.includes(marker)),
  )
}
