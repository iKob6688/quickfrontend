import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { AppLogo } from '@/components/icons/AppLogo'
import { BrandIcon } from '@/components/icons/BrandIcon'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
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
    <div className="min-vh-100 d-flex align-items-center justify-content-center px-3 py-5">
      <div className="w-100" style={{ maxWidth: 720 }}>
        <Card className="overflow-hidden">
          {/* Header */}
          <div
            className="border-bottom px-4 py-3"
            style={{
              background:
                'linear-gradient(90deg, rgba(47,128,237,0.16) 0%, rgba(28,200,183,0.10) 55%, rgba(255,255,255,0.65) 100%)',
            }}
          >
            <div className="d-flex align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-2">
                <BrandIcon variant="gold" size={30} />
                <div style={{ lineHeight: 1.15 }}>
                  <div className="small fw-semibold text-uppercase" style={{ letterSpacing: '0.18em' }}>
                    Quickfront18
                  </div>
                  <div className="small text-muted">Odoo 18 Celestial Interface</div>
                </div>
              </div>
              <div className="d-none d-sm-inline-flex rounded-pill bg-dark text-white px-3 py-1 small">
                สำหรับธุรกิจไทย · Thai SMEs
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 p-sm-5">
            <div className="text-center mb-4">
              <div className="d-flex justify-content-center mb-2">
                <AppLogo size="lg" />
              </div>
              <h1 className="h4 fw-semibold mb-1">เข้าสู่ระบบ CLT Online</h1>
              <p className="text-muted mb-0">
                เชื่อมต่อเพื่อจัดการบัญชี ภาษี ใบแจ้งหนี้ และแดชบอร์ด
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mx-auto" style={{ maxWidth: 420 }}>
              <div className="mb-3">
                <Label htmlFor="login" required>
                  ชื่อผู้ใช้
                </Label>
                <Input
                  id="login"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username หรืออีเมลใน Odoo"
                />
              </div>

              <div className="mb-3">
                <Label htmlFor="password" required>
                  รหัสผ่าน
                </Label>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่าน Odoo 18 ของคุณ"
                  rightAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="btn btn-sm btn-outline-secondary"
                      style={{ borderRadius: 999 }}
                    >
                      {showPassword ? 'ซ่อน' : 'แสดง'}
                    </button>
                  }
                />
              </div>

              {error ? (
                <div className="alert alert-danger small py-2 mb-3">{error}</div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-100"
                isLoading={isLoading}
              >
                เข้าสู่ระบบ CLT Online
              </Button>

              <p className="text-muted small mt-3 mb-0">
                ระบบจะเชื่อมต่อผ่าน CLT middleware ไปยัง ODOO Backend โดยใช้โทเคนที่ปลอดภัยและรองรับหลายบริษัท (Instance ID)
              </p>
            </form>
          </div>
        </Card>
      </div>
    </div>
  )
}


