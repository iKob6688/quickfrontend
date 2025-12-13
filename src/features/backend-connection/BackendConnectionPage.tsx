import { FormEvent, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConnectionStatusIcon } from '@/components/icons/ConnectionStatusIcon'
import { TokenIcon } from '@/components/icons/TokenIcon'
import { InlineHelp } from '@/components/ui/InlineHelp'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  registerCompany,
  type RegisterCompanyResponse,
} from '@/api/endpoints/auth'
import { toApiError } from '@/api/response'
import { useAuthStore } from '@/features/auth/store'

export function BackendConnectionPage() {
  const [companyName, setCompanyName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [provisionError, setProvisionError] = useState<string | undefined>()
  const [result, setResult] = useState<RegisterCompanyResponse | null>(null)

  const login = useAuthStore((s) => s.login)

  const handleProvision = async (e: FormEvent) => {
    e.preventDefault()
    setProvisionError(undefined)

    const masterKey = import.meta.env.VITE_REGISTER_MASTER_KEY
    if (!masterKey) {
      setProvisionError(
        'ระบบยังไม่ได้ตั้งค่า VITE_REGISTER_MASTER_KEY ใน environment ทำให้ไม่สามารถสร้างบริษัทใหม่ได้.',
      )
      return
    }

    setIsSubmitting(true)
    try {
      const created = await registerCompany({
        companyName,
        adminEmail,
      })
      setResult(created)

      // Optional: auto-login with newly created admin
      await login({
        login: created.admin_login,
        password: created.admin_password,
      })
    } catch (error) {
      const apiErr = toApiError(error)
      setProvisionError(apiErr.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="การเชื่อมต่อ Quickfront ↔ Odoo 18"
        subtitle="สร้างบริษัท + ผู้ดูแลระบบ (admin) ใหม่บน Odoo 18 และเข้าสู่ระบบ Quickfront18 อัตโนมัติ"
        breadcrumb="Settings · Backend provisioning"
      />

      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        <Card
          header={
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TokenIcon size={20} />
                <span className="text-sm font-medium text-surfaceDark">
                  สร้างบริษัทใหม่ + Admin
                </span>
              </div>
            </div>
          }
        >
          <form className="space-y-4" onSubmit={handleProvision}>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-primaryDark">
                ชื่อบริษัทใหม่
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-2xl border border-primary/25 bg-bgLight/90 px-3 py-2 text-sm text-surfaceDark outline-none ring-primary/40 placeholder:text-surfaceDark/40 focus:border-accentGold focus:bg-white focus:ring-2"
                placeholder="เช่น Quickfront Demo Co., Ltd."
              />
              <InlineHelp>
                ชื่อนี้จะถูกสร้างเป็นบริษัทใหม่ใน Odoo (res.company)
              </InlineHelp>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-primaryDark">
                  อีเมลผู้ดูแลระบบ (Admin)
                </label>
                <Tooltip content="ใช้เพื่อสร้างผู้ใช้ admin และเป็นช่องทาง reset password ในอนาคต">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-bgLight text-[12px] font-semibold text-surfaceDark/70">
                    ?
                  </span>
                </Tooltip>
              </div>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full rounded-2xl border border-primary/25 bg-bgLight/90 px-3 py-2 text-sm text-surfaceDark outline-none ring-primary/40 placeholder:text-surfaceDark/40 focus:border-accentGold focus:bg-white focus:ring-2"
                placeholder="admin@example.com"
              />
              <InlineHelp>
                ระบบจะสร้าง admin login + รหัสผ่านเริ่มต้น และพยายามเข้าสู่ระบบให้ทันที
              </InlineHelp>
            </div>

            {provisionError && (
              <p className="rounded-2xl bg-accentPink/8 px-3 py-2 text-xs text-accentPink">
                {provisionError}
              </p>
            )}

            <Button
              type="submit"
              size="md"
              className="mt-2 w-full"
              isLoading={isSubmitting}
            >
              สร้างบริษัทและเข้าสู่ระบบด้วย Admin ใหม่
            </Button>

            <p className="mt-2 text-[11px] text-surfaceDark/70">
              การเรียกใช้ endpoint นี้จะส่ง master key จาก environment ({' '}
              <code className="text-[11px]">VITE_REGISTER_MASTER_KEY</code> ) ไป
              ยัง Odoo addon <code>adt_th_api</code> เพื่อสร้างบริษัทและ user
              admin อัตโนมัติ
            </p>
          </form>
        </Card>

        <Card
          header={
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ConnectionStatusIcon status={result ? 'connected' : 'pending'} />
                <span className="text-sm font-medium text-surfaceDark">
                  ผลการสร้างบริษัท / การเชื่อมต่อ
                </span>
              </div>
            </div>
          }
        >
          {!result ? (
            <p className="text-xs text-surfaceDark/70">
              หลังจากสร้างบริษัทใหม่สำเร็จ ระบบจะแสดงข้อมูลบริษัทและ admin ที่นี่
              พร้อมพยายามเข้าสู่ระบบด้วยบัญชีใหม่อัตโนมัติ.
            </p>
          ) : (
            <div className="space-y-3 text-xs text-surfaceDark">
              <div>
                <p className="font-semibold text-primaryDark">
                  {result.company_name} (ID: {result.company_id})
                </p>
              </div>
              <div className="space-y-1 rounded-2xl bg-bgLight/80 px-3 py-2">
                <p className="text-[11px] font-semibold text-surfaceDark/80">
                  Admin login
                </p>
                <p className="text-[13px]">{result.admin_login}</p>
              </div>
              <div className="space-y-1 rounded-2xl bg-accentGold/10 px-3 py-2">
                <p className="text-[11px] font-semibold text-surfaceDark/80">
                  รหัสผ่านเริ่มต้นของ Admin
                </p>
                <p className="text-[13px]">{result.admin_password}</p>
                <p className="mt-1 text-[11px] text-surfaceDark/70">
                  กรุณาจดเก็บรหัสผ่านนี้ไว้ในที่ปลอดภัย และเปลี่ยนรหัสผ่านทันทีหลังเข้าสู่ระบบ Odoo ครั้งแรก.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

