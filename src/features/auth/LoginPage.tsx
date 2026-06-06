import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

function toUserLoginError(raw?: string) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const lower = text.toLowerCase()
  if (lower.includes('invalid credentials') || lower.includes('unauthorized')) {
    return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่อีกครั้ง'
  }
  if (lower.includes('backend ตอบกลับเป็นหน้า html') || lower.includes('/web/session/get_session_info')) {
    return 'ระบบเชื่อมต่อเซิร์ฟเวอร์ไม่สมบูรณ์ชั่วคราว กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ'
  }
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('ไม่พบ route')) {
    return 'ไม่สามารถเชื่อมต่อระบบได้ในขณะนี้ กรุณาตรวจสอบเครือข่ายหรือแจ้งผู้ดูแลระบบ'
  }
  return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const userError = toUserLoginError(error)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    try {
      await login({ login: username, password })
      const redirectTo =
        (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(redirectTo, { replace: true })
    } catch {
      // error is stored in Zustand and rendered below
    }
  }

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center px-3"
      style={{ background: 'var(--qf-body-bg)' }}
    >
      <div className="w-100" style={{ maxWidth: 440 }}>
        <Card className="border-0 shadow-lg p-3 p-sm-4 bg-white" style={{ borderRadius: '24px' }}>
          <div className="p-3">
            <div className="text-center mb-4">
              <img
                src="/chonlatee-logo.png"
                alt="Chonlatee Innovation"
                className="mb-4"
                style={{
                  width: 'clamp(184px, 58%, 236px)',
                  height: 'auto',
                  display: 'inline-block',
                }}
              />
              <h1 className="h4 fw-bold text-dark mb-2">ยินดีต้อนรับกลับมา</h1>
              <p className="text-muted small mb-0">
                ระบบงานบัญชีออนไลน์และเอกสารสำหรับธุรกิจ SME ไทย
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <Label htmlFor="login" required className="form-label text-dark font-medium">
                  ชื่อผู้ใช้ / อีเมล
                </Label>
                <Input
                  id="login"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username หรือ อีเมล"
                />
              </div>

              <div className="mb-4">
                <Label htmlFor="password" required className="form-label text-dark font-medium">
                  รหัสผ่าน
                </Label>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่าน ของคุณ"
                  rightAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="btn btn-sm btn-link text-decoration-none py-1 px-2"
                      style={{ fontSize: '0.8rem', color: 'var(--qf-primary)' }}
                    >
                      {showPassword ? 'ซ่อน' : 'แสดง'}
                    </button>
                  }
                />
              </div>

              {userError ? (
                <div className="alert alert-danger border-0 small py-2 mb-3" style={{ whiteSpace: 'pre-line', borderRadius: '12px' }}>
                  {userError}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-100 py-3 mb-3 text-white fw-semibold"
                isLoading={isLoading}
                style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                เข้าสู่ระบบ CLT Online
              </Button>

              <div className="text-center mt-3">
                <p className="text-muted mb-0" style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                  ระบบจะเชื่อมต่อข้อมูลบริษัทของคุณอย่างปลอดภัยและเข้าสู่ Dashboard โดยตรง
                </p>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  )
}
