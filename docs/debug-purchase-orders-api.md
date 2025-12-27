# Debug Purchase Orders API - Troubleshooting Guide

## ปัญหาที่พบ
- Frontend แสดงข้อมูล Purchase Orders แต่ข้อมูลไม่ครบ (ไม่มี vendor name, date, total = 0.00)
- หน้าแสดง "ร่าง #12", "ร่าง #16" etc. แต่ fields อื่นๆ เป็น empty

## ขั้นตอน Debug

### 1. เปิด Browser DevTools

1. เปิด DevTools (F12 หรือ Right-click → Inspect)
2. ไปที่ Console tab
3. Refresh หน้า Purchase Orders

### 2. ตรวจสอบ Console Logs

ดู logs ที่ขึ้นต้นด้วย:
- `[unwrapResponse]` - แสดง raw response และ normalized data
- `[purchases.service]` - แสดง data หลังจาก unwrap
- `[PurchaseOrdersListPage]` - แสดง orders data ที่ใช้ใน component

### 3. ตรวจสอบ Network Tab

1. ไปที่ Network tab
2. คลิกที่ request `list` (`/api/th/v1/purchases/orders`)
3. ดู **Response** tab (ไม่ใช่ Payload)

โครงสร้างที่ควรเห็น:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "data": [
      {
        "id": 12,
        "number": "PO00012",
        "vendorName": "ชื่อผู้ขาย",
        "vendorId": 1,
        "orderDate": "2024-01-15T00:00:00",
        "total": 1000.00,
        "status": "draft",
        "currency": "THB"
      }
    ]
  }
}
```

### 4. ตรวจสอบ Field Mapping

ถ้า backend ส่ง field names ที่ต่างจากที่ frontend คาดหวัง:

**Frontend expects:**
- `vendorName`
- `vendorId`
- `orderDate`
- `expectedDate`
- `total`
- `currency`
- `status`

**Backend might send:**
- `partner_name` หรือ `partner_name` แทน `vendorName`
- `date_order` แทน `orderDate`
- `amount_total` แทน `total`
- `currency_id.name` หรือ `currency_code` แทน `currency`

### 5. วิธีแก้ไข

#### Option A: แก้ Backend ให้ส่ง field names ที่ถูกต้อง
Backend ควร map Odoo fields เป็น API contract:
```python
# Backend should return:
{
    "vendorName": po.partner_id.name,
    "vendorId": po.partner_id.id,
    "orderDate": po.date_order.isoformat(),
    "total": po.amount_total,
    "currency": po.currency_id.name,
    ...
}
```

#### Option B: แก้ Frontend ให้รองรับ field names ที่ backend ส่งมา
ถ้า backend ส่ง `partner_name` แทน `vendorName`:
```typescript
// In PurchaseOrderListItem interface
export interface PurchaseOrderListItem {
  id: number
  number: string
  vendorName?: string  // Optional
  partner_name?: string  // Backend field name
  // ...
}

// In component, map fields:
vendor: order.vendorName ?? order.partner_name ?? '—'
```

## Quick Check

รันคำสั่งนี้ใน Console เพื่อดูข้อมูลที่ได้รับ:

```javascript
// ตรวจสอบ query data
console.log('Query data:', query.data)
console.log('Orders:', orders)
console.log('Rows:', rows)
```

## Expected Console Output

ถ้าทุกอย่างทำงานถูกต้อง ควรเห็น:

```
[unwrapResponse] Processing response: { url: '/th/v1/purchases/orders/list', ... }
[unwrapResponse] Normalized envelope: { success: true, dataType: 'array', dataLength: 9, ... }
[purchases.service] Unwrapped data: { isArray: true, length: 9, firstItem: {...} }
[PurchaseOrdersListPage] Orders data: { total: 9, firstOrder: { id: 12, vendorName: "...", ... } }
```

## Common Issues

1. **Backend returns empty/null fields**
   - ตรวจสอบว่า backend query `purchase.order` ได้ข้อมูลครบหรือไม่
   - ตรวจสอบ field mapping ใน backend controller

2. **Field name mismatch**
   - Backend ส่ง `partner_name` แต่ frontend คาดหวัง `vendorName`
   - Solution: แก้ backend หรือเพิ่ม field mapping ใน frontend

3. **API returns 200 but data is empty array**
   - Backend ทำงานแต่ไม่มีข้อมูล
   - Solution: ตรวจสอบ database หรือ filter conditions

4. **Parse error**
   - Response structure ไม่ตรงกับที่คาดหวัง
   - Solution: ตรวจสอบ Response tab ใน Network และแก้ไข parser

