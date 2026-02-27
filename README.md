## Quickfront18 Frontend (React + TypeScript)

Quickfront18 is a React 18 + Vite + TypeScript frontend for Thai SME accounting on top of Odoo 18 Community.  
It talks to a middleware backend over JSON APIs, supports offline-first usage, and integrates with LINE LIFF.

## Local Development Setup

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   
   Create a `.env` file in the project root:
   ```env
   # For local development with local Odoo backend (default):
   VITE_API_BASE_URL=/api
   VITE_PROXY_TARGET=http://localhost:8069
   VITE_API_KEY=your_api_key_here
   VITE_ODOO_DB=q01
   ```
   
   **OR** for local development with remote backend:
   ```env
   VITE_API_BASE_URL=/api
   VITE_PROXY_TARGET=https://qacc.erpth.net
   VITE_API_KEY=your_api_key_here
   VITE_ODOO_DB=q01
   ```

3. **Start dev server:**
   ```bash
   npm run dev
   ```

### Troubleshooting `ECONNREFUSED` Error

If you see `ECONNREFUSED` when starting the dev server, it means the backend Odoo service isn't running.

**Option A: Use Remote Backend (Recommended for quick testing)**
- Set `VITE_PROXY_TARGET=https://qacc.erpth.net` in your `.env` file
- Make sure you have network access to the remote server
- Restart the dev server: `npm run dev`

**Option B: Run Local Odoo Backend**
- Start your local Odoo instance on port 8069
- Or update `VITE_PROXY_TARGET` to match your Odoo port (e.g., `http://localhost:18069`)

**Option C: Disable Proxy (Direct API calls)**
- Set `VITE_API_BASE_URL=https://qacc.erpth.net/api` (full URL)
- Remove or comment out the proxy in `vite.config.ts`
- Note: This may cause CORS issues if the backend doesn't allow cross-origin requests

### Environment Variables

- `VITE_API_BASE_URL`: API base path (default: `/api`)
  - Use `/api` for proxy mode (development)
  - Use full URL (e.g., `https://qacc.erpth.net/api`) for direct mode
- `VITE_PROXY_TARGET`: Backend URL for Vite proxy (development only)
  - Default: `http://localhost:8069`
  - Set to remote URL if using remote backend
- `VITE_API_KEY`: API key from Odoo (ADT API → API Clients)
- `VITE_ODOO_DB`: Database name (optional, can be set at runtime)

## Production-grade runbook (final)

This section is a “do this, don’t debug” guide based on issues we hit during server rollout (Cloudflare + nginx + Odoo multi-DB).

### Topics & issues we hit (postmortem)

- **`405 Not Allowed` / `404 Not Found` at `/api/...`**
  - **Cause**: nginx `/api` was not proxying to the correct upstream (or Cloudflare was fronting a different origin), or Odoo instance didn’t load the API controllers/models in the selected DB.
  - **Fix**: a dedicated Odoo API instance on its own port + nginx proxy to that port.
- **`500 Internal Server Error` from Odoo**
  - **Cause**: broken Odoo config (`addons_path` contained a stray `>` like `/opt/odoo18/>`, or duplicated `[options]` section), or missing addon roots so dependencies were not found.
  - **Fix**: sanitize config + make `addons_path` include every addon root directory that contains your installed modules.
- **API route exists but model missing (`KeyError: 'adt.api.client'`)**
  - **Cause**: `adt_th_api` wasn’t actually loaded in the running registry because dependency modules (e.g. `report_xlsx`, `partner_firstname`, `date_range`, `l10n_th_*`) were not discoverable via `addons_path`.
  - **Fix**: add the missing addon root (example from our server: `/opt/odoo18/odoo/adtv18/l10nth`) to the API instance `addons_path`, restart, then upgrade modules.
- **`upstream sent too big header` (nginx)**
  - **Cause**: upstream returned large headers (cookies, etc.).
  - **Fix**: increase nginx proxy buffers (and ensure `large_client_header_buffers` is in the `server`/`http` context, not inside `location`).
- **zsh: `event not found: doctype`**
  - **Cause**: pasting HTML containing `!` into zsh (history expansion).
  - **Fix**: run only the curl command, or `set +H` for the session.

### Production architecture (recommended)

- **Odoo UI instance (multi-DB)**: normal Odoo service (e.g. port `8069`), `list_db` as needed.
- **Odoo API instance (pinned DB)**: separate service (e.g. port `18069`) with:
  - `db_name = q01` and `dbfilter = ^q01$`
  - `server_wide_modules` includes your API module (e.g. `adt_th_api`)
  - `workers = 0` and `max_cron_threads = 0` to keep it deterministic (adjust later)
  - **separate logfile** (e.g. `/var/log/odoo18/odoo18-api.log`) so you don’t mix logs
