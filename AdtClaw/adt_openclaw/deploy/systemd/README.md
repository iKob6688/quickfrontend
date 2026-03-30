# OpenClaw production service

`adt_openclaw` is an Odoo addon, so it runs inside the Odoo service that loads the module.

For production, keep OpenClaw as the structured execution gateway in Odoo and run the local OpenClaw-compatible provider as a separate systemd service.

## Service files

- `adt-openclaw-provider.service`
- `adt-openclaw-healthcheck.service`
- `adt-openclaw-healthcheck.timer`

## Launcher scripts

- `scripts/adt_openclaw_provider_launcher`
- `scripts/adt_openclaw_healthcheck`
- `scripts/install_server_openclaw.sh`

## Example environment file

Create `/etc/openclaw/openclaw.env`:

```bash
OPENCLAW_PROVIDER_CMD=ollama serve
OPENCLAW_BIND_ADDR=127.0.0.1:11434
OPENCLAW_MODEL=openclaw-local
OPENCLAW_API_KEY=
```

If you use another OpenAI-compatible runtime, replace `OPENCLAW_PROVIDER_CMD` with that command.
If you are testing the assistant planner in `adt_th_api`, configure the OpenAI credentials in Odoo backend settings separately.

## Install

### Option A: automated server install

Run the installer as root on the production server:

```bash
sudo ./scripts/install_server_openclaw.sh
```

This will:

- create the `openclaw` service user and group if they do not exist
- install the launcher and healthcheck helpers into `/usr/local/bin`
- install the systemd unit files into `/etc/systemd/system`
- create `/etc/openclaw/openclaw.env` if missing
- enable and start the provider service
- enable the periodic healthcheck timer
- leave `adt_openclaw` itself loaded by the Odoo service

### Option B: manual install

```bash
install -m 755 scripts/adt_openclaw_provider_launcher /usr/local/bin/adt_openclaw_provider_launcher
install -m 755 scripts/adt_openclaw_healthcheck /usr/local/bin/adt_openclaw_healthcheck
install -m 755 scripts/adt_openclaw_adminctl /usr/local/bin/adt_openclaw_adminctl
install -m 644 deploy/systemd/adt-openclaw-provider.service /etc/systemd/system/
install -m 644 deploy/systemd/adt-openclaw-healthcheck.service /etc/systemd/system/
install -m 644 deploy/systemd/adt-openclaw-healthcheck.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now adt-openclaw-provider.service
systemctl enable --now adt-openclaw-healthcheck.timer
```

After installation, verify:

```bash
systemctl status adt-openclaw-provider.service
systemctl status adt-openclaw-healthcheck.timer
curl -s http://127.0.0.1:11434/v1/models
```

## Runtime model

- **OpenAI**: assistant planning / chat responses in `adt_th_api`
- **OpenClaw**: structured execution gateway in Odoo
- **Odoo**: business truth, ACLs, record rules, workflow enforcement, audit

The production assistant flow should never expose OpenClaw directly to the browser.
