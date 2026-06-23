请作为独立审查员审查本次小程序打卡分流验收切片。

范围：
- `frontend/tests/smoke/browser-smoke.spec.ts`
  - 新增测试辅助函数：
    - `loginSmokeTenant`
    - `ensureSmokeDepartment`
    - `createSmokePersonnel`
  - 新增真机 Chrome 用例：
    - `mini-program check-in does not silently route duplicated phone and tenant app routes directly`

业务要求背景：
- 开发者默认小程序按手机号匹配人员。
- 如果同一个手机号命中多个企业，不能静默打卡，必须返回需要选择企业/管理员预绑定的冲突结果。
- 企业自有小程序通过 appId 直接分流到该企业。
- 成功打卡应关联正确企业、正确人员，并保留照片。

请重点检查：
1. 新用例是否真正构造了两个企业、同手机号人员。
2. 默认小程序 appId 打卡是否断言 409 `MULTIPLE_TENANTS`，并断言候选企业包含两个企业。
3. 冲突场景是否证明没有静默写入打卡记录。
4. 企业自有 appId 是否断言成功写到目标企业/目标人员，而另一个企业没有写入。
5. 是否存在测试顺序污染、默认 appId 污染、权限 token 错用、身份证号碰撞、临时文件风险。
6. 是否误恢复库存预警或改变业务逻辑。

已跑验证：
- Focused real Chrome: `cd frontend && npx playwright test tests/smoke/browser-smoke.spec.ts --grep "mini-program check-in does not silently route"` => 1/1 pass
- `bash scripts/verify.sh` => backend 57/57 + frontend 36/36 + builds pass
- Full real Chrome: `bash scripts/browser-smoke.sh` => 35/35 pass
- `code-review-graph build --skip-flows && code-review-graph detect-changes` => risk 0.60, no affected flows; static gaps are test helpers/listCheckIns covered by the new focused/full Chrome test.

请输出：
- 阻塞问题（如有）
- 非阻塞建议（如有）
- 是否认可本 slice 可提交
