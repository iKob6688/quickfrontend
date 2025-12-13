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

  return (
    <div className="alert alert-warning small mb-3">
      <div className="fw-semibold mb-1">ตั้งค่าการเชื่อมต่อยังไม่ครบ</div>
      <div className="mb-2">
        {missingApiKey ? '• ยังไม่มี API Key (VITE_API_KEY)\n' : null}
        {missingBaseUrl ? '• ยังไม่มี API Base URL (VITE_API_BASE_URL)\n' : null}
        {missingDb ? '• ยังไม่มี DB (VITE_ODOO_DB)\n' : null}
        {!token ? '• ยังไม่ได้ login (ไม่มี Bearer token)\n' : null}
      </div>
      <div>
        แนะนำ: รัน <code>npm run bootstrap</code> เพื่อสร้าง/อัปเดต <code>.env</code> แล้วรีสตาร์ท dev server
      </div>
    </div>
  )
}


