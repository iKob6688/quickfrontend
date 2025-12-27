# Purchase Orders API - Backend Implementation Required

## ⚠️ ปัญหาปัจจุบัน

Frontend พร้อมใช้งานแล้ว แต่ backend ยังไม่มี API endpoints สำหรับ Purchase Orders ทำให้หน้า UI แสดง error 404 หรือข้อมูลไม่สมบูรณ์

## ✅ Frontend Status (Production-Ready)

Frontend implementation เป็น **production-grade** แล้ว:

- ✅ Service layer: `src/api/services/purchases.service.ts`
- ✅ UI Components: `src/features/purchases/PurchaseOrdersListPage.tsx`
- ✅ Type definitions: TypeScript interfaces ครบถ้วน
- ✅ Error handling: จัดการ error cases ครบ
- ✅ Loading states: แสดง loading, error, empty states
- ✅ Infinite scroll: รองรับ pagination
- ✅ Search & Filter: รองรับการค้นหาและกรองสถานะ

**Frontend ไม่ได้ใช้ mock data** - มันเรียก API จริงผ่าน `apiClient.post('/th/v1/purchases/orders/list', ...)`

## ❌ Backend Status (Missing)

Backend ยัง**ไม่มี** routes สำหรับ Purchase Orders:

- ❌ Controller file: `adt_th_api/controllers/purchases.py` - **ยังไม่มี**
- ❌ Routes: `/api/th/v1/purchases/orders/*` - **ยังไม่ register**
- ❌ Model integration: ยังไม่ได้เชื่อมต่อกับ `purchase.order` ใน Odoo

## 📋 API Specification

Frontend เรียกใช้ endpoints ตาม spec ใน `docs/api-purchases-expenses-taxes.md`:

### Required Endpoints

1. **List Purchase Orders**
   - `POST /api/th/v1/purchases/orders/list`
   - Request params: `{ status?, vendor_id?, search?, limit?, offset?, date_from?, date_to? }`
   - Response: `ApiEnvelope<PurchaseOrderListItem[]>`

2. **Get Purchase Order**
   - `POST /api/th/v1/purchases/orders/:id`
   - Request params: `{ id: number }`
   - Response: `ApiEnvelope<PurchaseOrder>`

3. **Create Purchase Order**
   - `POST /api/th/v1/purchases/orders`
   - Request params: `PurchaseOrderPayload`
   - Response: `ApiEnvelope<PurchaseOrder>`

4. **Update Purchase Order**
   - `PUT /api/th/v1/purchases/orders/:id`
   - Request params: `{ id: number } & PurchaseOrderPayload`
   - Response: `ApiEnvelope<PurchaseOrder>`

5. **Confirm Purchase Order**
   - `POST /api/th/v1/purchases/orders/:id/confirm`
   - Request params: `{ id: number }`
   - Response: `ApiEnvelope<PurchaseOrder>`

6. **Cancel Purchase Order**
   - `POST /api/th/v1/purchases/orders/:id/cancel`
   - Request params: `{ id: number, reason?: string }`
   - Response: `ApiEnvelope<PurchaseOrder>`

## 🔧 Implementation Steps for Backend Team

### Step 1: Create Controller File

สร้างไฟล์: `adt_th_api/controllers/purchases.py`

```python
from odoo import http
from odoo.http import request
from ..utils import authenticate, api_envelope, validate_scope

class PurchaseOrdersController(http.Controller):
    
    @http.route('/api/th/v1/purchases/orders/list', type='json', auth='bearer', methods=['POST'], csrf=False)
    @authenticate
    @validate_scope('purchases')
    def list_purchase_orders(self):
        # Extract params from JSON-RPC request
        params = request.jsonrequest.get('params', {})
        status = params.get('status')
        vendor_id = params.get('vendor_id')
        search = params.get('search')
        limit = params.get('limit', 100)
        offset = params.get('offset', 0)
        date_from = params.get('date_from')
        date_to = params.get('date_to')
        
        # Query purchase.order model
        domain = []
        if status:
            domain.append(('state', '=', status))
        if vendor_id:
            domain.append(('partner_id', '=', vendor_id))
        if search:
            domain.append('|', ('name', 'ilike', search), ('partner_id.name', 'ilike', search))
        if date_from:
            domain.append(('date_order', '>=', date_from))
        if date_to:
            domain.append(('date_order', '<=', date_to))
        
        # Get purchase orders
        po_env = request.env['purchase.order']
        pos = po_env.search(domain, limit=limit, offset=offset, order='date_order desc')
        
        # Transform to API format
        items = []
        for po in pos:
            items.append({
                'id': po.id,
                'number': po.name or '',
                'vendorName': po.partner_id.name or '',
                'vendorId': po.partner_id.id,
                'orderDate': po.date_order.isoformat() if po.date_order else '',
                'expectedDate': po.date_planned.isoformat() if po.date_planned else None,
                'total': float(po.amount_total),
                'status': self._map_state_to_status(po.state),
                'currency': po.currency_id.name,
            })
        
        return api_envelope(items)
    
    def _map_state_to_status(self, state: str) -> str:
        """Map Odoo purchase.order state to API status"""
        mapping = {
            'draft': 'draft',
            'sent': 'sent',
            'to approve': 'to_approve',
            'purchase': 'purchase',
            'done': 'done',
            'cancel': 'cancel',
        }
        return mapping.get(state, 'draft')
    
    # Implement other endpoints: get, create, update, confirm, cancel
    # ... (see full implementation in API spec)
```

