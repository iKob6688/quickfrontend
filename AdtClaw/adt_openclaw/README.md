# adt_openclaw (Odoo 18 CE)

OpenClaw is the backend execution gateway for assistant-driven business actions.

It provides:

- structured execution of validated Odoo business commands
- LINE and Web message bridging
- Odoo scope commands with ACL / record-rule enforcement
- OS scope admin commands behind an explicit allowlist-only helper
- one-time auto-login links for report download
- dedicated technical agent identity support (`iadmin`)

## Install

1. Put module in addons path:
   - `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_openclaw`
2. Restart Odoo.
3. Update Apps list.
4. Install `ADT OpenClaw`.

## Configuration

Open `Settings -> OpenClaw` and set:
- Enable AI Agent
- AI Agent Login / Display Name / Password
- AI Agent Company Scope
- LINE channel secret / access token
- Public Base URL
- Admin login allowlist
- adminctl path (`/usr/local/bin/adt_openclaw_adminctl`)
- allowlists:
  - service names
  - repo keys (`key=/path`)
- log keys (`key=/path`)

## Production service layout

`adt_openclaw` is an Odoo addon, not a standalone daemon. In production, run:

- the Odoo service that loads `adt_openclaw` and `adt_th_api`
- a local OpenClaw-compatible provider service on `127.0.0.1:11434`

The addon includes service templates and launcher scripts under:

- `deploy/systemd/`
- `scripts/`

See `deploy/systemd/README.md` for install steps and the environment file layout.

For Linux production servers, the recommended fast path is:

```bash
sudo ./scripts/install_server_openclaw.sh
```

That installer sets up:

- the `openclaw` system user/group
- `/etc/openclaw/openclaw.env`
- the provider launcher and healthcheck binaries
- the systemd provider service
- the periodic healthcheck timer

Recommended AI agent login:

- `iadmin`

The password is not stored in module code. Enter it once in Odoo settings when creating the account.
Grant the account the business-module groups it needs, but keep system configuration and admin groups separate.
Use the `Enable AI Agent` switch to turn assistant execution on/off without deleting `iadmin`.

## Role boundary

- OpenAI handles chat/planning in the React assistant.
- OpenClaw executes validated structured commands only.
- Odoo owns the truth, validation, and audit trail.

## Endpoints

- `POST /adt_openclaw/line/webhook`
- `POST /adt_openclaw/web/inbound`
- `POST /adt_openclaw/session/bind`
- `POST /adt_openclaw/admin/verify`
- `GET /adt_openclaw/go/<token>`
- `GET /adt_openclaw/att/<attachment_id>?download=1`

## Safe helper (`Option 1`)

Install helper script:

1. Copy `scripts/adt_openclaw_adminctl` to `/usr/local/bin/adt_openclaw_adminctl`
2. `chmod 750 /usr/local/bin/adt_openclaw_adminctl`
3. Create `/etc/sudoers.d/adt_openclaw_adminctl`:

```text
odoo ALL=(root) NOPASSWD: /usr/local/bin/adt_openclaw_adminctl *
```

The script only supports:
- `restart-odoo <service>`
- `git-pull <repo_path>`
- `status`
- `tail-log <log_path> [lines]`

No shell passthrough is allowed.

## Test payloads

### Bind session

```json
{
  "channel": "web",
  "chat_user_id": "u1001",
  "odoo_base_url": "http://127.0.0.1:8069",
  "dbname": "odoo18",
  "login": "admin",
  "password_or_api_key": "admin"
}
```

For the dedicated assistant identity, use the `iadmin` Odoo login and the password you configured in OpenClaw settings.

### Web inbound

```json
{
  "chat_user_id": "u1001",
  "text": "report.generate",
  "meta": {}
}
```

### Admin verify

```json
{
  "channel": "web",
  "chat_user_id": "u1001",
  "otp_or_password": "123456"
}
```

## Local test checklist

- Install module
- Bind session via `/session/bind`
- Run `record.create`, `record.search`, and `report.generate`
- Open `/go/<token>` and confirm direct download without login page
- Verify admin session and run `os.status`, `os.logs`
- Confirm audit rows
- Confirm admin TTL/expiry denial
- Confirm token single-use and expiry behavior
