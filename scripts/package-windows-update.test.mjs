import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const projectRoot = new URL('..', import.meta.url).pathname;

test('update package excludes all database files and ScanData', async (context) => {
  const releaseDir = await mkdtemp(join(tmpdir(), 'scan-update-package-'));
  context.after(() => rm(releaseDir, { recursive: true, force: true }));

  execFileSync('bash', ['scripts/package-windows.sh'], {
    cwd: projectRoot,
    env: { ...process.env, SCAN_PACKAGE_MODE: 'update', SCAN_RELEASE_DIR: releaseDir },
    stdio: 'pipe'
  });

  const [packageName] = execFileSync('find', [releaseDir, '-name', '*.zip', '-maxdepth', '1'], {
    encoding: 'utf8'
  }).trim().split('\n');
  const entries = execFileSync('unzip', ['-Z1', packageName], { encoding: 'utf8' });

  assert.doesNotMatch(entries, /^ScanData\//m);
  assert.doesNotMatch(entries, /(^|\/)scan\.db$/m);
  assert.match(entries, /^Scan\/scripts\/deploy-windows\.ps1$/m);
  assert.match(entries, /^README-WINDOWS\.txt$/m);
});
