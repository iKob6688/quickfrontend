import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Alert, Form } from 'react-bootstrap'
import { ApiError } from '@/api/response'
import { extractFieldErrors, useFormErrors } from '@/lib/formErrors'
import { toast } from '@/lib/toastStore'
import {
  createPartner,
  getPartner,
  updatePartner,
  type PartnerCompanyType,
  type PartnerUpsertPayload,
} from '@/api/services/partners.service'
import { CountrySelector } from '@/features/customers/CountrySelector'

export function CustomerFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams()

  const isEdit = Boolean(params.id)
  const id = useMemo(() => (params.id ? Number(params.id) : undefined), [params.id])

  const { globalError, fieldErrors, setGlobalError, setFieldErrors, clearErrors } =
    useFormErrors()

  const existingQuery = useQuery({
    queryKey: ['partner', id],
    enabled: isEdit && typeof id === 'number' && id > 0,
    queryFn: () => getPartner(id!),
    staleTime: 30_000,
  })

  const [formData, setFormData] = useState<PartnerUpsertPayload>({
    company_type: 'company',
    name: '',
    vat: '',
    email: '',
    phone: '',
    mobile: '',
    active: true,
    street: '',
    street2: '',
    city: '',
    zip: '',
    countryId: null,
  })

  useEffect(() => {
    if (existingQuery.data) {
      setFormData({
        company_type: existingQuery.data.companyType,
        name: existingQuery.data.name || '',
        vat: existingQuery.data.vat || existingQuery.data.taxId || '',
        email: existingQuery.data.email || '',
        phone: existingQuery.data.phone || '',
        mobile: existingQuery.data.mobile || '',
        active: existingQuery.data.active,
        street: existingQuery.data.street || '',
        street2: existingQuery.data.street2 || '',
        city: existingQuery.data.city || '',
        zip: existingQuery.data.zip || '',
        countryId: existingQuery.data.countryId ?? null,
      })
    }
  }, [existingQuery.data])

  const upsertMutation = useMutation({
    mutationFn: async (payload: PartnerUpsertPayload) => {
      if (isEdit) {
        if (!id || !Number.isFinite(id) || id <= 0) throw new Error('Invalid customer id')
        return updatePartner(id, payload)
      }
      return createPartner(payload)
    },
    onSuccess: async (partner) => {
      await queryClient.invalidateQueries({ queryKey: ['partners'] })
      await queryClient.invalidateQueries({ queryKey: ['partner', partner.id] })
      toast.success(isEdit ? 'บันทึกลูกค้าเรียบร้อย' : 'สร้างลูกค้าเรียบร้อย')
      navigate(`/customers/${partner.id}`, { replace: true })
    },
    onError: (err) => {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : 'Unknown error')
      setGlobalError(apiErr.message)
      setFieldErrors(extractFieldErrors(apiErr) ?? {})
      toast.error(apiErr.message)
    },
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    clearErrors()

    if (!formData.name.trim()) {
      setGlobalError('กรุณากรอกชื่อ')
      setFieldErrors({ name: 'ต้องระบุชื่อ' })
      return
    }

    await upsertMutation.mutateAsync({
      ...formData,
      name: formData.name.trim(),
      vat: formData.vat?.trim() || undefined,
      email: formData.email?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      mobile: formData.mobile?.trim() || undefined,
      street: formData.street?.trim() || undefined,
      street2: formData.street2?.trim() || undefined,
      city: formData.city?.trim() || undefined,
      zip: formData.zip?.trim() || undefined,
    })
  }

  const setCompanyType = (t: PartnerCompanyType) =>
    setFormData((s) => ({ ...s, company_type: t }))

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า'}
        subtitle="ข้อมูลลูกค้า (res.partner)"
        breadcrumb={`รายรับ · ลูกค้า · ${isEdit ? 'แก้ไข' : 'เพิ่ม'}`}
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate('/customers')}>
              ยกเลิก
            </Button>
            <Button size="sm" type="submit" form="customer-form" isLoading={upsertMutation.isPending}>
              บันทึก
            </Button>
          </div>
        }
      />

      {globalError ? (
        <Alert variant="danger" className="small mb-3">
          {globalError}
        </Alert>
      ) : null}

      {isEdit && existingQuery.isLoading ? (
        <div className="small text-muted">กำลังโหลดข้อมูลเดิม...</div>
      ) : null}

      {isEdit && existingQuery.isError ? (
        <Alert variant="danger" className="small">
          {existingQuery.error instanceof Error ? existingQuery.error.message : 'โหลดข้อมูลไม่สำเร็จ'}
        </Alert>
      ) : null}

      <Form id="customer-form" onSubmit={submit}>
        <div className="row g-4">
          <div className="col-lg-8">
            <Card className="p-4">
              <div className="qf-section-title mb-3">ข้อมูลลูกค้า</div>
              <div className="row g-3">
                <div className="col-md-8">
                  <Label htmlFor="name" required>
                    ชื่อลูกค้า
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((s) => ({ ...s, name: e.target.value }))}
                    error={Boolean(fieldErrors.name)}
                  />
                  {fieldErrors.name ? <div className="small text-danger mt-1">{fieldErrors.name}</div> : null}
                </div>

                <div className="col-md-4">
                  <Label htmlFor="vat">เลขผู้เสียภาษี</Label>
                  <Input
                    id="vat"
                    value={formData.vat ?? ''}
                    onChange={(e) => setFormData((s) => ({ ...s, vat: e.target.value }))}
                  />
                </div>

                <div className="col-md-4">
                  <Label htmlFor="email">อีเมล</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email ?? ''}
                    onChange={(e) => setFormData((s) => ({ ...s, email: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="phone">โทรศัพท์</Label>
                  <Input
                    id="phone"
                    value={formData.phone ?? ''}
                    onChange={(e) => setFormData((s) => ({ ...s, phone: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="mobile">มือถือ</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile ?? ''}
                    onChange={(e) => setFormData((s) => ({ ...s, mobile: e.target.value }))}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4 mt-4">
              <div className="qf-section-title mb-3">ที่อยู่</div>
              <div className="row g-3">
                <div className="col-md-6">
                  <Label htmlFor="street">ที่อยู่</Label>
                  <Input
                    id="street"
                    value={formData.street ?? ''}
                    onChange={(e) => setFormData((s) => ({ ...s, street: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <Label htmlFor="street2">ที่อยู่ (บรรทัด 2)</Label>
                  <Input
                    id="street2"
                    value={formData.street2 ?? ''}
                    onChange={(e) => setFormData((s) => ({ ...s, street2: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="city">เขต/อำเภอ</Label>
                  <Input
                    id="city"
                    value={formData.city ?? ''}
                    onChange={(e) => setFormData((s) => ({ ...s, city: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="zip">รหัสไปรษณีย์</Label>
                  <Input
                    id="zip"
                    value={formData.zip ?? ''}
                    onChange={(e) => setFormData((s) => ({ ...s, zip: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <CountrySelector
                    value={formData.countryId}
                    onChange={(value) => setFormData((s) => ({ ...s, countryId: value }))}
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className="col-lg-4">
            <Card className="p-4">
              <div className="qf-section-title mb-3">ตั้งค่า</div>
              <div className="mb-3">
                <Label required>ประเภท</Label>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.company_type === 'company' ? 'primary' : 'secondary'}
                    onClick={() => setCompanyType('company')}
                  >
                    นิติบุคคล
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.company_type === 'person' ? 'primary' : 'secondary'}
                    onClick={() => setCompanyType('person')}
                  >
                    บุคคล
                  </Button>
                </div>
              </div>

              <div>
                <Label>สถานะ</Label>
                <div className="form-check form-switch mt-1">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="active"
                    checked={Boolean(formData.active)}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, active: e.target.checked }))
                    }
                  />
                  <label className="form-check-label" htmlFor="active">
                    ใช้งาน (Active)
                  </label>
                </div>
                <div className="small text-muted mt-2">
                  Tip: ใช้ “ปิดใช้งาน” เพื่อ archive ลูกค้าใน Odoo โดยไม่ลบข้อมูล
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Form>
    </div>
  )
}


