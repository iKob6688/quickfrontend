import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { listEmployeeUsers, type EmployeeUserOption } from '@/api/services/employee-users.service'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

interface Props {
  id?: string
  onPick: (value: EmployeeUserOption) => void
  disabled?: boolean
  initialLabel?: string
}

export function EmployeeUserCombobox({ id, onPick, disabled, initialLabel }: Props) {
  const [input, setInput] = useState(initialLabel || '')
  const qDebounced = useDebouncedValue(input.trim(), 250)

  useEffect(() => {
    if (initialLabel && !input.trim()) setInput(initialLabel)
  }, [initialLabel, input])

  const query = useQuery({
    queryKey: ['employee-users', qDebounced],
    queryFn: () => listEmployeeUsers({ q: qDebounced || undefined, active: true, limit: 20 }),
    staleTime: 30_000,
  })

  const items = query.data ?? []
  const options = useMemo(
    () =>
      items.map<ComboboxOption>((item) => ({
        id: item.id,
        label: item.name,
        meta: [item.login, item.email].filter(Boolean).join(' · ') || `ID: ${item.id}`,
      })),
    [items],
  )

  return (
    <Combobox
      id={id || 'employeeUserSearch'}
      value={input}
      onChange={setInput}
      disabled={disabled}
      placeholder="พิมพ์เพื่อค้นหาพนักงาน/ผู้ใช้"
      minChars={1}
      options={options}
      total={options.length}
      isLoading={query.isFetching}
      emptyText="ไม่พบพนักงาน/ผู้ใช้"
      onPick={(opt) => {
        const picked = items.find((item) => item.id === Number(opt.id))
        if (!picked) return
        setInput(picked.name)
        onPick(picked)
      }}
    />
  )
}
