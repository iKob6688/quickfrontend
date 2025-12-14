# Server Deployment Guide

## วิธีเชื่อมต่อเมื่อย้ายขึ้น Server

เมื่อย้ายแอปพลิเคชันขึ้น server แล้ว ต้องตั้งค่า environment variables ใหม่เพื่อให้เชื่อมต่อกับ Odoo backend ได้ถูกต้อง

## ปัญหาที่พบบ่อย

### Error 405: Method Not Allowed

**สาเหตุ:** `VITE_API_BASE_URL` ไม่ถูกต้อง หรือยังใช้ค่า `/api` (สำหรับ development) แทนที่จะเป็น full URL ของ server

**วิธีแก้:**
1. ใช้ CLI command `npm run update-env` เพื่ออัพเดท `.env`
2. ตั้งค่า `VITE_API_BASE_URL` เป็น full URL ของ server เช่น:
   - `https://api.example.com`
   - `https://middleware.example.com/api`
   - `http://your-server-ip:8069/api`

## ขั้นตอนการตั้งค่า

### วิธีที่ 1: ใช้ CLI Command (แนะนำ)

```bash
npm run update-env
```

Script จะถามค่าต่างๆ:
- **API Base URL**: Full URL ของ server (เช่น `https://api.example.com`)
- **API Key**: จาก Odoo API Client
- **Database Name**: ชื่อ database ใน Odoo
- **Allowed Scopes**: Scopes ที่อนุญาต (เช่น `auth,invoice,excel`)
- **Register Master Key**: (Optional) สำหรับสร้างบริษัทใหม่

### วิธีที่ 2: ใช้ Bootstrap Script

```bash
npm run bootstrap
```

กรอก:
- **Odoo bootstrap URL**: `https://your-server.com/api/th/v1/frontend/bootstrap`
- **Registration Token**: API Key จาก Odoo
- **Database name**: (Optional)

### วิธีที่ 3: แก้ไข .env โดยตรง

สร้างหรือแก้ไขไฟล์ `.env` ที่ root ของโปรเจกต์:

```env
# ===== Odoo bootstrap (auto-generated) START =====
VITE_API_BASE_URL=https://your-server.com/api
VITE_API_KEY=your-api-key-from-odoo
VITE_ODOO_DB=your-database-name
VITE_ALLOWED_SCOPES=auth,invoice,excel
VITE_REGISTER_MASTER_KEY=your-master-key-if-needed
# ===== Odoo bootstrap (auto-generated) END =====
```

## Environment Variables

### VITE_API_BASE_URL (Required)

**สำหรับ Server Deployment:**
- ต้องเป็น full URL เช่น `https://api.example.com` หรือ `https://middleware.example.com/api`
- ไม่ควรมี trailing slash (`/`) ที่ท้าย

**สำหรับ Development:**
- ใช้ `/api` (Vite จะ proxy ไปยัง `http://localhost:8069`)

**ตัวอย่าง:**
```env
# Production
VITE_API_BASE_URL=https://api.example.com

# Development
VITE_API_BASE_URL=/api
```

### VITE_API_KEY (Required)

API Key จาก Odoo API Client

**วิธีหา:**
1. เข้า Odoo → Settings → Technical → API Clients
2. เลือก API Client ที่ต้องการ
3. Copy API Key

**ตัวอย่าง:**
```env
VITE_API_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### VITE_ODOO_DB (Required)

ชื่อ database ใน Odoo

**ตัวอย่าง:**
```env
VITE_ODOO_DB=qacc
# หรือ
VITE_ODOO_DB=production
```

### VITE_ALLOWED_SCOPES (Required)

Scopes ที่อนุญาต คั่นด้วย comma

**ตัวอย่าง:**
```env
VITE_ALLOWED_SCOPES=auth,invoice,excel
# หรือสำหรับทั้งหมด
VITE_ALLOWED_SCOPES=*
```

### VITE_REGISTER_MASTER_KEY (Optional)

Master key สำหรับสร้างบริษัทใหม่ผ่าน UI

**ตัวอย่าง:**
```env
VITE_REGISTER_MASTER_KEY=your-master-key-here
```

## ตรวจสอบการตั้งค่า

### 1. ตรวจสอบ .env file

```bash
cat .env
```

ตรวจสอบว่า:
- `VITE_API_BASE_URL` เป็น full URL (สำหรับ server)
- `VITE_API_KEY` ไม่ว่าง
- `VITE_ODOO_DB` ถูกต้อง
- `VITE_ALLOWED_SCOPES` ถูกต้อง

### 2. ตรวจสอบใน Browser

1. เปิด Developer Tools (F12)
2. ไปที่ Console tab
3. ตรวจสอบ error messages
4. ไปที่ Network tab เพื่อดู API requests

### 3. ตรวจสอบ API Connection

ลองเรียก API endpoint โดยตรง:

```bash
curl -X POST https://your-server.com/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -d '{"jsonrpc":"2.0","method":"call","params":{"login":"admin","password":"admin","db":"your-db"}}'
```

## Troubleshooting

### Error 405: Method Not Allowed

**สาเหตุ:** `VITE_API_BASE_URL` ไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบว่า `VITE_API_BASE_URL` เป็น full URL (ไม่ใช่ `/api`)
2. ตรวจสอบว่า URL ไม่มี trailing slash
3. ตรวจสอบว่า server รองรับ POST method สำหรับ login endpoint

### Error 401: Unauthorized

**สาเหตุ:** API Key ไม่ถูกต้องหรือไม่ active

**วิธีแก้:**
1. ตรวจสอบ API Key ใน Odoo → Settings → Technical → API Clients
2. ตรวจสอบว่า API Client active = True
3. ตรวจสอบว่า API Key ถูก copy มาครบถ้วน (ไม่มี space)

### Error 404: Not Found

**สาเหตุ:** API endpoint ไม่พบ

**วิธีแก้:**
1. ตรวจสอบว่า `VITE_API_BASE_URL` ถูกต้อง
2. ตรวจสอบว่า server มี endpoint `/th/v1/auth/login`
3. ตรวจสอบว่า middleware/backend ทำงานอยู่

### Connection Timeout

**สาเหตุ:** ไม่สามารถเชื่อมต่อกับ server ได้

**วิธีแก้:**
1. ตรวจสอบว่า server ทำงานอยู่
2. ตรวจสอบ firewall/network settings
3. ตรวจสอบว่า URL ถูกต้อง (http vs https)

## หลังจากอัพเดท .env

### Development

```bash
# Restart dev server
npm run dev
```

### Production

```bash
# Rebuild application
npm run build

# Restart application server
# (ขึ้นอยู่กับ deployment platform)
```

## ตัวอย่างการตั้งค่าสำหรับ Server ต่างๆ

### Nginx Reverse Proxy

```env
VITE_API_BASE_URL=https://api.example.com
```

### Direct Odoo Server

```env
VITE_API_BASE_URL=http://your-server-ip:8069/api
```

### Docker Container

```env
VITE_API_BASE_URL=http://odoo-container:8069/api
```

## ข้อมูลเพิ่มเติม

- [Bootstrap Setup Guide](./bootstrap-setup-guide.md)
- [API Contract](./api_contract.md)
- [Architecture Snapshot](./architecture_snapshot.md)
