# Production Hardening Backlog (Prioritized)

## P0 (Must Fix Before Major Rollout)

### P0-1: Dynamic report date/filter hardening (`adt_dynamic_accounting_report`)
- Problem: Balance Sheet / P&L JS filter state is mutable/fragile; date range breaks are user-visible.
- Evidence:
  - `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_dynamic_accounting_report/static/src/js/balance_sheet.js`
  - `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_dynamic_accounting_report/static/src/js/profit_and_loss.js`
- Action:
  - Normalize filter state shape (`{date_from,date_to,journal_ids,...}` only)
  - Validate event target handling
  - Add regression tests for manual dates + presets + comparison

### P0-2: AI endpoint scope correction (`auth` -> `ai`)
- Problem: AI endpoints currently require `auth` scope; this is a policy mismatch and weakens separation.
- Evidence:
  - `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_th_api/controllers/api_ai_assistant.py`
- Action:
  - Change AI endpoints to `scope_code="ai"`
  - Update clients/keys/bootstrapping docs
  - Add negative/positive scope tests

### P0-3: End-to-end stock/receiving workflow gap (React + API)
- Problem: Procure-to-pay and quote-to-cash are incomplete without receiving/delivery/stock operations.
- Action:
  - Add stock/picking/receiving API endpoints in `adt_th_api`
  - Add React pages/components for incoming receipts and delivery validation
  - Link PO/SO detail pages to stock actions

### P0-4: Schema drift resilience for dynamic Odoo reports (`wht_amount`)
- Problem: Dynamic Odoo report path can still fail when `account_move_line.wht_amount` column missing.
- Evidence:
  - API fallback exists in `api_accounting_reports.py`, but dynamic report UI path still breaks
- Action:
  - Patch dynamic report model calls / SQL assumptions with field existence guards
  - Add fallback strategy similar to API partner ledger

### P0-5: Route/proxy diagnostics and topology stability
- Problem: Repeated local/prod issues from route/proxy mismatch cause outages and false frontend debugging.
- Action:
  - Runtime diagnostics endpoint + frontend diagnostics panel
  - Canonical env config docs and startup validation
  - Network error mapping (`404 route missing`, `CORS`, `proxy`, `HTML instead of JSON`)

## P1 (High Business Value / Strongly Recommended)

### P1-1: Explicit SO -> Invoice endpoint and UI continuation
- Add idempotent backend endpoint to create invoice from `sale.order`
- Surface CTA in React (`Confirm SO`, `Create Invoice`, `Open Invoice`)
- Respect invoicing policy (ordered/delivered quantities)

### P1-2: AI usage logging + response `usage` payload
- Backend should emit `usage` in chat/execute/confirm responses
- Persist provider/model/tokens/latency in logs (or linked telemetry model)
- Frontend can reuse existing token UI without hacks

### P1-3: AI parser/policy/runner refactor (maintainable architecture)
- Split current `_build_plan` and tool dispatch into:
  - parser
  - policy
  - runner
  - audit serializer
- Keep backward-compatible API shape while incrementally adding metadata

### P1-4: Tax report export API completion (VAT/WHT)
- Implement real PDF/XLSX export handling in API
- Return downloadable file stream or signed file token
- Add export tests and frontend UX states

### P1-5: COA/Journal admin-only management layer
- Add explicit read/list (and optionally manage) endpoints with admin-only permissions
- React admin screens or links should be gated by backend perms

### P1-6: Professional payment workflow improvements
- Improve split payment UX, allocation views, outstanding balance timeline
- Prepare PromptPay QR integration path

## P2 (UX Acceleration / Quality)

### P2-1: Auto-save drafts for quotation/SO/invoice forms
- Local draft persistence
- Restore prompts
- Conflict handling if backend draft changed

### P2-2: Inline create/edit customer and product in selectors
- Modal/drawer quick create from workflow form
- Return selected record to form context automatically

### P2-3: Standardized frontend error/retry patterns
- Reusable empty/error/retry components for all data pages
- Better messaging for route fallback failures

### P2-4: Report metadata endpoints + dynamic filter rendering
- Reduce hardcoding of accounts/journals/analytics filters

## P3 (Expansion / Optimization)

### P3-1: Advanced AI tools (PO, invoices, reconciliation hints, report explanations)
### P3-2: AI conversational memory and context summarization
### P3-3: Analytics and usage dashboards for AI + user workflows

## Implementation Sequencing Recommendation

1. P0-5 (diagnostics) + P0-1 (report filter hardening) in parallel
2. P0-2 (AI scope) + P1-2 (usage logging) together
3. P0-3 (stock/receiving foundations) before polishing quote-to-cash UX
4. P1-1 (SO->Invoice explicit endpoint/CTA)
5. P1-4/P1-5 tax export + COA/journal admin layer
6. P2 UX accelerators
7. P3 AI expansion

