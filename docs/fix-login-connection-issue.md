# แก้ไขปัญหา Login เชื่อมต่อไม่ได้

## 🔴 ปัญหา

จาก Network tab เห็นว่า:
- Request URL: `https://v18.erpth.net/api/th/v1/auth/login`
- Request failed (red X icon)
- "Provisional headers are shown" warning
- Request Headers มี `X-Adt-Api-Key` แล้ว

## 🔍 ตรวจสอบ

### 1. ตรวจสอบ Response Headers

ใน Developer Tools → Network tab:
1. คลิกที่ failed request "login"
2. ดู **Response** tab (ไม่ใช่ Headers)
3. ดู Status code และ error message

**Status codes ที่เป็นไปได้:**
- `CORS error` - CORS configuration ไม่ถูกต้อง
- `net::ERR_FAILED` - Connection failed
- `net::ERR_CONNECTION_REFUSED` - Server ไม่ตอบกลับ
- `net::ERR_SSL_PROTOCOL_ERROR` - SSL issue
- `404 Not Found` - Route ไม่มี
- `405 Method Not Allowed` - Method ไม่รองรับ
- `500 Internal Server Error` - Server error

### 2. ตรวจสอบ Console Tab

ดู Console tab ใน Developer Tools:
- มี error message อะไรบ้าง?
- มี CORS error หรือไม่?

### 3. ทดสอบ API โดยตรง

```bash
# บน server
curl -X POST https://v18.erpth.net/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: XkIWQccBcin02epyCBOrPAdL_mwjc3HE5z4Lt-wlzuYWSAZIMjV_Rw" \
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

## 🔧 วิธีแก้ไข

### ปัญหา 1: CORS Error

**อาการ:** Console แสดง CORS error

**แก้ไข:** เพิ่ม CORS headers ใน Odoo backend หรือ nginx

**Nginx config:**
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
}
```

### ปัญหา 2: Connection Failed

**อาการ:** `net::ERR_FAILED` หรือ `net::ERR_CONNECTION_REFUSED`

**แก้ไข:**
1. ตรวจสอบว่า Odoo ทำงานอยู่
2. ตรวจสอบ firewall
3. ตรวจสอบว่า URL ถูกต้อง

```bash
# ตรวจสอบ Odoo
sudo systemctl status odoo18

# ทดสอบ connection
curl -v https://v18.erpth.net/api/th/v1/auth/login
```

### ปัญหา 3: SSL/TLS Error

**อาการ:** `net::ERR_SSL_PROTOCOL_ERROR`

**แก้ไข:**
- ตรวจสอบ SSL certificate
- ตรวจสอบว่าใช้ HTTPS ถูกต้อง

### ปัญหา 4: 404 Not Found

**อาการ:** Status 404

**แก้ไข:**
- ตรวจสอบว่า route มีอยู่
- ตรวจสอบว่า module ถูก install
- Restart Odoo

### ปัญหา 5: 405 Method Not Allowed

**อาการ:** Status 405

**แก้ไข:**
- ตรวจสอบว่า route รองรับ POST method
- ตรวจสอบ nginx config

## 🧪 Debug Steps

### 1. ตรวจสอบ Network Tab

1. เปิด Developer Tools → Network tab
2. ลอง login อีกครั้ง
3. คลิกที่ failed request
4. ดู **Response** tab:
   - Status code
   - Error message
   - Response body (ถ้ามี)

### 2. ตรวจสอบ Console Tab

1. เปิด Developer Tools → Console tab
2. ลอง login อีกครั้ง
3. ดู error messages

### 3. ทดสอบด้วย curl

```bash
# ทดสอบจาก server
curl -X POST https://v18.erpth.net/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: XkIWQccBcin02epyCBOrPAdL_mwjc3HE5z4Lt-wlzuYWSAZIMjV_Rw" \
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

### 4. ตรวจสอบ VITE_API_BASE_URL

```bash
# บน server
cd /opt/quickfrontend
cat .env | grep VITE_API_BASE_URL
```

ต้องเห็น: `VITE_API_BASE_URL=https://v18.erpth.net/api`

## 📋 Checklist

- [ ] ตรวจสอบ Response tab ใน Network tab (ดู error message)
- [ ] ตรวจสอบ Console tab (ดู error messages)
- [ ] ทดสอบด้วย curl จาก server
- [ ] ตรวจสอบ CORS configuration
- [ ] ตรวจสอบ nginx config
- [ ] ตรวจสอบ Odoo status
- [ ] ตรวจสอบ VITE_API_BASE_URL

## 🔍 สิ่งที่ต้องดู

1. **Response tab** - ดู status code และ error message
2. **Console tab** - ดู JavaScript errors
3. **curl test** - ทดสอบว่า API ทำงานจาก server หรือไม่

ลองดู Response tab ใน Network tab แล้วบอก error message ที่เห็นมาได้ไหมครับ?
