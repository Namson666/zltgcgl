你是 audit_worker。请审查本次 WMS 库存/班组台账导出与净数量切片，重点看是否存在阻塞问题。

范围：
- backend/src/modules/wms/service.ts
- backend/src/modules/wms/routes.ts
- backend/src/modules/wms/service.test.ts
- frontend/src/api/index.ts
- frontend/src/pages/wms/Materials.tsx
- frontend/src/pages/wms/Ledger.tsx
- frontend/tests/smoke/browser-smoke.spec.ts

已完成验证：
- focused real Chrome: enterprise user can export wms inventory and work team ledger with net quantities 1/1 passed
- bash scripts/verify.sh passed: backend 7 files / 50 tests, backend build, frontend 2 files / 36 tests, frontend build
- full real Chrome smoke: 29/29 passed
- code-review-graph risk 0.50; static gaps remain but backend service tests and Chrome test cover the changed behavior

审查要求：
1. 库存导出是否复用当前 active stock/filter 语义，且 SQLite-safe contains 不再用 unsupported mode。
2. 班组台账列表/导出是否只使用 active outbound orders，并且退库数量只统计 active return orders。
3. 前端导出按钮是否实际下载 blob，文件名/成功提示是否与测试一致。
4. 真实 Chrome 是否覆盖：入库10、出库4、退库1 => 库存7，台账净领用3，库存汇总/已出库/班组台账三个下载。
5. 确认没有恢复库存预警/低库存功能。

请输出：PASS/WARN/FAIL；BLOCKERS；YELLOW RISKS；简短证据。
