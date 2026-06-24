你是 audit_worker。请审查本轮 S66 “交付需求-证据矩阵”改动。

背景：
- 用户目标：实现今天提出的重构功能需求，完成真机/真实浏览器测试并交付；必须使用 code-review-graph。
- 当前 CI / 真实浏览器 smoke 已绿，但 Product Green 仍 Yellow，因为真实生产 HTTPS/DNS/证书、真实第三方人脸网关凭证、用户验收未完成。
- 用户明确删除库存预警 / inventory alert，不得恢复。

本轮改动：
- 新增 `.ai/DELIVERY_EVIDENCE_MATRIX.json`：列出用户明确需求、状态、证据文件和外部剩余证据。
- 新增 `scripts/check-delivery-evidence-matrix.mjs`：校验矩阵 status 合法、证据文件存在、external_yellow 必须写 remaining_external_evidence、Product Green 不得提前变 Green、库存预警不得回到验收矩阵。
- `scripts/verify.sh` 接入 delivery evidence matrix check。
- README 增加 S66 说明。

本地验证：
- `node scripts/check-delivery-evidence-matrix.mjs` PASS：12 requirements + 2 invariants。
- `bash scripts/verify.sh` PASS：backend 61、frontend 38、builds、route matrix、production smoke guard、delivery evidence matrix。
- `code-review-graph build --skip-flows && code-review-graph detect-changes` risk 0.60；static gaps 来自 CLI guard scripts 和 production-smoke helper，均由 verify/runtime subprocess 覆盖。

请重点审查：
1. 矩阵是否覆盖用户今天明确提出的需求：模块开通、独立登录、合同三 tab、小程序分流、人员照片/人脸、打卡规则/异常/信任地、WMS 删除库存预警、劳资/财务/开发者核心后台、Production Smoke、用户验收。
2. 是否存在假绿：Product Green / User Green 是否仍 Yellow/未验证。
3. evidence 文件是否是实际存在且相关的证据，不是空洞引用。
4. 校验脚本是否能防止矩阵腐烂或库存预警回流。
5. 是否有阻塞问题、需要补的 Yellow follow-ups、是否可提交推送。
