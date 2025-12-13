# Quickfront18 Functional Spec (Frontend)

This document describes **what the React SPA and CLI provide** today, and how the user flows map to the **existing Odoo 18 `adt_th_api` endpoints**.

## Scope & principles

- **Odoo 18 is the source of truth** for accounting logic (states, totals, taxes, payment state).
- The SPA does **UI orchestration only**:
  - Render data from the API
  - Collect inputs and submit to the API
  - Show loading/errors/success states
- All HTTP calls go through:
  - `src/api/client.ts` (Axios instance + headers + 401 handling)
  - `src/api/services/*` (typed service functions)
  - `src/api/response.ts` (`unwrapResponse<T>()` for envelope/JSON-RPC)
- **React Query** is used for server state; **Zustand** only for auth/app UI state.

---

## Phase 1 — Bootstrap (CLI)

### Goal
Provision a frontend instance using a single **Registration Token** (Odoo API client key) and write `.env` automatically.

### User flow
- Run:
  - `npm run bootstrap`
- Prompt:
  - Bootstrap URL (default: `http://localhost:8069/api/th/v1/frontend/bootstrap`)
  - Registration Token
  - Optional db name (can be omitted)
- Writes `.env` block:
  - `VITE_API_BASE_URL`
  - `VITE_API_KEY`
  - `VITE_ODOO_DB`
  - `VITE_ALLOWED_SCOPES`
- User restarts `npm run dev`.

---

## Phase 2 — Authentication

### Login
- Page: `LoginPage` (`/login`)
- Store: `useAuthStore.login()`
- Behaviour:
  - Submit username/password
  - Call login API → store bearer token
  - Call me API → store user profile + instance id
  - Redirect to `/dashboard`

### Persist session
- On refresh:
  - If token exists → `loadMe()` fetches user and restores session

### Unauthorized handling
- On any API 401:
  - clear token + instance id
  - redirect to `/login`

---

## Phase 3 — Invoices (Sales)

### Invoice list
- Page: `InvoicesListPage` (`/sales/invoices`)
- Capabilities:
  - Tabs: all / draft / posted / paid / cancelled
  - Search (invoice number / customer name)
  - Refresh
  - Navigate to create invoice
  - Navigate to invoice detail

### Invoice create/edit
- Page: `InvoiceFormPage` (`/sales/invoices/new`, `/sales/invoices/:id/edit`)
- Capabilities:
  - Create/edit invoice header:
    - customerId (numeric for now)
    - invoiceDate, dueDate
    - currency
    - notes
  - Lines editor:
    - add/remove line
    - edit: productId, description, quantity, unitPrice, taxRate
  - Submit disabled until header + ≥ 1 line present
  - On success: navigates to invoice detail

> Note: Customer and product selectors require partner/product endpoints that are **not currently exposed** by `adt_th_api` under `/api/th/v1/*`. Until those exist, the UI uses numeric IDs.

### Invoice detail
- Page: `InvoiceDetailPage` (`/sales/invoices/:id`)
- Capabilities:
  - Render invoice header + status badge
  - Render invoice lines and Odoo-calculated amounts:
    - `amountUntaxed`, `totalTax`, `total`
    - line `subtotal`
  - Actions:
    - Post invoice (draft → posted)
    - Edit invoice (draft only)
    - Register payment (posted only)
    - Print/PDF (disabled until backend PDF endpoint exists)

### Register payment
- UI: `RegisterPaymentModal`
- Inputs:
  - amount, date, method, reference
- Behaviour:
  - Calls payment endpoint
  - Invalidates React Query caches for invoice + invoice list

---

## Phase 4 — Excel import

### Excel import page
- Page: `ExcelImportPage` (`/excel-import`)
- Capabilities:
  - Upload `.xlsx` file
  - Client-side preview + basic validation
  - Create import job
  - Poll job status until completed/failed
  - Fetch final result + provide download link for failed rows (if any)

---

## Phase 5 — Dashboard

### Dashboard
- Page: `DashboardPage` (`/dashboard`)
- Current:
  - Connection status (ping)
  - User + instance id display
  - Navigation cards
- Missing (requires backend KPI endpoint):
  - Revenue/outstanding/overdue KPIs
  - Charts (Recharts is installed)

---

## Customers/Contacts (planned)

The required customer/partner endpoints (`/api/th/v1/partners/*`) are **not present** in the current `adt_th_api/controllers` set. Once backend exposes them (same envelope/JSON-RPC pattern), Quickfront18 will add:
- Customers list + search + archive/unarchive
- Customer detail with contacts/addresses/invoices
- Customer create/edit forms


