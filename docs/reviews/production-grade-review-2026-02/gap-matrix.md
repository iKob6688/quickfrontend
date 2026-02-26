# Gap Matrix (Current vs Target)

## Legend

- `Status`: `OK`, `Partial`, `Missing`, `Fragile`
- `Priority`: `P0` (critical), `P1`, `P2`, `P3`

## Frontend UX / Workflow

| Area | Current | Target | Status | Priority | Notes |
|---|---|---|---|---|---|
| Quotation create flow | Basic create/edit exists | Guided flow with continuation to SO/invoice | Partial | P1 | Need stronger CTA chain and downstream actions |
| Invoice create flow | Create/edit/post/payment exists | End-to-end invoice lifecycle with professional payment UX | Partial | P1 | Missing split payment UX, QR flow |
| Autosave draft (quotation/SO/invoice) | Not found | Auto-save + restore + conflict handling | Missing | P2 | Requested in attached doc |
| Inline create customer/product from selector | Route exists (`/products/new`) but not inline workflow-native | Inline modal/drawer create/edit | Partial | P2 | Adds speed, reduces context switches |
| Purchase Request -> PO | Present | Tight, visible lifecycle | Partial | P1 | Verify conversion discoverability and status UX |
| PO -> Goods Receipt (stock receiving) | Not surfaced in React | Full receive/partial receive workflow | Missing | P0/P1 | Core procure-to-pay gap |
| Delivery/stock fulfillment for sales | Not surfaced in React | Picking/delivery workflow | Missing | P0/P1 | Blocks end-to-end quote-to-cash |
| Dashboard drilldown UX | Present, improved in some areas | Consistent clickable metrics and stateful filters | Partial | P2 | Continue UX polish and action consistency |
| Error handling / degraded mode | Exists in multiple pages | Structured retry + actionable error states | Partial | P1 | Especially route/proxy/report failures |

## Backend API (`adt_th_api`)

| Area | Current | Target | Status | Priority | Notes |
|---|---|---|---|---|---|
| Route support (`/api` + `/web/adt`) | Dual route exists for many modules | Explicit contract + deployment guidance | Partial | P0 | Runtime confusion still happens |
| Error envelope consistency | Mixed across endpoints | Standardized `code/message/details/trace_id` | Fragile | P1 | Impacts frontend resilience |
| AI endpoint scope policy | Uses `auth` scope for AI routes | Dedicated `ai` scope | Fragile | P0 | Security/maintainability issue |
| Tax reports JSON | Good base | Stable + validated + documented | Partial | P1 | VAT/WHT data structure looks strong |
| Tax reports export via API | Placeholder for VAT PDF/XLSX | Real export delivery (download or file token) | Missing | P1 | Needed for production completeness |
| COA / Journal management API | Helper read only (accounts/by-code) observed | Admin-only list/read/manage endpoints | Missing | P1 | Requested in attached doc |
| Report metadata endpoints | Partial implicit behavior | Explicit metadata endpoints for filters | Missing | P2 | Reduces frontend hardcoding |
| Schema drift fallback (reports) | Partner ledger fallback exists | Broad report-layer resilience strategy | Partial | P0 | Dynamic Odoo UI path still breaks |

## AI Assistant (`adt_ai_config` + React)

| Area | Current | Target | Status | Priority | Notes |
|---|---|---|---|---|---|
| Architecture | Rule-based planner/runner | `route => parser => policy => runner => audit` | Partial | P1 | Good skeleton, limited parser depth |
| Conversational capability | Basic keyword routing | Contextual AI + grounded DB answers | Missing/Partial | P1 | Depends on parser/provider integration |
| Tool coverage | contacts/products/quotation/report/help | Sales, purchases, stock, invoices, payments, reports | Missing | P1 | High business impact |
| Token usage in backend response | Frontend supports display; backend inconsistent | Standard `usage` in chat/execute/confirm | Missing | P1 | User explicitly requested |
| Audit logging | `ai.agent.action.log` exists | Add usage/provider/latency/denials | Partial | P1 | Extend schema and logging points |
| Permission isolation | Company scoping + ACL via env/user | Formal policy layer + deny reasons | Partial | P0 | Must remain DB-only and non-bypass |

## Accounting Reports (React + Dynamic Odoo Module)

| Area | Current | Target | Status | Priority | Notes |
|---|---|---|---|---|---|
| React accounting reports | Broad coverage | Stable contract + drilldowns + filters | Partial | P1 | API side mostly present |
| Odoo dynamic report date filters | Works but fragile JS state/event handling | Deterministic filter state + validation | Fragile | P0 | User reported date range breaks |
| P&L/Balance Sheet separation | P&L uses balance-sheet wizard/model | Clear report-specific models/contracts | Fragile | P1 | Strong coupling raises regression risk |
| Drilldown alignment | Partial | Unified drilldown URL/action contract | Partial | P1 | Needed across React and Odoo UI |
| Schema drift compatibility (`wht_amount`) | API partner-ledger fallback exists | End-to-end fallback including dynamic UI | Partial | P0 | Current Odoo UI path still vulnerable |

## Payments / Thai Tax / PromptPay

| Area | Current | Target | Status | Priority | Notes |
|---|---|---|---|---|---|
| Register payment | Modal supports manual methods | Full payment operations incl. split/allocations UX | Partial | P1 | Backend may support repeated payments but UX is limited |
| Partial payment visibility | Amount paid/due visible | Timeline + allocations + reconciliation hints | Partial | P2 | Professional accounting UX gap |
| PromptPay QR | Not found | Generate/display/track QR for invoice/receipt | Missing | P1 | Requested target feature |
| VAT/WHT UI usability | Present via reports | Guided Thai tax setup/report UX | Partial | P1 | Strong need for discoverability |

## Operations / Deployability

| Area | Current | Target | Status | Priority | Notes |
|---|---|---|---|---|---|
| Local/prod route behavior | Known confusion around proxy/no-proxy | Documented topology + runtime diagnostics | Fragile | P0 | Repeat issue pattern |
| Cron/autovacuum transient cleanup | Errors observed (`unlink` on report variants) | Clean cron runs / safe transient handling | Fragile | P1 | Ops noise and potential side effects |
| Observability | Mixed logs and browser debugging | Structured logs/metrics/traces | Partial | P1 | Especially AI/report endpoints |

