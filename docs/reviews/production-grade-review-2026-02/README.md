# ERPTH Production-Grade Review Package (2026-02)

This review package implements the planning deliverables for a production-grade review of:

- React frontend (`ERPTH`)
- Odoo API layer (`adt_th_api`)
- AI assistant backend (`adt_ai_config`)
- Dynamic accounting reports (`adt_dynamic_accounting_report`)
- Related accounting/tax modules that affect compatibility

## Deliverables

1. `gap-matrix.md`
2. `workflow-coverage-matrix.md`
3. `api-contract-compatibility-matrix.md`
4. `permission-data-isolation-matrix.md`
5. `pdf-print-correctness-matrix.md`
6. `production-hardening-backlog.md`
7. `rollout-and-uat-matrix.md`

## Baseline Summary (from current code review)

- React covers sales, purchases, invoices, accounting reports, dashboard, AI assistant.
- React does not yet expose a full stock receiving/warehouse workflow.
- AI assistant backend is currently a rule-based planner/runner with approval modes.
- AI API supports both `/api/th/v1/ai/*` and `/web/adt/th/v1/ai/*`.
- AI usage token fields are supported by frontend UI but not consistently produced by backend responses.
- `adt_dynamic_accounting_report` has filter/date handling fragility in JS and strong coupling between Balance Sheet and Profit & Loss.
- `adt_th_api` has resilience fallback for partner ledger when `account_move_line.wht_amount` column is missing, but dynamic Odoo report UI path can still fail on schema drift.
- Tax reports API (VAT/WHT) is functional for JSON payloads but export endpoints are not yet API-complete (PDF/XLSX placeholders).

## Source References Used

- `/Users/ikob/Documents/iKobDoc/ERPTH/src`
- `/Users/ikob/Documents/iKobDoc/ERPTH/docs`
- `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_th_api/controllers`
- `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config/models/ai_assistant.py`
- `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_dynamic_accounting_report`
- `/Users/ikob/Documents/iKobDoc/Active22/Cholatee Innovation/ERPTH project/ปรับ erpth 2502.docx`

## How to Use This Package

- Use `gap-matrix.md` to align stakeholders on current-state vs target-state.
- Use `production-hardening-backlog.md` to create implementation tickets.
- Use `rollout-and-uat-matrix.md` as release gating for staging/production.
- Use workflow and API matrices during frontend/backend sprint planning.

