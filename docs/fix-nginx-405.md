# แก้ไข Nginx 405 Error

## 🔴 ปัญหา

Nginx ตอบ `405 Not Allowed` แสดงว่า:
- Request ไปถึง nginx แล้ว ✅
- แต่ nginx ไม่ได้ proxy ไปยัง backend หรือไม่รองรับ POST method ❌

## 🔍 ตรวจสอบ Odoo Port

```bash
# ใช้ ss แทน netstat
ss -tlnp | grep 8069

# หรือ
sudo lsof -i :8069

# หรือดูใน odoo config
cat /etc/odoo18.conf | grep xmlrpc_port
```

## 🔧 แก้ไข Nginx Configuration

### 1. ตรวจสอบ Config File

```bash
# ดู config files
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/

# ดู config ที่เกี่ยวข้อง
cat /etc/nginx/sites-available/qacc
# หรือ
cat /etc/nginx/sites-available/default
```

### 2. แก้ไข Config

```bash
sudo nano /etc/nginx/sites-available/qacc
# หรือ
sudo nano /etc/nginx/sites-available/default
```

### 3. เพิ่มหรือแก้ไข Location Block

```nginx
server {
    listen 80;
    server_name qacc.erpth.net;
    
    # Frontend static files
    root /var/www/qacc;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy - สำคัญ!
    location /api {
        # Proxy ไปยัง Odoo backend
        # ตรวจสอบ port จาก odoo config หรือ ss command
        proxy_pass http://127.0.0.1:8069;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # อนุญาต POST method
        proxy_method POST;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

**สำคัญ:** 
- แก้ไข `proxy_pass` ให้ชี้ไปยัง Odoo backend (ปกติ `http://127.0.0.1:8069`)
- ตรวจสอบ port จาก `/etc/odoo18.conf` หรือ `ss -tlnp | grep 8069`

### 4. ตรวจสอบ Odoo Config

```bash
# ดู port ที่ Odoo ฟัง
cat /etc/odoo18.conf | grep -E "xmlrpc_port|http_port"
```

### 5. Reload Nginx

```bash
# ตรวจสอบ syntax
sudo nginx -t

# ถ้า OK ให้ reload
sudo systemctl reload nginx
```

## 🧪 ทดสอบ

### 1. ทดสอบ Backend โดยตรง

```bash
# ทดสอบว่า Odoo ทำงาน
curl -X POST http://127.0.0.1:8069/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
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

### 2. ทดสอบผ่าน Nginx

```bash
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

**ผลลัพธ์ที่คาดหวัง:**
- ✅ `200 OK` - ทำงานปกติ
- ❌ `405 Not Allowed` - ยังมีปัญหา
- ❌ `502 Bad Gateway` - Odoo ไม่ทำงานหรือ port ผิด
- ❌ `404 Not Found` - Route ไม่ถูกต้อง

## 📋 Checklist

- [ ] ตรวจสอบ Odoo port (`ss -tlnp | grep 8069`)
- [ ] Nginx config มี `location /api` block
- [ ] `proxy_pass` ชี้ไปยัง `http://127.0.0.1:8069` (หรือ port ที่ถูกต้อง)
- [ ] `proxy_method POST` มีอยู่
- [ ] `nginx -t` ผ่าน (ไม่มี syntax error)
- [ ] Nginx reload แล้ว
- [ ] ทดสอบด้วย curl แล้วได้ 200 OK

## 🔍 Debug Commands

```bash
# ดู nginx error logs
sudo tail -f /var/log/nginx/error.log

# ดู nginx access logs
sudo tail -f /var/log/nginx/access.log

# ตรวจสอบ nginx config
sudo nginx -T | grep -A 20 "location /api"

# ตรวจสอบ Odoo port
ss -tlnp | grep 8069
# หรือ
sudo lsof -i :8069
```

## ⚠️ หมายเหตุ

ถ้าใช้ Cloudflare:
- Cloudflare อาจจะ cache response
- ลอง disable Cloudflare proxy (ใช้ DNS only)
- หรือ clear Cloudflare cache