### Step 2: Register Routes

ให้แน่ใจว่า routes ถูก register ใน Odoo routing map โดยการ:

1. Import controller ใน `adt_th_api/__init__.py` หรือ `__manifest__.py`
2. หรือให้แน่ใจว่า controller file อยู่ใน `controllers/` directory และถูก auto-discovered

### Step 3: Add Scope

ถ้ายังไม่มี scope `purchases` ให้เพิ่มใน `adt_th_api`:

```python
# In your scope definition file
SCOPES = {
    # ... existing scopes
    'purchases': 'Purchase Orders management',
}
```

### Step 4: Upgrade Module & Restart

```bash
# Upgrade module
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  -c /etc/odoo18-api.conf -d q01 -u adt_th_api --stop-after-init

# Restart service
sudo systemctl restart odoo18-api

# Verify routes are registered
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  shell -c /etc/odoo18-api.conf -d q01
```

ใน Odoo shell:
```python
>>> request.env['ir.http']._get_routing_map()._rules_by_endpoint
# Look for 'purchases' or '/api/th/v1/purchases'
```

### Step 5: Test with curl

```bash
API_KEY="<adt_api_client.key>"
TOKEN="<Bearer token>"

# Test list endpoint
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/orders/list" \
  -H "X-ADT-API-Key: $API_KEY" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10,"offset":0},"id":1}'
```

## 📚 Reference Documents

- **API Specification**: `docs/api-purchases-expenses-taxes.md`
- **Type Definitions**: `src/api/services/purchases.service.ts`
- **Frontend Implementation**: `src/features/purchases/PurchaseOrdersListPage.tsx`
- **Verification Guide**: `docs/purchase-orders-partners-verification.md`

## ✅ Acceptance Criteria

Backend implementation จะสำเร็จเมื่อ:

1. ✅ `POST /api/th/v1/purchases/orders/list` returns `200 OK` with valid data
2. ✅ Response format matches `ApiEnvelope<PurchaseOrderListItem[]>` spec
3. ✅ All required fields are present (`id`, `number`, `vendorName`, `orderDate`, `total`, `status`, `currency`)
4. ✅ Status filtering works (`status` param)
5. ✅ Search works (`search` param)
6. ✅ Pagination works (`limit`, `offset` params)
7. ✅ Frontend UI shows data correctly (no more "ร่าง #undefined")

## 🔍 Troubleshooting

### Issue: 404 Not Found

**Cause**: Routes not registered in Odoo routing map

**Fix**:
1. Verify controller file exists and is in correct location
2. Restart Odoo service (not just upgrade module)
3. Check Odoo logs for route registration errors

### Issue: 401 Unauthorized

**Cause**: Missing `X-ADT-API-Key` or `Authorization: Bearer` headers

**Fix**: Frontend already sends these headers. Check backend authentication logic.

### Issue: 405 Method Not Allowed

**Cause**: Route defined with wrong HTTP method

**Fix**: Use `methods=['POST']` for JSON-RPC endpoints (not `methods=['GET']`)

### Issue: Data structure mismatch

**Cause**: Response format doesn't match `ApiEnvelope` spec

**Fix**: Use `api_envelope()` helper to wrap response:
```python
return api_envelope(data)  # Returns { success: True, data: ... }
```

---

**Summary**: Frontend is production-ready and waiting for backend API endpoints. Once backend implements the routes above, the Purchase Orders feature will work end-to-end.

