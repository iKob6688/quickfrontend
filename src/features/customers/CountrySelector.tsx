import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

interface Props {
  value: number | null | undefined
  onChange: (value: number | null) => void
}

/**
 * vNext-ready placeholder: today backend expects `countryId` number.
 * When `/countries/list` exists, replace this with a searchable selector.
 */
export function CountrySelector({ value, onChange }: Props) {
  return (
    <div>
      <Label htmlFor="countryId">ประเทศ</Label>
      <Input
        id="countryId"
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      />
      <div className="small text-muted mt-1">
        vNext: เปลี่ยนเป็น country selector เมื่อมี endpoint ประเทศ
      </div>
    </div>
  )
}


