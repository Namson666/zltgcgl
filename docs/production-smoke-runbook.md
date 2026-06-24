# Production Smoke Runbook

This project must not claim Product Green from local build/tests alone. The final external gate is a non-mutating production smoke against the real HTTPS deployment, DNS/reverse proxy/certificate path, independent tenant login host, and real face-recognition gateway configuration.

## Local command

```bash
PRODUCTION_BASE_URL=https://your-web-domain.example \
PRODUCTION_API_BASE_URL=https://your-api-domain.example \
PRODUCTION_PORTAL_HOST=tenant-login.example \
PRODUCTION_DEVELOPER_TOKEN=*** \
EXPECT_PORTAL_READY=1 \
EXPECT_FACE_GATEWAY_READY=1 \
node scripts/production-smoke.mjs > docs/smoke-evidence/production-smoke-$(date -u +%Y%m%dT%H%M%SZ).json
```

Exit codes:

- `0`: Green. No failed or Yellow checks.
- `1`: Red. At least one required production check failed.
- `2`: Invalid invocation, usually missing `PRODUCTION_BASE_URL`.
- `3`: Yellow. The deployment answered, but optional/production-critical evidence is incomplete.

## GitHub Actions manual run

Use the `Production Smoke` workflow from GitHub Actions after deployment.

Required workflow input:

- `production_base_url`: real public frontend URL, must be `https://`.

Required for final Product Green:

- `production_api_base_url`: real API URL when API is not served from the same origin.
- `production_portal_host`: independent tenant login domain to prove DNS/cert/portal routing.
- `expect_portal_ready`: keep `true` for final Product Green.
- `expect_face_gateway_ready`: keep `true` for final Product Green.

Do not turn `expect_portal_ready` or `expect_face_gateway_ready` off for a final acceptance run. Turning either off intentionally downgrades the run to Yellow evidence only.

The smoke script rejects obvious non-production hosts by default, including `localhost`, private IP ranges, `.local`, and `dev`/`staging`/`test` host labels. For an explicit staging or local rehearsal only, set `PRODUCTION_SMOKE_ALLOW_NON_PRODUCTION_HOSTS=1`; never set it for final Product Green.

The JSON artifact includes `allowNonProductionHosts`; final Product Green requires it to be `false`. The `production_portal_host` value must exactly match the real production DNS/CNAME host for the independent login page.

Required repository/environment secret for protected readiness:

- `PRODUCTION_DEVELOPER_TOKEN`: a real developer/admin bearer token with access to `/api/developer/readiness`.

Optional redaction helper:

- `FACE_RECOGNITION_HTTP_API_KEY`: only used for output redaction if a downstream response accidentally includes it.

## Product Green rule

Product Green can only be claimed when:

- the production workflow or local command exits `0`;
- the artifact JSON is saved under `docs/smoke-evidence/` or attached to the GitHub workflow run;
- the run used the real production DNS/TLS endpoints, not localhost/staging/test hosts;
- `allowNonProductionHosts` in the JSON artifact is `false`;
- the protected readiness check proves `face_gateway` is `ready`;
- the latest CI build/test and real browser smoke are also Green.
