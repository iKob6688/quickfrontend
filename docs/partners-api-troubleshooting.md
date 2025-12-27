# Partners API Troubleshooting Guide

## ปัญหาที่พบบ่อย: รายชื่อติดต่อไม่ทำงาน

### 1. ตรวจสอบ API Endpoint

Frontend เรียกใช้:
- `POST /api/th/v1/partners/list`

### 2. วิธีตรวจสอบ Backend

#### 2.1 ตรวจสอบว่า Controller มีอยู่จริง

```bash
# SSH เข้าไปที่ server
ssh user@server

# ตรวจสอบว่า controller file มีอยู่
find /opt/odoo18 -name "*partner*.py" -o -name "*contact*.py" | grep -i adt
```

#### 2.2 ตรวจสอบ Routes ใน Odoo Shell

```bash
# เข้า Odoo shell
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  shell -c /etc/odoo18-api.conf -d q01
```

ใน Odoo shell:
```python
# Build routing map
root = env['ir.http']
app = root.get_wsgi_application()
rules = root.nodb_routing_map.items()

# หา routes ที่มี 'partners'
for rule in rules:
    if 'partners' in str(rule[0]):
        print(rule)
```

#### 2.3 ตรวจสอบ Service Status

```bash
# ตรวจสอบว่า service ทำงานอยู่
sudo systemctl status odoo18-api

# ตรวจสอบ logs
sudo journalctl -u odoo18-api -n 50 --no-pager
```

#### 2.4 Test API Endpoint ด้วย curl

```bash
# Test partners list endpoint
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/partners/list?db=q01" \
  -H "X-ADT-API-Key: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10},"id":1}'
```

### 3. ปัญหาที่เป็นไปได้และวิธีแก้ไข

#### ปัญหา 1: 404 Not Found

**สาเหตุ**: API endpoint ยังไม่มีใน backend

**วิธีแก้**:
1. ตรวจสอบว่า controller file `adt_th_api/controllers/partners.py` มีอยู่
2. ตรวจสอบว่า routes ถูก register แล้ว
3. Upgrade module: `sudo -u odoo18 ... -u adt_th_api --stop-after-init`
4. **Restart service**: `sudo systemctl restart odoo18-api` (สำคัญ!)

#### ปัญหา 2: 401 Unauthorized

**สาเหตุ**: API Key หรือ Bearer token ไม่ถูกต้อง

**วิธีแก้**:
1. ตรวจสอบ `VITE_API_KEY` ใน `.env`
2. ตรวจสอบ Bearer token ใน browser DevTools
3. ตรวจสอบว่า API client มี scope `contacts`

#### ปัญหา 3: 500 Internal Server Error

**สาเหตุ**: Backend error (model ไม่พบ, permission issue, etc.)

**วิธีแก้**:
1. ตรวจสอบ Odoo logs: `sudo journalctl -u odoo18-api -n 100`
2. ตรวจสอบว่า model `res.partner` มีอยู่
3. ตรวจสอบ permissions ของ API user

#### ปัญหา 4: Response Format ไม่ถูกต้อง

**สาเหตุ**: Backend ส่ง response format ที่ไม่ตรงกับที่ frontend คาดหวัง

**วิธีแก้**:
1. ตรวจสอบ console log ใน browser DevTools (F12)
2. ดู log ที่ขึ้นต้นด้วย `[listPartners]`
3. ตรวจสอบ response format ว่าเป็น JSON-RPC หรือไม่

### 4. Debug ใน Frontend

#### 4.1 เปิด Browser DevTools

1. กด F12 หรือคลิกขวา → Inspect
2. ไปที่ Tab "Console"
3. ดู error messages และ debug logs

#### 4.2 ตรวจสอบ Network Requests

1. ไปที่ Tab "Network"
2. กรองด้วย "partners"
3. คลิกที่ request `/api/th/v1/partners/list`
4. ตรวจสอบ:
   - Status Code (200, 404, 401, 500, etc.)
   - Request Headers (X-ADT-API-Key, Authorization)
   - Response Body

#### 4.3 ดู Debug Logs

Frontend จะ log ข้อมูลต่อไปนี้เมื่อ `import.meta.env.DEV === true`:
- `[listPartners] Raw API response` - Raw response จาก backend
- `[listPartners] Unwrapped data` - Data หลังจาก unwrap
- `[listPartners] Mapped items` - Data หลังจาก map fields

### 5. Checklist สำหรับ Backend Team

- [ ] Controller file `adt_th_api/controllers/partners.py` มีอยู่
- [ ] Routes `/api/th/v1/partners/*` ถูก register
- [ ] Module `adt_th_api` ถูก upgrade (`-u adt_th_api --stop-after-init`)
- [ ] Service `odoo18-api` ถูก restart (`systemctl restart odoo18-api`)
- [ ] API endpoint `/api/th/v1/partners/list` return 200 OK
- [ ] Response format เป็น JSON-RPC: `{ jsonrpc: "2.0", result: { success: true, data: [...] } }`
- [ ] API client มี scope `contacts`

### 6. ตัวอย่าง Response ที่ถูกต้อง

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Company Name",
        "display_name": "Company Name",
        "vat": "1234567890123",
        "phone": "02-123-4567",
        "email": "contact@company.com",
        "active": true,
        "isCompany": true,
        "company_type": "company"
      }
    ],
    "error": null
  }
}
```

หรืออาจจะเป็น array โดยตรง:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Company Name",
        ...
      }
    ]
  }
}
```

Frontend จะ handle ทั้งสอง format ได้

