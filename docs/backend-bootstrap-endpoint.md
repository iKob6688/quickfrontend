# Backend: Frontend Bootstrap Endpoint Implementation Guide

## Overview

Frontend bootstrap endpoint สำหรับให้ React app setup `.env` อัตโนมัติผ่าน registration token.

## Endpoint Specification

### Route
```
POST /api/th/v1/frontend/bootstrap
```

### Request

**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "registration_token": "<string>"
}
```

### Response (Success)

**Status:** `200 OK`

**Body (JSON-RPC format):**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "api_base_url": "/api",
      "db": "qacc",
      "api_key": "0iDbxCtbwpIOJRMQNMTnXcqNF_4WyhuQxHqlZQHBfp1lq4vjLFDrbQ",
      "allowed_scopes": ["auth", "invoice", "excel"],
      "company_id": 1,
      "company_name": "My Company (San Francisco)"
    },
    "error": null
  }
}
```

**Required Fields:**
- `db` (string, **required**): Odoo database name (e.g., "qacc")
- `api_key` (string, **required**): API key for X-ADT-API-Key header
- `api_base_url` (string, optional): Base URL for API calls (default: "/api")
- `allowed_scopes` (array or string, optional): Comma-separated scopes (e.g., ["auth", "invoice", "excel"])
- `company_id` (number, optional): Company ID
- `company_name` (string, optional): Company name

### Response (Error)

**Status:** `200 OK` (JSON-RPC always returns 200, error in result)

**Body:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": false,
    "data": null,
    "error": {
      "message": "Invalid or expired registration token"
    }
  }
}
```

## Implementation Example

### Option 1: Add to existing controller (e.g., `api_auth.py`)

```python
from odoo import http
from odoo.http import request
from .api_base import AdtApiBaseController

class AdtAuthApiController(AdtApiBaseController):
    # ... existing methods ...

    @http.route(
        "/api/th/v1/frontend/bootstrap",
        type="json",
        auth="public",
        methods=["POST"],
        csrf=False,
    )
    def api_frontend_bootstrap(self, **payload):
        """Bootstrap endpoint for React frontend setup.
        
        Validates registration token and returns frontend configuration.
        """
        registration_token = payload.get("registration_token", "").strip()
        
        if not registration_token:
            return self._json_response(
                error="registration_token is required", status=400
            )
        
        # TODO: Implement token validation logic
        # Example:
        # token_model = request.env["adt.registration.token"].sudo()
        # token_rec = token_model.search([
        #     ("token", "=", registration_token),
        #     ("active", "=", True),
        #     ("expires_at", ">", fields.Datetime.now()),
        # ], limit=1)
        # 
        # if not token_rec:
        #     return self._json_response(
        #         error="Invalid or expired registration token", status=401
        #     )
        # 
        # api_key = token_rec.api_key_id
        # company = token_rec.company_id
        
        # For now, return mock data (replace with actual logic)
        # This assumes you have a way to:
        # 1. Validate the registration token
        # 2. Get the associated API key
        # 3. Get the associated company
        # 4. Get allowed scopes from API key configuration
        
        # IMPORTANT: db is REQUIRED - must be provided
        # Options:
        # 1. From token/registration record: token_rec.db or token_rec.company_id.company_id
        # 2. From request.db (if available)
        # 3. From API key configuration
        # 4. As a fallback, use a default (but this should be avoided)
        
        db_name = (
            token_rec.db or  # If token has db field
            (token_rec.company_id and token_rec.company_id._get_database_name()) or  # From company
            request.db or  # From request
            "qacc"  # Fallback (should be avoided)
        )
        
        data = {
            "api_base_url": "/api",
            "db": db_name,  # REQUIRED - must not be empty
            "api_key": token_rec.api_key_id.key,  # From validated token
            "allowed_scopes": token_rec.api_key_id.get_scopes_list(),  # From API key scopes
            "company_id": token_rec.company_id.id,  # From token.company_id
            "company_name": token_rec.company_id.name,  # From company.name
        }
        
        return self._json_response(data=data)
