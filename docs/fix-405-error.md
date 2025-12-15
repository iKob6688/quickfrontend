# แก้ไข Error 405: Method Not Allowed

## 🔴 ปัญหา

Error 405 เกิดจาก `VITE_API_BASE_URL` ไม่ถูกต้อง หรือยังไม่ได้ build ใหม่หลังจากตั้งค่า `.env`

## ✅ วิธีแก้ไข

### ขั้นตอนที่ 1: ตรวจสอบ .env

```bash
cd /opt/quickfrontend
cat .env | grep VITE_API_BASE_URL
```

**ต้องเห็น:**
```env
VITE_API_BASE_URL=https://your-server.com/api
```

**❌ ถ้าเห็น:**
```env
VITE_API_BASE_URL=/api
```
แสดงว่ายังใช้ค่า development อยู่ ต้องแก้ไข

### ขั้นตอนที่ 2: ตั้งค่า .env ใหม่

```bash
# วิธีที่ 1: ใช้ setup script (แนะนำ)
npm run setup:prod

# วิธีที่ 2: แก้ไขโดยตรง
nano .env
```

**แก้ไข:**
```env
VITE_API_BASE_URL=https://your-server.com/api
# หรือ
VITE_API_BASE_URL=https://api.your-domain.com
```

**สำคัญ:** ต้องเป็น **full URL** ที่ขึ้นต้นด้วย `http://` หรือ `https://`

### ขั้นตอนที่ 3: Validate

```bash
npm run validate-env:prod
```

ต้องเห็น:
```
✅ Environment validation passed!
```

### ขั้นตอนที่ 4: Build ใหม่

**สำคัญ:** ต้อง build ใหม่ทุกครั้งที่แก้ไข `.env` เพราะ Vite จะ embed environment variables ลงใน build

```bash
npm run build
```

### ขั้นตอนที่ 5: Deploy ใหม่

```bash
sudo rsync -av --delete dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc
```

### ขั้นตอนที่ 6: Clear Browser Cache

1. เปิด Developer Tools (F12)
2. Right-click ที่ refresh button
3. เลือก "Empty Cache and Hard Reload"

หรือใช้ Incognito/Private mode

## 🔍 ตรวจสอบว่าแก้ไขแล้ว

1. เปิด Developer Tools → Network tab
2. ลอง login อีกครั้ง
3. ตรวจสอบ request ไปยัง `/api/th/v1/auth/login`
4. **ต้องไม่เห็น error 405**

## 📝 Quick Fix Script

```bash
#!/bin/bash
cd /opt/quickfrontend

# 1. Pull latest code
git pull origin main

# 2. Setup environment (ถ้ายังไม่ได้ setup)
npm run setup:prod

# 3. Validate
npm run validate-env:prod

# 4. Build
npm run build

# 5. Deploy
sudo rsync -av --delete dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc

echo "✅ Deploy completed!"
```

## ⚠️ สิ่งที่ต้องจำ

1. **ทุกครั้งที่แก้ไข `.env` ต้อง build ใหม่**
2. **`VITE_API_BASE_URL` ต้องเป็น full URL สำหรับ production**
3. **Clear browser cache หลังจาก deploy**

## 🐛 ถ้ายังไม่ได้

### ตรวจสอบว่า API endpoint ถูกต้อง

```bash
# ทดสอบ API endpoint โดยตรง
curl -X POST https://your-server.com/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -d '{"jsonrpc":"2.0","method":"call","params":{"login":"admin","password":"test","db":"your-db"}}'
```

### ตรวจสอบ Network tab

1. เปิด Developer Tools → Network
2. ดู request URL ที่ถูกเรียก
3. ตรวจสอบว่า URL ถูกต้อง (ไม่ใช่ `/api` แต่เป็น full URL)

### ตรวจสอบ build output

```bash
# ตรวจสอบว่า environment variables ถูก embed ใน build
grep -r "VITE_API_BASE_URL" dist/ | head -5
```
