# Purchase Orders API Troubleshooting Guide

This document provides steps to diagnose and resolve issues with the Purchase Orders API (`/api/th/v1/purchases/orders/*`).

## Common Symptoms

- "ไม่สามารถโหลดใบสั่งซื้อได้" (Failed to load purchase orders) on the Purchase Orders list page.
- Empty list of purchase orders, even if data exists in Odoo.
- HTTP errors (404 Not Found, 401 Unauthorized, 500 Internal Server Error) in browser console or network tab.
- Dashboard Purchase Orders card shows 0 orders or no data.

## Frontend Checks (Browser DevTools)

1. **Open Developer Tools (F12)**: Go to the "Console" and "Network" tabs.
2. **Navigate to "ใบสั่งซื้อ" (Purchase Orders) page.**
3. **Check Console for Errors**: Look for messages starting with `[listPurchaseOrders]`, `[getPurchaseOrder]`, or API errors.
4. **Check Network Tab**:
   - Filter requests by "purchases" or "orders".
   - Look for failed requests (red status, non-200 codes).
   - Examine the `Status`, `Response`, and `Headers` for clues.

## Backend Checks (Server-side)

The frontend expects the following API endpoints to be available:
- `POST /api/th/v1/purchases/orders/list`
- `POST /api/th/v1/purchases/orders/:id`
- `POST /api/th/v1/purchases/orders` (create)
- `PUT /api/th/v1/purchases/orders/:id` (update)
- `POST /api/th/v1/purchases/orders/:id/confirm`
- `POST /api/th/v1/purchases/orders/:id/cancel`

**⚠️ IMPORTANT: These routes are NOT yet implemented in the backend Odoo module (`adt_th_api`).**

The frontend code is ready, but the backend team needs to implement these endpoints.

### 1. Verify Controller File Existence

Check if a purchase orders controller exists:

```bash
find /opt/odoo18/odoo/adtv18 -name "*purchase*.py" | grep -i controller
# Expected: /opt/odoo18/odoo/adtv18/adt_th_api/controllers/purchases.py (or similar)
```

**If the file doesn't exist**: The backend needs to create `adt_th_api/controllers/purchases.py` with the required routes.

### 2. Verify Routes are Registered in Odoo

New or changed HTTP routes in Odoo controllers require the Odoo service to be restarted to be registered. You can check if routes are registered using the Odoo shell:

```bash
# Access Odoo shell (replace odoo18 and q01 with your user/db if different)
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  shell -c /etc/odoo18-api.conf -d q01

# In the Odoo shell, force routing rules generation and inspect:
from odoo.http import root
root.get_wsgi_application() # Ensure application is loaded
for rule in root.nodb_routing_map.iter_rules():
    if '/api/th/v1/purchases/orders' in str(rule.rule):
        print(rule)
```

**If no routes are found**: The controller needs to be created and the service restarted.

### 3. Ensure Odoo Service is Restarted

After any changes to Python controller files, you **must** restart the Odoo API service. An Odoo module upgrade (`-u`) alone does not reload HTTP routing.

```bash
sudo systemctl restart odoo18-api
sudo systemctl status odoo18-api --no-pager
# Verify that the PID of the odoo18-api service has changed after restart.
ps -ef | grep -E "/etc/odoo18-api\\.conf" | grep -v grep
```

### 4. Check API Key and Bearer Token

Ensure your frontend's `VITE_API_KEY` and the user's Bearer token are correctly configured and sent with requests.

```bash
# Example curl command to test (replace YOUR_KEY and YOUR_TOKEN)
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/orders/list?db=q01" \
  -H "X-ADT-API-Key: YOUR_KEY" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10},"id":1}'
```

### 5. Check Odoo API Client Scopes

The API client used for authentication must have the `purchases` scope enabled in Odoo.

- Go to Odoo UI: **ADT API → API Clients**
- Edit the API client
- Ensure `purchases` scope is checked/enabled

### 6. Check Odoo Logs for Internal Server Errors (500)

