# สร้าง API Client ใน Odoo สำหรับ Bootstrap

## วิธีที่ 1: ผ่าน Odoo UI

1. เปิด Odoo → **Settings** → **Technical** → **API Clients**
2. คลิก **Create**
3. กรอกข้อมูล:
   - **Name**: `Quickfront18 Frontend`
   - **Company**: เลือก company ที่ต้องการ (หรือปล่อยว่าง)
   - **Active**: ✓ (ต้องติ๊ก)
4. คลิก **Save**
5. **Copy API Key** ที่แสดงในฟิลด์ "API Key"
6. ใช้ API Key นี้เป็น Registration Token ใน bootstrap script

## วิธีที่ 2: ผ่าน Odoo Shell

```bash
# เปิด Odoo shell
cd /path/to/odoo
python3 odoo-bin shell -c odoo.conf -d qacc
```

ใน shell:
```python
env = request.env

# สร้าง API Client
api_client = env['adt.api.client'].sudo().create({
    'name': 'Quickfront18 Frontend',
    'active': True,
    'company_id': 1,  # หรือ company id ที่ต้องการ (ถ้ามีหลาย company)
})

print(f"\n✅ API Client created!")
print(f"   Name: {api_client.name}")
print(f"   API Key: {api_client.key}")
print(f"   Company: {api_client.company_id.name if api_client.company_id else 'All'}")
print(f"\n📋 Copy this API Key to use as Registration Token:\n")
print(f"   {api_client.key}\n")
```

## วิธีที่ 3: ใช้ API Key ที่มีอยู่แล้ว

ถ้ามี API Client อยู่แล้ว:

1. ไปที่ **Settings** → **Technical** → **API Clients**
2. เปิด API Client ที่ต้องการ
3. ตรวจสอบว่า:
   - **Active** = ✓ (ต้องติ๊ก)
   - มี **API Key** ในฟิลด์
4. Copy **API Key**
5. ใช้เป็น Registration Token

## ตรวจสอบ API Client

```python
# ใน Odoo shell
env = request.env
clients = env['adt.api.client'].sudo().search([])

print(f"Total API Clients: {len(clients)}\n")
for c in clients:
    print(f"  - {c.name}")
    print(f"    Key: {c.key[:30]}...")
    print(f"    Active: {c.active}")
    print(f"    Company: {c.company_id.name if c.company_id else 'All'}")
    print()
```

## Troubleshooting

### API Key ไม่พบ
- ตรวจสอบว่า API Client **Active** = ✓
- ตรวจสอบว่า key ถูก copy มาครบถ้วน (ไม่มี space)
- ตรวจสอบว่าใช้ key ที่ถูกต้อง (ไม่ใช่ name)

### Company ไม่พบ
- ตรวจสอบว่ามี company ใน Odoo หรือไม่
- หรือระบุ `company_id` เมื่อสร้าง API Client

