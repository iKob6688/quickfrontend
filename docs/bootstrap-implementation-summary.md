# Bootstrap Implementation Summary (Locked Version)

## ✅ สิ่งที่ทำเสร็จแล้ว

### 1. Frontend Bootstrap Script (`scripts/bootstrap.js`)

**Features:**
- ✅ รับ Odoo host (auto-fix URL format: `http:localhost` → `http://localhost`)
- ✅ รับ Database name (optional)
- ✅ รับ Registration Token (API Key)
- ✅ ส่ง JSON-RPC request ไปยัง Odoo
- ✅ อ่าน JSON-RPC response
- ✅ Validate required fields (db, api_key)
- ✅ เขียน/อัปเดต `.env` อัตโนมัติ
- ✅ แสดง success message พร้อมข้อมูลที่ได้

**Usage:**
```bash
npm run bootstrap
```

**Output `.env`:**
```env
# ===== Odoo bootstrap (auto-generated) START =====
VITE_API_BASE_URL=/api
VITE_API_KEY=...
VITE_ODOO_DB=qacc
VITE_ALLOWED_SCOPES=auth,invoice,excel
# ===== Odoo bootstrap (auto-generated) END =====
```

### 2. Backend Bootstrap Endpoint (`/api/th/v1/frontend/bootstrap`)

**Location:** `adt_th_api/controllers/api_auth.py`

**Features:**
- ✅ รับ `registration_token` (ใช้ API Key จาก `adt.api.client`)
- ✅ รับ `db` (optional) - สำหรับ multi-db support
- ✅ Auto-create API client ถ้ายังไม่มี (dev convenience)
- ✅ Return config: `api_base_url`, `db`, `api_key`, `allowed_scopes`, `company_id`, `company_name`
- ✅ Error handling ที่ชัดเจน

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "registration_token": "...",
    "db": "qacc"  // optional
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "api_base_url": "/api",
      "db": "qacc",
      "api_key": "...",
      "allowed_scopes": ["auth", "invoice", "excel"],
      "company_id": 1,
      "company_name": "My Company"
    }
  }
}
```

### 3. Frontend API Integration

**Files Updated:**
- ✅ `src/api/client.ts` - ส่ง `X-ADT-API-Key` header อัตโนมัติ
- ✅ `src/api/response.ts` - รองรับ JSON-RPC format
- ✅ `src/api/endpoints/auth.ts` - ใช้ `makeRpc()` ที่รวม `db` อัตโนมัติ
- ✅ `src/lib/scopes.ts` - Scope checking utilities

**Behavior:**
- ทุก API request ส่ง `X-ADT-API-Key` จาก `VITE_API_KEY`
- ทุก API request ส่ง `X-Instance-ID` จาก localStorage
- ทุก API request ส่ง `Authorization: Bearer <token>` หลัง login
- JSON-RPC requests รวม `db` จาก `VITE_ODOO_DB` อัตโนมัติ

## 📋 API Contract (Locked)

### Bootstrap Endpoint

**Route:** `POST /api/th/v1/frontend/bootstrap`

**Auth:** `auth="public"` (no auth required)

**Request Body (JSON-RPC):**
```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "registration_token": "<string>",  // Required: API Key from adt.api.client
    "db": "<string>"                    // Optional: Database name
  }
}
```

**Response (JSON-RPC + Envelope):**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "api_base_url": "/api",           // Required
      "db": "qacc",                     // Required
      "api_key": "...",                 // Required
      "allowed_scopes": ["auth", "invoice", "excel"],  // Required (array)
      "company_id": 1,                  // Optional
      "company_name": "My Company"     // Optional
    },
    "error": null
  }
}
```

### Auth Endpoints (Updated)

**All auth endpoints now:**
- ✅ ใช้ JSON-RPC format
- ✅ รวม `db` จาก `VITE_ODOO_DB` อัตโนมัติ (via `makeRpc()`)
- ✅ รองรับ JSON-RPC response format

**Endpoints:**
- `POST /api/th/v1/auth/login` - Login with `login`, `password`, `db`
- `POST /api/th/v1/auth/me` - Get current user (Bearer token)
- `POST /api/th/v1/auth/logout` - Logout
- `POST /api/th/v1/auth/register_company` - Register company (master key)

## 🔒 Locked Version Details

### Frontend Files (Locked)
- `scripts/bootstrap.js` - Bootstrap CLI script
- `src/api/client.ts` - Axios client with headers
- `src/api/response.ts` - JSON-RPC + envelope unwrapper
- `src/api/endpoints/auth.ts` - Auth endpoints with auto-db
- `src/lib/scopes.ts` - Scope utilities
- `package.json` - Added `"bootstrap": "node scripts/bootstrap.js"`

### Backend Files (Locked)
- `adt_th_api/controllers/api_auth.py` - Added `api_frontend_bootstrap()` method

### Environment Variables (Auto-generated)
- `VITE_API_BASE_URL` - API base URL (default: `/api`)
- `VITE_API_KEY` - API key for `X-ADT-API-Key` header
- `VITE_ODOO_DB` - Odoo database name
- `VITE_ALLOWED_SCOPES` - Comma-separated scopes

## 🚀 Usage Flow

### Initial Setup
```bash
# 1. Install dependencies
npm install

# 2. Run bootstrap
npm run bootstrap
# - Enter Odoo host: http://localhost:8069
# - Enter database (optional): qacc
# - Enter registration token: <API Key>

# 3. Start dev server
npm run dev
```

### After Bootstrap
- `.env` file is auto-generated
- All API calls use `VITE_API_KEY` automatically
- All API calls include `db` from `VITE_ODOO_DB` automatically
- Login flow works with `db` parameter

## 📝 Notes

1. **Registration Token = API Key**: ตอนนี้ใช้ API Key จาก `adt.api.client` เป็น registration token (ชั่วคราว)
2. **Auto-create API Client**: Backend จะสร้าง API client อัตโนมัติถ้ายังไม่มี (dev convenience)
3. **Database Name**: Optional แต่แนะนำให้ระบุถ้ามีหลาย database
4. **Scopes**: Default scopes = `["auth", "invoice", "excel"]` (สามารถเพิ่ม field ใน model ได้ภายหลัง)

## 🔄 Future Enhancements (Not Implemented)

- [ ] Separate registration token model (ไม่ใช่ API key)
- [ ] Token expiration handling
- [ ] Scope-based UI filtering
- [ ] Multiple API keys per company
- [ ] Token usage tracking

---

**Version Locked:** 2025-01-XX
**Status:** ✅ Working - Ready for production use

