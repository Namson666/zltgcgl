你是 audit_worker。请审查当前 git diff 中“分包合同工作流”切片，范围只包括：

- Prisma schema / migration：SubContract.workTeamId、WorkTeam.subContracts、迁移 SQL。
- 后端合同接口：合同基础板块下的分包合同 CRUD、只读班组列表、分包付款记录、付款/结算凭证附件。
- 前端合同页面：分包合同 tab 新建/编辑/删除、关联承包合同、关联班组、详情、付款记录、付款凭证/结算凭证上传下载删除。
- Playwright 真实 Chrome smoke：分包合同录入、付款、上传、下载、删除。

请重点寻找阻塞级问题：

1. 租户隔离是否可能越权读取/关联/写入其他企业数据。
2. 合同基础板块是否错误依赖 wms/labor 模块开通。
3. 分包合同是否错误引入审批流程，或与“不需要审批”冲突。
4. 付款凭证和结算凭证附件分类是否可能混淆。
5. 浏览器测试是否真的覆盖分包合同录入、付款、上传、下载、删除。
6. schema 与 migration 是否明显漂移。
7. 是否存在前端运行时白屏风险或接口返回结构不兼容风险。

请输出：

- BLOCKERS：必须修复后才能提交的问题。
- NON_BLOCKING：可后续优化的问题。
- VERIFICATION_REVIEW：对本轮 `bash scripts/verify.sh`、`bash scripts/browser-smoke.sh`、Prisma validate 的覆盖评价。

如果没有阻塞问题，请明确写 `BLOCKERS: none`。
