# UI_ACTIONS_CONTRACT

## Purpose
Define backend-driven UI actions that React can safely execute.

## Action schema
```json
{
  "type": "OPEN_ROUTE | OPEN_RECORD | SHOW_TOAST | ASK_APPROVAL",
  "payload": {}
}
```

## 1) OPEN_ROUTE
Payload:
```json
{
  "route": "/accounting/reports/profit-loss",
  "replace": false
}
```
Rules:
- React must validate route is in backend capabilities report whitelist.
- If not allowed, ignore and show warning toast.

## 2) OPEN_RECORD
Payload:
```json
{
  "model": "sale.order",
  "id": 123,
  "route": "/sales/orders/123"
}
```
Rules:
- Prefer explicit `route` and validate safe prefix.
- If route missing, React can map known model->route pattern.

## 3) SHOW_TOAST
Payload:
```json
{
  "level": "info | success | warning | error",
  "message": "Quotation created successfully"
}
```
Rules:
- Message plain text only.

## 4) ASK_APPROVAL
Payload:
```json
{
  "session_id": "asst_20260214_xxx",
  "plan_ids": ["step_3"],
  "message": "Approve quotation creation?"
}
```
Rules:
- React presents plan summary + approval button.
- Approval button calls `/ai/execute` with approved plan ids.

## Client handling order
1. Render assistant reply/plan cards.
2. Execute non-destructive immediate actions (`SHOW_TOAST`).
3. Queue navigation actions (`OPEN_ROUTE`/`OPEN_RECORD`) after user interaction or step completion.
4. For `ASK_APPROVAL`, halt write execution until explicit approval.

## Rejection behavior
- If route/record action fails validation, React must:
  - not execute navigation
  - emit warning toast
  - keep chat usable
