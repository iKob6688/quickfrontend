# Permission & Data Isolation Matrix

## Security Goals

- Enforce user permissions in Odoo (ACL + record rules) for all reads/writes.
- Enforce company isolation with `X-Instance-ID` + allowed company checks.
- Prevent frontend scope labels from becoming trust source.
- Ensure AI assistant never bypasses permissions or leaks cross-company data.

## Role Matrix (Target)

| Capability | Admin | Accountant | Sales | Purchase | Viewer |
|---|---|---:|---:|---:|---:|
| Login / me | Yes | Yes | Yes | Yes | Yes |
| View dashboard KPIs | Yes | Yes | Yes | Yes | Yes (limited) |
| Create/Edit customers | Yes | Yes | Yes | Yes | No |
| Create/Edit products | Yes | Yes | Yes (optional policy) | Yes (optional policy) | No |
| Create quotation/SO | Yes | Optional | Yes | No | No |
| Confirm SO | Yes | Optional | Yes (policy-based) | No | No |
| Create/Post invoice | Yes | Yes | Optional (create only) | No | No |
| Register customer payment | Yes | Yes | Optional (cashier role) | No | No |
| Create/Approve PR | Yes | Optional | No | Yes | No |
| Create/Confirm PO | Yes | Optional | No | Yes | No |
| Receive goods / stock ops | Yes | Optional | No | Yes / Warehouse | No |
| COA/Journal management | Yes | No (read optional) | No | No | No |
| Accounting reports | Yes | Yes | Limited subset | Limited subset | Limited subset |
| VAT/WHT reports | Yes | Yes | No | No | No |
| AI Assistant (read-only tools) | Yes | Yes | Yes | Yes | Optional |
| AI Assistant create/post tools | Yes | Policy-based | Policy-based | Policy-based | No |

## Endpoint Authorization Checklist (Review/Implementation)

| Check | Applies To | Current Risk | Required Action |
|---|---|---|---|
| Scope code matches domain (`ai`, `reports`, `tax_reports`, etc.) | All API routes | AI uses `auth` scope | Refactor AI routes to require `ai` scope |
| Bearer user required for API routes | Mutating and sensitive reads | Mixed patterns possible | Audit all `/api/th/v1/*` controllers |
| Company context enforcement (`X-Instance-ID`) | Multi-company APIs + AI | Implemented in AI; needs consistency elsewhere | Standardize helper usage |
| No `sudo()` bypass for business data reads/writes | AI tools, report APIs | Some report model calls use `sudo()` legitimately | Restrict/annotate `sudo()` and test data isolation |
| Record rule enforcement | AI tool dispatch, list/detail APIs | Depends on env/user usage | Add test matrix by role/company |
| Frontend scope display not trusted | React UI guards | Runtime/hardcoded scope changes have occurred | Document and enforce backend-only trust |

## AI-Specific Data Isolation Controls (Target)

| Control | Requirement | Implementation Direction |
|---|---|---|
| Company scoping | Mandatory on every AI call | Reuse `_scoped_env_for_user`; add tests |
| ACL/record rules | Never bypass | No broad `sudo()` in tool methods |
| Tool policy gating | Feature flags + role permissions + sensitivity class | Introduce policy layer before runner |
| Read/write approval | Explicit approval for finance-sensitive mutations | Keep nonce + approval ids; extend to more tools |
| Audit logging | Every tool execution / denial / error | Extend `ai.agent.action.log` schema |
| Token usage logging | Prompt/completion/total/model/provider | Add fields or linked telemetry model |

## Required Security Tests (Minimum)

- Cross-company AI query with wrong `X-Instance-ID` returns 403.
- AI tool cannot read restricted partner/invoice outside record rules.
- Sales user cannot call COA/journal admin endpoints (once added).
- Web route and API route authorization behavior is equivalent in outcome.
- Report drilldown respects same permissions as report header data.