```

### Option 2: Create new controller (e.g., `api_frontend.py`)

```python
from odoo import http
from odoo.http import request
from .api_base import AdtApiBaseController

class AdtFrontendApiController(AdtApiBaseController):
    """Frontend-specific endpoints for React app setup."""

    @http.route(
        "/api/th/v1/frontend/bootstrap",
        type="json",
        auth="public",
        methods=["POST"],
        csrf=False,
    )
    def api_frontend_bootstrap(self, **payload):
        """Bootstrap endpoint for React frontend setup."""
        registration_token = payload.get("registration_token", "").strip()
        
        if not registration_token:
            return self._json_response(
                error="registration_token is required", status=400
            )
        
        # TODO: Implement token validation
        # See Option 1 for example logic
        
        data = {
            "api_base_url": "/api",
            "db": request.db or "qacc",
            "api_key": "...",  # From validated token
            "allowed_scopes": ["auth", "invoice", "excel"],
            "company_id": 1,
            "company_name": "...",
        }
        
        return self._json_response(data=data)
```

Then register in `__init__.py`:
```python
from . import api_frontend

# In __init__.py or wherever controllers are registered
```

## Data Model Requirements

You'll need a model to store registration tokens. Example:

```python
# models/adt_registration_token.py
from odoo import models, fields, api
from datetime import datetime, timedelta

class AdtRegistrationToken(models.Model):
    _name = "adt.registration.token"
    _description = "Registration Token for Frontend Bootstrap"
    
    name = fields.Char("Name", required=True)
    token = fields.Char("Token", required=True, index=True)
    api_key_id = fields.Many2one("adt.api.key", "API Key", required=True)
    company_id = fields.Many2one("res.company", "Company", required=True)
    active = fields.Boolean("Active", default=True)
    expires_at = fields.Datetime("Expires At")
    created_at = fields.Datetime("Created At", default=fields.Datetime.now)
    
    @api.model
    def create_token(self, api_key, company, expires_days=30):
        """Create a new registration token."""
        token_value = self._generate_token()
        expires_at = fields.Datetime.now() + timedelta(days=expires_days)
        
        return self.create({
            "name": f"Token for {company.name}",
            "token": token_value,
            "api_key_id": api_key.id,
            "company_id": company.id,
            "expires_at": expires_at,
        })
    
    def _generate_token(self):
        """Generate a secure random token."""
        import secrets
        return secrets.token_urlsafe(32)
```

## API Key Model (if not exists)

```python
# models/adt_api_key.py
from odoo import models, fields

class AdtApiKey(models.Model):
    _name = "adt.api.key"
    _description = "API Key for Frontend Authentication"
    
    name = fields.Char("Name", required=True)
    key = fields.Char("API Key", required=True, index=True)
    scopes = fields.Char("Allowed Scopes", help="Comma-separated list: auth,invoice,excel")
    active = fields.Boolean("Active", default=True)
    company_id = fields.Many2one("res.company", "Company")
    
    def get_scopes_list(self):
        """Return scopes as a list."""
        if not self.scopes:
            return []
        return [s.strip() for s in self.scopes.split(",")]
```

## Testing

After implementation, test with:

```bash
curl -X POST "http://localhost:8069/api/th/v1/frontend/bootstrap" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "registration_token": "YOUR_TOKEN_HERE"
    }
  }'
```

Or use the frontend bootstrap script:
```bash
npm run bootstrap
```

## Security Considerations

1. **Token Expiration**: Registration tokens should expire (e.g., 30 days)
2. **One-time Use**: Consider making tokens single-use (mark as used after bootstrap)
3. **Rate Limiting**: Add rate limiting to prevent brute force
4. **Logging**: Log all bootstrap attempts for audit
5. **HTTPS**: In production, enforce HTTPS for bootstrap endpoint

## Integration with Existing Code

- Use `AdtApiBaseController._json_response()` for consistent response format
- Follow existing patterns in `api_auth.py` for JSON-RPC handling
- Ensure `request.db` is set correctly if multi-db support is needed

