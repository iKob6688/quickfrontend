# Quickfront18 API Contract (Single Source of Truth)

This is the **single API contract** for the Quickfront18 React frontend.

- **Backend module**: `adt_th_api` (Odoo 18)
- **API base URL in frontend**: `VITE_API_BASE_URL` (typically `/api` via Vite proxy)
- **Important**: Most endpoints are declared with Odoo `type="json"` ⇒ the request must be **JSON-RPC 2.0** and the response is often wrapped in JSON-RPC.

---

## 1) Common response envelope

Backend returns **ApiEnvelope** either directly or wrapped by JSON-RPC:

```ts
export type ApiErrorPayload =
  | string
  | { message: string; code?: string; details?: unknown }

export interface ApiEnvelope<T> {
  success: boolean
  data?: T | null
  error?: ApiErrorPayload | null
}
```

### JSON-RPC wrapper (most `type="json"` routes)

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": { "success": true, "data": { /* ... */ }, "error": null }
}
```

Frontend normalizes both formats via `src/api/response.ts` → `unwrapResponse<T>()`.

---

## 2) JSON-RPC request format

For `type="json"` routes, send:

```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": { /* payload */ }
}
```

Frontend already has a helper: `src/api/services/rpc.ts` → `makeRpc(params)`.

---

## 3) Required headers (sent by `src/api/client.ts`)

- `X-ADT-API-Key: <api_key>` (**required** for all `/api/th/v1/*` endpoints)
- `Authorization: Bearer <token>` (**required** for user actions)
- `X-Instance-ID: <company_id>` (string; used for company scoping)

---

## 4) Scopes (API key policy)

Scopes are managed in Odoo (**ADT API → API Clients**).

### Implemented scopes (backend already has these)
- `system`: health check
- `auth`: login/me/logout/bootstrap
- `invoice`: sales invoices APIs
- `excel`: excel import APIs
- `contacts`: contacts/customers/partners APIs
- `dashboard`: KPI dashboard
- `pdf`: PDF export endpoints

### Planned scopes (required for “real selector UX”)
- `products`: product search/list
- `tax`: tax search/list
- `uom`: UoM search/list

> If API Client `Scope Policy = Custom scopes`, the key must explicitly include the needed scopes.

---

## 5) Bootstrap (installation)

### [Implemented] POST `/api/th/v1/frontend/bootstrap`
- **Auth**: API key required (via `X-ADT-API-Key`)
- **Body**: JSON-RPC

Request params:
- `registration_token: string`
- `db?: string`

Response data:
```ts
export interface FrontendBootstrapResponse {
  api_base_url: string // typically "/api"
  db: string
  api_key: string
  allowed_scopes: string[]
  company_id: number
  company_name: string
}
```

Example:
```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": { "registration_token": "...", "db": "qacc" }
}
```

---

## 6) Auth

Base path: `/api/th/v1/auth/*`

### [Implemented] POST `/api/th/v1/auth/login`
- **Auth**: API key required
- **Body**: JSON-RPC

Request params:
- `login: string`
- `password: string`
- `db?: string`

Response data:
```ts
export interface LoginResponse {
  token: string
  user: { id: number; name: string; login: string }
  companies: Array<{ id: number; name: string }>
}
```

### [Implemented] POST `/api/th/v1/auth/me`
- **Auth**: API key + Bearer required
- **Body**: JSON-RPC

Response data:
```ts
export interface MeResponse {
  id: number
  name: string
  login: string
  instancePublicId: string
  companyId: number
  companyName: string
  companies: Array<{ id: number; name: string }>
}
```

### [Implemented] POST `/api/th/v1/auth/logout`
- **Auth**: API key + Bearer required
- **Body**: JSON-RPC

### [Implemented] POST `/api/th/v1/auth/register_company`
- **Auth**: API key required
- **Guard**: requires `master_key` in params (Odoo config parameter)
- **Body**: JSON-RPC

---

## 7) System

### [Implemented] POST `/api/th/v1/ping`
- **Auth**: API key required
- **Scope**: `system`
- **Body**: JSON-RPC (payload ignored)

Response data:
```ts
export interface PingResponse { pong: true }
```

---

## 8) Contacts / Customers / Partners (res.partner)

Backend provides the same behavior under:
- `/api/th/v1/contacts/*`
- `/api/th/v1/customers/*`
- `/api/th/v1/partners/*` (frontend-legacy contract)

### [Implemented] POST `/api/th/v1/partners/list`
- **Auth**: API key + Bearer required
- **Scope**: `contacts`
- **Body**: JSON-RPC

Request params:
- `q?: string` (search)
- `search?: string` (alias)
- `active?: boolean`
- `company_type?: 'company'|'person'` (mapped)
- `limit?: number`
- `offset?: number`

Response data:
```ts
export interface PartnerSummary {
  id: number
  name: string
  vat?: string
  phone?: string
  email?: string
  active: boolean
  companyType: 'company' | 'person'
}

export interface PartnerListResponse {
  items: PartnerSummary[]
  total: number
  offset: number
  limit: number
}
```

### [Implemented] POST `/api/th/v1/partners/<id>`
- **Auth**: API key + Bearer required
- **Scope**: `contacts`
- **Body**: JSON-RPC

Response data (note: backend currently returns `taxId`/`isCompany` in detail):
```ts
export interface PartnerDetail {
  id: number
  name: string
  displayName: string
  email?: string
  phone?: string
  mobile?: string
  taxId?: string
  isCompany: boolean
  street?: string
  street2?: string
  city?: string
  zip?: string
  countryId?: number | null
  countryName?: string | null
}
```

### [Implemented] POST `/api/th/v1/partners/create`
- **Auth**: API key + Bearer required
- **Scope**: `contacts`
- **Body**: JSON-RPC

### [Implemented] POST `/api/th/v1/partners/<id>/update`
- **Auth**: API key + Bearer required
- **Scope**: `contacts`
- **Body**: JSON-RPC

---

## 9) Sales invoices (account.move out_invoice)

Base path: `/api/th/v1/sales/invoices/*`

### Important business rules
- **Update is allowed only when invoice is `draft`**.
- After posting, edits must use **B1 Amendment flow** (credit note + new invoice / delta).

### [Implemented - v2] Invoice line schema (current)

```ts
export interface InvoiceLineV2 {
  productId: number | null
  description: string
  quantity: number
  uomId?: number | null
  uomName?: string | null
  unitPrice: number
  discount?: number
  taxIds?: number[]
  taxes?: Array<{ id: number; name: string; amount: number; amountType: string }>
  taxRate?: number // legacy (first tax only)
  subtotal: number
}

export interface InvoiceV2 {
  id: number
  number?: string
  customerId: number
  customerName?: string
  invoiceDate: string | null
  dueDate: string | null
  currency: string
  status: 'draft' | 'posted' | 'paid' | 'cancelled'
  amountUntaxed: number
  totalTax: number
  total: number
  createdAt: string | null
  updatedAt: string | null
  notes?: string | null
  lines: InvoiceLineV2[]
}
```

### [Implemented] POST `/api/th/v1/sales/invoices/list`
- **Auth**: API key + Bearer required
- **Scope**: `invoice`
- **Body**: JSON-RPC

Params:
- `status?: 'draft'|'posted'|'paid'|'cancelled'`
- `search?: string`
- `limit?: number`
- `offset?: number`
- `date_from?: string` (YYYY-MM-DD)
- `dateTo?: string` (YYYY-MM-DD)

Response data:
- `InvoiceListItem[]`

### [Implemented] POST `/api/th/v1/sales/invoices/<id>`
- **Auth**: API key + Bearer required
- **Scope**: `invoice`
- **Body**: JSON-RPC

Response data:
- `InvoiceV2`

### [Implemented] POST `/api/th/v1/sales/invoices`
- **Auth**: API key + Bearer required
- **Scope**: `invoice`
- **Body**: JSON-RPC

Request data:
- `InvoiceV2` payload fields (`customerId`, `invoiceDate`, `dueDate`, `currency`, `lines`, `notes`)

### [Implemented] PUT `/api/th/v1/sales/invoices/<id>`
- **Auth**: API key + Bearer required
- **Scope**: `invoice`
- **Body**: JSON-RPC
- **Rule**: only `draft` invoices can be updated

### [Implemented] POST `/api/th/v1/sales/invoices/<id>/post`
- **Auth**: API key + Bearer required
- **Scope**: `invoice`
- **Body**: JSON-RPC

### [Implemented] POST `/api/th/v1/sales/invoices/<id>/register-payment`
- **Auth**: API key + Bearer required
- **Scope**: `invoice`
- **Body**: JSON-RPC

Params:
- `amount?: number` (default residual)
- `date?: string` (YYYY-MM-DD)
- `method?: string`
- `reference?: string`

### [Implemented] GET `/api/th/v1/sales/invoices/<id>/pdf`
- **Auth**: API key + Bearer required
- **Scopes**:
  - always requires `invoice`
  - requires `pdf` only when API Client uses `Custom scopes`
- **Response**: `application/pdf`

---

## 9.1) Amend posted invoice (B1)

### [Implemented] POST `/api/th/v1/sales/invoices/<id>/amend`
- **Auth**: API key + Bearer required
- **Scope**: `invoice`
- **Body**: JSON-RPC
- **Rule**: only `posted` invoices can be amended (audit trail)

Request params:
- `mode: 'replace' | 'delta'`
- `reason: string`
- `newInvoice?: InvoiceV2` (required for `replace`)
- `deltaLines?: InvoiceLineV2[]` (required for `delta`)
- `postCreditNote?: boolean` (optional)
- `postNewInvoice?: boolean` (optional; replace only)

Response data:
```ts
export interface InvoiceAmendResponse {
  originalInvoiceId: number
  creditNoteId: number | null
  newInvoiceId: number | null
}
```

## 10) Dashboard KPI

### [Implemented] POST `/api/th/v1/dashboard/kpis`
- **Auth**: API key + Bearer required
- **Scope**: `dashboard`
- **Body**: JSON-RPC

Params:
- `date_from?: string` (YYYY-MM-DD) (default first day of current month)
- `date_to?: string` (YYYY-MM-DD) (default today)

Response data:
```ts
export interface DashboardKpisResponse {
  companyId: number
  companyName: string
  period: { from: string; to: string }
  salesInvoices: { postedCount: number; postedTotal: number }
  receivables: {
    openCount: number
    openTotal: number
    overdueCount: number
    overdueTotal: number
  }
}
```

---

## 11) Excel import

### [Implemented] POST `/api/th/v1/excel/import`
- **Auth**: API key + Bearer required
- **Scope**: `excel`
- **Type**: `multipart/form-data` (this is a `type="http"` route)

Fields:
- `file`: `.xlsx`
- `import_type`: `customers|products|expenses|invoices|other`

### [Implemented] GET `/api/th/v1/excel/import/<job_id>`
- **Auth**: API key + Bearer required
- **Scope**: `excel`

### [Implemented] GET `/api/th/v1/excel/import/<job_id>/result`
- **Auth**: API key + Bearer required
- **Scope**: `excel`

---

## 12) Target contract (vNext) — required for “real invoice editor”

These are **required next** to support:
- product selector
- multi-tax
- UoM
- discount
- B1 amend flow (edit posted invoice properly)

### [Implemented] Products
- POST `/api/th/v1/products/list`
- POST `/api/th/v1/products/<id>`

### [Implemented] Taxes
- POST `/api/th/v1/taxes/list` (sale taxes)

### [Implemented] UoM
- POST `/api/th/v1/uoms/list`

### Notes
- invoice v2 line fields (`uomId`, `discount`, `taxIds`) are supported now.
- `taxRate` is kept as legacy output (first tax only) to avoid breaking older clients.

---

## 13) Error & status-code notes

- For Odoo `type="json"` routes, HTTP status may not reflect errors reliably.
- Always rely on the `ApiEnvelope`:
  - `success: true` → use `data`
  - `success: false` → show `error.message` (or string)

