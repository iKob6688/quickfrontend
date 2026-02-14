# CURRENT_STATE_REVIEW

## What already exists and can be reused

### Reuse in React
- API foundation is already centralized in `src/api/client.ts` and `src/api/response.ts`.
- Existing domain services for contacts/products/quotations already align to MVP entities.
- Existing routing/navigation can handle report deep links with `useNavigate`.
- Existing agent UI components prove pattern for AI-related pages and cards.

### Reuse in Odoo
- `adt_th_api` already has:
  - API key + bearer auth stack (`controllers/api_base.py`)
  - company context scoping (`X-Instance-ID`)
  - scope model (`adt.api.scope`) and client allow policy (`adt.api.client`)
  - generic request logging (`adt.api.log`)
  - domain controllers for contact/product/quotation/report primitives.
- `adt_ai_config` already has:
  - AI settings in `res.config.settings`
  - workflow/demo concepts and logging model patterns for AI orchestration.

## What must be added for Avatar AI Assistant
1. New capability contract endpoint for React shell gating (`/ai/capabilities`).
2. Chat orchestration endpoint with allowlisted tools only (`/ai/chat`).
3. Optional approval execution endpoint (`/ai/execute`) for write actions requiring confirmation.
4. Semantic AI action log model (tool-level), separate from request log.
5. React avatar widget and chat panel that:
   - only appears when backend says `show_bot=true`
   - executes backend-driven `ui_actions` contract safely.

## Minimal-impact integration strategy

### Principle
- Keep core ERP endpoints untouched.
- Add a thin assistant layer reusing existing service/controller conventions.
- Avoid large refactor; integrate via new files + minimal targeted imports.

### Odoo extension points (planned)
- Prefer extend `adt_ai_config` for assistant orchestration/config/models.
- Reuse auth helpers from `adt_th_api` through a small shared import or duplicated thin guard compatible with existing style.

Planned files to add/extend:
- Add: `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config/models/ai_assistant.py`
- Add: `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config/controllers/ai_assistant.py`
- Extend: `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config/models/res_config_settings.py` (assistant flags/settings only)
- Extend: `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config/models/__init__.py`
- Extend: `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config/controllers/__init__.py`
- Extend: `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config/security/ir.model.access.csv`
- Add: `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config/views/ai_assistant_views.xml` (optional log viewer/settings)
- Extend: `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_ai_config/__manifest__.py`

### React extension points (planned)
- Add: `src/api/services/ai-assistant.service.ts`
- Add: `src/features/assistant/AvatarAssistant.tsx`
- Add: `src/features/assistant/types.ts`
- Extend minimally:
  - `src/App.tsx` (mount avatar widget once in protected layout)
  - `src/components/layout/AppLayout.tsx` (optional container slot only)
  - `src/api/client.ts` (no secret changes; keep existing headers)

## Key risks to control in implementation
- Never return server keys to React (capabilities only return booleans/flags).
- Ensure tool execution is allowlisted; no arbitrary model/method execution.
- Enforce ACL and company context in every tool operation.
- Ensure OPEN_ROUTE action only navigates to backend-whitelisted routes.
- Keep audit logs for each tool call including failure context.
