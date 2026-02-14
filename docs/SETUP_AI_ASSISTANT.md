# SETUP_AI_ASSISTANT

## Backend module (Odoo)
- Main module: `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_th_api`
- New endpoints:
  - `POST /api/th/v1/ai/capabilities`
  - `POST /api/th/v1/ai/chat`
  - `POST /api/th/v1/ai/execute`

## Odoo settings
Go to Settings and configure:
- `Enable AI Assistant` = true
- `AI Assistant Mode`:
  - `approve_required` (recommended)
  - `auto_safe`
  - `plan_only`
- `AI Provider`:
  - `local` for deterministic MVP (no external key required)
  - `service` if using external AI service URL/secret
- Feature flags:
  - Read assistant
  - Create contact
  - Create product
  - Create quotation
  - Open report

## Security and auth
- React still sends:
  - `Authorization: Bearer <token>`
  - `X-ADT-API-Key`
  - `X-Instance-ID`
- Odoo enforces ACL/record rules by user env.
- Assistant uses allowlisted tools only.

## React integration
- Service file:
  - `/Users/ikob/Documents/iKobDoc/ERPTH/src/api/services/ai-assistant.service.ts`
- Avatar widget:
  - `/Users/ikob/Documents/iKobDoc/ERPTH/src/features/assistant/AvatarAssistant.tsx`
  - `/Users/ikob/Documents/iKobDoc/ERPTH/src/features/assistant/avatar-assistant.css`
- Mounted in:
  - `/Users/ikob/Documents/iKobDoc/ERPTH/src/components/layout/AppLayout.tsx`

## Demo script (MVP)
1. Open ERPTH and login.
2. Click avatar assistant.
3. Send:
   - `Create contact ABC Co with email a@b.com`
   - `Create product Solar Panel 30W price 990`
   - `Create quotation for ABC Co with 2 x Solar Panel 30W`
4. Click `Approve` when asked (for quotation in `approve_required` mode).
5. Ask:
   - `Open profit report`

## Troubleshooting
- Avatar not shown:
  - Check `/api/th/v1/ai/capabilities` response `show_bot`.
  - Check Odoo setting `Enable AI Assistant`.
- `Unauthorized`:
  - Verify bearer token and API key headers.
- `Tool disabled or not allowed`:
  - Enable corresponding feature flag in Odoo settings.
