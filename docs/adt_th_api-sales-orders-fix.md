# adt_th_api Sales Orders Integration Fix

Date: 2026-02-10

## Problem
Frontend page `/sales/orders` calls:
- `POST /api/th/v1/sales/orders/list`
- `POST /api/th/v1/sales/orders/<id>`
- `POST /api/th/v1/sales/orders`
- `PUT /api/th/v1/sales/orders/<id>`
- `POST /api/th/v1/sales/orders/<id>/confirm`

Current backend returns `404` for `/api/th/v1/sales/orders/*`.

## Current frontend behavior (safe fallback)
Frontend now auto-falls back to invoice endpoints if `/sales/orders/*` is missing:
- `/api/th/v1/sales/invoices/*`

This removes the immediate 404 blocker in production while backend is being patched.

## Required backend patch in adt_th_api (permanent fix)
Create controller: `adt_th_api/controllers/api_sales_orders.py`

Implement routes:
- `POST /api/th/v1/sales/orders/list`
- `POST /api/th/v1/sales/orders/<int:order_id>`
- `POST /api/th/v1/sales/orders`
- `PUT /api/th/v1/sales/orders/<int:order_id>`
- `POST /api/th/v1/sales/orders/<int:order_id>/confirm`
- Optional: `POST /api/th/v1/sales/orders/<int:order_id>/cancel`

Business mapping to Odoo model `sale.order`:
- draft quotation: `state = draft`
- sent quotation: `state = sent`
- confirmed sale order: `state = sale`
- done: `state = done`
- canceled: `state = cancel`

## Required payload/response shape
Keep same envelope as other API routes:
- Request: JSON-RPC params
- Response: `{ success: boolean, data: ..., error: ... }`

Minimum data fields for frontend:
- list item:
  - `id`, `name|documentNumber`, `partner|customer`, `date_order|orderDate`, `validity_date|validityDate`, `state|status`, `amount_total`, `currency`
- detail:
  - above fields + `lines[]`, `amount_untaxed`, `amount_tax`, `notes`

Line item fields:
- `product_id|productId`, `description|name`, `quantity`, `price_unit|unitPrice`, `discount`, `tax_ids|taxIds`, `price_subtotal|subtotal`, `price_tax|totalTax`, `price_total|total`

## Security/scopes
Add/confirm scope for sales orders in API client policy.
Suggested:
- reuse `invoice` scope for compatibility with existing frontend nav policy
- or add new scope `sale_order` and update frontend nav+guards accordingly

## Deploy checklist (Odoo server)
1. Add controller file and import it in `adt_th_api/controllers/__init__.py`
2. Upgrade module:
```bash
sudo -u odoo18 /opt/odoo18/venv/bin/python /opt/odoo18/odoo/odoo-bin \
  -c /etc/odoo18-api.conf -d <db_name> -u adt_th_api --stop-after-init
```
3. Restart service:
```bash
sudo systemctl restart odoo18-api
```
4. Verify routes:
```bash
curl -s -X POST "https://<host>/api/th/v1/sales/orders/list" \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: <api_key>" \
  -H "Authorization: Bearer <token>" \
  -H "X-Instance-ID: <instance_id>" \
  -d '{"jsonrpc":"2.0","method":"call","params":{"limit":10,"offset":0}}'
```

## Related note: product connection
Sales/Purchase forms now use `/api/th/v1/products/list` and `/api/th/v1/products/<id>`.
If product dropdown fails, add `products` scope to the API client.
