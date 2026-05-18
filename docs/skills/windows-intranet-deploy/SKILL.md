---
name: windows-intranet-deploy
description: Deploy, update, package, or troubleshoot small Windows Server intranet apps, especially Node API + React/Vite web + Prisma + SQLite systems. Use when Codex needs to create or review Windows deployment scripts, simplify internal-network deployment, handle Install/Update/Restart workflows, preserve production SQLite data, run Prisma migrations safely, configure Windows Scheduled Tasks, diagnose IIS 500.19, Prisma P3005, Prisma DLL EPERM locks, Vite API URL build mistakes, firewall/port access, or proxy-related 502 errors.
---

# Windows Intranet Deploy

Use this skill for small internal Windows Server deployments where maintainability matters more than infrastructure sophistication.

Default to a simple, explicit deployment:

```text
Node API service:        3000
Node static web service: 8080
SQLite data:             C:\app\data
Logs:                    C:\app\logs
Backups:                 C:\app\backups
Startup:                 Windows Scheduled Tasks
```

Avoid IIS unless the user explicitly needs IIS features such as central reverse proxying, Windows authentication, TLS termination, or existing enterprise hosting rules.

## Core Rules

- Keep deployment understandable by non-specialist maintainers.
- Prefer one PowerShell script with `Install`, `Update`, and `Restart` modes.
- Keep application files separate from data, logs, and backups.
- Never overwrite production SQLite data during program updates.
- Always back up the SQLite database before schema migrations.
- Use `prisma migrate deploy` in production.
- Do not run `prisma migrate dev` or normal seed scripts against production data.
- Write Vite environment files before building the frontend.
- Stop running app processes before `pnpm install`, `prisma generate`, or rebuilds on Windows.
- Finish every deploy/update with health checks.

## Standard Directory Layout

Use a predictable root such as `C:\scan` or `C:\<app-name>`:

```text
C:\app-root\app        # optional: code/app directory
C:\app-root\data       # SQLite database
C:\app-root\logs       # app and deploy logs
C:\app-root\backups    # timestamped database backups
```

If the package extracts to `C:\scan\Scan`, keep durable data outside that extracted folder:

```text
C:\scan\Scan
C:\scan\data\scan.db
C:\scan\logs
C:\scan\backups
```

## Deployment Modes

### Install

Use for a new server or clean deployment.

Required behavior:

```text
check Node.js and npm
install/enable pnpm
write .env files
copy packaged database only when no production database exists
pnpm install --prod=false
pnpm db:generate
prisma migrate deploy
pnpm build
open firewall ports
create startup tasks
start tasks
run health checks
```

Suggested command shape:

```powershell
.\scripts\deploy-windows.ps1 -Mode Install -ServerIp "192.168.1.144"
```

### Update

Use for future program or database-schema updates.

Required behavior:

```text
stop app tasks
stop this project's node.exe processes
backup SQLite database
preserve existing COOKIE_SECRET
install dependencies
generate Prisma client
run prisma migrate deploy
build API and web
restart tasks
run health checks
```

Suggested command shape:

```powershell
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144"
```

### Restart

Use for service restart only.

```powershell
.\scripts\deploy-windows.ps1 -Mode Restart -ServerIp "192.168.1.144"
```

Do not modify dependencies, database, or build outputs in restart mode.

## PowerShell Script Requirements

Use a constrained parameter surface:

```powershell
param(
  [ValidateSet("Install", "Update", "Restart")]
  [string]$Mode = "Install",
  [string]$ServerIp = "",
  [string]$InstallRoot = "C:\app",
  [int]$WebPort = 8080,
  [int]$ApiPort = 3000
)
```

Keep advanced switches optional and rare:

```powershell
-FreshDatabase
-SkipBuild
-SkipFirewall
-SkipTasks
```

Prefer `-ServerIp` over separate `-WebOrigin` and `-ApiBaseUrl` because operators commonly mix ports.

## Environment Files

For Vite apps, write both root/API env and web env before build:

```text
.env
apps\api\.env
apps\web\.env
```

Include:

```text
DATABASE_URL="file:C:/app/data/app.db"
API_PORT=3000
WEB_ORIGIN="http://server-ip:8080"
COOKIE_NAME="app_session"
COOKIE_SECRET="<stable secret>"
COOKIE_SECURE=false
SESSION_TTL_HOURS=12
VITE_API_BASE_URL="http://server-ip:3000"
```

In `Update` mode, read and preserve the existing `COOKIE_SECRET` when present. Changing it invalidates signed cookies and can create confusing auth behavior after updates.

After build, verify the frontend bundle contains the API URL:

```powershell
Select-String -Path C:\app\app\apps\web\dist\assets\*.js -Pattern "server-ip:3000" -SimpleMatch
```

## Windows Process Locks

Windows often locks Prisma engine DLLs while the API is running.

Before dependency install, `prisma generate`, or build, stop:

```text
ScanApi scheduled task
ScanWeb scheduled task
node.exe processes whose command line contains the project root
node.exe processes running run-web-server.js
node.exe processes running apps\api\dist\src\main.js
```

Common error:

```text
EPERM: operation not permitted, rename query_engine-windows.dll.node.tmp... -> query_engine-windows.dll.node
```

