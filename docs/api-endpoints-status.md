# API Endpoints Status Check

อัปเดตล่าสุด: 2025-12-26

## สรุปสถานะ API Endpoints

### ✅ 1. Partners/Customers API - **COMPLETE**

**Frontend เรียกใช้:**
- `POST /api/th/v1/partners/list` ✅
- `POST /api/th/v1/partners/:id` ✅
- `POST /api/th/v1/partners/create` ✅
- `POST /api/th/v1/partners/:id/update` ✅

**Backend Status:**
- Controller: `adt_th_api/controllers/api_contacts.py`
- Routes: มีครบทุก routes ตามที่ frontend เรียกใช้
- Status: ✅ **พร้อมใช้งาน**

---

### ✅ 2. Purchase Orders API - **COMPLETE**

**Frontend เรียกใช้:**
- `POST /api/th/v1/purchases/orders/list` ✅
- `POST /api/th/v1/purchases/orders/:id` ✅
- `POST /api/th/v1/purchases/orders` (create) ✅
- `PUT /api/th/v1/purchases/orders/:id` (update) ✅
- `POST /api/th/v1/purchases/orders/:id/confirm` ✅
- `POST /api/th/v1/purchases/orders/:id/cancel` ✅

**Backend Status:**
- Controller: `adt_th_api/controllers/api_purchase_orders.py`
- Routes: มีครบทุก routes ตามที่ frontend เรียกใช้
- Status: ✅ **พร้อมใช้งาน**

---

### ⚠️ 3. Purchase Requests API - **MISSING 1 ENDPOINT**

**Frontend เรียกใช้:**
- `POST /api/th/v1/purchases/requests/list` ✅
- `POST /api/th/v1/purchases/requests/:id` ✅
- `POST /api/th/v1/purchases/requests` (create) ✅
- `PUT /api/th/v1/purchases/requests/:id` (update) ✅
- `POST /api/th/v1/purchases/requests/:id/submit` ✅
- `POST /api/th/v1/purchases/requests/:id/approve` ✅
- `POST /api/th/v1/purchases/requests/:id/reject` ✅
- `POST /api/th/v1/purchases/requests/:id/cancel` ✅
- `POST /api/th/v1/purchases/requests/:id/convert-to-po` ❌ **MISSING**

**Backend Status:**
- Controller: `adt_th_api/controllers/api_purchase_requests.py`
- Routes: มี 8/9 routes
- Missing: `convert-to-po` endpoint
- Status: ⚠️ **ต้องเพิ่ม endpoint `convert-to-po`**

---

## Action Items

### Priority: High - Add Purchase Request Convert-to-PO Endpoint

**ต้องเพิ่ม:**
1. Route: `POST /api/th/v1/purchases/requests/<int:request_id>/convert-to-po`
2. Frontend route: `POST /web/adt/th/v1/purchases/requests/<int:request_id>/convert-to-po`
3. Implementation: ใช้ wizard `purchase.request.line.make.purchase.order` เพื่อสร้าง Purchase Order จาก Purchase Request

**Implementation Notes:**
- Model: `purchase.request` และ `purchase.request.line`
- Wizard: `purchase.request.line.make.purchase.order`
- Method: `make_purchase_order()` ใน wizard
- Input: `request_id`, optional `supplier_id`, optional `purchase_order_id` (existing PO)
- Output: Purchase Order object (serialized)

**Files to modify:**
- `adtv18/adt_th_api/controllers/api_purchase_requests.py`
- Add method `_convert_to_purchase_order(request_id, **payload)`
- Add route handlers (external + frontend)

---

## Testing Checklist

### Partners API ✅
- [x] List partners
- [x] Get partner detail
- [x] Create partner
- [x] Update partner

### Purchase Orders API ✅
- [x] List purchase orders
- [x] Get purchase order detail
- [x] Create purchase order
- [x] Update purchase order
- [x] Confirm purchase order
- [x] Cancel purchase order

### Purchase Requests API ⚠️
- [x] List purchase requests
- [x] Get purchase request detail
- [x] Create purchase request
- [x] Update purchase request
- [x] Submit purchase request
- [x] Approve purchase request
- [x] Reject purchase request
- [x] Cancel purchase request
- [ ] Convert purchase request to PO ❌

---

## Summary

| API Endpoint | Status | Missing Routes | Priority |
|--------------|--------|----------------|----------|
| `/api/th/v1/partners/*` | ✅ Complete | None | - |
| `/api/th/v1/purchases/orders/*` | ✅ Complete | None | - |
| `/api/th/v1/purchases/requests/*` | ⚠️ Almost Complete | 1 route (`convert-to-po`) | High |

**Total Missing Endpoints: 1**