- **nginx**:
  - `qacc.erpth.net` serves the SPA and proxies `/api/` to the API instance (`127.0.0.1:18069`)
  - (optional) keep the `db` rewrite via snippet for “multi-db selection by CLI” and future flexibility
- **Cloudflare**:
  - Ensure the origin is correct and that `/api` traffic reaches nginx (test from origin IP with `Host:` header when debugging).

### Required frontend env (same server / same domain)

Use relative `/api` so the SPA calls nginx on the same domain:

```env
VITE_API_BASE_URL=/api
VITE_API_KEY=<adt_api_client.key>
VITE_ODOO_DB=q01
```

### One-command DB switching (CLI)

There are two supported patterns; pick one and stick to it.

#### A) Switch DB at nginx layer (rewrite `db=`) — fastest

If your nginx config uses a snippet like `/etc/nginx/snippets/qacc_api_db.conf`:

```nginx
set $odoo_api_db q01;
```

You can switch it by CLI and reload nginx:

```bash
sudo npm run set-api-db -- --db q02 --snippet /etc/nginx/snippets/qacc_api_db.conf --reload
```

#### B) Switch DB by pinning the API instance (recommended for production)

This updates `db_name` + `dbfilter` in `/etc/odoo18-api.conf` and restarts the service:

```bash
sudo npm run set-odoo-api-db -- --db q02 --config /etc/odoo18-api.conf --service odoo18-api
```

### Production deployment (frontend on same server)

```bash
cd /opt/quickfrontend

# 1) set env
nano .env

# 2) build
npm ci
npm run build

# 3) deploy build output to nginx root
# IMPORTANT: on our production, nginx serves SPA from:
#   root /var/www/qacc;
# not from /opt/quickfrontend/dist
sudo rsync -av --delete /opt/quickfrontend/dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc

# 4) reload nginx
sudo nginx -t && sudo systemctl reload nginx
```

### Production deployment (Odoo API instance / adt_th_api)

This frontend depends on Odoo controllers from `adt_th_api`. When you change Python controller files, **you must restart the `odoo18-api` service** to load the new routes. `-u` (upgrade module) alone does **not** hot‑reload HTTP routing in a long-running Odoo process.

#### 0) Confirm the API instance is the one serving `/api/*`

```bash
# Confirm service is running
sudo systemctl status odoo18-api --no-pager

# Confirm it's using the pinned config (should be /etc/odoo18-api.conf)
ps -ef | grep -E "/etc/odoo18-api\\.conf" | grep -v grep

# Show how the service is started (paths for python/odoo-bin)
systemctl show -p ExecStart odoo18-api
```

#### 1) Update addon code (git → server)

```bash
cd /opt/odoo18/odoo/adtv18
git status
git pull
```

#### 2) Upgrade module in the pinned DB

> Replace `q01` if your API instance pins another DB (`db_name` in `/etc/odoo18-api.conf`).

```bash
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  -c /etc/odoo18-api.conf -d q01 -u adt_th_api --stop-after-init
```

#### 3) Restart API service (required for new/changed routes)

```bash
sudo systemctl restart odoo18-api
sudo systemctl status odoo18-api --no-pager

# Ensure PID changed after restart (important when fixing 404 routes)
ps -ef | grep -E "/etc/odoo18-api\\.conf" | grep -v grep
```

#### 4) Verification (local, bypass nginx)

```bash
# Should respond (usually 200 HTML) – confirms service listens on the API port
curl -i http://127.0.0.1:18069/web/login | head
```

#### 5) Verification matrix (what 404/401/405 means)

