你是 audit_worker。请审查本轮“生产级人脸识别 provider 接入点”改动。

上下文：
- 项目是多租户工程管理系统。
- 用户要求微信/小程序打卡保存照片、定位，并做人脸识别；第三方失败时不得丢打卡数据。
- 本轮改动把 `backend/src/modules/labor/face-provider.ts` 从 stub 扩展为可配置 HTTP 网关 provider，并在劳资考勤页面增加 provider 下拉。

请重点审查：
1. 人脸 provider 配置缺失、网关失败、返回低分时是否安全降级。
2. 是否存在阻断打卡或丢照片定位的风险。
3. 是否有明显凭证泄露风险。
4. 多租户/权限/模块开通是否被绕过。
5. 测试和真实浏览器 smoke 是否覆盖新增路径。

请输出：
- PASS 或 FAIL
- BLOCKERS（如无写 none）
- YELLOW RISKS
- 建议的最小修复项
