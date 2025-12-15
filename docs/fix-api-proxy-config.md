# แก้ไข API Proxy Configuration

## 📍 สถานะปัจจุบัน

- **Frontend:** `https://qacc.erpth.net` (React app)
- **Backend:** `https://v18.erpth.net` (Odoo)
- **ปัญหา:** Frontend เรียก API โดยตรงไปยัง `v18.erpth.net` ไม่ผ่าน proxy

## ✅ วิธีแก้ไข

### 1. แก้ไข VITE_API_BASE_URL

ตั้งค่าให้ใช้ relative path เพื่อให้ request ผ่าน nginx proxy:

```bash
cd /opt/quickfrontend

# แก้ไข .env
sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=/api|' .env

# ตรวจสอบ
cat .env | grep VITE_API_BASE_URL
```

**ต้องเห็น:** `VITE_API_BASE_URL=/api`

### 2. Build ใหม่

```bash
# Validate
npm run validate-env:prod

# Build ใหม่ (สำคัญ!)
npm run build
```

### 3. Deploy

```bash
sudo rsync -av --delete dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc
```

### 4. ตรวจสอบ Nginx Config

ตรวจสอบว่า nginx config มี `location /api` ที่ proxy ไปยัง `v18.erpth.net`:

```bash
sudo cat /etc/nginx/sites-available/qacc | grep -A 30 "location /api"
```

**ต้องมี:**
```nginx
location /api {
    proxy_pass https://v18.erpth.net;
    
    # CORS headers
    add_header Access-Control-Allow-Origin "https://qacc.erpth.net" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-ADT-API-Key, X-Instance-ID" always;
    add_header Access-Control-Allow-Credentials "true" always;
    
    # Handle preflight
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin "https://qacc.erpth.net" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-ADT-API-Key, X-Instance-ID" always;
        add_header Access-Control-Max-Age 3600;
        add_header Content-Type 'text/plain charset=UTF-8';
        add_header Content-Length 0;
        return 204;
    }
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeout settings
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # SSL settings
    proxy_ssl_verify off;
    proxy_ssl_server_name on;
}
```

### 5. Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🔄 Flow ที่ถูกต้อง

### ❌ ผิด (ตอนนี้)

```
Browser → https://v18.erpth.net/api/th/v1/auth/login (direct)
         ❌ ไม่ผ่าน nginx proxy
         ❌ ไม่มี log ใน nginx
         ❌ CORS error
```

### ✅ ถูกต้อง (หลังแก้ไข)

```
Browser → https://qacc.erpth.net/api/th/v1/auth/login
         ↓ (nginx proxy)
         → https://v18.erpth.net/api/th/v1/auth/login
         ✅ ผ่าน nginx proxy
         ✅ มี log ใน nginx
         ✅ ไม่มี CORS error
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
# ดู access log (ต้องเห็น log)
sudo tail -f /var/log/nginx/qacc.access.log

# ดู error log
sudo tail -f /var/log/nginx/qacc.error.log
```

### 3. ทดสอบด้วย curl

```bash
# ทดสอบผ่าน proxy
curl -X POST https://qacc.erpth.net/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -H "Origin: https://qacc.erpth.net" \
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

- [ ] `VITE_API_BASE_URL=/api` (ไม่ใช่ `https://v18.erpth.net/api`)
- [ ] Build ใหม่แล้ว
- [ ] Deploy แล้ว
- [ ] Nginx config มี `location /api` ที่ proxy ไปยัง `https://v18.erpth.net`
- [ ] Nginx config มี CORS headers
- [ ] Request URL ใน Network tab เป็น `qacc.erpth.net/api/...`
- [ ] มี log ใน nginx access log

## ⚠️ หมายเหตุ

**สำคัญ:** 
- Frontend อยู่ที่ `qacc.erpth.net`
- Backend อยู่ที่ `v18.erpth.net`
- ต้องใช้ nginx proxy เพื่อ:
  - หลีกเลี่ยง CORS issues
  - มี log ใน nginx
  - ควบคุม request flow

**ไม่ควร:** ตั้ง `VITE_API_BASE_URL=https://v18.erpth.net/api` เพราะจะทำให้:
- Request ไปยัง backend โดยตรง (ไม่ผ่าน proxy)
- ไม่มี log ใน nginx
- CORS error

**ควร:** ตั้ง `VITE_API_BASE_URL=/api` เพื่อให้:
- Request ผ่าน nginx proxy
- มี log ใน nginx
- ไม่มี CORS error