If you get a 500 error, check the Odoo logs for detailed Python tracebacks:

```bash
sudo journalctl -u odoo18-api -n 100 --no-pager
# Look for Python tracebacks related to purchase.order model or permissions.
```

### 7. Verify `purchase.order` Model and Permissions

Ensure the `purchase.order` model exists and the API user has sufficient read/write permissions on it.

```bash
# In Odoo shell:
env['purchase.order'].search_count([]) # Should return a number, not an error
env['purchase.order'].check_access_rights('read') # Should return True
env['purchase.order'].check_access_rights('write') # Should return True
```

### 8. Backend Implementation Requirements

The backend team needs to create a controller file `adt_th_api/controllers/purchases.py` with the following structure:

```python
from odoo import http
from odoo.http import request
from odoo.addons.adt_th_api.controllers.base import AdtThApiController

class PurchaseOrdersController(AdtThApiController):
    
    @http.route('/api/th/v1/purchases/orders/list', type='json', auth='bearer', methods=['POST'], csrf=False)
    def list_orders(self, **kwargs):
        # Implement list logic
        pass
    
    @http.route('/api/th/v1/purchases/orders/<int:id>', type='json', auth='bearer', methods=['POST'], csrf=False)
    def get_order(self, id, **kwargs):
        # Implement get logic
        pass
    
    @http.route('/api/th/v1/purchases/orders', type='json', auth='bearer', methods=['POST'], csrf=False)
    def create_order(self, **kwargs):
        # Implement create logic
        pass
    
    @http.route('/api/th/v1/purchases/orders/<int:id>', type='json', auth='bearer', methods=['PUT'], csrf=False)
    def update_order(self, id, **kwargs):
        # Implement update logic
        pass
    
    @http.route('/api/th/v1/purchases/orders/<int:id>/confirm', type='json', auth='bearer', methods=['POST'], csrf=False)
    def confirm_order(self, id, **kwargs):
        # Implement confirm logic
        pass
    
    @http.route('/api/th/v1/purchases/orders/<int:id>/cancel', type='json', auth='bearer', methods=['POST'], csrf=False)
    def cancel_order(self, id, **kwargs):
        # Implement cancel logic
        pass
```

See `docs/api-purchases-expenses-taxes.md` for complete API specification including request/response formats.

### 9. Module Upgrade and Service Restart

After creating or modifying the controller:

```bash
# 1. Upgrade the module
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  -c /etc/odoo18-api.conf -d q01 -u adt_th_api --stop-after-init

# 2. Restart the service (CRITICAL - routes won't load without restart)
sudo systemctl restart odoo18-api

# 3. Verify service is running
sudo systemctl status odoo18-api --no-pager
```

## Expected Error Messages

### 404 Not Found:
- **Meaning**: Route doesn't exist in backend (most likely - endpoints not yet implemented)
- **Fix**: Create controller + routes, upgrade module, **restart service**

### 401 Unauthorized:
- **Meaning**: Missing API key, Bearer token, or scope not enabled
- **Fix**: Check `VITE_API_KEY` env, auth token, and `purchases` scope in API client

### 405 Method Not Allowed:
- **Meaning**: Wrong HTTP method (using GET instead of POST/PUT)
- **Fix**: Use POST for JSON-RPC endpoints (except PUT for update)

### 500 Internal Server Error:
- **Meaning**: Backend error (model not found, permission issue, etc.)
- **Fix**: Check Odoo logs, verify `purchase.order` model exists, check permissions

## Testing the API

Once the backend implements the endpoints, test with:

```bash
# Test list endpoint
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/orders/list?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10},"id":1}'

# Test get endpoint (replace <id> with actual purchase order ID)
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/orders/<id>?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{},"id":1}'
```

## Related Documentation

- **API Specification**: `docs/api-purchases-expenses-taxes.md`
- **Verification Checklist**: `docs/purchase-orders-partners-verification.md`
- **Missing Endpoints Summary**: `docs/api-endpoints-missing-check.md`

