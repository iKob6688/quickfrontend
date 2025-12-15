# แก้ไขปัญหา Frontend เรียก API โดยตรง

## 🔴 ปัญหา

Frontend กำลังเรียก `https://v18.erpth.net/api/th/v1/auth/login` โดยตรง ไม่ได้ผ่าน proxy ที่ `qacc.erpth.net/api`

**ผลลัพธ์:**
- ❌ ไม่มี log ใน nginx ของ `qacc.erpth.net`
- ❌ CORS error (cross-origin request)
- ❌ Network Error

## ✅ วิธีแก้ไข

### วิธีที่ 1: ใช้ Relative Path (แนะนำ)

ตั้ง `VITE_API_BASE_URL` เป็น `/api` เพื่อให้ request ผ่าน proxy:

```bash
cd /opt/quickfrontend

# แก้ไข .env
sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=/api|' .env

# ตรวจสอบ
cat .env | grep VITE_API_BASE_URL
```

**ผลลัพธ์:**
- Request จะเป็น: `https://qacc.erpth.net/api/th/v1/auth/login`
- ผ่าน nginx proxy → `https://v18.erpth.net/api/th/v1/auth/login`
- มี log ใน nginx

### วิธีที่ 2: ใช้ Full URL ของ Frontend Domain

ตั้ง `VITE_API_BASE_URL` เป็น `https://qacc.erpth.net/api`:

```bash
cd /opt/quickfrontend

# แก้ไข .env
sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://qacc.erpth.net/api|' .env

# ตรวจสอบ
cat .env | grep VITE_API_BASE_URL
```

## 🔧 ขั้นตอน

### 1. แก้ไข .env

```bash
cd /opt/quickfrontend

# วิธีที่ 1: ใช้ relative path (แนะนำ)
sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=/api|' .env

# หรือ วิธีที่ 2: ใช้ full URL ของ frontend
# sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://qacc.erpth.net/api|' .env

# ตรวจสอบ
cat .env | grep VITE_API_BASE_URL
```

### 2. Validate

```bash
npm run validate-env:prod
```

### 3. Build ใหม่

```bash
# Build ใหม่ (สำคัญ!)
npm run build
```

### 4. Deploy

```bash
sudo rsync -av --delete dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc
```

### 5. ตรวจสอบ Nginx Config

ตรวจสอบว่า nginx config มี `location /api` ที่ proxy ไปยัง `v18.erpth.net`:

```bash
sudo cat /etc/nginx/sites-available/qacc | grep -A 20 "location /api"
```

ต้องเห็น:
```nginx
location /api {
    proxy_pass https://v18.erpth.net;
    # ... CORS headers ...
}
```

### 6. Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🧪 ทดสอบ

### 1. ตรวจสอบ Request URL

1. เปิด `https://qacc.erpth.net`
2. เปิด Developer Tools → Network tab
3. ลอง login
4. ดู request URL ต้องเป็น: `https://qacc.erpth.net/api/th/v1/auth/login`
5. **ไม่ใช่:** `https://v18.erpth.net/api/th/v1/auth/login`

### 2. ตรวจสอบ Nginx Logs

```bash
# ดู access log
sudo tail -f /var/log/nginx/qacc.access.log

# ดู error log
sudo tail -f /var/log/nginx/qacc.error.log
```

ตอนนี้ต้องเห็น log เมื่อมีการ login

### 3. ทดสอบด้วย curl

```bash
# ทดสอบผ่าน proxy
curl -X POST https://qacc.erpth.net/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "login": "admin",
      "password": "qadmin",
      "db": "q01"
    }
  }' -v
```

## 📋 Checklist

- [ ] `VITE_API_BASE_URL` ถูกแก้ไขเป็น `/api` หรือ `https://qacc.erpth.net/api`
- [ ] Build ใหม่แล้ว
- [ ] Deploy แล้ว
- [ ] Nginx config มี `location /api` ที่ proxy ไปยัง `v18.erpth.net`
- [ ] Request URL ใน Network tab เป็น `qacc.erpth.net/api/...` (ไม่ใช่ `v18.erpth.net/api/...`)
- [ ] มี log ใน nginx access log

## ⚠️ หมายเหตุ

**สำคัญ:** 
- ถ้าใช้ `VITE_API_BASE_URL=/api` → Request จะเป็น `https://qacc.erpth.net/api/...` (ผ่าน proxy)
- ถ้าใช้ `VITE_API_BASE_URL=https://v18.erpth.net/api` → Request จะเป็น `https://v18.erpth.net/api/...` (direct, ไม่ผ่าน proxy)

**แนะนำ:** ใช้ `/api` เพื่อให้ผ่าน proxy และมี log ใน nginx
