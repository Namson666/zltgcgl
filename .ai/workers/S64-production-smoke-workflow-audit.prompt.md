你是 audit_worker。请审查本轮 S64 “Production Smoke workflow + runbook + status handoff”改动。

背景：
- 用户要求全程 Superpowers Pro，并且不能把 Build Green / Browser Green 当成 Product Green。
- Product Green 仍必须等真实生产 HTTPS/DNS/证书、独立登录域名、真实第三方人脸识别网关凭证全部通过。
- 库存预警 / inventory alert 已被用户删除，不得恢复。

请重点审查：
1. `.github/workflows/production-smoke.yml` 是否会在 `scripts/production-smoke.mjs` 返回 1/2/3 时错误通过，尤其注意 `tee` 管道。
2. workflow 是否会泄漏 `PRODUCTION_DEVELOPER_TOKEN` 或 `FACE_RECOGNITION_HTTP_API_KEY`。
3. workflow 的输入和 secret 设计是否能证明真实生产域名、独立登录域名、人脸网关 readiness。
4. `docs/production-smoke-runbook.md` 是否清楚说明 Product Green 条件与 Yellow/Red 的区别。
5. README 和 `.ai/*` 状态是否仍诚实：CI Green 已验证，但 Product Green 仍 Yellow。
6. 是否有任何库存预警恢复、破坏 CI、或外部写操作风险。

本地验证证据：
- `node --check scripts/production-smoke.mjs`
- JSON parse OK for `.ai/PROJECT_STATUS.json`, `.ai/REQUIRED_ACTION_CONTRACT.json`, `.ai/TEST_STATUS.json`
- Ruby YAML parse OK for `.github/workflows/production-smoke.yml` and `.github/workflows/ci.yml`
- `node scripts/production-smoke.mjs` without `PRODUCTION_BASE_URL` exits 2 with clear error
- `bash scripts/verify.sh` passed backend 61 + frontend 38 + builds + route matrix
- `code-review-graph build --skip-flows && code-review-graph detect-changes` risk 0.00 / 0 gaps

请给出：
- PASS/WARN/FAIL
- 阻塞问题列表
- Yellow follow-ups
- 是否可以提交推送
