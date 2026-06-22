# Bug 修复历史

> 记录资料通工程管理系统的 Bug 修复、问题和经验教训
> 编写时间：2026-05-17

---

## 一、已修复的 Bug

### 2026-04-29 修复

#### 1. inventory.update 安全模式修复
- **问题**：全文件 5 处 `inventory.update` 可能因记录不存在而报错 "Record to update not found"
- **修复**：全部改为 `findFirst` + 条件 `update` 模式
- **涉及场景**：入库删除/编辑时 subProjectId 可能为 null → 回退到待分配库存子项目；出库删除/创建/调拨均加 findFirst 保护
- **文件**：`backend/src/modules/wms/routes.ts`

#### 2. 前端出库登记项目名称显示修复
- **问题 1**：React key 冲突，同名项目只显示一个
- **修复 1**：`key={p.projectName}` 改为 `key={p.subProjectId + p.projectName}`
- **问题 2**：库存表格 key 格式不一致
- **修复 2**：统一为 `subProjectId__materialId__projectName` 格式
- **问题 3**：列名「子项目」语义不清
- **修复 3**：改为「项目名称」
- **文件**：`frontend/src/pages/wms/Outbound.tsx`

#### 3. 入库表单三级联动修复
- **问题**：项目部下拉框未按合同过滤，项目名称无自动建议
- **修复**：项目部按 `contractId` 过滤 + 项目名称输入框添加 datalist 建议
- **文件**：`frontend/src/pages/wms/Inbound.tsx`

#### 4. 入库删除误报出库冲突修复
- **问题**：冲突检测未过滤软删除（`isActive: false`）的出库单
- **修复**：添加 `isActive: true` 过滤条件
- **文件**：`backend/src/modules/wms/routes.ts`

#### 5. contractId 过滤路径修复
- **问题**：`getInboundProjectNames` 中通过 `subProject.contractId` 过滤，但 SubProject 表无此字段
- **修复**：改为 `subProject.department.contractId`
- **文件**：`backend/src/modules/wms/routes.ts`

---

## 二、已知问题（待修复）

### P0 - 必须修复（运行时错误）

| 编号 | 问题 | 文件 | 状态 |
|------|------|------|------|
| P0-1 | JWT Token 中 tenantId 可选，开发者登录后为 undefined | `backend/src/common/utils/jwt.ts` | 待修复 |
| P0-2 | AuthenticatedRequest.user 类型定义必填但可能不赋值 | `backend/src/common/types/index.ts` | 待修复 |
| P0-3 | Excel 导出/解析/OCR 功能为 TODO 空实现 | `backend/src/modules/wms/routes.ts` | 待修复 |
| P0-4 | Role.name 全局唯一导致多租户角色名冲突 | `backend/prisma/schema.prisma` | 待修复 |

### P1 - 高优先级（安全/架构问题）

| 编号 | 问题 | 文件 | 状态 |
|------|------|------|------|
| P1-1 | JWT 默认密钥过于简单，有硬编码兜底值 | `backend/src/common/utils/jwt.ts` | 待修复 |
| P1-2 | CORS 配置 `origin: true` 过于宽松 | `backend/src/app.ts` | 待修复 |
| P1-3 | SQLite 使用了 @db.Decimal（SQLite 不支持，映射为 TEXT） | `backend/prisma/schema.prisma` | 待修复 |

### P2 - 中优先级（功能/设计）

| 编号 | 问题 | 文件 | 状态 |
|------|------|------|------|
| P2-1 | 前端 localStorage token key 不一致兼容问题 | `frontend/src/api/client.ts` | 待修复 |
| P2-2 | 发放记录 personnelId 可选导致风控漏检 | `backend/prisma/schema.prisma` | 待修复 |
| P2-3 | 每个租户只能有一条订阅记录 | `backend/prisma/schema.prisma` | 待修复 |
| P2-4 | API 错误响应格式不统一 | 多处路由文件 | 待修复 |

### P3 - 低优先级（建议改进）

| 编号 | 问题 | 文件 | 状态 |
|------|------|------|------|
| P3-1 | Department.subProjects 删除行为不明确 | `backend/prisma/schema.prisma` | 待修复 |
| P3-2 | 身份证号仅校验格式，不校验校验码 | `backend/src/modules/labor/routes.ts` | 待修复 |
| P3-3 | 前端 API 401 跳转可能在已登录状态下重复触发 | `frontend/src/api/client.ts` | 待修复 |

---

## 三、架构层面发现的问题

### 多租户方案不统一
- WMS 使用 Developer→Company 模型，Labor 使用 tenantId 冗余隔离
- 已统一为 Developer→Tenant 模型

### 合同语义冲突
- WMS 的 Contract 指采购合同，Labor 的 Contract 指承包合同（等于项目）
- 已通过 contractType 字段区分 + 新增 Department 模型

### 角色模型不一致
- WMS 使用动态 Role+Permission 表，Labor 使用枚举 TenantRole
- 已统一为动态 RBAC 模型

### 依赖版本不一致
- WMS 用 Vite 8/React 19.2/TS 6，Labor 用 Vite 5.3/React 19.0/TS 5.5
- 已统一为 Vite 6/React 19/TS 5.5+

---

## 四、经验教训

### 编码规范
- API 接口统一响应格式：`{ success: boolean, data?: any, error?: string }`
- 所有数据库操作使用 Prisma，不直接写 SQL
- 敏感信息通过环境变量管理，不硬编码

### 安全
- JWT Secret 生产环境必须修改，不设硬编码兜底值
- 密码使用 bcryptjs 加密（10 轮 salt）
- 全局限流（express-rate-limit）
- HTTP 安全头（Helmet）

### 数据库
- 所有业务表必须包含 tenantId
- 项目部隔离的表必须包含 departmentId
- 使用 UUID 作为主键
- 软删除使用 isActive 字段，不物理删除
- 金额字段生产环境用 Decimal，开发 SQLite 用 Float

### 前端
- 移动端适配（768px 断点）
- 所有表单需要验证
- 操作反馈用 Toast 提示
- 加载/空状态有对应 UI 组件

---

## 五、历史备份记录

| 日期 | 备份内容 | 备份位置 |
|------|---------|---------|
| 2026-05-17 | 全量项目代码（排除 node_modules/.git/dist/build） | `/Volumes/home/AI备份/projects/资料通工程管理系统/2026-05-09/` |
