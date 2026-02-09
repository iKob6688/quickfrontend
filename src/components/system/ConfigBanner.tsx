import { getAccessToken } from '@/lib/authToken'

function hasValue(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

export function ConfigBanner() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  const apiKey = import.meta.env.VITE_API_KEY
  const db = import.meta.env.VITE_ODOO_DB
  const token = getAccessToken()

  const missingApiKey = !hasValue(apiKey)
  const missingBaseUrl = !hasValue(baseUrl)
  const missingDb = !hasValue(db)

  if (!missingApiKey && !missingBaseUrl && !missingDb) return null

  const issues: string[] = []
  if (missingApiKey) issues.push('ยังไม่มี API Key (VITE_API_KEY)')
  if (missingBaseUrl) issues.push('ยังไม่มี API Base URL (VITE_API_BASE_URL)')
  if (missingDb) issues.push('ยังไม่มี DB (VITE_ODOO_DB)')
  if (!token) issues.push('ยังไม่ได้ login (ไม่มี Bearer token)')

  return (
    <div className="alert alert-warning small mb-3">
      <div className="fw-semibold mb-1">ตั้งค่าการเชื่อมต่อยังไม่ครบ</div>
      <ul className="mb-2 ps-3">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
      <div>
        แนะนำ: รัน <code>npm run bootstrap</code> เพื่อสร้าง/อัปเดต <code>.env</code> แล้วรีสตาร์ท dev server
      </div>
    </div>
  )
}

