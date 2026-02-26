# Rollout Plan + UAT Matrix (Production Grade)

## Release Strategy (Phased)

### Phase 0: Baseline Stabilization (No UX expansion)
- Goal: stop regressions and integration outages
- Includes:
  - Route/proxy diagnostics
  - Dynamic report date filter hardening
  - AI scope correction (non-breaking migration)
  - Report schema drift guards (`wht_amount`)

### Phase 1: Workflow Completion Foundations
- Goal: enable missing core business workflow steps
- Includes:
  - Stock receiving/delivery APIs + basic UI
  - Explicit SO -> Invoice endpoint + UI CTA
  - COA/journal admin read/list endpoints (admin only)

### Phase 2: Professional UX and Tax/Payment Completion
- Goal: make daily operations fast and reliable
- Includes:
  - Autosave draft forms
  - Inline create/edit selectors
  - Tax export API completion
  - Payment UX improvements
  - PDF correctness fixes

### Phase 3: AI Production Upgrade
- Goal: assistant architecture upgrade and expanded finance-safe tools
- Includes:
  - Parser/policy/runner refactor
  - Usage logging + observability
  - Expanded workflow tools with approvals
  - PromptPay QR assistant support (if base feature exists)

## Environment Rollout Matrix

| Stage | Purpose | Required Gates | Rollback Readiness |
|---|---|---|---|
| Local | Developer validation | Unit tests + smoke routes | N/A |
| Integration/Staging | Cross-module validation | Contract tests + UAT subset + report regression | Config rollback + module update rollback |
| Pilot Production | Limited users/companies | P0 complete + critical UAT pass | Feature flags + route fallback |
| Full Production | Broad rollout | All P1 gates + incident playbook | Monitored release with rollback checklist |

## UAT Matrix (Must Pass by Phase)

## Phase 0 UAT (P0 Gate)

| ID | Scenario | Expected Result | Priority |
|---|---|---|---|
| UAT-P0-01 | Login in local proxy mode | JSON response, no HTML 404 | P0 |
| UAT-P0-02 | Login in production nginx/proxy mode | JSON response, no route mismatch | P0 |
| UAT-P0-03 | Open P&L and change date range manually | Report refreshes correctly | P0 |
| UAT-P0-04 | Open Balance Sheet and apply date preset | Report refreshes correctly | P0 |
| UAT-P0-05 | Partner Ledger with missing `wht_amount` DB column (simulated/affected env) | No fatal error; fallback or guarded behavior | P0 |
| UAT-P0-06 | AI capabilities endpoint with API key + bearer + wrong scope | Denied correctly | P0 |
| UAT-P0-07 | AI capabilities/chat with `X-Instance-ID` unauthorized company | 403 company forbidden | P0 |

## Phase 1 UAT (Workflow Foundations Gate)

| ID | Scenario | Expected Result | Priority |
|---|---|---|---|
| UAT-P1-01 | Create quotation -> confirm SO | State transition visible in React and Odoo | P1 |
| UAT-P1-02 | SO -> Create Invoice | Invoice generated once (idempotent behavior) | P1 |
| UAT-P1-03 | PO confirm -> Receive goods (partial) | Stock and PO received qty updated | P1 |
| UAT-P1-04 | Receive remaining goods | Full received state correct | P1 |
| UAT-P1-05 | Admin user accesses COA/journal admin endpoints | Allowed | P1 |
| UAT-P1-06 | Non-admin user accesses COA/journal admin endpoints | Denied | P1 |

## Phase 2 UAT (Professional UX/Tax Gate)

| ID | Scenario | Expected Result | Priority |
|---|---|---|---|
| UAT-P2-01 | Start quotation form, reload page | Draft restores safely | P2 |
| UAT-P2-02 | Create product inline from sales form | Product created and selected automatically | P2 |
| UAT-P2-03 | VAT report JSON + PDF export | Data matches and export file downloads | P1 |
| UAT-P2-04 | WHT report JSON + export | Data matches and export file downloads | P1 |
| UAT-P2-05 | Partial payments across two payments | Amount due and receipt outputs are correct | P1 |
| UAT-P2-06 | Quotation/Invoice/Receipt PDF field checklist | All required fields present and correct | P1 |

## Phase 3 UAT (AI Upgrade Gate)

| ID | Scenario | Expected Result | Priority |
|---|---|---|---|
| UAT-P3-01 | Ask AI for customer summary (authorized user/company) | DB-grounded answer with correct scope | P1 |
| UAT-P3-02 | Ask AI for restricted record | Denial/no data leak | P0 |
| UAT-P3-03 | AI create quotation with approval flow | Approval prompt then correct document creation | P1 |
| UAT-P3-04 | AI returns `usage` in chat/execute/confirm | UI displays token usage and backend logs usage | P1 |
| UAT-P3-05 | AI task history | Audit trail shows actions/results/errors | P1 |

## Regression Suite (Run Every Release)

- Auth (`login`, `me`, `logout`)
- Dashboard KPIs and summary cards
- Sales orders list/detail/create/edit/confirm
- Invoices list/detail/create/post/register payment/amend/print
- Purchase requests list/detail/create/approval
- Purchase orders list/detail/create/confirm
- Accounting report pages (P&L, Balance Sheet, GL, Partner Ledger, Trial Balance)
- Tax reports (VAT/WHT)
- AI capabilities/chat basic flow

## Go-Live Checklist (Production)

- [ ] Backups verified (DB + filestore + custom modules)
- [ ] Module versions and git SHAs recorded
- [ ] Nginx/proxy config verified for `/api` and `/web/adt`
- [ ] Environment variables validated (`VITE_API_BASE_URL`, DB, API key bootstrap)
- [ ] Feature flags set for phased rollout
- [ ] Monitoring/logging dashboards ready
- [ ] Rollback plan tested (config + code + module update rollback)
- [ ] UAT sign-off from accounting + operations + admin

