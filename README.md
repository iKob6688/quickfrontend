## Quickfront18 Frontend (React + TypeScript)

Quickfront18 is a React 18 + Vite + TypeScript frontend for Thai SME accounting on top of Odoo 18 Community.  
It talks to a middleware backend over JSON APIs, supports offline-first usage, and integrates with LINE LIFF.

### API base URL

- **Env:** `VITE_API_BASE_URL` (e.g. `https://middleware.example.com`)
- If not set, the app uses `window.location.origin`.
- Feature endpoints specify their full path, e.g. `/api/th/v1/auth/login`.

### Standard response shape

All HTTP 2xx responses are expected to wrap business data in the following envelope:

```ts
interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: {
    code?: string
    message: string
    details?: unknown
  } | null
}
```

- `src/api/response.ts` provides:
  - `unwrapResponse<T>()` – extracts `data` or throws `ApiError`.
  - `toApiError()` – converts unknown/axios errors into a typed `ApiError`.
- All endpoint modules (`auth.ts`, `excel.ts`, `invoices.ts`, etc.) call `unwrapResponse` so feature code only sees typed data or throws.

### Authentication & token storage

- Access token:
  - Stored in `localStorage` under key `qf18_access_token`.
  - Helper functions in `src/lib/authToken.ts`.
  - Automatically attached as `Authorization: Bearer <token>` by `src/api/client.ts` on every request.
- Instance ID (multi‑Odoo support):
  - After `login` or `me`, the backend returns `instancePublicId` (either top‑level or on the user).
  - Stored in `localStorage` under key `qf18_instance_public_id`.
  - Also stored in the Zustand `authStore` as `instancePublicId`.
  - Automatically sent as header **`X-Instance-ID`** in every API call by the axios request interceptor.
- On `401`:
  - The axios response interceptor clears local auth storage and invokes an optional `unauthorizedHandler`.
  - The app registers a handler in `App` that:
    - Calls `authStore.logout()` (to clear Zustand state + IndexedDB).
    - Redirects the user back to `/login`.
  - A short‑lived access token strategy with either a refresh token HTTP‑only cookie or explicit re‑login is recommended; the current code is ready to plug a refresh flow in the `401` handler.

### Instance ID & multi‑Odoo behaviour

- Every authenticated request to the backend is automatically scoped by:
  - `Authorization: Bearer <access_token>`
  - `X-Instance-ID: <instance_public_id>`
- The instance ID is obtained during:
  - Initial username/password login (`/api/th/v1/auth/login`).
  - Subsequent `/api/th/v1/auth/me` calls.
- Clearing auth (manual logout or `401`) removes both the token and the instance ID from storage, ensuring the next session cannot leak to a previous Odoo instance.

### Authentication endpoints

Implemented in `src/api/endpoints/auth.ts` using the `/api/th/v1/auth` namespace:

- `POST /api/th/v1/auth/login`
  - Body: `{ username, password }`
  - Response: `ApiEnvelope<{ accessToken, user, instancePublicId? }>`
- `GET /api/th/v1/auth/me`
  - Response: `ApiEnvelope<AuthUser>`
- `POST /api/th/v1/auth/logout`
- `POST /api/th/v1/auth/line-login`
  - Body: `{ idToken }` (LIFF ID token)

### Excel import API & flow

Implemented in `src/api/endpoints/excel.ts`:

- `POST /api/th/v1/excel/import`
  - `multipart/form-data` with fields:
    - `file` – `.xlsx` file
    - `import_type` – `'customers' | 'products' | 'expenses' | 'invoices' | 'other'`
  - Returns: `ApiEnvelope<ExcelImportJob>` with `jobId` and row counts.
- `GET /api/th/v1/excel/import/:jobId`
  - Returns: `ApiEnvelope<ExcelImportJob>` (status `pending | processing | completed | failed`).
- `GET /api/th/v1/excel/import/:jobId/result`
  - Returns: `ApiEnvelope<ExcelImportResult>` with:
    - `summary` – `{ totalRows, acceptedRows, failedRows }`
    - `failedFileUrl?` – URL to download failed rows.

Frontend behaviour:

- `useExcelPreview` (local parsing using `xlsx`):
  - Enforces `.xlsx` and max file size.
  - Parses workbook into sheet previews (name, rowCount, columns).
- `useExcelValidator`:
  - Validates required columns per sheet and reports issues.
- `ExcelUploadCard`:
  - Drag‑and‑drop + file picker.
  - Shows validation summary and sheet preview.
  - On submit:
    - Uploads to `/excel/import`.
    - Polls job status until `completed | failed`.
    - Fetches final result and exposes download link for failed rows.

### Offline sync & mapping PendingOpType → endpoints

- IndexedDB schema in `src/offline/db.ts`:
  - `masters`, `draftInvoices`, `pendingOps`.
- Offline queueing in `src/offline/syncEngine.ts`:
  - `queueOfflineOperation({ type, payload })` appends to `pendingOps`.
  - `syncPendingOperations()`:
    - Skips when `navigator.onLine === false`.
    - For each `PendingOperation` with `status = 'pending'`:
      - Marks as `syncing`.
      - Dispatches to concrete endpoints based on `PendingOpType`:
        - `CREATE_INVOICE` → `createInvoice(payload)`
        - `UPDATE_INVOICE` → `updateInvoice(payload.id, payload)`
        - `POST_INVOICE` → `postInvoice(payload.id)`
        - `REGISTER_PAYMENT` → `registerPayment(payload.id, payload.payment)`
      - On success → marks op as `done`.
      - On error → marks as `error` and stores `lastError`.
  - `attachOnlineOfflineListeners()` triggers `syncPendingOperations()` when the browser goes back online.

