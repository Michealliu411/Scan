import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const deployScript = await readFile(new URL('./deploy-windows.ps1', import.meta.url), 'utf8');
const packageScript = await readFile(new URL('./package-windows.sh', import.meta.url), 'utf8');
const deploymentGuide = await readFile(new URL('../docs/WINDOWS_DEPLOYMENT.md', import.meta.url), 'utf8');

test('registers an online database backup task at 02:00 under SYSTEM', () => {
  assert.match(deployScript, /BackupRetentionDays/);
  assert.match(deployScript, /C:\\backup/);
  assert.match(deployScript, /ScanDatabaseBackup/);
  assert.match(deployScript, /New-ScheduledTaskTrigger -Daily -At "02:00"/);
  assert.match(deployScript, /New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest/);
});

test('generates online SQLite backup files instead of copying the active database', () => {
  assert.match(deployScript, /VACUUM INTO/);
  assert.match(deployScript, /prisma db execute --stdin --url `\$env:DATABASE_URL/);
  assert.match(deployScript, /\.partial/);
  assert.match(deployScript, /database-backup\.log/);
  assert.match(deployScript, /scan-db-\*\.db/);
});

test('writes the backup script outside the API runner template', () => {
  const apiRunnerTemplateStart = deployScript.indexOf('$apiScript = @"');
  const apiRunnerTemplateEnd = deployScript.indexOf('"@', apiRunnerTemplateStart);
  const backupScriptFunction = deployScript.indexOf('function Write-DatabaseBackupScript');

  assert.ok(apiRunnerTemplateStart >= 0, 'API runner template must exist');
  assert.ok(apiRunnerTemplateEnd >= 0, 'API runner template must close');
  assert.ok(backupScriptFunction > apiRunnerTemplateEnd, 'backup script generator must not be inside API runner template');
});

test('documents daily backup operation in the package and deployment guide', () => {
  for (const content of [packageScript, deploymentGuide]) {
    assert.match(content, /ScanDatabaseBackup/);
    assert.match(content, /C:\\backup/);
    assert.match(content, /database-backup\.log/);
  }

  assert.match(deploymentGuide, /Start-ScheduledTask ScanDatabaseBackup/);
  assert.match(deploymentGuide, /Get-ScheduledTaskInfo ScanDatabaseBackup/);
});
