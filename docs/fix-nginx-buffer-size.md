# แก้ไข Nginx Buffer Size Error

## 🔴 ปัญหา

Error: `upstream sent too big header while reading response header from upstream`

**สาเหตุ:** Backend ส่ง response headers ที่ใหญ่เกินไป ทำให้ nginx ไม่สามารถอ่านได้

## ✅ วิธีแก้ไข

เพิ่ม buffer size settings ใน nginx config:

```nginx
location /api {
    proxy_pass https://v18.erpth.net;
    
    # Buffer size settings - สำคัญ!
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
    proxy_busy_buffers_size 32k;
    proxy_temp_file_write_size 32k;
    
    # Large header buffer
    large_client_header_buffers 4 32k;
    
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
    
    # Buffer settings
    proxy_buffering off;
    proxy_request_buffering off;
    
    # SSL settings
    proxy_ssl_verify off;
    proxy_ssl_server_name on;
}
```

## 🔧 ขั้นตอน

### 1. แก้ไข Nginx Config

```bash
sudo nano /etc/nginx/sites-available/qacc
```

เพิ่ม `large_client_header_buffers` ที่ server level (นอก location block)
และเพิ่ม proxy buffer settings ใน `location /api` block

### 2. ตรวจสอบ Syntax

```bash
sudo nginx -t
```

### 3. Reload Nginx

```bash
sudo systemctl reload nginx
```

### 4. ตรวจสอบ Logs

```bash
sudo tail -f /var/log/nginx/qacc.error.log
```

ตอนนี้ error ควรหายไป

## 📋 Nginx Config ที่สมบูรณ์

```nginx
server {
    listen 443 ssl http2;
    server_name qacc.erpth.net;

    ssl_certificate     /etc/ssl/certs/cloudflare_origin.pem;
    ssl_certificate_key /etc/ssl/private/cloudflare_origin.key;

    access_log /var/log/nginx/qacc.access.log;
    error_log  /var/log/nginx/qacc.error.log;

    client_max_body_size 300M;
    
    # Large header buffer - ต้องอยู่ที่ server level
    large_client_header_buffers 4 32k;

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

    # Large header buffer - ต้องอยู่ที่ server level
    large_client_header_buffers 4 32k;

    location /api {
        proxy_pass https://v18.erpth.net;
        
        # Buffer size settings - แก้ไข error "too big header"
        proxy_buffer_size 16k;
        proxy_buffers 8 16k;
        proxy_busy_buffers_size 32k;
        proxy_temp_file_write_size 32k;
        
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
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_buffering off;
        proxy_request_buffering off;
        
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
    }
}
```

## 🧪 ทดสอบ

1. Reload nginx
2. ลอง login อีกครั้ง
3. ตรวจสอบ error log - ต้องไม่เห็น error "too big header" อีก

## ⚠️ หมายเหตุ

- Buffer size ที่แนะนำ: 16k-32k
- ถ้ายังมีปัญหา อาจต้องเพิ่มเป็น 64k
- `large_client_header_buffers` ใช้สำหรับ request headers ที่ใหญ่
