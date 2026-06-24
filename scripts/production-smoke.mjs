#!/usr/bin/env node
/**
 * Non-mutating production readiness smoke for the public deployment.
 *
 * This script is intentionally environment-driven so Product Green cannot be
 * claimed without a real URL, TLS endpoint, and (optionally) a developer token.
 */

const REQUIRED_BASE_URL = process.env.PRODUCTION_BASE_URL || process.env.PRODUCTION_FRONTEND_BASE_URL;
const API_BASE_URL = process.env.PRODUCTION_API_BASE_URL || REQUIRED_BASE_URL;
const DEVELOPER_TOKEN = process.env.PRODUCTION_DEVELOPER_TOKEN || '';
const PORTAL_HOST = process.env.PRODUCTION_PORTAL_HOST || '';
const ALLOW_HTTP = process.env.ALLOW_INSECURE_PRODUCTION_HTTP === '1';
const ALLOW_NON_PRODUCTION_HOSTS = process.env.PRODUCTION_SMOKE_ALLOW_NON_PRODUCTION_HOSTS === '1';
const EXPECT_FACE_GATEWAY_READY = process.env.EXPECT_FACE_GATEWAY_READY === '1';
const EXPECT_PORTAL_READY = process.env.EXPECT_PORTAL_READY === '1';
const SECRET_VALUES = [
  process.env.FACE_RECOGNITION_HTTP_API_KEY,
  process.env.PRODUCTION_DEVELOPER_TOKEN,
].filter(Boolean);

const results = [];

function redact(value) {
  if (!value) return value;
  return SECRET_VALUES.reduce((text, secret) => String(text).split(secret).join('[REDACTED]'), String(value));
}

function normalizeBaseUrl(raw, name) {
  if (!raw) {
    throw new Error(`${name} is required. Set PRODUCTION_BASE_URL to a real https:// deployment URL.`);
  }
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:' && !ALLOW_HTTP) {
    throw new Error(`${name} must use https:// for production smoke. Set ALLOW_INSECURE_PRODUCTION_HTTP=1 only for local/staging dry runs.`);
  }
  validateProductionHostname(parsed.hostname, name);
  return parsed;
}

function validateProductionHostname(hostname, name) {
  if (ALLOW_NON_PRODUCTION_HOSTS) return;

  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const labels = normalized.split('.');
  const firstLabel = labels[0];
  const privateIpv4Patterns = [
    /^10\./,
    /^127\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./,
    /^0\.0\.0\.0$/,
  ];
  const privateIpv6Patterns = [
    /^::$/,
    /^fc[0-9a-f]{2}:/,
    /^fd[0-9a-f]{2}:/,
    /^fe80:/,
  ];
  const isNonProduction =
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    privateIpv4Patterns.some((pattern) => pattern.test(normalized)) ||
    privateIpv6Patterns.some((pattern) => pattern.test(normalized)) ||
    ['dev', 'development', 'local', 'staging', 'stage', 'test', 'testing'].includes(firstLabel) ||
    labels.some((label) => ['dev', 'development', 'local', 'staging', 'stage', 'test', 'testing'].includes(label));

  if (isNonProduction) {
    throw new Error(`${name} host "${hostname}" looks like a non-production target. Set PRODUCTION_SMOKE_ALLOW_NON_PRODUCTION_HOSTS=1 only for explicit staging/local dry runs; final Product Green requires the real production DNS/TLS host.`);
  }
}

