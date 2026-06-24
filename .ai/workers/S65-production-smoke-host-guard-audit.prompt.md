你是 audit_worker。请审查本轮 S65 “production-smoke 非生产主机防误用 guard”改动。

背景：
- 用户要求全程 Superpowers Pro，交付前必须真机/真实浏览器验收，不能把 CI Green 当 Product Green。
- S64 已新增手动 GitHub Actions Production Smoke workflow；本轮是在 `scripts/production-smoke.mjs` 里补强最终 Product Green 的输入防护。
- 目标：默认拒绝明显非生产目标（localhost、私网 IP、.local、dev/staging/test host label），避免误把 staging/local run 当最终 Product Green。只有显式 `PRODUCTION_SMOKE_ALLOW_NON_PRODUCTION_HOSTS=1` 才允许 staging/local dry-run。
- 库存预警 / inventory alert 已被用户删除，不得恢复。

请重点审查：
1. `scripts/production-smoke.mjs` 的 `validateProductionHostname` 是否能覆盖 localhost、127/10/172.16-31/192.168/169.254/0.0.0.0、`.local`、`staging/dev/test` 等明显非生产 host。
2. 该 guard 是否仍允许显式 staging/local rehearsal：`PRODUCTION_SMOKE_ALLOW_NON_PRODUCTION_HOSTS=1`。
3. 是否会破坏真实生产域名、HTTPS 要求、portal host 检查、secret redaction。
4. `scripts/check-production-smoke-guard.mjs` 是否确实覆盖新增函数的关键分支，且已接入 `scripts/verify.sh`。
5. `docs/production-smoke-runbook.md` 是否准确说明最终 Product Green 不能使用 localhost/staging/test。
6. 是否有任何库存预警恢复、外部写操作、或 Product Green 误报。

本地验证证据：
- `node --check scripts/production-smoke.mjs`
- `node scripts/check-production-smoke-guard.mjs` PASS
- `bash scripts/verify.sh` PASS：backend 61、frontend 38、builds、route matrix、production smoke guard
- `code-review-graph build --skip-flows && code-review-graph detect-changes` risk 0.60，2 个 static gaps 指向 `normalizeBaseUrl` / `validateProductionHostname`；这些分支由 `scripts/check-production-smoke-guard.mjs` runtime subprocess assertions 覆盖，但 graph 没识别为 test 文件。

请给出：
- PASS/WARN/FAIL
- 阻塞问题列表
- Yellow follow-ups
- 是否可以提交推送
