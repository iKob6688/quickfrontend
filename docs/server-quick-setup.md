# Quick Setup Guide สำหรับ Server

## ปัญหา: npm run update-env ไม่พบ script

ถ้าได้ error `Missing script: "update-env"` แสดงว่า code บน server ยังไม่ได้อัพเดท

## วิธีแก้ (เลือกวิธีใดวิธีหนึ่ง)

### วิธีที่ 1: รัน Script โดยตรง (เร็วที่สุด) ⚡

```bash
node scripts/update-env.js
```

### วิธีที่ 2: อัพเดท package.json บน Server

แก้ไขไฟล์ `package.json` เพิ่มบรรทัดนี้ในส่วน `scripts`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "bootstrap": "node scripts/bootstrap.js",
    "update-env": "node scripts/update-env.js"
  }
}
```

แล้วรัน:
```bash
npm run update-env
```

### วิธีที่ 3: Pull Code ใหม่จาก Git

```bash
git pull origin main
# หรือ branch ที่คุณใช้
npm run update-env
```

### วิธีที่ 4: สร้าง .env โดยตรง (ถ้าไม่มี script)

สร้างไฟล์ `.env` ที่ root ของโปรเจกต์:

```bash
nano .env
```

ใส่เนื้อหาดังนี้:

```env
# ===== Odoo bootstrap (auto-generated) START =====
VITE_API_BASE_URL=https://your-server.com/api
VITE_API_KEY=your-api-key-from-odoo
VITE_ODOO_DB=your-database-name
VITE_ALLOWED_SCOPES=auth,invoice,excel
# ===== Odoo bootstrap (auto-generated) END =====
```

**สำคัญ:** แก้ไขค่าต่างๆ ให้ตรงกับ server ของคุณ:
- `VITE_API_BASE_URL`: ต้องเป็น full URL เช่น `https://api.example.com` หรือ `https://your-server.com/api`
- `VITE_API_KEY`: API Key จาก Odoo → Settings → Technical → API Clients
- `VITE_ODOO_DB`: ชื่อ database ใน Odoo
- `VITE_ALLOWED_SCOPES`: เช่น `auth,invoice,excel`

## ตรวจสอบว่า Script มีอยู่

```bash
# ตรวจสอบว่าไฟล์มีอยู่
ls -la scripts/update-env.js

# ถ้ามี ให้รันโดยตรง
node scripts/update-env.js
```

## หลังจากตั้งค่า .env

### Development
```bash
npm run dev
```

### Production
```bash
# Rebuild
npm run build

# Restart application
# (ขึ้นอยู่กับ deployment platform ของคุณ)
```

## Troubleshooting

### Error: Cannot find module 'readline'
- Node.js version ต่ำเกินไป ต้องใช้ Node.js 18+ หรือ 20+

### Error: Cannot find module 'fs'
- ตรวจสอบว่าใช้ Node.js (ไม่ใช่ browser environment)

### Script ไม่ทำงาน
- ตรวจสอบว่าไฟล์มี execute permission: `chmod +x scripts/update-env.js`
- หรือรัน: `node scripts/update-env.js`
