# อัพเดท VITE_API_BASE_URL หลัง Install Module

## ✅ Module Install แล้ว

ตอนนี้ Odoo อยู่ที่ `v18.erpth.net` และ module `adt_th_api` ถูก install แล้ว

## 🔧 ขั้นตอนต่อไป

### 1. ทดสอบ Route

```bash
# ทดสอบ route โดยตรง
curl -X POST http://v18.erpth.net/api/th/v1/auth/login \
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
  }'
```

**ผลลัพธ์ที่คาดหวัง:**
- ✅ `200 OK` - Route ทำงานปกติ
- ❌ `404 Not Found` - Route ยังไม่มี (ต้อง restart Odoo)
- ❌ `401 Unauthorized` - API key ไม่ถูกต้อง

### 2. อัพเดท VITE_API_BASE_URL

```bash
cd /opt/quickfrontend

# แก้ไข .env
nano .env
```

แก้ไขเป็น:
```env
VITE_API_BASE_URL=https://v18.erpth.net/api
```

หรือใช้คำสั่ง:
```bash
sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://v18.erpth.net/api|' .env
```

### 3. Validate

```bash
npm run validate-env:prod
```

### 4. Build ใหม่

```bash
# Build ใหม่ (สำคัญ!)
npm run build
```

### 5. Deploy

```bash
sudo rsync -av --delete dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc
```

### 6. อัพเดท Nginx Config (ถ้าจำเป็น)

ถ้า Odoo อยู่ที่ `v18.erpth.net` และ frontend อยู่ที่ `qacc.erpth.net` อาจจะต้องอัพเดท nginx config:

```bash
sudo nano /etc/nginx/sites-available/qacc
```

ตรวจสอบว่า `location /api` proxy ไปยัง:
```nginx
location /api {
    proxy_pass http://v18.erpth.net;
    # หรือ
    # proxy_pass http://v18.erpth.net:8069;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🧪 ทดสอบ

### 1. ทดสอบ Route โดยตรง

```bash
curl -X POST https://v18.erpth.net/api/th/v1/auth/login \
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

### 2. ทดสอบผ่าน Frontend

1. เปิด browser: `https://qacc.erpth.net`
2. ลอง login
3. ตรวจสอบ Developer Tools → Network tab
4. ต้องไม่เห็น error 405 หรือ 404

## 📋 Checklist

- [ ] Module `adt_th_api` ถูก install ใน Odoo
- [ ] Route `/api/th/v1/auth/login` ทำงาน (ทดสอบด้วย curl)
- [ ] `VITE_API_BASE_URL` ถูกอัพเดทเป็น `https://v18.erpth.net/api`
- [ ] Build ใหม่แล้ว
- [ ] Deploy แล้ว
- [ ] Nginx config ถูกต้อง (ถ้าใช้ proxy)
- [ ] ทดสอบ login ผ่าน frontend แล้ว

## 🔍 Troubleshooting

### Route ยังได้ 404

```bash
# Restart Odoo
sudo systemctl restart odoo18

# ตรวจสอบ logs
sudo tail -f /var/log/odoo18/odoo-server.log
```

### Error 405 ยังอยู่

- ตรวจสอบว่า build ใหม่แล้ว
- Clear browser cache
- ตรวจสอบ Network tab ว่า URL ถูกต้อง

### Error 401 Unauthorized

- ตรวจสอบ API key ใน `.env`
- ตรวจสอบว่า API key active ใน Odoo
