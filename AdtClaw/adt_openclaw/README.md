# adt_openclaw (Odoo 18 CE)

Secure messenger bridge for LINE and Web chat with:
- Odoo scope commands (ORM with ACL/record rules)
- OS scope admin commands (allowlist-only via helper)
- One-time auto-login links for report download

## Install

1. Put module in addons path:
   - `/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_openclaw`
2. Restart Odoo.
3. Update Apps list.
4. Install `ADT OpenClaw`.

## Configuration

Open `Settings -> OpenClaw` and set:
- LINE channel secret / access token
- Public Base URL
- Admin login allowlist
- adminctl path (`/usr/local/bin/adt_openclaw_adminctl`)
- allowlists:
  - service names
  - repo keys (`key=/path`)
  - log keys (`key=/path`)

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
- Run `record.create` and `report.generate`
- Open `/go/<token>` and confirm direct download without login page
- Verify admin session and run `os.status`, `os.logs`
- Confirm audit rows
- Confirm admin TTL/expiry denial
- Confirm token single-use and expiry behavior

