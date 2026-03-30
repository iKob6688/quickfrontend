#!/usr/bin/env bash
set -euo pipefail

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Please run this installer as root (or via sudo)."
  fi
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
module_root="$(cd "${script_dir}/.." && pwd)"
systemd_dir="${SYSTEMD_DIR:-/etc/systemd/system}"
bin_dir="${BIN_DIR:-/usr/local/bin}"
env_dir="${ENV_DIR:-/etc/openclaw}"
env_file="${ENV_FILE:-${env_dir}/openclaw.env}"
service_user="${OPENCLAW_SERVICE_USER:-openclaw}"
service_group="${OPENCLAW_SERVICE_GROUP:-openclaw}"
service_home="${OPENCLAW_SERVICE_HOME:-/var/lib/openclaw}"

require_root

command -v systemctl >/dev/null 2>&1 || die "systemctl is required for the production installer."

mkdir -p "$env_dir"
mkdir -p "$service_home"

if ! getent group "$service_group" >/dev/null 2>&1; then
  groupadd --system "$service_group"
fi

if ! id -u "$service_user" >/dev/null 2>&1; then
  useradd --system \
    --gid "$service_group" \
    --home-dir "$service_home" \
    --create-home \
    --shell /usr/sbin/nologin \
    "$service_user"
fi

chown -R "$service_user:$service_group" "$service_home"
chmod 750 "$service_home"

install -m 755 "$module_root/scripts/adt_openclaw_provider_launcher" "$bin_dir/adt_openclaw_provider_launcher"
install -m 755 "$module_root/scripts/adt_openclaw_healthcheck" "$bin_dir/adt_openclaw_healthcheck"
install -m 755 "$module_root/scripts/adt_openclaw_adminctl" "$bin_dir/adt_openclaw_adminctl"

install -m 644 "$module_root/deploy/systemd/adt-openclaw-provider.service" "$systemd_dir/adt-openclaw-provider.service"
install -m 644 "$module_root/deploy/systemd/adt-openclaw-healthcheck.service" "$systemd_dir/adt-openclaw-healthcheck.service"
install -m 644 "$module_root/deploy/systemd/adt-openclaw-healthcheck.timer" "$systemd_dir/adt-openclaw-healthcheck.timer"

if [[ ! -f "$env_file" ]]; then
  cat > "$env_file" <<'ENV'
# OpenClaw production provider settings
# Edit these values before enabling the service if your runtime differs.
OPENCLAW_PROVIDER_CMD=ollama serve
OPENCLAW_BIND_ADDR=127.0.0.1:11434
OPENCLAW_BASE_URL=http://127.0.0.1:11434/v1
OPENCLAW_MODEL=openclaw-local
OPENCLAW_API_KEY=
OPENCLAW_HEALTHCHECK_TIMEOUT_SEC=5
OPENCLAW_HEALTHCHECK_WAIT_SEC=60
ENV
fi

chown root:"$service_group" "$env_file"
chmod 640 "$env_file"

systemctl daemon-reload
systemctl enable --now adt-openclaw-provider.service
systemctl enable --now adt-openclaw-healthcheck.timer

echo "Installed OpenClaw production services."
echo "Edit ${env_file} if your provider command, model, or API key differs."
echo "Current status:"
systemctl --no-pager --full status adt-openclaw-provider.service || true
