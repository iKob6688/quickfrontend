# API Contract Compatibility Matrix (React ↔ `adt_th_api` ↔ Odoo)

## Contract Principles (Target)

- Keep `/api/th/v1/*` as canonical contract for SPA.
- Support `/web/adt/th/v1/*` as deployment fallback/compat route where needed.
- Standardize response envelopes and list shapes.
- Make fallback behavior explicit and observable (loggable, typed).

## Endpoint Families

| Domain | React Consumer | `adt_th_api` Route(s) | Odoo Dependency | Current Compatibility | Risks | Action |
|---|---|---|---|---|---|---|
| Auth | `src/api/services/auth.service.ts` | `/api/th/v1/auth/*` + `/web/adt/th/v1/auth/*` | session + `adt.auth.token` | Partial/Fragile (topology-sensitive) | Proxy/base URL confusion, 404 in local when routes unavailable | Add route diagnostics + fallback policy doc + integration test |
| AI Assistant | `src/api/services/ai-assistant.service.ts` | `/api/th/v1/ai/*` + `/web/adt/th/v1/ai/*` | `adt.ai.assistant.session` | Partial | Scope mismatch (`auth` vs `ai`), no consistent `usage` payload | Introduce AI scope + usage schema + response contract tests |
| Sales Orders | `src/api/services/sales-orders.service.ts` | `/api/th/v1/sales/orders/*` | `sale.order` | Partial | Fallback-to-invoice behavior may hide backend gaps | Add explicit capability flag + deprecate fallback hacks gradually |
| Sales Invoices | `src/api/services/invoices.service.ts` | `/api/th/v1/sales/invoices/*` (and related) | `account.move`, payments | Good/Partial | Payment UX vs backend richness mismatch | Add split payment APIs if needed + schema docs |
| Purchase Orders | `src/api/services/purchases.service.ts` | `/api/th/v1/purchases/orders/*` | `purchase.order` | Partial | Receiving flow absent | Add receiving endpoints |
| Purchase Requests | `src/api/services/purchase-requests.service.ts` | `/api/th/v1/purchases/requests/*` | `purchase.request` | Partial | Response shape variations observed | Normalize backend list schema |
| Accounting Reports | `src/api/services/accounting-reports.service.ts` | `/api/th/v1/accounting/reports/*` + web variants | report wizards/custom models | Partial | Schema drift/custom-field dependency | Expand fallbacks + metadata endpoints + tests |
| Tax Reports | tax report pages/services | `/api/th/v1/tax-reports/*` + web variants | l10n_th report wizards/models | Partial | Export placeholders | Implement API export contract |

## Response Shape Compatibility (Observed)

| Pattern | Current Reality | Compatibility Risk | Target |
|---|---|---|---|
| List payload | Multiple shapes (`items`, `data`, `rows`, etc.) | Frontend needs normalization glue; regressions likely | Standardize to `items` + `total` + `meta` |
| Error payload | Mixed (`error` string vs object) | Inconsistent user errors/retry behavior | Standard `error: { code, message, details, trace_id }` |
| Drilldown links | Some endpoints provide `drilldownUrl`, some implicit | UI inconsistencies | Standardize `ui_actions`/`recordRef` |
| Filter echo | Often present but uneven | Hard to rehydrate state | Standard `filters` section with canonical keys |

## AI Contract Gaps (Specific)

| Endpoint | React expects | Backend currently returns | Gap |
|---|---|---|---|
| `POST /ai/capabilities` | capabilities + tools + reports (+ optional permissions) | Mostly compatible | Add explicit policy/version metadata |
| `POST /ai/chat` | `reply`, `plan`, `ui_actions`, `records`, optional `usage` | No reliable `usage` observed | Add `usage`, `parser`, `policy` info |
| `POST /ai/execute` | `results`, `ui_actions`, `records`, optional `usage` | Compatible basics | Add execution receipt and usage |
| `POST /ai/confirm` | confirmation result + usage | Compatible basics | Add usage + denial metadata |
| `POST /ai/tasks` | task list with source links | Depends on backend implementation | Add stable task schema and pagination |

## Compatibility Decision Log (for implementation)

1. Preserve canonical `/api/th/v1/*` paths.
2. Keep web routes as compatibility fallback, but frontend fallback logic must be instrumented (debug metadata / error reasons).
3. Add schema version headers or `meta.apiVersion`.
4. Write contract tests per critical endpoint family before refactors.

