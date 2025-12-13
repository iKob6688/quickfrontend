# Bootstrap Setup Guide

## ปัญหาที่พบบ่อย

### Error: "Invalid or expired registration token"

**สาเหตุ:** API key ที่ใช้ไม่มีใน Odoo database หรือ API client ไม่ active

**วิธีแก้:**

1. **ตรวจสอบ API Client ใน Odoo:**
   - ไปที่ Odoo → Settings → Technical → API Clients
   - ตรวจสอบว่ามี API Client ที่มี key ตรงกับที่ใช้หรือไม่
   - ตรวจสอบว่า API Client ถูก activate (active = True) หรือไม่

2. **สร้าง API Client ใหม่ (ถ้ายังไม่มี):**
   - ไปที่ Settings → Technical → API Clients
   - คลิก "Create"
   - ตั้งชื่อ (เช่น "Quickfront18 Frontend")
   - เลือก Company (ถ้ามีหลาย company)
   - Save
   - Copy API Key ที่สร้างขึ้นมา

3. **ใช้ API Key เป็น Registration Token:**
   - ใช้ API Key ที่ copy มาวางใน bootstrap script
   - รัน `npm run bootstrap` อีกครั้ง

## ขั้นตอน Setup Bootstrap

### 1. สร้าง API Client ใน Odoo

```python
# หรือสร้างผ่าน Odoo shell:
# python3 odoo-bin shell -c odoo.conf -d qacc

env = request.env
api_client = env['adt.api.client'].sudo().create({
    'name': 'Quickfront18 Frontend',
    'active': True,
    'company_id': 1,  # หรือ company id ที่ต้องการ
})
print(f"API Key: {api_client.key}")
```

### 2. ใช้ API Key เป็น Registration Token

```bash
npm run bootstrap
# กรอก:
# - Odoo host: http://localhost:8069
# - Registration Token: <API Key จากขั้นตอนที่ 1>
```

### 3. ตรวจสอบ .env

หลัง bootstrap สำเร็จ ไฟล์ `.env` จะมี:

```env
# ===== Odoo bootstrap (auto-generated) START =====
VITE_API_BASE_URL=/api
VITE_API_KEY=...
VITE_ODOO_DB=qacc
VITE_ALLOWED_SCOPES=auth,invoice,excel
# ===== Odoo bootstrap (auto-generated) END =====
```

### 4. Restart Dev Server

```bash
npm run dev
```

## Troubleshooting

### API Key ไม่พบ

- ตรวจสอบว่า API Client มี key หรือไม่
- ตรวจสอบว่า key ถูก copy มาครบถ้วน (ไม่มี space ข้างหน้า/หลัง)
- ตรวจสอบว่า API Client active หรือไม่

### DB name ไม่ถูกต้อง

- ตรวจสอบว่า `request.db` ใน Odoo ถูกต้อง
- หรือระบุ db ใน bootstrap response ตามที่ต้องการ

### Company ไม่พบ

- ตรวจสอบว่ามี company ใน Odoo หรือไม่
- หรือระบุ company_id ใน API Client

