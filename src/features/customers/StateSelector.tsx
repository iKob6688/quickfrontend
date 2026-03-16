import { useQuery } from '@tanstack/react-query'
import { listPartnerStates } from '@/api/services/partners.service'
import { Label } from '@/components/ui/Label'

interface Props {
  countryId?: number | null
  value?: number | null
  onChange: (value: number | null) => void
}

export function StateSelector({ countryId, value, onChange }: Props) {
  const query = useQuery({
    queryKey: ['partner-states', countryId],
    queryFn: () => listPartnerStates({ countryId, limit: 500 }),
    enabled: countryId != null,
    staleTime: 60_000,
  })

  return (
    <div>
      <Label htmlFor="stateId">จังหวัด</Label>
      <select
        id="stateId"
        className="form-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={query.isLoading || countryId == null}
      >
        <option value="">ไม่ระบุจังหวัด</option>
        {(query.data || []).map((state) => (
          <option key={state.id} value={state.id}>
            {state.name}
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