Root cause: running API process is holding Prisma DLL.

Fix: stop project tasks and project node processes, then rerun deploy/update.

## Database Rules

Production update sequence:

```text
stop services
backup database
generate Prisma client
prisma migrate deploy
build
start services
health check
```

If `prisma migrate deploy` reports P3005:

```text
The database schema is not empty.
```

Interpretation: existing database has tables but no Prisma migration history. For a known production baseline, mark existing migration folders as applied, then rerun deploy.

Do this only when the schema is known to match the migrations.

Never use destructive reset commands on production data unless the user explicitly asks and understands the data loss.

## Startup Tasks

Prefer Windows Scheduled Tasks over manual PowerShell windows for simple internal deployments.

Create:

```text
ScanApi -> powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\app\run-api.ps1
ScanWeb -> powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\app\run-web.ps1
```

Use SYSTEM principal and AtStartup trigger for simple server apps.

Daily operations:

```powershell
Get-ScheduledTask ScanApi, ScanWeb
Start-ScheduledTask ScanApi
Stop-ScheduledTask ScanApi
Start-ScheduledTask ScanWeb
Stop-ScheduledTask ScanWeb
```

## Static Web Server

If avoiding IIS, generate a tiny Node static server for `apps\web\dist`.

Requirements:

- listen on `0.0.0.0`;
- serve real files when they exist;
- fall back to `index.html` for SPA routes;
- set common MIME types for `.html`, `.js`, `.css`, `.json`, `.svg`, `.png`, `.ico`, `.woff`, `.woff2`.

Do not depend on global `serve` unless the operator explicitly accepts that dependency.

## Health Checks

Run after every deploy/update/restart:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/production-lines -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8080 -UseBasicParsing
```

Also verify external access from a client machine:

Windows:

```powershell
Test-NetConnection server-ip -Port 8080
Test-NetConnection server-ip -Port 3000
```

macOS:

```bash
nc -vz server-ip 8080
nc -vz server-ip 3000
curl --noproxy '*' http://server-ip:8080
```

## Firewall

Open inbound app ports:

```powershell
New-NetFirewallRule -DisplayName "App Web 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "App API 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any
```

If the server can access itself but clients cannot, check:

```powershell
netstat -ano | findstr :8080
netstat -ano | findstr :3000
Get-NetFirewallRule -DisplayName "App Web 8080","App API 3000"
```

Correct listeners should show `0.0.0.0:<port>` or `[::]:<port>`, not only `127.0.0.1:<port>`.

## IIS Guidance

Do not introduce IIS by default.

If IIS is already installed and bound to the same port, it can mask the Node static server. Symptoms include:

```text
HTTP 500.19
0x80070003
Cannot read web.config
```

Check:

```powershell
Import-Module WebAdministration
Get-ChildItem IIS:\Sites | Select-Object Name, state, bindings
netstat -ano | findstr :8080
```

Fix by stopping the IIS site or moving it to another port:

```powershell
Stop-WebSite "ScanWeb"
```

Only configure IIS if the user explicitly wants it.

## Client Proxy Problems

Internal IPs must not go through global proxy/VPN tools.

Symptoms:

```text
Chrome 502 Bad Gateway
Remote Address: 127.0.0.1:<proxy-port>
curl --noproxy '*' works but Chrome fails
```

Fix by switching proxy to rule mode or adding DIRECT/bypass rules:

```text
192.168.0.0/16
10.0.0.0/8
172.16.0.0/12
localhost
127.0.0.1
```

## Common Errors

### Script path not found

Error:

```text
.\scripts\deploy-windows.ps1 is not recognized
```

Cause: running from the wrong directory. Find the real project root:

```powershell
Get-ChildItem C:\ -Filter deploy-windows.ps1 -Recurse -ErrorAction SilentlyContinue
```

### node not found

Install Node.js LTS, then reopen PowerShell and verify:

```powershell
node -v
npm -v
```

### prisma not found

Cause: production install skipped devDependencies.

Fix:

```powershell
pnpm install --prod=false
```

### P3005 database not empty

Cause: existing DB lacks Prisma migration history.

Fix only after confirming baseline:

```powershell
pnpm --filter "@app/api" exec prisma migrate resolve --applied <migration-folder>
pnpm --filter "@app/api" exec prisma migrate deploy
```

### NativeCommandError for Prisma env output

PowerShell may treat Prisma stderr informational output as `NativeCommandError`.

In deploy scripts, judge native commands by exit code, not by PowerShell stderr text.

### Frontend requests 8080 API paths

Symptoms:

```text
GET /auth/me on port 8080
Cannot read properties of undefined (reading 'mustChangePassword')
```

Cause: Vite did not receive `VITE_API_BASE_URL` before build.

Fix: write `apps\web\.env` before `pnpm build`, rebuild, and hard refresh browser.

## Deliverables Checklist

For each future project, produce:

```text
scripts/package-windows.sh
scripts/deploy-windows.ps1
docs/WINDOWS_DEPLOYMENT.md
```

The deployment document must include:

```text
first install command
update command
restart command
data/logs/backups paths
health checks
common troubleshooting
backup warning
```
