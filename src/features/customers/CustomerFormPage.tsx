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
import { normalizeVatNumber, sanitizeVatNumber, thaiVatValidationMessage } from '@/lib/vat'
import { lookupDbdByTaxId, type DbdLookupResult } from '@/api/services/dbd.service'
import {
  createPartner,
  getPartner,
  updatePartner,
  type PartnerCompanyType,
  type PartnerUpsertPayload,
} from '@/api/services/partners.service'
import {
  listThaiDistricts,
  listThaiProvinces,
  listThaiSubDistricts,
} from '@/api/services/thai-address.service'
import { CountrySelector } from '@/features/customers/CountrySelector'
import { StateSelector } from '@/features/customers/StateSelector'
import {
  ThaiDistrictSelector,
  ThaiProvinceSelector,
  ThaiSubDistrictSelector,
} from '@/features/customers/ThaiAddressSelectors'

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
  district: '',
  subDistrict: '',
  zip: '',
  countryId: Number(import.meta.env.VITE_COUNTRY_TH_ID || 219),
  stateId: null,
  provinceId: null,
  districtId: null,
  subDistrictId: null,
  vatPriceMode: 'vat_excluded',
  branchCode: 'สำนักงานใหญ่',
}

function extractSubDistrict(street2?: string): string {
  const raw = String(street2 || '').trim()
  if (!raw) return ''
  const m = raw.match(/(?:แขวง\/ตำบล)\s*([^\|,]+)/i)
  return m?.[1]?.trim() || ''
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
  const [dbdPreview, setDbdPreview] = useState<DbdLookupResult | null>(null)

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
      district: data.district || data.city || '',
      subDistrict: data.subDistrict || extractSubDistrict(data.street2),
      zip: data.zip || '',
      countryId: data.countryId ?? null,
      stateId: data.stateId ?? null,
      provinceId: data.provinceId ?? data.stateId ?? null,
      districtId: data.districtId ?? null,
      subDistrictId: data.subDistrictId ?? null,
      vatPriceMode: data.vatPriceMode || 'vat_excluded',
      branchCode: data.branchCode || 'สำนักงานใหญ่',
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

  const dbdLookupMutation = useMutation({
    mutationFn: async () => {
      const vatError = thaiVatValidationMessage(formData.vat)
      if (vatError) throw new Error(vatError)
      return lookupDbdByTaxId(normalizeVatNumber(formData.vat) || '')
    },
    onSuccess: (result) => {
      setDbdPreview(result)
      if (result.lookupStatus === 'ok') {
        toast.success(result.message || 'ดึงข้อมูล DBD สำเร็จ')
      } else {
        toast.error(result.message || 'ไม่พบข้อมูล DBD')
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'DBD lookup failed'
      setDbdPreview({
        taxId: normalizeVatNumber(formData.vat) || '',
        lookupStatus: 'error',
        message,
      })
      toast.error(message)
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

    const vatError = thaiVatValidationMessage(formData.vat)
    if (vatError) {
      setGlobalError(vatError)
      setFieldErrors({ vat: vatError })
      return
    }

    await upsertMutation.mutateAsync({
      ...formData,
      name: formData.name.trim(),
      vat: normalizeVatNumber(formData.vat),
      email: formData.email?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      mobile: formData.mobile?.trim() || undefined,
      street: formData.street?.trim() || undefined,
      street2: formData.street2?.trim() || undefined,
      city: formData.city?.trim() || undefined,
      district: formData.district?.trim() || undefined,
      subDistrict: formData.subDistrict?.trim() || undefined,
      zip: formData.zip?.trim() || undefined,
      vatPriceMode: formData.vatPriceMode || 'vat_excluded',
      branchCode: formData.branchCode?.trim() || undefined,
    })
  }

  const setCompanyType = (t: PartnerCompanyType) =>
    updateFormData({ company_type: t })

  const thailandId = Number(import.meta.env.VITE_COUNTRY_TH_ID || 219)
  const isThaiAddress = (formData.countryId ?? thailandId) === thailandId

  const handleProvinceChange = async (provinceId: number | null) => {
    const selected = provinceId
      ? (await listThaiProvinces()).find((item) => item.id === provinceId)
      : null
    updateFormData({
      provinceId,
      stateId: selected?.stateId ?? null,
      districtId: null,
      subDistrictId: null,
      district: '',
      city: '',
      subDistrict: '',
      zip: '',
    })
  }

  const handleDistrictChange = async (districtId: number | null) => {
    const selected = districtId
      ? (await listThaiDistricts({ provinceId: formData.provinceId ?? null })).find((item) => item.id === districtId)
      : null
    updateFormData({
      districtId,
      subDistrictId: null,
      district: selected?.name || '',
      city: selected?.name || '',
      subDistrict: '',
      zip: '',
    })
  }

  const handleSubDistrictChange = async (subDistrictId: number | null) => {
    if (!subDistrictId) {
      updateFormData({ subDistrictId: null, subDistrict: '', zip: '' })
      return
    }
    const items = await listThaiSubDistricts({ districtId: formData.districtId ?? null })
    const selected = items.find((item) => item.id === subDistrictId)
    updateFormData({
      subDistrictId,
      subDistrict: selected?.name || '',
      zip: selected?.zipCode || '',
    })
  }

  const applyDbdPreview = async () => {
    if (!dbdPreview || dbdPreview.lookupStatus !== 'ok') return

    const thailandId = Number(import.meta.env.VITE_COUNTRY_TH_ID || 219)
    let provinceId: number | null = formData.provinceId ?? null
    let stateId: number | null = formData.stateId ?? null
    let districtId: number | null = formData.districtId ?? null
    let subDistrictId: number | null = formData.subDistrictId ?? null

    if (dbdPreview.provinceName) {
      const provinces = await listThaiProvinces()
      const province = provinces.find(
        (item) => item.name === dbdPreview.provinceName || item.nameTh === dbdPreview.provinceName,
      )
      provinceId = province?.id ?? null
      stateId = province?.stateId ?? null

      if (provinceId && dbdPreview.districtName) {
        const districts = await listThaiDistricts({ provinceId })
        const district = districts.find(
          (item) => item.name === dbdPreview.districtName || item.nameTh === dbdPreview.districtName,
        )
        districtId = district?.id ?? null

        if (districtId && dbdPreview.subDistrictName) {
          const subDistricts = await listThaiSubDistricts({ districtId })
          const subDistrict = subDistricts.find(
            (item) =>
              item.name === dbdPreview.subDistrictName || item.nameTh === dbdPreview.subDistrictName,
          )
          subDistrictId = subDistrict?.id ?? null
        }
      }
    }

    updateFormData({
      company_type: 'company',
      name: dbdPreview.companyNameTh || formData.name,
      vat: dbdPreview.taxId || formData.vat,
      street: dbdPreview.addressText || formData.street,
      countryId: thailandId,
      stateId,
      provinceId,
      districtId,
      subDistrictId,
      district: dbdPreview.districtName || formData.district,
      city: dbdPreview.districtName || formData.city,
      subDistrict: dbdPreview.subDistrictName || formData.subDistrict,
      zip: dbdPreview.zipcode || formData.zip,
    })

    toast.success('นำข้อมูล DBD มาใส่ในฟอร์มแล้ว')
  }

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
                    inputMode="numeric"
                    maxLength={13}
                    onChange={(e) => updateFormData({ vat: sanitizeVatNumber(e.target.value) })}
                    error={Boolean(fieldErrors.vat)}
                  />
                  {fieldErrors.vat ? <div className="small text-danger mt-1">{fieldErrors.vat}</div> : null}
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => dbdLookupMutation.mutate()}
                      isLoading={dbdLookupMutation.isPending}
                    >
                      Lookup DBD
                    </Button>
                    <div className="small text-muted">ใช้ backend lookup เท่านั้น และต้องมี credential ฝั่ง Odoo</div>
                  </div>
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
                    onChange={(value) =>
                      updateFormData({
                        countryId: value,
                        stateId: value === thailandId ? formData.stateId ?? null : null,
                        provinceId: value === thailandId ? formData.provinceId ?? null : null,
                        districtId: value === thailandId ? formData.districtId ?? null : null,
                        subDistrictId: value === thailandId ? formData.subDistrictId ?? null : null,
                      })
                    }
                  />
                </div>
                {isThaiAddress ? (
                  <>
                    <div className="col-md-4">
                      <ThaiProvinceSelector
                        value={formData.provinceId}
                        onChange={(value) => {
                          handleProvinceChange(value).catch(() => {
                            updateFormData({ provinceId: value, districtId: null, subDistrictId: null })
                          })
                        }}
                      />
                    </div>
                    <div className="col-md-4">
                      <ThaiDistrictSelector
                        provinceId={formData.provinceId}
                        value={formData.districtId}
                        onChange={(value) => {
                          handleDistrictChange(value).catch(() => {
                            updateFormData({ districtId: value, subDistrictId: null })
                          })
                        }}
                      />
                    </div>
                    <div className="col-md-4">
                      <ThaiSubDistrictSelector
                        districtId={formData.districtId}
                        value={formData.subDistrictId}
                        onChange={(value) => {
                          handleSubDistrictChange(value).catch(() => {
                            updateFormData({ subDistrictId: value })
                          })
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-md-4">
                      <StateSelector
                        countryId={formData.countryId}
                        value={formData.stateId}
                        onChange={(value) => updateFormData({ stateId: value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <Label htmlFor="district">เขต/อำเภอ</Label>
                      <Input
                        id="district"
                        value={formData.district ?? ''}
                        onChange={(e) => updateFormData({ district: e.target.value, city: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <Label htmlFor="subDistrict">แขวง/ตำบล</Label>
                      <Input
                        id="subDistrict"
                        value={formData.subDistrict ?? ''}
                        onChange={(e) => updateFormData({ subDistrict: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <div className="col-md-4">
                  <Label htmlFor="vatPriceMode">ประเภทราคา</Label>
                  <select
                    id="vatPriceMode"
                    className="form-select"
                    value={formData.vatPriceMode || 'vat_excluded'}
                    onChange={(e) =>
                      updateFormData({
                        vatPriceMode: e.target.value as PartnerUpsertPayload['vatPriceMode'],
                      })
                    }
                  >
                    <option value="no_vat">ไม่มี VAT</option>
                    <option value="vat_included">รวม VAT</option>
                    <option value="vat_excluded">แยก VAT</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <Label htmlFor="branchCode">สาขา</Label>
                  <Input
                    id="branchCode"
                    value={formData.branchCode ?? ''}
                    onChange={(e) => updateFormData({ branchCode: e.target.value })}
                    placeholder="เช่น สำนักงานใหญ่"
                  />
                </div>
              </div>
            </Card>

            {dbdPreview ? (
              <Card className="p-4 mt-4">
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <div className="qf-section-title">DBD Preview</div>
                    <div className="small text-muted">ตรวจผล lookup ก่อนนำข้อมูลมาใส่ในฟอร์ม</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => applyDbdPreview().catch((error) => {
                      toast.error(error instanceof Error ? error.message : 'นำข้อมูล DBD ไม่สำเร็จ')
                    })}
                    disabled={dbdPreview.lookupStatus !== 'ok'}
                  >
                    Apply to form
                  </Button>
                </div>
                <Alert variant={dbdPreview.lookupStatus === 'ok' ? 'success' : 'warning'} className="small mb-3">
                  {dbdPreview.message || (dbdPreview.lookupStatus === 'ok' ? 'พร้อมนำข้อมูลมาใช้' : 'ยังไม่สามารถใช้ข้อมูลนี้ได้')}
                </Alert>
                <div className="row g-3 small">
                  <div className="col-md-6">
                    <strong>ชื่อบริษัท (TH)</strong>
                    <div>{dbdPreview.companyNameTh || '-'}</div>
                  </div>
                  <div className="col-md-6">
                    <strong>ชื่อบริษัท (EN)</strong>
                    <div>{dbdPreview.companyNameEn || '-'}</div>
                  </div>
                  <div className="col-md-4">
                    <strong>สถานะ</strong>
                    <div>{dbdPreview.status || '-'}</div>
                  </div>
                  <div className="col-md-4">
                    <strong>นิติบุคคล</strong>
                    <div>{dbdPreview.juristicType || '-'}</div>
                  </div>
                  <div className="col-md-4">
                    <strong>ทุนจดทะเบียน</strong>
                    <div>{dbdPreview.registeredCapital != null ? dbdPreview.registeredCapital.toLocaleString('en-US') : '-'}</div>
                  </div>
                  <div className="col-md-12">
                    <strong>ที่อยู่ตามทะเบียน</strong>
                    <div>{dbdPreview.addressText || '-'}</div>
                  </div>
                  <div className="col-md-3">
                    <strong>จังหวัด</strong>
                    <div>{dbdPreview.provinceName || '-'}</div>
                  </div>
                  <div className="col-md-3">
                    <strong>อำเภอ/เขต</strong>
                    <div>{dbdPreview.districtName || '-'}</div>
                  </div>
                  <div className="col-md-3">
                    <strong>ตำบล/แขวง</strong>
                    <div>{dbdPreview.subDistrictName || '-'}</div>
                  </div>
                  <div className="col-md-3">
                    <strong>รหัสไปรษณีย์</strong>
                    <div>{dbdPreview.zipcode || '-'}</div>
                  </div>
                </div>
              </Card>
            ) : null}
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
