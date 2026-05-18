#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="${SCAN_RELEASE_DIR:-"$ROOT_DIR/releases"}"
STAMP="$(date +%Y%m%d-%H%M%S)"
PACKAGE_PATH="$RELEASE_DIR/scan-windows-$STAMP.zip"
STAGING_DIR="${TMPDIR:-/tmp}/scan-windows-package-$STAMP"
APP_DIR="$STAGING_DIR/Scan"
DATA_DIR="$STAGING_DIR/ScanData"

find_database() {
  if [[ -n "${SCAN_DB_PATH:-}" ]]; then
    printf '%s\n' "$SCAN_DB_PATH"
    return 0
  fi

  for candidate in \
    "$ROOT_DIR/apps/api/prisma/dev.db" \
    "$ROOT_DIR/apps/api/dev.db" \
    "$ROOT_DIR/dev.db"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  find "$ROOT_DIR" \
    -path "$ROOT_DIR/node_modules" -prune -o \
    -path "$ROOT_DIR/.git" -prune -o \
    -path "$ROOT_DIR/.planning" -prune -o \
    -name '*.db' -type f -print -quit
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command rsync
require_command zip

if [[ ! -f "$ROOT_DIR/apps/api/dist/src/main.js" || ! -f "$ROOT_DIR/apps/web/dist/index.html" ]]; then
  cat >&2 <<'WARN'
WARNING: Build artifacts are missing.
Run `pnpm --filter @scan/api build && pnpm --filter @scan/web build` before packaging
to create an offline-friendly update package. Without dist artifacts, the server
update may need to build on-site.
WARN
fi

rm -rf "$STAGING_DIR"
mkdir -p "$APP_DIR" "$DATA_DIR" "$RELEASE_DIR"

rsync -a "$ROOT_DIR/" "$APP_DIR/" \
  --exclude '.git/' \
  --exclude '.planning/' \
  --exclude '.pnpm-store/' \
  --exclude 'node_modules/' \
  --exclude 'coverage/' \
  --exclude 'releases/' \
  --exclude '.env' \
  --exclude 'apps/api/.env' \
  --exclude '*.db' \
  --exclude '*.db-journal' \
  --exclude '*.log' \
  --exclude '*.tsbuildinfo' \
  --exclude '.DS_Store'

DB_PATH="$(find_database || true)"
if [[ -n "$DB_PATH" && -f "$DB_PATH" ]]; then
  cp "$DB_PATH" "$DATA_DIR/scan.db"
  printf 'Included database: %s\n' "$DB_PATH"
else
  printf 'No SQLite database found. Package will deploy with a new database.\n'
fi

cat > "$STAGING_DIR/README-WINDOWS.txt" <<'README'
Windows Server deployment:

1. Install Node.js LTS.
2. Extract this zip to C:\scan.
3. Open PowerShell as Administrator.
4. First install:
   cd C:\scan\Scan
   Set-ExecutionPolicy -Scope Process Bypass
   .\scripts\deploy-windows.ps1 -Mode Install -ServerIp "SERVER_LAN_IP"

Example:
   .\scripts\deploy-windows.ps1 -Mode Install -ServerIp "192.168.1.144"

For future updates, extract the new zip over C:\scan and run:
   .\scripts\deploy-windows.ps1 -Mode Update -ServerIp "SERVER_LAN_IP"

Offline server note:
- Servers are expected to have no internet access.
- If this is an update and package dependencies did not change, prefer:
  .\scripts\deploy-windows.ps1 -Mode Update -ServerIp "SERVER_LAN_IP" -SkipInstall -SkipDatabase -SkipBuild
- This reuses the existing node_modules, uses bundled build artifacts, and avoids npm/pnpm registry access.
- If dependencies or database schema changed, prepare that update intentionally before going on-site.

The deploy script stores data under C:\scan\data.
Update mode backs up C:\scan\data\scan.db to C:\scan\backups before migration unless database steps are skipped.
README

(cd "$STAGING_DIR" && zip -qr "$PACKAGE_PATH" Scan ScanData README-WINDOWS.txt)
rm -rf "$STAGING_DIR"

printf 'Created Windows deployment package:\n%s\n' "$PACKAGE_PATH"
printf '\nOffline update reminder:\n'
printf 'For existing offline servers with unchanged dependencies/schema, run deploy with -SkipInstall -SkipDatabase -SkipBuild.\n'
