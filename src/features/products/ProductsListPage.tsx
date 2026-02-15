import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { listProducts } from '@/api/services/products.service'

export function ProductsListPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const qDebounced = useDebouncedValue(q, 300)
  const limit = 30

  const query = useInfiniteQuery({
    queryKey: ['products', qDebounced, limit],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listProducts({
        q: qDebounced || undefined,
        limit,
        offset: pageParam,
        active: true,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0)
      if (loaded >= (lastPage?.total ?? 0)) return undefined
      if ((lastPage?.items?.length ?? 0) < limit) return undefined
      return loaded
    },
    staleTime: 30_000,
  })

  const products = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data?.pages])

  const rows = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        name: p.name,
        defaultCode: p.defaultCode || '—',
        uom: p.uomName || '—',
        listPrice: p.listPrice ?? p.price ?? 0,
        active: p.active !== false,
      })),
    [products],
  )

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'สินค้า/บริการ',
      cell: (r) => (
        <button
          type="button"
          className="btn btn-link p-0 fw-semibold text-decoration-none"
          onClick={() => navigate(`/products/${r.id}/edit`)}
        >
          {r.name}
        </button>
      ),
    },
    {
      key: 'defaultCode',
      header: 'รหัสสินค้า',
      className: 'text-nowrap',
      cell: (r) => <span className="font-monospace">{r.defaultCode}</span>,
    },
    {
      key: 'uom',
      header: 'หน่วยนับ',
      className: 'text-nowrap',
      cell: (r) => <span>{r.uom}</span>,
    },
    {
      key: 'listPrice',
      header: 'ราคาขาย',
      className: 'text-end',
      cell: (r) => (
        <span className="font-monospace">
          {Number(r.listPrice || 0).toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'สถานะ',
      className: 'text-nowrap',
      cell: (r) => <Badge tone={r.active ? 'green' : 'gray'}>{r.active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge>,
    },
    {
      key: 'actions',
      header: 'เมนูลัด',
      className: 'text-nowrap',
      cell: (r) => (
        <div className="d-flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => navigate('/sales/orders/new?orderType=quotation')}>
            ใบเสนอราคา
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/sales/orders/new?orderType=sale')}>
            Sale Order
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/purchases/requests')}>
            คำขอซื้อ
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/products/${r.id}/edit`)}>
            แก้ไข
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="สินค้า / Products"
        subtitle="จัดการสินค้าและบริการ (list / create / update) จาก Odoo18 ผ่าน adt_th_api"
        breadcrumb="รายรับ · สินค้า"
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/sales/orders?type=quotation')}>
              ไปหน้าใบเสนอราคา
            </Button>
            <Button size="sm" onClick={() => navigate('/products/new')}>
              + เพิ่มสินค้า
            </Button>
          </div>
        }
      />

      <div className="mb-3" style={{ maxWidth: 420 }}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อ/รหัส/บาร์โค้ดสินค้า"
          leftAdornment={<i className="bi bi-search"></i>}
        />
      </div>

      {query.isLoading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <Spinner animation="border" role="status" />
          <span className="ms-3">กำลังโหลดข้อมูล...</span>
        </div>
      ) : query.isError ? (
        <div className="alert alert-danger">
          <p className="fw-semibold mb-2">โหลดสินค้าไม่สำเร็จ</p>
          <p className="small mb-0">{query.error instanceof Error ? query.error.message : 'Unknown error'}</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          <DataTable
            title={`รายการสินค้า (${rows.length})`}
            right={
              <Button size="sm" variant="ghost" onClick={() => query.refetch()}>
                <i className="bi bi-arrow-clockwise me-1"></i>
                รีเฟรช
              </Button>
            }
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <div>
                <p className="h6 fw-semibold mb-2">ยังไม่มีสินค้า</p>
                <p className="small text-muted mb-0">{qDebounced ? 'ไม่พบผลลัพธ์ที่ค้นหา' : 'เริ่มต้นด้วยการเพิ่มสินค้าใหม่'}</p>
              </div>
            }
          />

          <div className="d-flex justify-content-between align-items-center">
            <div className="small text-muted">แสดงแล้ว {rows.length} รายการ</div>
            {query.hasNextPage ? (
              <Button size="sm" variant="secondary" onClick={() => query.fetchNextPage()} isLoading={query.isFetchingNextPage}>
                โหลดเพิ่ม
              </Button>
            ) : (
              <div className="small text-muted">ครบแล้ว</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
