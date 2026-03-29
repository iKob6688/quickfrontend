#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/Users/ikob/Documents/iKobDoc/ERPTH/AdtClaw/adt_openclaw}"
LAUNCH_AGENTS_DIR="${LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}"
APP_SUPPORT_DIR="${APP_SUPPORT_DIR:-$HOME/Library/Application Support/OpenClaw}"

mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$APP_SUPPORT_DIR"

install -m 755 "$ROOT_DIR/scripts/mock_openclaw_provider.py" "$APP_SUPPORT_DIR/mock_openclaw_provider.py"
install -m 755 "$ROOT_DIR/scripts/adt_openclaw_healthcheck" "$APP_SUPPORT_DIR/adt_openclaw_healthcheck"

cat > "$LAUNCH_AGENTS_DIR/com.adt.openclaw.provider.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.adt.openclaw.provider</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/env</string>
        <string>python3</string>
        <string>/Users/ikob/Library/Application Support/OpenClaw/mock_openclaw_provider.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>OPENCLAW_BIND_HOST</key>
        <string>127.0.0.1</string>
        <key>OPENCLAW_BIND_PORT</key>
        <string>11434</string>
        <key>OPENCLAW_MODEL</key>
        <string>openclaw-local</string>
        <key>OPENCLAW_DISPLAY_NAME</key>
        <string>OpenClaw Local Test Provider</string>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/openclaw-provider.out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/openclaw-provider.err.log</string>
</dict>
</plist>
PLIST

cat > "$LAUNCH_AGENTS_DIR/com.adt.openclaw.healthcheck.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.adt.openclaw.healthcheck</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/ikob/Library/Application Support/OpenClaw/adt_openclaw_healthcheck</string>
        <string>check</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/openclaw-healthcheck.out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/openclaw-healthcheck.err.log</string>
</dict>
</plist>
PLIST

uid="$(id -u)"
domain="gui/${uid}"

launchctl bootout "$domain" "$LAUNCH_AGENTS_DIR/com.adt.openclaw.provider.plist" >/dev/null 2>&1 || true
launchctl bootout "$domain" "$LAUNCH_AGENTS_DIR/com.adt.openclaw.healthcheck.plist" >/dev/null 2>&1 || true
launchctl bootstrap "$domain" "$LAUNCH_AGENTS_DIR/com.adt.openclaw.provider.plist"
launchctl bootstrap "$domain" "$LAUNCH_AGENTS_DIR/com.adt.openclaw.healthcheck.plist"

echo "Installed OpenClaw local test provider and healthcheck."
