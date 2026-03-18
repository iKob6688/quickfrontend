import { useQuery } from '@tanstack/react-query'
import {
  listThaiDistricts,
  listThaiProvinces,
  listThaiSubDistricts,
} from '@/api/services/thai-address.service'
import { Label } from '@/components/ui/Label'

interface ProvinceProps {
  value?: number | null
  onChange: (value: number | null) => void
}

export function ThaiProvinceSelector({ value, onChange }: ProvinceProps) {
  const query = useQuery({
    queryKey: ['thai-address', 'provinces'],
    queryFn: () => listThaiProvinces(),
    staleTime: 5 * 60_000,
  })

  return (
    <div>
      <Label htmlFor="thaiProvinceId">จังหวัด</Label>
      <select
        id="thaiProvinceId"
        className="form-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={query.isLoading}
      >
        <option value="">เลือกจังหวัด</option>
        {(query.data || []).map((province) => (
          <option key={province.id} value={province.id}>
            {province.name}
          </option>
        ))}
      </select>
      {query.isError ? (
        <div className="small text-danger mt-1">
          {query.error instanceof Error ? query.error.message : 'โหลดรายการจังหวัดไม่สำเร็จ'}
        </div>
      ) : null}
    </div>
  )
}

interface DistrictProps {
  provinceId?: number | null
  value?: number | null
  onChange: (value: number | null) => void
}

export function ThaiDistrictSelector({ provinceId, value, onChange }: DistrictProps) {
  const query = useQuery({
    queryKey: ['thai-address', 'districts', provinceId],
    queryFn: () => listThaiDistricts({ provinceId }),
    enabled: provinceId != null,
    staleTime: 5 * 60_000,
  })

  return (
    <div>
      <Label htmlFor="thaiDistrictId">เขต/อำเภอ</Label>
      <select
        id="thaiDistrictId"
        className="form-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={query.isLoading || provinceId == null}
      >
        <option value="">เลือกเขต/อำเภอ</option>
        {(query.data || []).map((district) => (
          <option key={district.id} value={district.id}>
            {district.name}
          </option>
        ))}
      </select>
      {query.isError ? (
        <div className="small text-danger mt-1">
          {query.error instanceof Error ? query.error.message : 'โหลดรายการเขต/อำเภอไม่สำเร็จ'}
        </div>
      ) : null}
    </div>
  )
}

interface SubDistrictProps {
  districtId?: number | null
  value?: number | null
  onChange: (value: number | null) => void
}

export function ThaiSubDistrictSelector({ districtId, value, onChange }: SubDistrictProps) {
  const query = useQuery({
    queryKey: ['thai-address', 'subdistricts', districtId],
    queryFn: () => listThaiSubDistricts({ districtId }),
    enabled: districtId != null,
    staleTime: 5 * 60_000,
  })

  return (
    <div>
      <Label htmlFor="thaiSubDistrictId">แขวง/ตำบล</Label>
      <select
        id="thaiSubDistrictId"
        className="form-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={query.isLoading || districtId == null}
      >
        <option value="">เลือกแขวง/ตำบล</option>
        {(query.data || []).map((subDistrict) => (
          <option key={subDistrict.id} value={subDistrict.id}>
            {subDistrict.name}
          </option>
        ))}
      </select>
      {query.isError ? (
        <div className="small text-danger mt-1">
          {query.error instanceof Error ? query.error.message : 'โหลดรายการแขวง/ตำบลไม่สำเร็จ'}
        </div>
      ) : null}
    </div>
  )
}
