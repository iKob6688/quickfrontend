# API_SPEC (Avatar AI Assistant MVP)

## Base rules
- Auth required: user session or bearer+api-key according to deployment policy.
- Company context: resolved from user/company and optional `X-Instance-ID`.
- All endpoints return unified envelope:
  - success=true: `{ "success": true, "data": ... , "error": null }`
  - success=false: `{ "success": false, "data": null, "error": { "code": "...", "message": "...", "details": ... } }`

## 1) GET/POST /ai/capabilities
Purpose:
- Let React decide whether to show avatar and what tools/features are available.

Response `data` schema:
```json
{
  "enabled": true,
  "show_bot": true,
  "mode": "approve_required",
  "features": {
    "ai.read_assistant": true,
    "ai.create_contact": true,
    "ai.create_product": true,
    "ai.create_quotation": true,
    "ai.open_report": true
  },
  "tools": [
    {"name": "create_contact", "allowed": true, "requires_approval": false},
    {"name": "create_product", "allowed": true, "requires_approval": false},
    {"name": "create_quotation", "allowed": true, "requires_approval": true},
    {"name": "open_report", "allowed": true, "requires_approval": false},
    {"name": "search_products", "allowed": true, "requires_approval": false}
  ],
  "reports": [
    {"key": "contacts", "title": "Contacts", "route": "/customers"},
    {"key": "products", "title": "Products", "route": "/sales/orders/new"},
    {"key": "quotations", "title": "Quotations", "route": "/sales/orders"}
  ],
  "session": {
    "company_id": 1,
    "lang": "en_US",
    "user_id": 2
  }
}
```

Rules:
- `show_bot = enabled && keys_ready && user_has_feature(ai.bot_ui)`.
- No secrets in response.

## 2) POST /ai/chat
Purpose:
- Accept user message, return assistant reply + plan + safe UI actions.

Request:
```json
{
  "message": "Create contact ABC Co then create product Solar Panel 30W and quotation 2 qty",
  "context": {
    "company_id": 1,
    "lang": "en_US",
    "ui": {
      "route": "/dashboard"
    }
  }
}
```

Response `data`:
```json
{
  "session_id": "asst_20260214_xxx",
  "reply": "I prepared a plan to create contact, product, and quotation.",
  "plan": [
    {
      "id": "step_1",
      "tool": "create_contact",
      "requires_approval": false,
      "args": {"name": "ABC Co", "email": "a@b.com"}
    },
    {
      "id": "step_2",
      "tool": "create_product",
      "requires_approval": false,
      "args": {"name": "Solar Panel 30W", "price": 990}
    },
    {
      "id": "step_3",
      "tool": "create_quotation",
      "requires_approval": true,
      "args": {"customer_name": "ABC Co", "product_name": "Solar Panel 30W", "qty": 2}
    }
  ],
  "ui_actions": [
    {"type": "SHOW_TOAST", "payload": {"level": "info", "message": "Plan ready"}},
    {"type": "ASK_APPROVAL", "payload": {"plan_ids": ["step_3"]}}
  ],
  "records": []
}
```

## 3) POST /ai/execute
Purpose:
- Execute approved/all-safe plan actions by allowlisted tools.

Request:
```json
{
  "session_id": "asst_20260214_xxx",
  "approved_plan_ids": ["step_3"],
  "nonce": "optional-integrity-token"
}
```

Response `data`:
```json
{
  "session_id": "asst_20260214_xxx",
  "results": [
    {
      "plan_id": "step_3",
      "tool": "create_quotation",
      "status": "success",
      "record": {"model": "sale.order", "id": 123, "name": "SO00123"}
    }
  ],
  "ui_actions": [
    {"type": "OPEN_RECORD", "payload": {"model": "sale.order", "id": 123, "route": "/sales/orders/123"}},
    {"type": "SHOW_TOAST", "payload": {"level": "success", "message": "Quotation created"}}
  ],
  "records": [
    {"model": "sale.order", "id": 123, "name": "SO00123"}
  ]
}
```

## Tool allowlist (MVP)
Read tools:
- `search_contacts`, `get_contact`
- `search_products`, `get_product`
- `search_quotations`, `get_quotation`
- `list_reports`
- `get_help`

Write tools:
- `create_contact` (auto safe)
- `create_product` (auto safe)
- `create_quotation` (requires approval by default)

## Errors
- `forbidden` (ACL/scope not allowed)
- `validation_error`
- `tool_not_allowed`
- `approval_required`
- `not_found`
- `internal_error`
