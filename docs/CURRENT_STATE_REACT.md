# CURRENT_STATE_REACT

## Scope
- Repository scanned: `/Users/ikob/Documents/iKobDoc/ERPTH`
- Frontend code scanned: `/Users/ikob/Documents/iKobDoc/ERPTH/src`

## Architecture (text diagram)
- UI layer: React + React Router + Zustand + Bootstrap components.
- Auth state: Zustand store (`src/features/auth/store.ts`) with token persisted in local storage helper (`src/lib/authToken.ts`).
- API layer: Axios singleton (`src/api/client.ts`) + JSON-RPC helper (`src/api/services/rpc.ts`) + feature services in `src/api/services/*.ts`.
- Backend connectivity: relative base URL (`/api`) from Vite env; routes under `/th/v1/*` are appended by service modules.
- Navigation: app routes declared in `src/App.tsx`; menu tabs/mobile nav in `src/components/layout/AppLayout.tsx`.

## Auth mechanism
- Login uses `POST /th/v1/auth/login` (`src/api/services/auth.service.ts`) via JSON-RPC body.
- Subsequent requests use:
  - `Authorization: Bearer <token>` from frontend storage.
  - `X-ADT-API-Key` from `VITE_API_KEY` (frontend env).
  - `X-Instance-ID` from selected instance/company.
  - Optional `X-Agent-Token` for agent routes.
- Axios client has `withCredentials: true`, so cookie-based session can also coexist.
- `db` query parameter auto-injected from `VITE_ODOO_DB` in request interceptor.

## API client layer
- Main file: `src/api/client.ts`
- Behaviors:
  - Global timeout (`VITE_API_TIMEOUT_MS`, default 45000).
  - Unified unauthorized handling for both HTTP 401 and API envelope `{ success:false, error:{message:'Unauthorized'}}`.
  - Central request headers for token, API key, instance, agent.
- Service pattern:
  - Service modules post `makeRpc(...)` payload.
  - `unwrapResponse(...)` normalizes backend envelope.

## Existing endpoints called (key list)
- Auth
  - `/th/v1/auth/login`
  - `/th/v1/auth/me`
  - `/th/v1/auth/logout`
  - `/th/v1/auth/register_company`
- Partners/contacts
  - `/th/v1/partners/list`
  - `/th/v1/partners/:id`
  - `/th/v1/partners` (create/update)
- Products
  - `/th/v1/products/list`
  - `/th/v1/products/:id`
- Sales orders/quotation
  - `/th/v1/sales/orders/*`
- Invoices
  - `/th/v1/sales/invoices/*`
- Accounting reports
  - `/th/v1/accounting/reports/*`
- Agent
  - `/th/v1/agent/ocr`
  - `/th/v1/agent/expense/auto-post`
  - `/th/v1/agent/quotation/create`
  - `/th/v1/agent/contact/create`
  - `/th/v1/agent/invoice/create`
  - `/web/adt/th/v1/agent/status` (frontend session status)

## Report routes in React
- `/accounting/reports`
- `/accounting/reports/profit-loss`
- `/accounting/reports/balance-sheet`
- `/accounting/reports/general-ledger`
- `/accounting/reports/trial-balance`
- `/accounting/reports/partner-ledger`
- `/accounting/reports/partner-ledger/partner/:partnerId`
- `/accounting/reports/aged-receivables`
- `/accounting/reports/aged-payables`
- `/accounting/reports/cash-book`
- `/accounting/reports/bank-book`
- `/accounting/reports/vat`
- `/accounting/reports/wht`
- `/accounting/reports/general-ledger/account/:accountId`
- `/accounting/reports/move-lines/:moveLineId`

## Existing chat/assistant and state management
- There is an existing “Agent” feature set (`src/features/agent/*`) for one-shot operations (OCR, create contact/quotation/invoice, expense).
- No persistent conversational avatar assistant in app shell.
- No global AI chat state model yet.

## Existing feature-gate patterns
- Menu-level scope check via `hasScope(...)` in `src/components/layout/AppLayout.tsx`.
- Scope source: `VITE_ALLOWED_SCOPES` frontend env.
- Current gating is UI-soft (warns, still allows navigation in some cases), backend remains actual enforcement.
- Agent enablement currently based on status endpoint + token; no unified capability contract endpoint.

## Risks / gaps (for Avatar Assistant)
- Sensitive key risk: `VITE_API_KEY` and optional register master key are in frontend env; Avatar feature must not introduce any new secret leakage.
- No standardized `capabilities` schema for bot UI gate across user/company.
- Existing agent calls are operation-specific; no tool allowlist abstraction for chat planning/execution.
- No unified AI action audit log surfaced to React.
- React has no generic `ui_actions` executor contract (OPEN_ROUTE/OPEN_RECORD/ASK_APPROVAL) yet.
