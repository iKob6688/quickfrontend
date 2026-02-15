import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Form } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { toast } from '@/lib/toastStore'
import { createProduct, getProduct, updateProduct, type ProductUpsertPayload } from '@/api/services/products.service'

const DEFAULT_FORM: ProductUpsertPayload = {
  name: '',
  defaultCode: '',
  barcode: '',
  listPrice: 0,
  saleOk: true,
  purchaseOk: true,
  active: true,
  description: '',
}

export function ProductFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const productId = id ? Number(id) : null

  const [errorText, setErrorText] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<ProductUpsertPayload>>({})

  const productQuery = useQuery({
    queryKey: ['product', productId],
    enabled: isEdit && Boolean(productId),
    queryFn: () => getProduct(productId!),
    staleTime: 30_000,
  })

  const formData = useMemo<ProductUpsertPayload>(() => {
    if (isEdit && productQuery.data) {
      return {
        name: productQuery.data.name || '',
        defaultCode: productQuery.data.defaultCode || '',
        barcode: productQuery.data.barcode || '',
        listPrice: productQuery.data.listPrice ?? productQuery.data.price ?? 0,
        saleOk: productQuery.data.saleOk ?? true,
        purchaseOk: productQuery.data.purchaseOk ?? true,
        active: productQuery.data.active !== false,
        description: productQuery.data.description || '',
        ...draft,
      }
    }
    return { ...DEFAULT_FORM, ...draft }
  }, [draft, isEdit, productQuery.data])

  const saveMutation = useMutation({
    mutationFn: async (payload: ProductUpsertPayload) => {
      if (isEdit && productId) return updateProduct(productId, payload)
      return createProduct(payload)
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['product', result.id] })
      toast.success(isEdit ? 'บันทึกสินค้าเรียบร้อย' : 'สร้างสินค้าสำเร็จ')
      navigate('/products', { replace: true })
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'บันทึกสินค้าไม่สำเร็จ'
      setErrorText(msg)
      toast.error(msg)
    },
  })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorText(null)
    if (!formData.name.trim()) {
      setErrorText('กรุณาระบุชื่อสินค้า')
      return
    }
    await saveMutation.mutateAsync({
      ...formData,
      name: formData.name.trim(),
      defaultCode: formData.defaultCode?.trim() || undefined,
      barcode: formData.barcode?.trim() || undefined,
      description: formData.description?.trim() || undefined,
      listPrice: Number(formData.listPrice || 0),
    })
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}
        subtitle="ตัวจัดการสินค้า/บริการสำหรับ Odoo18 (adt_th_api)"
        breadcrumb={`รายรับ · สินค้า · ${isEdit ? 'แก้ไข' : 'เพิ่ม'}`}
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate('/products')}>
              ยกเลิก
            </Button>
            <Button size="sm" type="submit" form="product-form" isLoading={saveMutation.isPending}>
              บันทึก
            </Button>
          </div>
        }
      />

      {errorText ? (
        <Alert variant="danger" className="small">
          {errorText}
        </Alert>
      ) : null}

      {isEdit && productQuery.isLoading ? <div className="small text-muted">กำลังโหลดข้อมูลสินค้า...</div> : null}
      {isEdit && productQuery.isError ? (
        <Alert variant="danger" className="small">
          {productQuery.error instanceof Error ? productQuery.error.message : 'โหลดสินค้าไม่สำเร็จ'}
        </Alert>
      ) : null}

      <Form id="product-form" onSubmit={onSubmit}>
        <div className="row g-4">
          <div className="col-lg-8">
            <Card className="p-4">
              <div className="qf-section-title mb-3">ข้อมูลสินค้า</div>
              <div className="row g-3">
                <div className="col-md-8">
                  <Label htmlFor="name" required>
                    ชื่อสินค้า
                  </Label>
                  <Input id="name" value={formData.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="defaultCode">รหัสสินค้า</Label>
                  <Input
                    id="defaultCode"
                    value={formData.defaultCode || ''}
                    onChange={(e) => setDraft((p) => ({ ...p, defaultCode: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="barcode">บาร์โค้ด</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode || ''}
                    onChange={(e) => setDraft((p) => ({ ...p, barcode: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="listPrice">ราคาขาย</Label>
                  <Input
                    id="listPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.listPrice ?? 0}
                    onChange={(e) => setDraft((p) => ({ ...p, listPrice: Number(e.target.value || 0) }))}
                  />
                </div>
                <div className="col-md-4">
                  <Label htmlFor="description">รายละเอียด</Label>
                  <Input
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
            </Card>
          </div>
          <div className="col-lg-4">
            <Card className="p-4">
              <div className="qf-section-title mb-3">ตั้งค่า</div>
              <div className="form-check form-switch mb-3">
                <input
                  id="saleOk"
                  className="form-check-input"
                  type="checkbox"
                  checked={Boolean(formData.saleOk)}
                  onChange={(e) => setDraft((p) => ({ ...p, saleOk: e.target.checked }))}
                />
                <label className="form-check-label" htmlFor="saleOk">
                  ใช้งานขาย (Sale)
                </label>
              </div>
              <div className="form-check form-switch mb-3">
                <input
                  id="purchaseOk"
                  className="form-check-input"
                  type="checkbox"
                  checked={Boolean(formData.purchaseOk)}
                  onChange={(e) => setDraft((p) => ({ ...p, purchaseOk: e.target.checked }))}
                />
                <label className="form-check-label" htmlFor="purchaseOk">
                  ใช้งานซื้อ (Purchase)
                </label>
              </div>
              <div className="form-check form-switch">
                <input
                  id="active"
                  className="form-check-input"
                  type="checkbox"
                  checked={Boolean(formData.active)}
                  onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))}
                />
                <label className="form-check-label" htmlFor="active">
                  ใช้งาน (Active)
                </label>
              </div>
            </Card>
          </div>
        </div>
      </Form>
    </div>
  )
}
