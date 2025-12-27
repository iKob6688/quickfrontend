# API Endpoints Missing Summary

อัปเดตล่าสุด: 2025-12-26

## สรุปสิ่งที่ขาด

### ✅ 1. Partners API - **COMPLETE**
- Status: มี routes ครบตามที่ frontend ต้องการ
- Routes: `/api/th/v1/partners/*`
- Action: ไม่ต้องทำอะไร

---

### ⚠️ 2. Purchase Orders API - **NEEDS FIX**

**ปัญหา:**
- Backend routes ใช้ `/api/th/v1/purchases/orders/*` ✅ (ถูกต้องแล้ว)
- แต่ในเอกสารระบุว่า routes ควรเป็น `purchases/orders` ซึ่งเราแก้ไขแล้ว

**Status:** ✅ **FIXED** (เพิ่งแก้ไขไป)

---

### ❌ 3. Purchase Requests API - **MISSING & WRONG ROUTES**

**ปัญหา 1: Routes ผิด** (ใช้ `purchase/requests` แทน `purchases/requests`)
- Backend routes ปัจจุบัน: `/api/th/v1/purchase/requests/*` ❌ (ไม่มี 's')
- Frontend ต้องการ: `/api/th/v1/purchases/requests/*` ✅ (มี 's')

**ปัญหา 2: ขาด Endpoint `convert-to-po`**
- Frontend ต้องการ: `POST /api/th/v1/purchases/requests/:id/convert-to-po`
- Backend: ❌ ยังไม่มี

**ต้องแก้ไข:**
1. ✅ แก้ routes ทั้งหมดจาก `purchase/requests` เป็น `purchases/requests`
2. ❌ เพิ่ม endpoint `convert-to-po`:
   - External: `POST /api/th/v1/purchases/requests/<int:request_id>/convert-to-po`
   - Frontend: `POST /web/adt/th/v1/purchases/requests/<int:request_id>/convert-to-po`

---

## Action Items

### Priority 1: Fix Purchase Requests Routes (HIGH)
**ไฟล์:** `adtv18/adt_th_api/controllers/api_purchase_requests.py`

**ต้องแก้:**
- เปลี่ยน `/api/th/v1/purchase/requests/*` → `/api/th/v1/purchases/requests/*`
- เปลี่ยน `/web/adt/th/v1/purchase/requests/*` → `/web/adt/th/v1/purchases/requests/*`

**Routes ที่ต้องแก้ (16 routes):**
1. `/api/th/v1/purchase/requests/list` → `/api/th/v1/purchases/requests/list`
2. `/api/th/v1/purchase/requests/<int:request_id>` (get) → `/api/th/v1/purchases/requests/<int:request_id>`
3. `/api/th/v1/purchase/requests` (create) → `/api/th/v1/purchases/requests`
4. `/api/th/v1/purchase/requests/<int:request_id>` (update) → `/api/th/v1/purchases/requests/<int:request_id>`
5. `/api/th/v1/purchase/requests/<int:request_id>/submit` → `/api/th/v1/purchases/requests/<int:request_id>/submit`
6. `/api/th/v1/purchase/requests/<int:request_id>/approve` → `/api/th/v1/purchases/requests/<int:request_id>/approve`
7. `/api/th/v1/purchase/requests/<int:request_id>/reject` → `/api/th/v1/purchases/requests/<int:request_id>/reject`
8. `/api/th/v1/purchase/requests/<int:request_id>/cancel` → `/api/th/v1/purchases/requests/<int:request_id>/cancel`
9-16. Frontend routes (8 routes) - แก้เหมือนกัน

---

### Priority 2: Add Convert-to-PO Endpoint (HIGH)

**ต้องเพิ่ม:**
1. Method: `_convert_to_purchase_order(request_id, **payload)`
2. External route: `POST /api/th/v1/purchases/requests/<int:request_id>/convert-to-po`
3. Frontend route: `POST /web/adt/th/v1/purchases/requests/<int:request_id>/convert-to-po`

**Implementation:**
- ใช้ wizard: `purchase.request.line.make.purchase.order`
- Input: `request_id`, optional `supplier_id`, optional `purchase_order_id` (existing PO)
- Output: Purchase Order object (serialized)

**Code reference:**
- Wizard model: `purchase.request.line.make.purchase.order`
- Method: `make_purchase_order()`
- Location: `adtv18/purchase_request/wizard/purchase_request_line_make_purchase_order.py`

---

## Summary Table

| API | Routes Status | Missing Endpoints | Priority |
|-----|--------------|-------------------|----------|
| Partners | ✅ Correct | 0 | - |
| Purchase Orders | ✅ Fixed | 0 | - |
| Purchase Requests | ❌ Wrong paths | 1 (`convert-to-po`) | **HIGH** |

**Total Issues:**
- Wrong routes: 16 routes ต้องแก้
- Missing endpoints: 1 endpoint ต้องเพิ่ม
