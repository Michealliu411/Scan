import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const deployScript = await readFile(new URL('./deploy-windows.ps1', import.meta.url), 'utf8');
const packageScript = await readFile(new URL('./package-windows.sh', import.meta.url), 'utf8');
const deploymentGuide = await readFile(new URL('../docs/WINDOWS_DEPLOYMENT.md', import.meta.url), 'utf8');

function readFunctionBody(name) {
  const start = deployScript.indexOf(`function ${name} {`);
  const next = deployScript.indexOf('\nfunction ', start + 1);

  assert.ok(start >= 0, `${name} must exist`);
  return deployScript.slice(start, next >= 0 ? next : undefined);
}

test('restarts API and web together after terminating residual project node processes', () => {
  const restartFunction = readFunctionBody('Restart-ScanServices');

  assert.match(restartFunction, /Stop-ScanTask "ScanApi"/);
  assert.match(restartFunction, /Stop-ScanTask "ScanWeb"/);
  assert.match(restartFunction, /Stop-ProjectNodeProcesses \$ProjectRoot/);
  assert.match(restartFunction, /Assert-PortsReleased @\(\$ApiPort, \$WebPort\)/);
  assert.match(restartFunction, /Start-ScheduledTask -TaskName "ScanApi"/);
  assert.match(restartFunction, /Start-ScheduledTask -TaskName "ScanWeb"/);

  const stopApi = restartFunction.indexOf('Stop-ScanTask "ScanApi"');
  const stopWeb = restartFunction.indexOf('Stop-ScanTask "ScanWeb"');
  const stopProcesses = restartFunction.indexOf('Stop-ProjectNodeProcesses $ProjectRoot');
  const assertPorts = restartFunction.indexOf('Assert-PortsReleased @($ApiPort, $WebPort)');
  const startApi = restartFunction.indexOf('Start-ScheduledTask -TaskName "ScanApi"');
  const startWeb = restartFunction.indexOf('Start-ScheduledTask -TaskName "ScanWeb"');

  assert.ok(stopApi < stopWeb);
  assert.ok(stopWeb < stopProcesses);
  assert.ok(stopProcesses < assertPorts);
  assert.ok(assertPorts < startApi);
  assert.ok(startApi < startWeb);
});

test('uses the reliable restart for restart mode and deployment completion', () => {
  const restartCalls = deployScript.match(/Restart-ScanServices \$ProjectRoot \$ApiPort \$WebPort/g) ?? [];

  assert.equal(restartCalls.length, 2);
  assert.doesNotMatch(deployScript, /Restart-ScanTask "ScanApi"/);
  assert.doesNotMatch(deployScript, /Restart-ScanTask "ScanWeb"/);
});

test('fails deployment when ports stay occupied or health checks do not recover', () => {
  const portFunction = readFunctionBody('Assert-PortsReleased');
  const healthFunction = readFunctionBody('Wait-HttpEndpoint');

  assert.match(portFunction, /Get-NetTCPConnection/);
  assert.match(portFunction, /Get-CimInstance[\s`]+Win32_Process/);
  assert.match(portFunction, /throw/);
  assert.match(healthFunction, /Invoke-WebRequest/);
  assert.match(healthFunction, /TimeoutSeconds/);
  assert.match(healthFunction, /throw/);
  assert.doesNotMatch(deployScript, /function Test-HttpEndpoint/);
  assert.equal((deployScript.match(/Wait-HttpEndpoint "API"/g) ?? []).length, 2);
  assert.equal((deployScript.match(/Wait-HttpEndpoint "Web"/g) ?? []).length, 2);
});

test('documents residual process cleanup in deployment and package instructions', () => {
  for (const content of [packageScript, deploymentGuide]) {
    assert.match(content, /residual Node processes/i);
    assert.match(content, /ScanApi.*ScanWeb/s);
    assert.match(content, /ports? 3000.*8080/is);
    assert.match(content, /health checks? must pass/i);
  }
});
