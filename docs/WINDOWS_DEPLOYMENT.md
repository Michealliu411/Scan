# Windows Server Deployment

This project is deployed without Git and without IIS. Field servers are expected
to be offline. The preferred update flow avoids npm/pnpm registry access on the
server and reuses existing runtime dependencies unless a dependency change is
explicitly called out during packaging.

## 1. Create The Package On The Mac

From the project root:

```bash
./scripts/package-windows.sh
```

The script creates:

```text
releases/scan-windows-YYYYMMDD-HHMMSS.zip
```

It excludes cache and local-only folders such as `.git`, `.planning`,
`node_modules`, and copies the first SQLite database it finds to `ScanData/scan.db`.
Build artifacts under `apps/api/dist` and `apps/web/dist` are included when present.

Before packaging for an offline server, build locally:

```bash
pnpm --filter @scan/api build
pnpm --filter @scan/web build
./scripts/package-windows.sh
```

If build artifacts are missing, the package script prints a warning because the
server may need to build on-site.

To force a specific database:

```bash
SCAN_DB_PATH=/absolute/path/to/dev.db ./scripts/package-windows.sh
```

为已有现场服务器制作更新包时，必须使用不携带数据库的更新模式：

```bash
SCAN_PACKAGE_MODE=update ./scripts/package-windows.sh
```

该包只包含 `Scan` 应用目录和更新说明，明确不包含 `ScanData`、`scan.db` 或其他数据库文件。更新时现场已有的 `C:\scan\data\scan.db` 由部署脚本先备份，再执行迁移；不得人工用包内数据库替换它。

## 2. Prepare A New Windows Server

A brand-new server needs Node.js LTS and dependencies. Because field servers are
offline, do not assume a clean first install can fetch packages from the internet.
If a new server does not already have the needed `node_modules`, prepare an
offline dependency bundle or arrange temporary access before going on-site.

After Node.js is installed, open a new Administrator PowerShell and verify:

```powershell
node -v
npm -v
```

Create a clean deployment folder:

```powershell
New-Item -ItemType Directory C:\scan
```

Extract the zip into `C:\scan`. The expected paths are:

```text
C:\scan\Scan\package.json
C:\scan\Scan\scripts\deploy-windows.ps1
C:\scan\ScanData\scan.db
```

## 3. First Install

Replace the IP with the server's LAN IP:

```powershell
cd C:\scan\Scan
Set-ExecutionPolicy -Scope Process Bypass

.\scripts\deploy-windows.ps1 -Mode Install -ServerIp "192.168.1.144"
```

The scan lookup interface defaults to:

```text
http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai
```

If the intranet address changes, pass `-ScanLookupUrl "http://new-address/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai"` when running the deployment script, or update `SCAN_LOOKUP_URL` in `.env`.
Update and restart runs preserve an existing `SCAN_LOOKUP_URL` unless `-ScanLookupUrl` is passed.

By default this uses:

```text
Web: http://192.168.1.144:8080
API: http://192.168.1.144:3000
Data: C:\scan\data\scan.db
Logs: C:\scan\logs
Backups: C:\scan\backups
```

The deploy script:

- installs pnpm if needed;
- installs project dependencies;
- writes `.env`;
- generates Prisma client;
- applies database migrations;
- builds API and web assets;
- opens Windows firewall ports 3000 and 8080;
- creates startup tasks `ScanApi` and `ScanWeb`;
- creates the daily online database backup task `ScanDatabaseBackup`;
- starts both tasks;
- runs basic API and web health checks.

## 4. Program And Database Updates

For future updates where dependencies and database schema did not change, extract
the new zip over `C:\scan`, then run the offline-safe update path:

```powershell
cd C:\scan\Scan
Set-ExecutionPolicy -Scope Process Bypass

.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -SkipInstall -SkipDatabase -SkipBuild
```

This reuses the existing `node_modules`, uses the bundled `dist` output, avoids
registry access, and restarts the app after backing up the database.

Full update mode is still available when dependencies, Prisma client output, or
database migrations must run:

```powershell
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144"
```

Full update mode:

- stops `ScanApi` and `ScanWeb`;
- backs up `C:\scan\data\scan.db` to `C:\scan\backups`;
- keeps the existing `COOKIE_SECRET` from `.env`;
- installs dependencies;
- runs Prisma database migrations with `migrate deploy`;
- builds the API and web app;
- restarts both tasks;
- runs health checks.

Production updates should use `-Mode Update`. Do not run `prisma migrate dev`
or `pnpm db:seed` on a production database.

Packaging rule: if a release needs server-side internet access, dependency
installation, or database migration, call that out before handing the package to
the field team.

## 5. Daily Operations

Open the app:

```text
http://server-ip:8080
```

Check task state:

```powershell
Get-ScheduledTask ScanApi, ScanWeb
```

Restart the app:

```powershell
cd C:\scan\Scan
.\scripts\deploy-windows.ps1 -Mode Restart -ServerIp "192.168.1.144"
```

View logs:

```powershell
Get-Content C:\scan\logs\api.log -Tail 80
Get-Content C:\scan\logs\web.log -Tail 80
```

Back up this file regularly:

```text
C:\scan\data\scan.db
```

The update script also creates timestamped database backups under:

```text
C:\scan\backups
```

### 每日在线备份

部署脚本还会创建 `ScanDatabaseBackup` 计划任务。它以 `SYSTEM` 身份每天本机时间 02:00 执行在线 SQLite 一致性备份，运行期间不会停止或重启 `ScanApi`、`ScanWeb`。

每日备份位于：

```text
C:\backup
```

文件名为 `scan-db-yyyyMMdd-HHmmss.db`，默认保留 30 天。首次安装或更新时可调整保留时间，例如保留 60 天：

```powershell
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -BackupRetentionDays 60
```

手工立即执行一次备份：

```powershell
Start-ScheduledTask ScanDatabaseBackup
```

检查任务状态和最近执行结果：

```powershell
Get-ScheduledTask ScanDatabaseBackup
Get-ScheduledTaskInfo ScanDatabaseBackup
Get-Content C:\scan\logs\database-backup.log -Tail 80
```

任务失败不会影响在线业务，也不会删除既有正式备份；请检查 `C:` 磁盘空间、`C:\backup` 权限和日志内容。

## 6. Optional Parameters

Use different ports:

```powershell
.\scripts\deploy-windows.ps1 -Mode Install -ServerIp "192.168.1.144" -WebPort 8081 -ApiPort 3001
```

Start with a new database and move the existing one to `C:\scan\backups`:

```powershell
.\scripts\deploy-windows.ps1 -Mode Install -ServerIp "192.168.1.144" -FreshDatabase
```

Skip task creation for a temporary manual test:

```powershell
.\scripts\deploy-windows.ps1 -Mode Install -ServerIp "192.168.1.144" -SkipTasks
```
