import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

interface Props {
  value: number | null | undefined
  onChange: (value: number | null) => void
}

export function CountrySelector({ value, onChange }: Props) {
  const thailandIdRaw = Number(import.meta.env.VITE_COUNTRY_TH_ID || 219)
  const thailandId = Number.isFinite(thailandIdRaw) && thailandIdRaw > 0 ? thailandIdRaw : 219
  const mode = value == null ? 'none' : value === thailandId ? 'th' : 'other'

  return (
    <div>
      <Label htmlFor="countryId">ประเทศ</Label>
      <select
        id="countryId"
        className="form-select"
        value={mode}
        onChange={(e) => {
          const next = e.target.value
          if (next === 'th') onChange(thailandId)
          else if (next === 'none') onChange(null)
        }}
      >
        <option value="th">ประเทศไทย</option>
        <option value="none">ไม่ระบุประเทศ</option>
        <option value="other">ประเทศอื่น (ระบุ Country ID)</option>
      </select>
      {mode === 'other' ? (
        <div className="mt-2">
          <Input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="Country ID"
          />
        </div>
      ) : null}
      <div className="small text-muted mt-1">ค่าเริ่มต้นประเทศไทย ใช้ Country ID: {thailandId}</div>
    </div>
  )
}