- **404 Not Found** on `/api/th/v1/...`:
  - **Meaning**: route is not registered in the running Odoo process (common after controller code changes).
  - **Fix**: `sudo systemctl restart odoo18-api` (and ensure you're hitting the correct instance/port).
- **401 Unauthorized** with JSON `Missing X-ADT-API-Key header`:
  - **Meaning**: you didn’t send `X-ADT-API-Key` (curl) or frontend env `VITE_API_KEY` is empty/wrong.

## AI Assistant (Safe LLM / DB-only)

The React assistant UI integrates with `adt_th_api` AI endpoints and now supports a **backend-only LLM adapter** with deterministic fallback.

### Security model (important)

- LLM runs **only on backend** (`adt_th_api`)
- LLM **does not** access DB directly
- LLM can only propose backend tools (tool registry)
- Tool execution uses normal Odoo ORM access (ACL + record rules + company scope)
- All business facts must come from the current Odoo DB/company context
- Sensitive write actions (confirm/post/payment/status changes) should remain approval-gated

### AI endpoints (unchanged paths)

- `/api/th/v1/ai/capabilities`
- `/api/th/v1/ai/runtime`
- `/api/th/v1/ai/chat`
- `/api/th/v1/ai/execute`
- `/api/th/v1/ai/confirm`
- `/api/th/v1/ai/tasks`

`/web/adt/th/v1/ai/*` aliases remain supported for web-session style integrations.

### Backend config (Odoo `ir.config_parameter`)

Set these in Odoo (System Parameters) for LLM mode:

- `adt_th_api.ai_enabled=1`
- `adt_th_api.ai_mode=approve_required` (or `auto_safe`, `plan_only`)
- `adt_th_api.ai_provider=openai_compat` (or `local`)
- `adt_th_api.ai_provider=openclaw` (for offline/local OpenAI-compatible runtime)
- `adt_th_api.ai_llm_enabled=1`
- `adt_th_api.ai_model=<model-name>`
- `adt_th_api.ai_base_url=<openai-compatible-base-url>`
- `adt_th_api.ai_api_key=<secret>`
- `adt_th_api.ai_timeout_sec=30`

For OpenClaw-specific overrides:

- `adt_th_api.ai_openclaw_base_url=<openclaw-base-url>`
- `adt_th_api.ai_openclaw_model=<openclaw-model>`
- `adt_th_api.ai_openclaw_api_key=<optional-api-key>`

If `ai_provider=local` or LLM is unavailable, the assistant falls back to deterministic planning (`mode=deterministic_fallback`).

### Frontend behavior

The assistant UI shows runtime metadata returned by backend:

- `mode` (`llm` / `deterministic_fallback`)
- `trace_id`
- `warnings`
- `safety` (DB-only flag, company id, approval count)
- `sources` (safe source summaries / record links)
- token `usage` (provider usage or local estimate)
- safe trace panel / drawer for tool proposals (allowed/denied, approval flags, deny reason)
- retry controls (`Retry query`, `Retry answer`)
- assistant context reset on company/instance change (to prevent cross-company chat context bleed)
- approval queue grouping summary (`Draft create`, `Status change`, `Payment`, `Posting`, etc.)

### Backend AI behavior (current phase)

- Backend-only LLM adapter (`OpenAI-compatible`) with deterministic fallback
- Central provider resolver (`local` / `openai_compat` / `openclaw`) in backend adapter
- Tool registry + policy metadata (category / auto-safe / approval-required)
- Sales / Purchase / Reports tool coverage extended (read + selected write wrappers)
- Structured `execute` results include `data`, `computed_from`, `error_code` (for source summaries and safe trace)
- AI errors include `trace_id` for support/debug without exposing sensitive stack traces

### AI eval harness (read workflow + safety contract)

Run a quick regression to verify `/ai/*` contract and DB-only safety metadata:

```bash
npm run ai:eval -- \
  --base http://localhost:8069 \
  --db q01 \
  --api-key <API_KEY> \
  --token <BEARER_TOKEN> \
  --instance-id <INSTANCE_ID>
```

What it checks:
- `capabilities` endpoint reachable
- `chat` responses include `mode`, `trace_id`, `safety`, `usage`
- warns if `safety.db_only_enforced` is not `true`
- runs Thai read prompts for Sales/Purchase/Reports summary scenarios
- runs write-risk prompts and asserts approval gating (`approval_required_count > 0`)

### Approval hard-guard (current behavior)

In backend policy, tools are forced into approval queue when either:
- category is `write_posting`, or
- tool name indicates risky action (`confirm`, `validate`, `post`, `payment`, `register`)

This keeps write-risk actions from auto-running even if category metadata is misconfigured.

### Upgrade / reload after backend AI changes

When changing Python files in `adt_th_api` (AI adapter, tools, controller):

```bash
cd /Users/ikob/Documents/iKobDoc/Active22/V18/odoo
/Users/ikob/Documents/iKobDoc/Active22/V18/odoo-venv18/bin/python3 ./odoo-bin \
  -c /Users/ikob/Documents/iKobDoc/Active22/V18/odoo/odoo.conf \
  -d q01 -u adt_th_api --stop-after-init
```

Then restart the Odoo server process and hard refresh the frontend.
- **405 Method Not Allowed** with `Allow: POST, OPTIONS`:
  - **Meaning**: you used the wrong HTTP method (e.g. GET). Use **POST** for JSON-RPC endpoints.

#### 6) Verify Branding endpoints (curl)

Branding endpoints used by Reports Studio:
- `POST /api/th/v1/erpth/branding/company?db=q01`
- `POST /api/th/v1/erpth/branding/company/update?db=q01`

```bash
API_KEY="<adt_api_client.key>"
TOKEN="<Bearer token>"

# Fetch branding (POST JSON-RPC)
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/erpth/branding/company?db=q01" \
  -H "X-ADT-API-Key: $API_KEY" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"db":"q01"},"id":1}' | head -n 80

# Update branding (POST JSON-RPC)
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/erpth/branding/company/update?db=q01" \
  -H "X-ADT-API-Key: $API_KEY" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"companyName":"ERPTH 123 Co., Ltd.","addressLines":["123 ถนนสุขุมวิท"],"db":"q01"},"id":1}' | head -n 120
```

#### 7) Odoo shell (debug) – run as `odoo18` (peer auth)

On our production, Postgres uses peer auth for DB user `odoo18`, so opening shell as `root` will fail. Use the service user:

```bash
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  shell -c /etc/odoo18-api.conf -d q01
```

#### If `git pull` fails on server (local changes)

If you see:

- `error: Your local changes to the following files would be overwritten by merge: package-lock.json`

Choose one:

```bash
# Option A: discard local changes (recommended on servers)
git restore --source=HEAD --worktree --staged package-lock.json
git pull --ff-only origin main
```

```bash
# Option B: stash (if you intentionally edited on server)
git stash push -u -m "wip"
git pull --ff-only origin main
```

### Production verification checklist

- **SPA is actually served from nginx root** (bypass Cloudflare cache/origin mismatch):
  - `curl -s -k --resolve qacc.erpth.net:443:127.0.0.1 https://qacc.erpth.net/ | grep assets/index | head`
  - Expected: it references the latest hashed assets from your newest build (e.g. `index-XXXX.js`, `index-YYYY.css`).
- **nginx points to the expected docroot**:
  - `sudo nginx -T | grep -nE "server_name qacc\.erpth\.net|root /var/www/qacc|try_files|location /api" -n`
- **Files exist in the docroot**:
  - `ls -la /var/www/qacc/assets | head`
- **API upstream works locally**:
  - `curl -i http://127.0.0.1:18069/web/login`
  - `curl -i -X POST http://127.0.0.1:18069/api/th/v1/auth/login?db=q01 -H "X-ADT-API-Key: <key>" ...`
- **nginx proxy works**:
  - `curl -i -X POST https://qacc.erpth.net/api/th/v1/auth/login?db=q01 ...` returns `success: true`
- **Routes changed? Restart the API service**:
  - If you changed Odoo controllers and still see `404` on new endpoints, restart:
    - `sudo systemctl restart odoo18-api`
- **Logs are separated**:
  - API: `/var/log/odoo18/odoo18-api.log`
  - Main: `/var/log/odoo18/odoo18.log`
- **No “Some modules are not loaded ...” in API logfile**:
  - If present, fix `addons_path` to include the missing addon roots.

## 🚀 Quick Start

### Development

```bash
# Setup environment
npm run setup

# Start dev server
npm run dev
```

### Production Deployment

```bash
# One-command setup
npm run setup:prod

# Validate configuration
npm run validate-env:prod

# Build
npm run build

# Deploy dist/ folder to your server
```

**That's it!** See [Server Deployment Guide](./docs/server-deployment-guide.md) for details.

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

### Purchase Orders, Expenses & Taxes/VAT API

See **[Purchase Orders, Expenses & Taxes/VAT API Specification](./docs/api-purchases-expenses-taxes.md)** for complete API documentation including:

**⚠️ Troubleshooting**: If Purchase Orders API is not working (404 errors), see **[Purchase Orders API Troubleshooting Guide](./docs/purchase-orders-api-troubleshooting.md)** for diagnosis and resolution steps.

- **Purchase Orders**: list, get, create, update, confirm, cancel
- **Expenses**: list, get, create, update, submit
- **Taxes & VAT**: list (enhanced), calculate, validate VAT number
- **TypeScript types**: Request/Response interfaces for all endpoints
- **Implementation guidelines**: API client structure, authentication, error handling, date format, testing
- **Key features**: camelCase responses, unified `ApiEnvelope<T>` format, error codes, pagination, company isolation

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
  - For SPA use without Odoo's login UI, controllers should:
    - Either accept bearer tokens via a helper like `_auth_bearer_user()` and switch `env.user` accordingly, **or**
    - Expose parallel `/api/th/v1/...` routes that rely solely on bearer token auth.

- **Purchase Orders, Expenses & Taxes/VAT endpoints**
  - See [Purchase Orders, Expenses & Taxes/VAT API Specification](./docs/api-purchases-expenses-taxes.md) for complete endpoint specifications.
  - Required endpoints:
    - Purchase Orders: `/api/th/v1/purchases/orders` (list, get, create, update, confirm, cancel)
    - Expenses: `/api/th/v1/expenses` (list, get, create, update, submit)
    - Taxes & VAT: `/api/th/v1/taxes` (list, calculate, validate-vat)
  - All endpoints must:
    - Accept JSON-RPC 2.0 format (Odoo `type="json"` routes)
    - Return `ApiEnvelope<T>` with camelCase field names
    - Support pagination via `limit`/`offset`
    - Respect `X-Instance-ID` header for company scoping
    - Use standard error codes (`AUTH_REQUIRED`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, etc.)
