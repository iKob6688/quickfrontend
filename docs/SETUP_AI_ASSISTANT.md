# SETUP_AI_ASSISTANT

## Architecture

- **OpenAI** handles the conversational assistant and structured planning.
- **OpenClaw** handles structured execution only.
- **Odoo** remains the source of truth and policy authority.
- **React** is the only chat surface.

## Main backend module

- `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_th_api`

## Assistant endpoints

- `POST /api/th/v1/ai/capabilities`
- `POST /api/th/v1/ai/runtime`
- `POST /api/th/v1/ai/chat`
- `POST /api/th/v1/ai/execute`
- `POST /api/th/v1/ai/confirm`
- `POST /api/th/v1/ai/tasks`

## Dedicated execution identity

- Recommended technical login: `iadmin`
- Display name: `OpenClaw`
- Keep the account limited to business-module groups needed for assistant execution
- Keep system configuration / admin groups separate

OpenClaw execution identity is controlled from Odoo settings and the `adt_openclaw` addon.

## OpenAI configuration in Odoo

Configure these from Odoo backend settings:

- `Enable AI Assistant`
- `Enable OpenAI Planner`
- `OpenAI Model`
- `OpenAI Base URL`
- `OpenAI API Key`
- `OpenAI Temperature`
- `OpenAI Max Tokens`
- `Prompt Version`
- `Allowed Intents`
- `Confirmation Policy`
- `Audit Logging`

Recommended values for the current `q01` smoke-tested setup:

- OpenAI model: `gpt-4o`
- Confirmation policy: `strict`
- Temperature: low, e.g. `0.0` to `0.2`

## OpenClaw configuration in Odoo

Configure these from Odoo backend settings:

- `Enable AI Agent`
- `AI Agent Login` = `iadmin`
- `AI Agent Display Name` = `OpenClaw`
- Allowed business models / scopes
- Company scope

OpenClaw should be reachable on localhost/private network only. It is used as a backend executor, not as a public chat service.

## Security and auth

- React sends bearer/session headers and safe UI context only.
- React does not store backend secrets.
- OpenAI does not access the database directly.
- OpenClaw does not receive free-form conversational control for assistant flows.
- Odoo enforces ACLs, record rules, company scope, and confirmation policy.

## React integration

- Service: `/Users/ikob/Documents/iKobDoc/ERPTH/src/api/services/ai-assistant.service.ts`
- Assistant UI: `/Users/ikob/Documents/iKobDoc/ERPTH/src/features/assistant/AvatarAssistant.tsx`
- Context capture: `/Users/ikob/Documents/iKobDoc/ERPTH/src/lib/assistantPageContext.ts`

The assistant should receive:

- current route
- page kind
- search query
- active model
- active record
- selected rows
- lightweight record summary

## Local smoke test status

The `q01` database has been smoke-tested end-to-end with:

- OpenAI planner enabled
- OpenClaw executor enabled
- quotation creation through a complex command
- audit logging working

Example command used in smoke testing:

- `หาลูกค้า ACTIVE แล้วสร้างใบเสนอราคาให้เขาโดยใช้สินค้า ค่าปิดงบ จำนวน 1 ชิ้น`

## Production deployment notes

- Upgrade `adt_th_api` after backend code changes.
- Restart the running Odoo process after controller/model changes.
- Keep OpenClaw provider/service bound to localhost or an internal network.
- Use the systemd installer in `AdtClaw/adt_openclaw/scripts/install_server_openclaw.sh` for Linux deployment.

## Troubleshooting

- Assistant says planner is not ready:
  - Check OpenAI enabled flag
  - Check API key
  - Check model name
  - Check base URL
- Assistant says executor is disabled:
  - Enable `AI Agent`
  - Confirm `iadmin` exists and is configured
- Assistant shows stale UI state:
  - Hard refresh the browser
  - Reopen the assistant panel
- Execution works but summary is stale:
  - Restart the Odoo process after updates

