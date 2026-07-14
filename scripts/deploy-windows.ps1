param(
  [ValidateSet("Install", "Update", "Restart")]
  [string]$Mode = "Install",
  [string]$ServerIp = "",
  [string]$InstallRoot = "C:\scan",
  [int]$WebPort = 8080,
  [int]$ApiPort = 3000,
  [string]$WebOrigin = "",
  [string]$ApiBaseUrl = "",
  [string]$ScanLookupUrl = "",
  [string]$CookieSecret = "",
  [ValidateRange(1, 3650)]
  [int]$BackupRetentionDays = 30,
  [switch]$FreshDatabase,
  [switch]$SkipInstall,
  [switch]$SkipDatabase,
  [switch]$SkipBuild,
  [switch]$SkipFirewall,
  [switch]$SkipTasks
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-WarningLine {
  param([string]$Message)
  Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Require-Command {
  param([string]$Name, [string]$Hint)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not available. $Hint"
  }
}

function New-RandomSecret {
  $bytes = New-Object byte[] 32
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
  } finally {
    $generator.Dispose()
  }
}

function Get-DefaultServerIp {
  $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.IPAddress -ne "0.0.0.0"
    } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress

  if ($ip) {
    return $ip
  }

  return "localhost"
}

function Ensure-FirewallRule {
  param(
    [string]$Name,
    [int]$Port
  )

  if (Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue) {
    return
  }

  New-NetFirewallRule `
    -DisplayName $Name `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $Port `
    -Action Allow | Out-Null
}

function Invoke-CheckedCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($Arguments -join ' ')"
  }
}

function Invoke-PrismaMigrateDeploy {
  param(
    [string]$ProjectRoot,
    [string]$LogsDir
  )

  $migrateLog = Join-Path $LogsDir "migrate-deploy.log"

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & pnpm --filter "@scan/api" exec prisma migrate deploy *> $migrateLog
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  Get-Content -Path $migrateLog | Write-Host

  if ($exitCode -eq 0) {
    return
  }

  $migrateOutput = Get-Content -Path $migrateLog -Raw
  if ($migrateOutput -notmatch "P3005") {
    throw "Database migration failed. See $migrateLog"
  }

  Write-WarningLine "Database is not empty but has no Prisma migration history. Baseline will be recorded."
  $migrationsPath = Join-Path $ProjectRoot "apps\api\prisma\migrations"
  $migrations = Get-ChildItem -Path $migrationsPath -Directory | Sort-Object Name

  foreach ($migration in $migrations) {
    Invoke-CheckedCommand "pnpm" @("--filter", "@scan/api", "exec", "prisma", "migrate", "resolve", "--applied", $migration.Name)
  }

  Invoke-CheckedCommand "pnpm" @("--filter", "@scan/api", "exec", "prisma", "migrate", "deploy")
}

function Read-EnvValue {
  param(
    [string]$Path,
    [string]$Name
  )

  if (-not (Test-Path $Path)) {
    return ""
  }

  $line = Get-Content -Path $Path | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) {
    return ""
  }

  return ($line -replace "^$Name=", "").Trim('"')
}

function Backup-Database {
  param(
    [string]$DatabasePath,
    [string]$BackupsDir
  )

  if (-not (Test-Path $DatabasePath)) {
    return
  }

  New-Item -ItemType Directory -Force -Path $BackupsDir | Out-Null
  $backupPath = Join-Path $BackupsDir ("scan-db-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".db")
  Copy-Item -Path $DatabasePath -Destination $backupPath -Force
  Write-Host "Database backup: $backupPath" -ForegroundColor Green
}

function Write-RunnerScripts {
  param(
    [string]$InstallRoot,
    [string]$ProjectRoot,
    [string]$LogsDir,
    [int]$WebPort
  )

  $apiRunnerPath = Join-Path $InstallRoot "run-api.ps1"
  $webRunnerPath = Join-Path $InstallRoot "run-web.ps1"
  $webServerPath = Join-Path $InstallRoot "run-web-server.js"
  $projectRootForJs = $ProjectRoot.Replace('\', '\\')

  $apiScript = @"
`$ErrorActionPreference = "Stop"
Set-Location "$ProjectRoot"
while (`$true) {
  node "apps\api\dist\src\main.js" 2>&1 | Tee-Object -FilePath "$LogsDir\api.log" -Append
  Start-Sleep -Seconds 3
}
"@

  $webScript = @"
`$ErrorActionPreference = "Stop"
Set-Location "$ProjectRoot"
while (`$true) {
  node "$webServerPath" 2>&1 | Tee-Object -FilePath "$LogsDir\web.log" -Append
  Start-Sleep -Seconds 3
}
"@

  $webServerScript = @"
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve('$projectRootForJs', 'apps', 'web', 'dist');
const port = Number(process.env.WEB_PORT || '$WebPort');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    });
    response.end(content);
  });
}

http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
  const requestedPath = path.resolve(root, relativePath || 'index.html');

  if (!requestedPath.startsWith(root)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.stat(requestedPath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(response, requestedPath);
      return;
    }

    sendFile(response, path.join(root, 'index.html'));
  });
}).listen(port, '0.0.0.0', () => {
  console.log('Scan web is listening on http://0.0.0.0:' + port);
});
"@

  Set-Content -Path $apiRunnerPath -Value $apiScript -Encoding UTF8
  Set-Content -Path $webRunnerPath -Value $webScript -Encoding UTF8
  Set-Content -Path $webServerPath -Value $webServerScript -Encoding UTF8

  return @{
    ApiRunner = $apiRunnerPath
    WebRunner = $webRunnerPath
  }
}

function Write-DatabaseBackupScript {
  param(
    [string]$InstallRoot,
    [string]$ProjectRoot,
    [string]$EnvPath,
    [string]$LogsDir,
    [string]$BackupRoot,
    [int]$RetentionDays
  )

  $backupScriptPath = Join-Path $InstallRoot "run-database-backup.ps1"
  $backupLogPath = Join-Path $LogsDir "database-backup.log"

  $backupScript = @"
`$ErrorActionPreference = "Stop"
`$projectRoot = "$ProjectRoot"
`$envPath = "$EnvPath"
`$backupRoot = "$BackupRoot"
`$backupLogPath = "$backupLogPath"
`$retentionDays = $RetentionDays
`$prismaPath = Join-Path `$projectRoot "apps\api\node_modules\.bin\prisma.cmd"

function Write-BackupLog {
  param([string]`$Message)

  `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path `$backupLogPath -Value "[`$timestamp] `$Message" -Encoding UTF8
}

`$partialPath = `$null
try {
  New-Item -ItemType Directory -Force -Path `$backupRoot | Out-Null
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent `$backupLogPath) | Out-Null

  if (-not (Test-Path `$envPath)) {
    throw "Environment file is missing: `$envPath"
  }

  `$databaseUrlLine = Get-Content -Path `$envPath |
    Where-Object { `$_ -match '^DATABASE_URL=' } |
    Select-Object -First 1
  if (-not `$databaseUrlLine) {
    throw "DATABASE_URL is missing from `$envPath"
  }

  `$env:DATABASE_URL = (`$databaseUrlLine -replace '^DATABASE_URL=', '').Trim('"')
  if (-not `$env:DATABASE_URL.StartsWith('file:')) {
    throw "DATABASE_URL must use SQLite file URL"
  }

  `$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  `$backupPath = Join-Path `$backupRoot ("scan-db-`$stamp.db")
  `$partialPath = "`$backupPath.partial"
  `$sqlBackupPath = `$partialPath.Replace('\', '/').Replace("'", "''")
  `$sql = "VACUUM INTO '`$sqlBackupPath';"

  if (-not (Test-Path `$prismaPath)) {
    throw "Project Prisma CLI is missing: `$prismaPath"
  }

  `$prismaOutput = @(`$sql | & `$prismaPath db execute --stdin --url `$env:DATABASE_URL 2>&1)
  `$prismaExitCode = `$LASTEXITCODE
  foreach (`$line in `$prismaOutput) {
    Write-BackupLog "PRISMA `$line"
  }
  if (`$prismaExitCode -ne 0) {
    throw "Prisma online backup command failed with exit code `$prismaExitCode"
  }

  if (-not (Test-Path `$partialPath) -or (Get-Item `$partialPath).Length -le 0) {
    throw "Online backup output is missing or empty: `$partialPath"
  }

  Move-Item -Path `$partialPath -Destination `$backupPath -Force
  `$partialPath = `$null

  Get-ChildItem -Path `$backupRoot -Filter "scan-db-*.db" -File |
    Where-Object { `$_.LastWriteTime -lt (Get-Date).AddDays(-`$retentionDays) } |
    Remove-Item -Force

  Write-BackupLog "SUCCESS `$backupPath"
} catch {
  if (`$partialPath -and (Test-Path `$partialPath)) {
    Remove-Item -Path `$partialPath -Force -ErrorAction SilentlyContinue
  }

  Write-BackupLog "FAILED `$(`$_.Exception.Message)"
  exit 1
}
"@

  Set-Content -Path $backupScriptPath -Value $backupScript -Encoding UTF8
  return $backupScriptPath
}

function Register-ScanTask {
  param(
    [string]$TaskName,
    [string]$ScriptPath
  )

  $action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Force | Out-Null
}

function Register-DatabaseBackupTask {
  param([string]$ScriptPath)

  $action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
  $trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

  Register-ScheduledTask `
    -TaskName "ScanDatabaseBackup" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Force | Out-Null
}

function Restart-ScanTask {
  param([string]$TaskName)

  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Start-ScheduledTask -TaskName $TaskName
}

function Stop-ScanTask {
  param([string]$TaskName)

  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  }
}

function Stop-ProjectNodeProcesses {
  param([string]$ProjectRoot)

  $escapedProjectRoot = $ProjectRoot.Replace('\', '\\')
  $processes = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        $_.CommandLine -like "*$ProjectRoot*" -or
        $_.CommandLine -like "*$escapedProjectRoot*" -or
        $_.CommandLine -like "*run-web-server.js*" -or
        $_.CommandLine -like "*apps\api\dist\src\main.js*"
      )
    }

  foreach ($process in $processes) {
    Write-WarningLine "Stopping project node.exe process $($process.ProcessId)"
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Test-HttpEndpoint {
  param(
    [string]$Name,
    [string]$Url
  )

  try {
    Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 8 | Out-Null
    Write-Host "$Name OK: $Url" -ForegroundColor Green
  } catch {
    Write-WarningLine "$Name did not respond yet: $Url"
  }
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$InstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$DataDir = Join-Path $InstallRoot "data"
$LogsDir = Join-Path $InstallRoot "logs"
$BackupsDir = Join-Path $InstallRoot "backups"
$BackupRoot = "C:\backup"
$DatabasePath = Join-Path $DataDir "scan.db"
$EnvPath = Join-Path $ProjectRoot ".env"
$ApiEnvPath = Join-Path $ProjectRoot "apps\api\.env"
$WebEnvPath = Join-Path $ProjectRoot "apps\web\.env"
$PackageDataPath = Join-Path $ProjectRoot "..\ScanData\scan.db"
$WebDistPath = Join-Path $ProjectRoot "apps\web\dist"
$ApiEntryPath = Join-Path $ProjectRoot "apps\api\dist\src\main.js"

Write-Step "Checking runtime prerequisites"
Require-Command node "Install Node.js LTS from https://nodejs.org/ and reopen PowerShell."
Require-Command npm "Node.js should install npm together with node."

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    Write-Step "Enabling pnpm through corepack"
    corepack enable
    corepack prepare pnpm@10.11.0 --activate
  } else {
    Write-Step "Installing pnpm through npm"
    npm install -g pnpm@10.11.0
  }
}

Require-Command pnpm "Install pnpm 10.11.0 before running this script."

if (-not $ServerIp) {
  $ServerIp = Get-DefaultServerIp
}

if (-not $WebOrigin) {
  $WebOrigin = "http://${ServerIp}:$WebPort"
}

if (-not $ApiBaseUrl) {
  $ApiBaseUrl = "http://${ServerIp}:$ApiPort"
}

if (-not $CookieSecret -and ($Mode -eq "Update" -or $Mode -eq "Restart")) {
  $CookieSecret = Read-EnvValue $EnvPath "COOKIE_SECRET"
}

if (-not $CookieSecret) {
  $CookieSecret = New-RandomSecret
}

if (-not $ScanLookupUrl -and ($Mode -eq "Update" -or $Mode -eq "Restart")) {
  $ScanLookupUrl = Read-EnvValue $EnvPath "SCAN_LOOKUP_URL"
}

if (-not $ScanLookupUrl) {
  $ScanLookupUrl = "http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai"
}

if ($Mode -eq "Restart") {
  Write-Step "Restarting app tasks"
  Restart-ScanTask "ScanApi"
  Restart-ScanTask "ScanWeb"
  Start-Sleep -Seconds 4

  Write-Step "Health checks"
  Test-HttpEndpoint "API" "http://127.0.0.1:$ApiPort/production-lines"
  Test-HttpEndpoint "Web" "http://127.0.0.1:$WebPort/"

  Write-Step "Restart complete"
  Write-Host "Open: $WebOrigin" -ForegroundColor Green
  exit 0
}

Write-Step "Preparing folders"
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
New-Item -ItemType Directory -Force -Path $BackupsDir | Out-Null

if (-not $SkipTasks) {
  Write-Step "Stopping existing app tasks"
  Stop-ScanTask "ScanApi"
  Stop-ScanTask "ScanWeb"
  Start-Sleep -Seconds 2
  Stop-ProjectNodeProcesses $ProjectRoot
}

if ($Mode -eq "Update") {
  Write-Step "Backing up database before update"
  Backup-Database $DatabasePath $BackupsDir
}

if ($FreshDatabase -and (Test-Path $DatabasePath)) {
  Write-WarningLine "FreshDatabase was supplied. Existing database will be moved to backups."
  $backupPath = Join-Path $BackupsDir ("scan-db-replaced-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".db")
  Move-Item -Path $DatabasePath -Destination $backupPath -Force
}

if ((Test-Path $PackageDataPath) -and -not (Test-Path $DatabasePath)) {
  Write-Step "Copying packaged SQLite database"
  Copy-Item $PackageDataPath $DatabasePath
}

$DatabaseUrlPath = $DatabasePath.Replace("\", "/")
$EnvContent = @"
DATABASE_URL="file:$DatabaseUrlPath"
API_PORT=$ApiPort
WEB_ORIGIN="$WebOrigin"
COOKIE_NAME="scan_session"
COOKIE_SECRET="$CookieSecret"
COOKIE_SECURE=false
SESSION_TTL_HOURS=12
INITIAL_ADMIN_PASSWORD=""
ALLOW_DEFAULT_ADMIN_PASSWORD=false
SCAN_LOOKUP_URL="$ScanLookupUrl"
VITE_API_BASE_URL="$ApiBaseUrl"
"@

Write-Step "Writing environment files"
Set-Content -Path $EnvPath -Value $EnvContent -Encoding UTF8
Set-Content -Path $ApiEnvPath -Value $EnvContent -Encoding UTF8
Set-Content -Path $WebEnvPath -Value $EnvContent -Encoding UTF8

Push-Location $ProjectRoot
try {
  if (-not $SkipInstall) {
    Write-Step "Installing dependencies"
    Invoke-CheckedCommand "pnpm" @("install", "--prod=false")
  } else {
    Write-Step "Skipping dependency install"
  }

  if (-not $SkipDatabase) {
    Write-Step "Generating Prisma client"
    Invoke-CheckedCommand "pnpm" @("db:generate")

    Write-Step "Applying database migrations"
    Invoke-PrismaMigrateDeploy $ProjectRoot $LogsDir

    Write-Step "Validating database schema"
    Invoke-CheckedCommand "pnpm" @("db:validate")
  } else {
    Write-Step "Skipping database client generation and migrations"
  }

  if (-not $SkipBuild) {
    Write-Step "Building API and web app"
    Invoke-CheckedCommand "pnpm" @("build")
  }
} finally {
  Pop-Location
}

if (-not (Test-Path $ApiEntryPath)) {
  throw "API build output is missing: $ApiEntryPath"
}

if (-not (Test-Path (Join-Path $WebDistPath "index.html"))) {
  throw "Web build output is missing: $WebDistPath"
}

if (-not $SkipFirewall) {
  Write-Step "Opening Windows firewall ports"
  Ensure-FirewallRule "Scan API $ApiPort" $ApiPort
  Ensure-FirewallRule "Scan Web $WebPort" $WebPort
}

Write-Step "Writing run scripts"
$runnerScripts = Write-RunnerScripts $InstallRoot $ProjectRoot $LogsDir $WebPort
$databaseBackupScriptPath = Write-DatabaseBackupScript `
  $InstallRoot `
  $ProjectRoot `
  $EnvPath `
  $LogsDir `
  $BackupRoot `
  $BackupRetentionDays

if (-not $SkipTasks) {
  Write-Step "Registering startup tasks"
  Register-ScanTask "ScanApi" $runnerScripts.ApiRunner
  Register-ScanTask "ScanWeb" $runnerScripts.WebRunner
  Register-DatabaseBackupTask $databaseBackupScriptPath

  Write-Step "Starting app tasks"
  Restart-ScanTask "ScanApi"
  Restart-ScanTask "ScanWeb"

  Start-Sleep -Seconds 4
}

Write-Step "Health checks"
Test-HttpEndpoint "API" "http://127.0.0.1:$ApiPort/production-lines"
Test-HttpEndpoint "Web" "http://127.0.0.1:$WebPort/"

Write-Step "Deployment complete"
Write-Host "Open: $WebOrigin" -ForegroundColor Green
Write-Host "API:  $ApiBaseUrl"
Write-Host "Data: $DatabasePath"
Write-Host "Logs: $LogsDir"
Write-Host "Daily database backup: $BackupRoot (02:00, keep $BackupRetentionDays days)"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  Start-ScheduledTask ScanApi"
Write-Host "  Stop-ScheduledTask ScanApi"
Write-Host "  Start-ScheduledTask ScanWeb"
Write-Host "  Stop-ScheduledTask ScanWeb"
Write-Host "  Get-Content $LogsDir\api.log -Tail 80"
Write-Host "  Get-Content $LogsDir\web.log -Tail 80"
Write-Host "  Start-ScheduledTask ScanDatabaseBackup"
Write-Host "  Get-Content $LogsDir\database-backup.log -Tail 80"
