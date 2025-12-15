# Final Deployment Steps

## ✅ สถานะปัจจุบัน

- ✅ Module Odoo install แล้ว
- ✅ Route `/api/th/v1/auth/login` ทำงานแล้ว (ได้ token แล้ว)
- ✅ Odoo อยู่ที่ `v18.erpth.net`

## 🚀 ขั้นตอนสุดท้าย

### 1. อัพเดท VITE_API_BASE_URL

```bash
cd /opt/quickfrontend

# แก้ไข .env
sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://v18.erpth.net/api|' .env

# ตรวจสอบ
cat .env | grep VITE_API_BASE_URL
```

ต้องเห็น: `VITE_API_BASE_URL=https://v18.erpth.net/api`

### 2. Validate Configuration

```bash
npm run validate-env:prod
```

### 3. Build ใหม่

```bash
# Build ใหม่ (สำคัญ! เพราะ environment variables ถูก embed ตอน build)
npm run build
```

### 4. Deploy

```bash
sudo rsync -av --delete dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc
```

### 5. อัพเดท Nginx Config (ถ้าจำเป็น)

ถ้า frontend อยู่ที่ `qacc.erpth.net` และต้องการ proxy `/api` ไปยัง `v18.erpth.net`:

```bash
sudo nano /etc/nginx/sites-available/qacc
```

ตรวจสอบ `location /api`:
```nginx
location /api {
    proxy_pass https://v18.erpth.net;
    # หรือถ้าใช้ http
    # proxy_pass http://v18.erpth.net:8069;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # CORS headers (ถ้าจำเป็น)
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-ADT-API-Key, X-Instance-ID" always;
}
```

Reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 6. ทดสอบ Frontend

1. เปิด browser: `https://qacc.erpth.net`
2. ลอง login
3. ตรวจสอบ Developer Tools → Network tab
4. ต้องไม่เห็น error 405 หรือ 404
5. Login สำเร็จและได้ token

## 📋 Quick Command Summary

```bash
cd /opt/quickfrontend

# 1. อัพเดท .env
sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://v18.erpth.net/api|' .env

# 2. Validate
npm run validate-env:prod

# 3. Build
npm run build

# 4. Deploy
sudo rsync -av --delete dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc

# 5. Reload nginx (ถ้าจำเป็น)
sudo systemctl reload nginx
```

## ✅ Checklist

- [ ] `VITE_API_BASE_URL` ถูกอัพเดทเป็น `https://v18.erpth.net/api`
- [ ] Build ใหม่แล้ว
- [ ] Deploy แล้ว
- [ ] Nginx config ถูกต้อง (ถ้าใช้ proxy)
- [ ] ทดสอบ login ผ่าน frontend สำเร็จ
- [ ] ได้ token และ login สำเร็จ

## 🎉 เสร็จสิ้น!

หลังจากทำตามขั้นตอนนี้ frontend ควรจะทำงานได้ปกติและ login ได้สำเร็จ
