# SECURITY_MODEL (Avatar AI Assistant)

## Security goals
- No OpenAI/MCP/API secret exposed to frontend.
- Odoo ORM + ACL + record rules stay authoritative.
- Only allowlisted tools can execute actions.
- Every AI action is audit logged.

## Identity and context
- User identity: authenticated Odoo user (session or bearer token validated server-side).
- Company context: derived from active company and optional validated `X-Instance-ID`.
- All model operations run in user-scoped env (not blanket sudo).

## Capability gate
- Endpoint `/ai/capabilities` computes:
  - global enable (`ai.enabled`)
  - key readiness (server-side settings only)
  - per-user feature flags/groups
- React renders avatar only when `show_bot=true`.

## Tool allowlist enforcement
- Server maintains static map `{tool_name: callable}`.
- Unknown tool => reject `tool_not_allowed`.
- No dynamic model/method eval.
- No arbitrary `env[model].sudo().<method>` execution paths.

## Approval model
- Mode values:
  - `approve_required`: write plans needing approval are returned but not executed until `/ai/execute`.
  - `auto_safe`: only non-destructive tools auto execute.
  - `plan_only`: no execution, guidance only.
- Default MVP policy:
  - `create_contact`: auto
  - `create_product`: auto
  - `create_quotation`: approval required

## Audit logging
- Dedicated semantic log model: `ai.agent.action.log`.
- Minimum fields:
  - user_id, company_id, session_id
  - tool_name, payload_summary
  - result_status (success/error/denied)
  - record_refs
  - error
  - timestamp
- Log both planning and execution stages.

## Data handling
- Never return server secrets in any response.
- Payload summary should mask sensitive fields where applicable.
- Keep logs concise but actionable for production troubleshooting.

## Route and UI action safety
- `OPEN_ROUTE` allowed only when route in capabilities `reports` whitelist (or approved route allowlist).
- `OPEN_RECORD` must map to valid known UI route patterns; never execute raw JS from backend.
- Toast/message actions are plain text only.

## Failure behavior
- Any ACL/record-rule error is surfaced as safe structured error.
- Partial plan execution supported; each step reports explicit status.
- Tool failures never trigger fallback arbitrary actions.
