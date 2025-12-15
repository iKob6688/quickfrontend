# แก้ไข Error 405 - Backend Configuration

## 🔴 สถานการณ์

`VITE_API_BASE_URL` ถูกต้องแล้ว (`https://qacc.erpth.net/api`) แต่ยังมี error 405

นี่หมายความว่าปัญหาอยู่ที่ **backend/middleware configuration**

## 🔍 ตรวจสอบ

### 1. ทดสอบ API Endpoint โดยตรง

```bash
curl -X POST https://qacc.erpth.net/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "login": "admin",
      "password": "your-password",
      "db": "your-database"
    }
  }'
```

**ผลลัพธ์ที่คาดหวัง:**
- ✅ `200 OK` - Backend ทำงานปกติ
- ❌ `405 Method Not Allowed` - Backend ไม่รองรับ POST method
- ❌ `404 Not Found` - Endpoint ไม่มีอยู่
- ❌ `401 Unauthorized` - API key ไม่ถูกต้อง

### 2. ตรวจสอบว่า Backend รองรับ POST Method

```bash
# ทดสอบด้วย OPTIONS method
curl -X OPTIONS https://qacc.erpth.net/api/th/v1/auth/login \
  -H "Access-Control-Request-Method: POST" \
  -v
```

ดู `Allow:` header ว่ามี `POST` หรือไม่

### 3. ตรวจสอบ Network Tab

1. เปิด Developer Tools → Network tab
2. ลอง login
3. ดู request details:
   - **Request URL**: ต้องเป็น `https://qacc.erpth.net/api/th/v1/auth/login`
   - **Request Method**: ต้องเป็น `POST`
   - **Status Code**: 405
   - **Response Headers**: ดู `Allow:` header

## 🔧 วิธีแก้ไข (Backend Side)

### ปัญหา: Backend ไม่รองรับ POST Method

**แก้ไขใน Odoo/Middleware:**

1. **ตรวจสอบ Route Configuration**

   ใน Odoo controller ต้องมี:
   ```python
   @http.route('/api/th/v1/auth/login', type='json', auth='none', methods=['POST'], csrf=False)
   def login(self, **kwargs):
       # login logic
   ```

2. **ตรวจสอบว่า Route ถูก Register**

   ตรวจสอบว่า route ถูก register ใน `__manifest__.py`:
   ```python
   'data': [
       # routes
   ]
   ```

3. **ตรวจสอบ CORS Configuration**

   ถ้าใช้ middleware แยก ตรวจสอบว่า:
   - CORS อนุญาต POST method
   - CORS อนุญาต origin ของ frontend

### ปัญหา: Endpoint Path ไม่ถูกต้อง

**ตรวจสอบว่า endpoint path ตรงกับที่ frontend เรียก:**

Frontend เรียก: `/api/th/v1/auth/login`

Backend ต้องมี route: `/api/th/v1/auth/login`

### ปัญหา: Nginx/Apache Configuration

**ตรวจสอบ reverse proxy configuration:**

#### Nginx

```nginx
location /api {
    proxy_pass http://backend-server;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Allow POST method
    proxy_method POST;
    
    # CORS headers (if needed)
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-ADT-API-Key, X-Instance-ID";
}
```

#### Apache

```apache
ProxyPass /api http://backend-server/api
ProxyPassReverse /api http://backend-server/api

# Allow POST method
<Proxy *>
    AllowMethods GET POST PUT DELETE OPTIONS
</Proxy>
```

## 🧪 Debug Steps

### 1. ตรวจสอบ Backend Logs

```bash
# Odoo logs
tail -f /var/log/odoo/odoo.log

# หรือ middleware logs
tail -f /var/log/middleware/access.log
```

### 2. ตรวจสอบว่า Request ไปถึง Backend

ดูใน logs ว่ามี request มาถึงหรือไม่

### 3. ทดสอบด้วย Postman/curl

```bash
# Test 1: Basic POST
curl -X POST https://qacc.erpth.net/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Test 2: With API Key
curl -X POST https://qacc.erpth.net/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "login": "admin",
      "password": "test",
      "db": "qacc"
    }
  }'
```

## 📋 Checklist

- [ ] `VITE_API_BASE_URL` ถูกต้อง (`https://qacc.erpth.net/api`)
- [ ] Build ใหม่หลังจากแก้ไข `.env`
- [ ] Backend route `/api/th/v1/auth/login` มีอยู่
- [ ] Backend route รองรับ POST method
- [ ] CORS configuration ถูกต้อง
- [ ] Reverse proxy (Nginx/Apache) configuration ถูกต้อง
- [ ] API Key ถูกต้องและ active
- [ ] Backend server ทำงานอยู่

## 🔗 Related Documentation

- [API Contract](./api_contract.md)
- [Bootstrap Setup Guide](./bootstrap-setup-guide.md)
- [Server Deployment Guide](./server-deployment-guide.md)
