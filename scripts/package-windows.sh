#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="${SCAN_RELEASE_DIR:-"$ROOT_DIR/releases"}"
STAMP="$(date +%Y%m%d-%H%M%S)"
PACKAGE_MODE="${SCAN_PACKAGE_MODE:-full}"
if [[ "$PACKAGE_MODE" != "full" && "$PACKAGE_MODE" != "update" ]]; then
  printf 'SCAN_PACKAGE_MODE must be full or update.\n' >&2
  exit 1
fi

PACKAGE_KIND="scan-windows"
if [[ "$PACKAGE_MODE" == "update" ]]; then
  PACKAGE_KIND="scan-windows-update"
fi

PACKAGE_PATH="$RELEASE_DIR/$PACKAGE_KIND-$STAMP.zip"
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
mkdir -p "$APP_DIR" "$RELEASE_DIR"
if [[ "$PACKAGE_MODE" == "full" ]]; then
  mkdir -p "$DATA_DIR"
fi

rsync -a "$ROOT_DIR/" "$APP_DIR/" \
  --exclude '.git/' \
  --exclude '.planning/' \
  --exclude '.superpowers/' \
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

if [[ "$PACKAGE_MODE" == "full" ]]; then
  DB_PATH="$(find_database || true)"
  if [[ -n "$DB_PATH" && -f "$DB_PATH" ]]; then
    cp "$DB_PATH" "$DATA_DIR/scan.db"
    printf 'Included database: %s\n' "$DB_PATH"
  else
    printf 'No SQLite database found. Package will deploy with a new database.\n'
  fi
fi

cat > "$STAGING_DIR/README-WINDOWS.txt" <<'README'
Windows Server deployment:

This is a full installation package. It includes ScanData\scan.db only for a new server where C:\scan\data\scan.db does not exist.

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
- If this is an update and package dependencies and database schema did not change, use:
  .\scripts\deploy-windows.ps1 -Mode Update -ServerIp "SERVER_LAN_IP" -SkipInstall -SkipDatabase
- Add -SkipBuild only when the package was already built for the same SERVER_LAN_IP and you have verified the frontend bundle contains SERVER_LAN_IP:3000:
  .\scripts\deploy-windows.ps1 -Mode Update -ServerIp "SERVER_LAN_IP" -SkipInstall -SkipDatabase -SkipBuild
- When unsure, do not add -SkipBuild. Rebuilding on the server writes the correct VITE_API_BASE_URL from -ServerIp.
- These update commands reuse the existing node_modules and avoid npm/pnpm registry access.
- If dependencies or database schema changed, prepare that update intentionally before going on-site.

The deploy script stores data under C:\scan\data.
Update mode backs up C:\scan\data\scan.db to C:\scan\backups before migration unless database steps are skipped.

Daily online backup:
- The deploy script registers ScanDatabaseBackup to run every day at 02:00 as SYSTEM.
- It creates a consistent SQLite backup without stopping ScanApi or ScanWeb.
- Backup files are stored in C:\backup and the latest 30 days are retained by default.
- Run once now: Start-ScheduledTask ScanDatabaseBackup
- View the result: Get-Content C:\scan\logs\database-backup.log -Tail 80
README

if [[ "$PACKAGE_MODE" == "update" ]]; then
  cat > "$STAGING_DIR/README-WINDOWS.txt" <<'README'
Windows Server update package:

This package intentionally contains no ScanData directory and no scan.db file.
It must be extracted over C:\scan on an existing Scan server. The existing
C:\scan\data\scan.db is preserved; the deployment script backs it up and then
applies compatible Prisma migrations.

Run PowerShell as Administrator:

  cd C:\scan\Scan
  Set-ExecutionPolicy -Scope Process Bypass
  .\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -SkipInstall -SkipBuild

Do not use -SkipDatabase for releases with database migrations.
Do not use -SkipTasks because this release registers ScanDatabaseBackup.
README
fi

if [[ "$PACKAGE_MODE" == "full" ]]; then
  (cd "$STAGING_DIR" && zip -qr "$PACKAGE_PATH" Scan ScanData README-WINDOWS.txt)
else
  (cd "$STAGING_DIR" && zip -qr "$PACKAGE_PATH" Scan README-WINDOWS.txt)
fi
rm -rf "$STAGING_DIR"

printf 'Created Windows deployment package:\n%s\n' "$PACKAGE_PATH"
if [[ "$PACKAGE_MODE" == "update" ]]; then
  printf '\nUpdate package: no ScanData or scan.db included.\n'
else
  printf '\nFull installation package: includes ScanData only for new server initialization.\n'
fi
