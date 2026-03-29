# OpenClaw production service

`adt_openclaw` is an Odoo addon, so it runs inside the Odoo service that loads the module.

For production, run the local OpenClaw-compatible provider as a separate systemd service and point `adt_th_api` to it.

## Service files

- `adt-openclaw-provider.service`
- `adt-openclaw-healthcheck.service`
- `adt-openclaw-healthcheck.timer`

## Launcher scripts

- `scripts/adt_openclaw_provider_launcher`
- `scripts/adt_openclaw_healthcheck`

## Example environment file

Create `/etc/openclaw/openclaw.env`:

```bash
OPENCLAW_PROVIDER_CMD=ollama serve
OPENCLAW_BIND_ADDR=127.0.0.1:11434
OPENCLAW_MODEL=openclaw-local
OPENCLAW_API_KEY=
```

If you use another OpenAI-compatible runtime, replace `OPENCLAW_PROVIDER_CMD` with that command.

## Install

```bash
install -m 755 scripts/adt_openclaw_provider_launcher /usr/local/bin/adt_openclaw_provider_launcher
install -m 755 scripts/adt_openclaw_healthcheck /usr/local/bin/adt_openclaw_healthcheck
install -m 644 deploy/systemd/adt-openclaw-provider.service /etc/systemd/system/
install -m 644 deploy/systemd/adt-openclaw-healthcheck.service /etc/systemd/system/
install -m 644 deploy/systemd/adt-openclaw-healthcheck.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now adt-openclaw-provider.service
systemctl enable --now adt-openclaw-healthcheck.timer
```
