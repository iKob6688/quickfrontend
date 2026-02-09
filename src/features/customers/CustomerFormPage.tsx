import { useMemo, useState, type FormEvent } from 'react'
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

const DEFAULT_FORM_DATA: PartnerUpsertPayload = {
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
}

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

  const [draftOverrides, setDraftOverrides] = useState<Partial<PartnerUpsertPayload>>({})

  const existingFormData = useMemo<PartnerUpsertPayload | null>(() => {
    const data = existingQuery.data
    if (!data) return null
    return {
      company_type: data.companyType,
      name: data.name || '',
      vat: data.vat || data.taxId || '',
      email: data.email || '',
      phone: data.phone || '',
      mobile: data.mobile || '',
      active: data.active,
      street: data.street || '',
      street2: data.street2 || '',
      city: data.city || '',
      zip: data.zip || '',
      countryId: data.countryId ?? null,
    }
  }, [existingQuery.data])

  const formData = useMemo<PartnerUpsertPayload>(() => {
    if (isEdit && existingFormData) {
      return { ...existingFormData, ...draftOverrides }
    }
    return { ...DEFAULT_FORM_DATA, ...draftOverrides }
  }, [draftOverrides, existingFormData, isEdit])

  const updateFormData = (patch: Partial<PartnerUpsertPayload>) => {
    setDraftOverrides((prev) => ({ ...prev, ...patch }))
  }

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
      toast.success(isEdit ? 'บันทึกรายชื่อติดต่อเรียบร้อย' : 'สร้างรายชื่อติดต่อเรียบร้อย')
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
    updateFormData({ company_type: t })

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขรายชื่อติดต่อ' : 'เพิ่มรายชื่อติดต่อ'}
        subtitle="ข้อมูลรายชื่อผู้ติดต่อ (res.partner) ทั้งลูกค้าและผู้ขาย"
        breadcrumb={`รายรับ · รายชื่อติดต่อ · ${isEdit ? 'แก้ไข' : 'เพิ่ม'}`}
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
              <div className="qf-section-title mb-3">ข้อมูลรายชื่อติดต่อ</div>
              <div className="row g-3">
                <div className="col-md-8">
                  <Label htmlFor="name" required>
                    ชื่อรายชื่อติดต่อ
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateFormData({ name: e.target.value })}
                    error={Boolean(fieldErrors.name)}
                  />
                  {fieldErrors.name ? <div className="small text-danger mt-1">{fieldErrors.name}</div> : null}
                </div>

                <div className="col-md-4">
                  <Label htmlFor="vat">เลขผู้เสียภาษี</Label>
                  <Input
                    id="vat"
                    value={formData.vat ?? ''}
                    onChange={(e) => updateFormData({ vat: e.target.value })}
                  />
                </div>

                <div className="col-md-4">
                  <Label htmlFor="email">อีเมล</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email ?? ''}
                    onChange={(e) => updateFormData({ email: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="phone">โทรศัพท์</Label>
                  <Input
                    id="phone"
                    value={formData.phone ?? ''}
                    onChange={(e) => updateFormData({ phone: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="mobile">มือถือ</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile ?? ''}
                    onChange={(e) => updateFormData({ mobile: e.target.value })}
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
                    onChange={(e) => updateFormData({ street: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <Label htmlFor="street2">ที่อยู่ (บรรทัด 2)</Label>
                  <Input
                    id="street2"
                    value={formData.street2 ?? ''}
                    onChange={(e) => updateFormData({ street2: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="city">เขต/อำเภอ</Label>
                  <Input
                    id="city"
                    value={formData.city ?? ''}
                    onChange={(e) => updateFormData({ city: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="zip">รหัสไปรษณีย์</Label>
                  <Input
                    id="zip"
                    value={formData.zip ?? ''}
                    onChange={(e) => updateFormData({ zip: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <CountrySelector
                    value={formData.countryId}
                    onChange={(value) => updateFormData({ countryId: value })}
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
                      updateFormData({ active: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor="active">
                    ใช้งาน (Active)
                  </label>
                </div>
                <div className="small text-muted mt-2">
                  Tip: ใช้ "ปิดใช้งาน" เพื่อ archive รายชื่อติดต่อใน Odoo โดยไม่ลบข้อมูล
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Form>
    </div>
  )
}

