import { FormEvent, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
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
    <div className="min-h-screen bg-ocean-diagonal text-surfaceDark">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="relative w-full max-w-xl">
          <div className="pointer-events-none absolute -left-20 -top-16 h-40 w-40 rounded-full bg-accentPink/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-20 h-52 w-52 rounded-full bg-accentGold/25 blur-3xl" />

          <Card className="relative w-full overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-white/70 bg-gradient-to-r from-primary/20 via-secondary/10 to-bgLight px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <BrandIcon variant="gold" size={30} />
                <div className="leading-tight">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primaryDark">
                    Quickfront18
                  </p>
                  <p className="text-[11px] text-primaryDark/80">
                    Odoo 18 Celestial Interface
                  </p>
                </div>
              </div>
              <span className="hidden rounded-2xl bg-surfaceDark px-3 py-1 text-[11px] font-medium text-bgLight shadow-soft sm:inline">
                สำหรับธุรกิจไทย · Thai SMEs
              </span>
            </div>

            <div className="px-4 py-5 sm:px-6 sm:py-7">
              <div className="flex flex-col items-center gap-3 pb-5 text-center text-surfaceDark">
                <AppLogo size="lg" />
                <div>
                  <h1 className="bg-gradient-to-r from-accentGold via-primaryDark to-accentPink bg-clip-text text-xl font-semibold text-transparent sm:text-2xl">
                    เข้าสู่ระบบ Quickfront18
                  </h1>
                  <div className="mt-1 h-0.5 w-16 rounded-full bg-gradient-to-r from-accentGold via-primary to-transparent" />
                </div>
                <p className="max-w-md text-sm text-surfaceDark/80 sm:text-base">
                  เชื่อมต่อกับ Odoo 18 เพื่อจัดการบัญชี ภาษี ใบแจ้งหนี้ และแดชบอร์ด
                  การเงินด้วยดีไซน์โทนฟ้า‑ทะเล และทองแบบ Celestial
                </p>
              </div>

              <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-primaryDark">
                    ชื่อผู้ใช้
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl border border-cardBorder bg-white px-3 py-2 text-base text-surfaceDark outline-none ring-primary/30 placeholder:text-surfaceDark/40 focus:border-primary/40 focus:ring-2"
                    placeholder="username หรืออีเมลใน Odoo"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-primaryDark">
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-cardBorder bg-white px-3 py-2 pr-20 text-base text-surfaceDark outline-none ring-primary/30 placeholder:text-surfaceDark/40 focus:border-primary/40 focus:ring-2"
                      placeholder="รหัสผ่าน Odoo 18 ของคุณ"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-2 my-1 inline-flex items-center rounded-2xl px-2 text-xs font-medium text-primaryDark/80 hover:bg-primary/10"
                    >
                      {showPassword ? 'ซ่อน' : 'แสดง'}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-2xl bg-accentPink/8 px-3 py-2 text-xs text-accentPink">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="mt-5 w-full h-11 rounded-full bg-accentGold text-surfaceDark font-semibold shadow-[0_12px_30px_rgba(251,191,36,0.55)] hover:bg-accentGold/90 hover:shadow-[0_16px_40px_rgba(251,191,36,0.6)]"
                  isLoading={isLoading}
                >
                  เข้าสู่ระบบ Quickfront18
                </Button>

                <p className="mt-2 text-[11px] text-surfaceDark/70">
                  ระบบจะเชื่อมต่อผ่าน Quickfront middleware ไปยัง Odoo 18 Community
                  โดยใช้โทเคนที่ปลอดภัยและรองรับหลายบริษัท (Instance ID)
                </p>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}