### Sales invoices endpoints

Implemented in `src/api/endpoints/invoices.ts` using `/api/th/v1/sales/invoices`:

- `POST /api/th/v1/sales/invoices`
  - Creates a new invoice from `InvoicePayload`.
- `PUT /api/th/v1/sales/invoices/:id`
  - Updates invoice.
- `POST /api/th/v1/sales/invoices/:id/post`
  - Posts invoice.
- `POST /api/th/v1/sales/invoices/:id/register-payment`
  - Registers payment based on `RegisterPaymentPayload`.

These are orchestrated by the offline sync engine via `PendingOpType` mappings as described above.

### Auth UX and 401 redirect strategy

- `ProtectedRoute` ensures unauthenticated users are redirected to `/login`.
- For `401` responses during an active session:
  - The axios interceptor clears persisted auth and calls `unauthorizedHandler`.
  - The handler triggers a clean logout (`authStore.logout()`) and redirects to `/login`.
- Token lifetime:
  - Recommended: short‑lived access tokens with either:
    - Silent refresh via refresh token (HTTP‑only cookie) handled inside the interceptor, or
    - Simple re‑login after expiry with a clear banner.
  - Current implementation leaves a clear `TODO` in the `401` handler to plug in refresh logic once the backend contract is finalised.

### Backend (Odoo) improvements expected by this frontend

This section is for the Odoo/middleware team. It lists what the React app already assumes from the backend.

- **Auth contract**
  - `POST /api/th/v1/auth/login`:
    - Accept body `{ username, password }` (or keep `{ login, password }` and map).
    - Return `data = { accessToken, user, instancePublicId? }` where:
      - `accessToken` is the bearer token understood by `_auth_bearer_user()` or equivalent.
      - `user` includes at least `{ id, name, email, locale?, companyName?, instancePublicId? }`.
  - `GET /api/th/v1/auth/me`:
    - Must accept `Authorization: Bearer <accessToken>` (+ optional `X-Instance-ID`).
    - Should return the same user structure as `login`.
  - On `401`, simply return HTTP 401 with the standard `{ success: false, data: null, error: ... }`.

- **Instance / multi‑tenant behaviour**
  - Backend should:
    - Provide a stable `instancePublicId` per tenant/company, returned from `login`/**or** `me`.
    - Honour `X-Instance-ID` on all business endpoints (invoices, excel, etc.) to scope `env.company` or tenant.
  - If no explicit instance model exists yet, `instancePublicId` can be derived from `res.company` (e.g. a slug or external ref), but the **field name and header should stay as is**.

- **Invoice & payment API alignment**
  - Expose REST-ish endpoints used by the SPA (can be thin wrappers over existing `/web/adt/th/v1/account/...` controllers):
    - `POST /api/th/v1/sales/invoices` → search/list invoices (filters + limit) matching the current `api_invoice.list_invoices` data shape.
    - `GET /api/th/v1/sales/invoices/:id` → invoice detail (shape like `invoice_detail`).
    - `POST /api/th/v1/sales/invoices/:id/register-payment` → same behaviour as `register_payment`.
    - **New for offline sync:**
      - `POST /api/th/v1/sales/invoices` (no `id`) → create draft invoice from `InvoicePayload`.
      - `PUT /api/th/v1/sales/invoices/:id` → update an existing draft/not-posted invoice.
      - `POST /api/th/v1/sales/invoices/:id/post` → post the invoice.
  - All above must respect bearer auth + `X-Instance-ID` and reply with `{ success, data, error }`.

- **Excel import endpoints**
  - Implement endpoints matching:
    - `POST /api/th/v1/excel/import`:
      - Accepts `multipart/form-data` with `file` (.xlsx) and `import_type`.
      - Returns `data = ExcelImportJob` with `jobId`, counters, `status`, `createdAt`.
    - `GET /api/th/v1/excel/import/:jobId`:
      - Returns latest `ExcelImportJob`.
    - `GET /api/th/v1/excel/import/:jobId/result`:
      - Returns `data = { summary: { totalRows, acceptedRows, failedRows }, failedFileUrl? }`.
  - Backend is free to choose the job storage model; the React app only relies on the contract above.

- **Backend connection / registration**
  - Provide a small API for instance registration and monitoring:
    - `POST /api/backend/instances/token`:
      - Returns `{ token, install_command, expires_at, instancePublicId }` in `data`.
    - `GET /api/backend/instances/:id` (where `:id = instancePublicId`):
      - Returns `{ id, hostname, ip, last_heartbeat, status }` in `data`, with `status = pending|connected|error|offline`.
  - These feed the “Connect Odoo backend” page and connection status icons.

- **Bearer-token support for frontend routes**
  - Existing `/web/adt/th/v1/...` routes currently use `auth="user"` and Odoo sessions.
  - For SPA use without Odoo’s login UI, controllers should:
    - Either accept bearer tokens via a helper like `_auth_bearer_user()` and switch `env.user` accordingly, **or**
    - Expose parallel `/api/th/v1/...` routes that rely solely on bearer token auth.

