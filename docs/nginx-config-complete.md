# Nginx Config ที่สมบูรณ์ (แก้ไข Buffer Size Error)

## ✅ Nginx Configuration ที่ถูกต้อง

```nginx
server {
    listen 443 ssl http2;
    server_name qacc.erpth.net;

    ssl_certificate     /etc/ssl/certs/cloudflare_origin.pem;
    ssl_certificate_key /etc/ssl/private/cloudflare_origin.key;

    access_log /var/log/nginx/qacc.access.log;
    error_log  /var/log/nginx/qacc.error.log;

    client_max_body_size 300M;
    
    # Large header buffer - ต้องอยู่ที่ server level (ไม่ใช่ใน location)
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

## 🔑 สิ่งที่สำคัญ

### 1. `large_client_header_buffers` ต้องอยู่ที่ server level

```nginx
server {
    # ... other settings ...
    
    # ✅ ถูกต้อง - อยู่ที่ server level
    large_client_header_buffers 4 32k;
    
    location /api {
        # ❌ ผิด - ไม่สามารถใช้ใน location ได้
        # large_client_header_buffers 4 32k;
    }
}
```

### 2. Proxy buffer settings อยู่ใน location /api

```nginx
location /api {
    # ✅ ถูกต้อง - ใช้ได้ใน location
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
    proxy_busy_buffers_size 32k;
    proxy_temp_file_write_size 32k;
}
```

## 🔧 ขั้นตอน

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

## ✅ Checklist

- [ ] `large_client_header_buffers` อยู่ที่ server level (นอก location block)
- [ ] Proxy buffer settings อยู่ใน location /api
- [ ] `nginx -t` ผ่าน (ไม่มี syntax error)
- [ ] Nginx reload สำเร็จ
- [ ] ไม่มี error "too big header" ใน logs
