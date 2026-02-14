# CURRENT_STATE_ODOO

## Scope
- Odoo custom addons scanned:
  - `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_th_api`
  - `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config`

## adt_th_api current architecture

### Controllers/routes map (high-value)
- Base/auth
  - `/api/th/v1/ping`
  - `/api/th/v1/auth/login`
  - `/api/th/v1/auth/me`
  - `/api/th/v1/auth/logout`
  - `/web/adt/th/v1/auth/me`
- Contacts/partners
  - `/api/th/v1/contacts/*`, `/api/th/v1/customers/*`, `/api/th/v1/partners/*`
  - session alias: `/web/adt/th/v1/contacts/*`
- Products
  - `/api/th/v1/products/list`
  - `/api/th/v1/products/<id>`
- Sales/quotation
  - `/api/th/v1/sales/orders/*`
- Invoices
  - `/api/th/v1/sales/invoices/*`
  - `/web/adt/th/v1/account/invoices*` (legacy/session path)
- Accounting/tax reports
  - `/api/th/v1/accounting/reports/*`
  - `/web/adt/th/v1/accounting/reports/*`
  - `/api/th/v1/tax-reports/*`, `/web/adt/th/v1/tax-reports/*`
- Agent endpoints
  - `/api/th/v1/agent/ocr`
  - `/api/th/v1/agent/expense/auto-post`
  - `/api/th/v1/agent/quotation/create`
  - `/api/th/v1/agent/contact/create`
  - `/api/th/v1/agent/invoice/create`
  - `/api/th/v1/agent/status`, `/web/adt/th/v1/agent/status`

### Auth and company context behavior
- API key auth (`X-ADT-API-Key`) via `adt.api.client` in `controllers/api_base.py`.
- Bearer token auth (`Authorization`) via `adt.auth.token` in `controllers/api_base.py`.
- Company scoping via `X-Instance-ID` -> `force_company` + `allowed_company_ids` in `_get_env()`.
- Scope checks via `_require_scope(client, scope_code)` and `adt.api.scope` relation on API client.

### Models/services used for core entities
- Contact: `res.partner` in `controllers/api_contacts.py`.
- Product: `product.product` in `controllers/api_products.py`.
- Quotation/SO: `sale.order` in `controllers/api_sales_orders.py`.
- Existing AI service helper: `services/ai_service.py` (OpenAI/vision/ocr helpers, server-side).

### Logging / audit today
- Generic API call log model: `adt.api.log` (`models/api_log.py`), populated by `_log_call(...)` in base controller.
- Fields include client, user, path, method, status, error, ip, instance, duration.
- No dedicated per-tool AI action audit model yet.

### Config storage pattern
- `adt_th_api` stores API client config in model data (`adt.api.client`) and scopes.
- `adt_ai_config` uses `res.config.settings` + `ir.config_parameter` (e.g., demo log monitor and MCP params).
- Current `adt_th_api/services/ai_service.py` also reads `.env` directly at import time (legacy pattern).

### Security approach (ACL/record rules)
- ACLs declared in `adt_th_api/security/ir.model.access.csv`.
- `adt.api.client` and scope management restricted to `group_adt_api_manager`.
- `adt.auth.token` readable only by `base.group_system`.
- `adt.agent.user` has record rule limiting regular users to own record (`adt_th_api_security.xml`).

## adt_ai_config current architecture

### Existing AI-related flow
- OCR and prompt-template flows (`adt.ocr.test`, `ai.prompt.template`) in `models/adt_ai_data.py` and `models/ai_prompt_template.py`.
- Legacy external code exists in `models/adt_ai_api.py` (includes non-Odoo FastAPI code block and direct .env reads).
- Workflow Demo Builder exists with:
  - models: `adt.ai.demo.master`, `adt.ai.demo.session`, `adt.ai.demo.log`, `adt.ai.demo.run`
  - controllers: `/ai_demo/session/<id>/start`, `/ai_demo/session/<id>/step/<index>/execute`, `/ai_demo/log`
  - web assets: `static/src/js/workflow_demo.js`, overlay runner UI.

### Security in adt_ai_config
- ACL file: `adt_ai_config/security/ir.model.access.csv`.
- Demo models mostly granted to `base.group_user`; logs read/create and runs read/write/create.

## Risks / gaps (for Avatar Assistant)
- Split AI logic across modules; no single standardized capability endpoint for React shell.
- Existing `.env` direct usage in python modules is not aligned with strict server-secret policy.
- No per-tool allowlist abstraction for conversational execution.
- No approval workflow contract for “plan then execute” in chat flow.
- Existing logging (`adt.api.log`) is request-level, not semantic AI action-level.
