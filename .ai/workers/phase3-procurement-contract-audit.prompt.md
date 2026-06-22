你是 audit_worker。请审查当前 git diff 中“采购合同工作流”切片，范围只包括：

- Prisma schema / migration：Contract.parentContractId、ContractPayment、索引。
- 后端合同接口：采购合同关联承包合同、采购付款记录、附件分类查询/上传。
- 前端合同页面：采购合同 tab、关联承包合同、供应商列表解析、付款记录、发票/付款凭证上传下载删除。
- Playwright 真实 Chrome smoke：录入、上传、下载、删除、开发者后台冒烟。

请重点寻找阻塞级问题：

1. 租户隔离是否可能越权读取/关联/写入其他企业数据。
2. 采购合同是否错误依赖审批流程，或未按“不需要审批”执行。
3. 附件分类是否会混淆合同附件、采购发票、付款凭证。
4. 浏览器测试是否只是虚假断言，是否真的覆盖上传/下载/删除和付款记录。
5. schema 与 migration 是否存在明显漂移。
6. 有没有前端运行时白屏风险或接口返回结构不兼容风险。

请输出：

- BLOCKERS：必须修复后才能提交的问题。
- NON_BLOCKING：可后续优化的问题。
- VERIFICATION_REVIEW：对本轮 `bash scripts/verify.sh` 与 `bash scripts/browser-smoke.sh` 的覆盖评价。

如果没有阻塞问题，请明确写 `BLOCKERS: none`。
