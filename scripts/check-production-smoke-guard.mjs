#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, 'production-smoke.mjs');

function run(env) {
  return spawnSync(process.execPath, [scriptPath], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 5000,
  });
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    console.error(message);
    console.error(JSON.stringify(detail, null, 2));
    process.exit(1);
  }
}

function expectExit2(name, env, pattern) {
  const result = run(env);
  const output = `${result.stdout}\n${result.stderr}`;
  assert(result.status === 2, `${name}: expected exit code 2`, {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  assert(pattern.test(output), `${name}: expected output to match ${pattern}`, {
    output,
  });
}

expectExit2(
  'missing production URL',
  {},
  /PRODUCTION_BASE_URL is required/,
);

expectExit2(
  'http URL without explicit local override',
  { PRODUCTION_BASE_URL: 'http://example.com' },
  /must use https:\/\//,
);

expectExit2(
  'localhost URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://localhost' },
  /looks like a non-production target/,
);

expectExit2(
  'ipv6 localhost URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://[::1]' },
  /looks like a non-production target/,
);

expectExit2(
  'ipv6 unspecified URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://[::]' },
  /looks like a non-production target/,
);

expectExit2(
  'ipv6 unique local URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://[fd00::1]' },
  /looks like a non-production target/,
);

expectExit2(
  'ipv6 link-local URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://[fe80::1]' },
  /looks like a non-production target/,
);

expectExit2(
  '.local URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://tenant.local' },
  /looks like a non-production target/,
);

expectExit2(
  '.localhost URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://api.dev.localhost' },
  /looks like a non-production target/,
);

expectExit2(
  'staging URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://staging.example.com' },
  /looks like a non-production target/,
);

expectExit2(
  'dev URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://dev.example.com' },
  /looks like a non-production target/,
);

expectExit2(
  'inner dev label URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://tenant.dev.example.com' },
  /looks like a non-production target/,
);

expectExit2(
  'test URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://test.example.com' },
  /looks like a non-production target/,
);

expectExit2(
  'loopback IP URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://127.0.0.1' },
  /looks like a non-production target/,
);

expectExit2(
  '10/8 private IP URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://10.0.0.5' },
  /looks like a non-production target/,
);

expectExit2(
  '172.16/12 private IP URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://172.20.0.5' },
  /looks like a non-production target/,
);

expectExit2(
  'private IP URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://192.168.1.10' },
  /looks like a non-production target/,
);

expectExit2(
  'link-local IP URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://169.254.1.10' },
  /looks like a non-production target/,
);

expectExit2(
  'unspecified IP URL rejected by default',
  { PRODUCTION_BASE_URL: 'https://0.0.0.0' },
  /looks like a non-production target/,
);

expectExit2(
  'portal host rejected by default',
  {
    PRODUCTION_BASE_URL: 'https://example.com',
    PRODUCTION_PORTAL_HOST: 'tenant.localhost',
  },
  /PRODUCTION_PORTAL_HOST host "tenant.localhost" looks like a non-production target/,
);

const stagingDryRun = run({
  PRODUCTION_SMOKE_ALLOW_NON_PRODUCTION_HOSTS: '1',
  PRODUCTION_BASE_URL: 'https://staging.example.com',
  PRODUCTION_SMOKE_TIMEOUT_MS: '50',
});
assert(stagingDryRun.status !== 2, 'explicit staging dry-run override should pass invocation validation', {
  status: stagingDryRun.status,
  stdout: stagingDryRun.stdout,
  stderr: stagingDryRun.stderr,
});
assert(/"allowNonProductionHosts": true/.test(stagingDryRun.stdout), 'staging dry-run evidence should disclose non-production host override', {
  stdout: stagingDryRun.stdout,
  stderr: stagingDryRun.stderr,
});

console.log('Production smoke guard check passed.');
