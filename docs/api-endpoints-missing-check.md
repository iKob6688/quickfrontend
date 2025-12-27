# API Endpoints Missing Check

สรุปปัญหา API endpoints ที่ frontend เรียกใช้แต่ backend ยังไม่มี

## 1. Partners/Customers API

### Frontend เรียกใช้:
- `POST /api/th/v1/partners/list`
- `POST /api/th/v1/partners/:id`
- `POST /api/th/v1/partners/create`
- `POST /api/th/v1/partners/:id/update`

### Status: ✅ ควรมี (ตาม docs/api_contract.md)
- เอกสารบอกว่า **"[Implemented]"** ใน `docs/api_contract.md` line 191-257
- Backend ควรมี routes เหล่านี้อยู่แล้ว

### Backend ควรตรวจสอบ:
1. Controller file: `adt_th_api/controllers/partners.py` หรือ `contacts.py`
2. Routes registered ว่ามี `/api/th/v1/partners/*` จริงหรือไม่
3. Service restarted หลังจากเพิ่ม routes หรือยัง?

---

## 2. Purchase Orders API

### Frontend เรียกใช้:
- `POST /api/th/v1/purchases/orders/list`
- `POST /api/th/v1/purchases/orders/:id`
- `POST /api/th/v1/purchases/orders` (create)
- `PUT /api/th/v1/purchases/orders/:id` (update)
- `POST /api/th/v1/purchases/orders/:id/confirm`
- `POST /api/th/v1/purchases/orders/:id/cancel`

### Status: ❌ ยังไม่มี (ไม่มีใน docs/api_contract.md)
- **ไม่มีในเอกสาร** `docs/api_contract.md`
- เอกสารมีแค่ invoices, partners, excel, dashboard เท่านั้น
- Frontend สร้างใหม่ตาม spec ใน `docs/api-purchases-expenses-taxes.md`

### Backend ต้องสร้าง:
1. Controller file: `adt_th_api/controllers/purchases.py`
2. Routes:
   ```python
   @route('/api/th/v1/purchases/orders/list', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/orders/<int:id>', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/orders', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/orders/<int:id>', type='json', auth='bearer', methods=['PUT'])
   @route('/api/th/v1/purchases/orders/<int:id>/confirm', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/orders/<int:id>/cancel', type='json', auth='bearer', methods=['POST'])
   ```
3. Model: `purchase.order` ใน Odoo
4. Scope: เพิ่ม `purchases` scope ใน API client

---

## 3. Purchase Requests API

### Frontend เรียกใช้:
- `POST /api/th/v1/purchases/requests/list`
- `POST /api/th/v1/purchases/requests/:id`
- `POST /api/th/v1/purchases/requests` (create)
- `PUT /api/th/v1/purchases/requests/:id` (update)
- `POST /api/th/v1/purchases/requests/:id/submit`
- `POST /api/th/v1/purchases/requests/:id/approve`
- `POST /api/th/v1/purchases/requests/:id/reject`
- `POST /api/th/v1/purchases/requests/:id/cancel`
- `POST /api/th/v1/purchases/requests/:id/convert-to-po`

### Status: ❌ ยังไม่มี (ไม่มีใน docs/api_contract.md)
- **ไม่มีในเอกสาร** `docs/api_contract.md`
- Frontend สร้างใหม่ตาม spec ใน `docs/purchase-requests-verification.md`

### Backend ต้องสร้าง:
1. Controller file: `adt_th_api/controllers/purchase_requests.py`
2. Routes:
   ```python
   @route('/api/th/v1/purchases/requests/list', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/requests/<int:id>', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/requests', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/requests/<int:id>', type='json', auth='bearer', methods=['PUT'])
   @route('/api/th/v1/purchases/requests/<int:id>/submit', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/requests/<int:id>/approve', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/requests/<int:id>/reject', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/requests/<int:id>/cancel', type='json', auth='bearer', methods=['POST'])
   @route('/api/th/v1/purchases/requests/<int:id>/convert-to-po', type='json', auth='bearer', methods=['POST'])
   ```
3. Model: `purchase.request` ใน Odoo (ต้องติดตั้ง module `purchase_request`)
4. Scope: ใช้ `purchases` scope (เดียวกับ Purchase Orders)

---

## 4. Summary Table

| API Endpoint | Frontend Calls | Backend Status | Action Required |
|--------------|----------------|----------------|-----------------|
| `/api/th/v1/partners/*` | ✅ | ✅ Should exist | Verify routes exist |
| `/api/th/v1/purchases/orders/*` | ✅ | ❌ Missing | Create controller + routes |
| `/api/th/v1/purchases/requests/*` | ✅ | ❌ Missing | Create controller + routes |

---

## 5. Action Items สำหรับ Backend Team

### 5.1 Verify Partners API (Priority: High)

```bash
# Check if partners controller exists
find /opt/odoo18/odoo/adtv18 -name "*partner*.py" -o -name "*contact*.py"

# Check if routes are registered (in Odoo shell)
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  shell -c /etc/odoo18-api.conf -d q01

# In shell:
env['ir.http']._generate_routing_rules()
# Look for '/api/th/v1/partners' in the output
```

**If missing**: Create `adt_th_api/controllers/partners.py` with routes.

### 5.2 Create Purchase Orders API (Priority: High)

1. Create `adt_th_api/controllers/purchases.py`:
   - List, Get, Create, Update, Confirm, Cancel endpoints
   - Connect to `purchase.order` model
   - See spec in `docs/api-purchases-expenses-taxes.md` section 1.1

2. Add routes to controller
3. Test endpoints
4. Upgrade module: `-u adt_th_api --stop-after-init`
5. Restart service: `systemctl restart odoo18-api`

### 5.3 Create Purchase Requests API (Priority: Medium)

1. Ensure `purchase_request` module is installed in Odoo
2. Create `adt_th_api/controllers/purchase_requests.py`:
   - List, Get, Create, Update, Submit, Approve, Reject, Cancel, Convert endpoints
   - Connect to `purchase.request` model
   - See spec in `docs/purchase-requests-verification.md` section 3

3. Add routes to controller
4. Test endpoints
5. Upgrade module: `-u adt_th_api --stop-after-init`
6. Restart service: `systemctl restart odoo18-api`

### 5.4 Add API Scopes

Ensure API client has required scopes:
- `contacts` (for partners)
- `purchases` (for purchase orders and purchase requests)

---

## 6. Testing Commands

### Test Partners API:
```bash
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/partners/list?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10},"id":1}'
```

### Test Purchase Orders API (after implementation):
```bash
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/orders/list?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10},"id":1}'
```

### Test Purchase Requests API (after implementation):
```bash
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/requests/list?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10},"id":1}'
```

---

## 7. Expected Error Messages

### 404 Not Found:
- **Meaning**: Route doesn't exist in backend
- **Fix**: Create controller + routes, upgrade module, restart service

### 401 Unauthorized:
- **Meaning**: Missing API key or Bearer token
- **Fix**: Check `VITE_API_KEY` env and auth token

### 405 Method Not Allowed:
- **Meaning**: Wrong HTTP method (using GET instead of POST)
- **Fix**: Use POST for JSON-RPC endpoints

### 500 Internal Server Error:
- **Meaning**: Backend error (model not found, permission issue, etc.)
- **Fix**: Check Odoo logs, verify model exists, check permissions

