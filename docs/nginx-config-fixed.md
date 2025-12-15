# Nginx Config ที่แก้ไขแล้ว

## 🔧 Nginx Configuration (แก้ไขแล้ว)

```nginx
server {
    listen 443 ssl http2;
    server_name qacc.erpth.net;

    ssl_certificate     /etc/ssl/certs/cloudflare_origin.pem;
    ssl_certificate_key /etc/ssl/private/cloudflare_origin.key;

    access_log /var/log/nginx/qacc.access.log;
    error_log  /var/log/nginx/qacc.error.log;

    client_max_body_size 300M;

    root /var/www/qacc;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store";
    }

    location /assets/ {
        try_files $uri =404;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        access_log off;
    }

    # API proxy - สำคัญ!
    location /api {
        # ใช้ https สำหรับ backend
        proxy_pass https://v18.erpth.net;
        
        # CORS headers - สำคัญ!
        add_header Access-Control-Allow-Origin "https://qacc.erpth.net" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-ADT-API-Key, X-Instance-ID" always;
        add_header Access-Control-Allow-Credentials "true" always;
        
        # Handle preflight requests
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
        
        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
        
        # SSL verification (ถ้า backend ใช้ self-signed cert)
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
    }
}
```

## 🔑 สิ่งที่แก้ไข

### 1. เปลี่ยน proxy_pass เป็น HTTPS

```nginx
# ❌ ผิด
proxy_pass http://v18.erpth.net;

# ✅ ถูก
proxy_pass https://v18.erpth.net;
```

### 2. เพิ่ม CORS Headers

```nginx
add_header Access-Control-Allow-Origin "https://qacc.erpth.net" always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-ADT-API-Key, X-Instance-ID" always;
add_header Access-Control-Allow-Credentials "true" always;
```

### 3. Handle Preflight Requests

```nginx
if ($request_method = 'OPTIONS') {
    add_header Access-Control-Allow-Origin "https://qacc.erpth.net" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-ADT-API-Key, X-Instance-ID" always;
    add_header Access-Control-Max-Age 3600;
    add_header Content-Type 'text/plain charset=UTF-8';
    add_header Content-Length 0;
    return 204;
}
```

### 4. เพิ่ม Timeout และ Buffer Settings

```nginx
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
proxy_buffering off;
proxy_request_buffering off;
```

### 5. เพิ่ม SSL Settings

```nginx
proxy_ssl_verify off;
proxy_ssl_server_name on;
```

## 📝 ขั้นตอนการอัพเดท

```bash
# 1. แก้ไข config
sudo nano /etc/nginx/sites-available/qacc

# 2. ตรวจสอบ syntax
sudo nginx -t

# 3. Reload nginx
sudo systemctl reload nginx

# 4. ตรวจสอบ logs
sudo tail -f /var/log/nginx/qacc.error.log
```

## 🧪 ทดสอบ

### 1. ทดสอบด้วย curl

```bash
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

### 2. ทดสอบใน Browser

1. เปิด `https://qacc.erpth.net`
2. ลอง login
3. ตรวจสอบ Network tab:
   - ต้องไม่เห็น CORS error
   - Request ต้องสำเร็จ (ไม่ใช่ red X)

## ⚠️ หมายเหตุ

- ถ้า `v18.erpth.net` ใช้ self-signed certificate อาจต้องตั้ง `proxy_ssl_verify off`
- ถ้า backend อยู่ที่ port อื่น (เช่น 8069) ใช้ `https://v18.erpth.net:8069`
- ตรวจสอบว่า CORS origin ตรงกับ domain ที่ใช้จริง