function joinUrl(base, path) {
  const url = new URL(base.toString());
  const relative = path.replace(/^\//, '');
  const queryIndex = relative.indexOf('?');
  const relativePath = queryIndex >= 0 ? relative.slice(0, queryIndex) : relative;
  const relativeSearch = queryIndex >= 0 ? relative.slice(queryIndex) : '';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${relativePath}`.replace(/\/+/g, '/');
  url.search = relativeSearch;
  return url;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.PRODUCTION_SMOKE_TIMEOUT_MS || 10000));
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    return { response, body, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function check(name, fn, { optional = false } = {}) {
  try {
    if (optional) {
      const skippedReason = await fn({ optional: true });
      if (typeof skippedReason === 'string') {
        results.push({ name, status: 'skipped', message: skippedReason });
        return;
      }
      return;
    }
    await fn({ optional: false });
  } catch (error) {
    results.push({ name, status: 'fail', message: redact(error?.message || error) });
  }
}

function pass(name, message, detail = undefined) {
  results.push({ name, status: 'pass', message, detail });
}

function warn(name, message, detail = undefined) {
  results.push({ name, status: 'warn', message, detail });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let frontendBase;
let apiBase;
try {
  frontendBase = normalizeBaseUrl(REQUIRED_BASE_URL, 'PRODUCTION_BASE_URL');
  apiBase = normalizeBaseUrl(API_BASE_URL, 'PRODUCTION_API_BASE_URL');
  if (PORTAL_HOST) validateProductionHostname(PORTAL_HOST, 'PRODUCTION_PORTAL_HOST');
} catch (error) {
  console.error(redact(error.message));
  process.exit(2);
}

await check('frontend_login_page', async () => {
  const url = joinUrl(frontendBase, '/login');
  const { response, text } = await fetchJson(url);
  assert(response.ok, `GET ${url} returned HTTP ${response.status}`);
  assert(!/stack trace|Internal Server Error|Cannot GET \/login/i.test(text), 'login page looks like an error page');
  pass('frontend_login_page', `GET ${url} returned ${response.status}`);
});

await check('api_health', async () => {
  const url = joinUrl(apiBase, '/api/health');
  const { response, body } = await fetchJson(url);
  assert(response.ok, `GET ${url} returned HTTP ${response.status}`);
  assert(body?.success === true && body?.data?.status === 'ok', 'health payload is not success=true/status=ok');
  pass('api_health', `GET ${url} returned healthy payload`);
});

await check('api_v1_health', async () => {
  const url = joinUrl(apiBase, '/api/v1/health');
  const { response, body } = await fetchJson(url);
  assert(response.ok, `GET ${url} returned HTTP ${response.status}`);
  assert(body?.success === true && body?.data?.status === 'ok', 'v1 health payload is not success=true/status=ok');
  pass('api_v1_health', `GET ${url} returned healthy payload`);
});

await check('tenant_portal_domain', async () => {
  if (!PORTAL_HOST) {
    const message = 'PRODUCTION_PORTAL_HOST not set; independent-login DNS/cert cannot be proven in this run';
    if (EXPECT_PORTAL_READY) throw new Error(message);
    warn('tenant_portal_domain', message);
    return;
  }
  const url = joinUrl(apiBase, `/api/auth/portal-config?hostname=${encodeURIComponent(PORTAL_HOST)}`);
  const { response, body } = await fetchJson(url, { headers: { Host: PORTAL_HOST } });
  assert(response.ok, `GET ${url} returned HTTP ${response.status}`);
  assert(body?.success === true && body?.data?.domain, 'portal config did not return an enabled portal domain');
  pass('tenant_portal_domain', `portal host ${PORTAL_HOST} resolved to enabled tenant portal`, { domain: body.data.domain });
});

await check('developer_readiness', async () => {
  if (!DEVELOPER_TOKEN) {
    warn('developer_readiness', 'PRODUCTION_DEVELOPER_TOKEN not set; protected production readiness checks were not executed');
    return;
  }
  const url = joinUrl(apiBase, '/api/developer/readiness');
  const { response, body, text } = await fetchJson(url, {
    headers: { Authorization: `Bearer ${DEVELOPER_TOKEN}` },
  });
  assert(response.ok, `GET ${url} returned HTTP ${response.status}`);
  assert(body?.success === true && Array.isArray(body?.data?.checks), 'readiness payload is not success=true with checks[]');
  SECRET_VALUES.forEach((secret) => {
    assert(!text.includes(secret), 'developer readiness response leaked a configured secret');
  });
  const faceGateway = body.data.checks.find((item) => item.key === 'face_gateway');
  assert(faceGateway, 'readiness checks do not include face_gateway');
  if (EXPECT_FACE_GATEWAY_READY) {
    assert(faceGateway.status === 'ready', `face_gateway is ${faceGateway.status}, expected ready`);
  } else if (faceGateway.status !== 'ready') {
    warn('developer_readiness.face_gateway', 'face gateway is not production-ready in this environment', faceGateway.detail);
  }
  pass('developer_readiness', `protected readiness returned ${body.data.overallStatus}`, {
    overallStatus: body.data.overallStatus,
    checks: body.data.checks.map((item) => ({ key: item.key, status: item.status })),
  });
});

const failed = results.filter((item) => item.status === 'fail');
const warned = results.filter((item) => item.status === 'warn' || item.status === 'skipped');

console.log(JSON.stringify({
  status: failed.length === 0 ? (warned.length === 0 ? 'green' : 'yellow') : 'red',
  generatedAt: new Date().toISOString(),
  frontendBaseUrl: frontendBase.origin,
  apiBaseUrl: apiBase.origin,
  allowNonProductionHosts: ALLOW_NON_PRODUCTION_HOSTS,
  results,
}, null, 2));

if (failed.length > 0) process.exit(1);
if (warned.length > 0) process.exit(3);
