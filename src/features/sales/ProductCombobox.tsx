import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { getProduct, listProducts, type ProductSummary } from '@/api/services/products.service'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

interface Props {
  valueId: number | null
  onPick: (product: ProductSummary) => void
  disabled?: boolean
}

export function ProductCombobox({ valueId, onPick, disabled }: Props) {
  const [input, setInput] = useState('')
  const qTrim = input.trim()
  const qDebounced = useDebouncedValue(qTrim, 250)
  const limit = 20

  const selectedQuery = useQuery({
    queryKey: ['product', valueId],
    enabled: typeof valueId === 'number' && valueId > 0,
    queryFn: () => getProduct(valueId as number),
    staleTime: 60_000,
  })

  useEffect(() => {
    // keep input synced with selected value (unless user is actively searching)
    if (!qTrim && selectedQuery.data?.name) setInput(selectedQuery.data.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueId, selectedQuery.data?.name])

  const listQuery = useInfiniteQuery({
    queryKey: ['products', qDebounced],
    enabled: qDebounced.length >= 1,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listProducts({
        q: qDebounced || undefined,
        active: true,
        limit,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0)
      if (loaded >= (lastPage?.total ?? 0)) return undefined
      if ((lastPage?.items?.length ?? 0) < limit) return undefined
      return loaded
    },
    staleTime: 30_000,
  })

  const items = useMemo(() => listQuery.data?.pages.flatMap((p) => p.items) ?? [], [listQuery.data?.pages])
  const total = listQuery.data?.pages[0]?.total

  const options = useMemo(() => {
    return items.map<ComboboxOption>((p) => ({
      id: p.id,
      label: p.name,
      meta: p.defaultCode ? `[${p.defaultCode}]` : `ID: ${p.id}`,
    }))
  }, [items])

  return (
    <div>
      <Combobox
        id="productSearch"
        value={input}
        onChange={setInput}
        disabled={disabled}
        placeholder="ค้นหาสินค้า/บริการ (พิมพ์อย่างน้อย 1 ตัวอักษร)"
        minChars={1}
        leftAdornment={<i className="bi bi-box-seam"></i>}
        options={options}
        total={total}
        isLoading={listQuery.isFetching}
        isLoadingMore={listQuery.isFetchingNextPage}
        onLoadMore={() => listQuery.hasNextPage && listQuery.fetchNextPage()}
        emptyText="ไม่พบสินค้า"
        menuMaxHeight={220}
        onPick={(opt) => {
          const picked = items.find((x) => x.id === Number(opt.id))
          if (picked) {
            setInput(picked.name)
            onPick(picked)
          }
        }}
      />
      {listQuery.isError ? (
        <div className="small text-danger mt-1">
          {listQuery.error instanceof Error ? listQuery.error.message : 'โหลดสินค้าไม่สำเร็จ'}
        </div>
      ) : null}
    </div>
  )
}


