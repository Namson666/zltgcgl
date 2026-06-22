## 共享记忆

每次对话开始时，必须先读取 /Volumes/home/AI备份/mem/ 下所有文件。
这是 Namson 所有 AI Agent 的统一真相源，包含：
- 用户画像、沟通偏好、通用规则
- 所有项目的当前状态
- 学习进度（L1→L6 Vibe Coder 路径）
- 各 Agent 的角色和配置
- 最近的重要决策
- 新想法池

学到关于 Namson 的新信息时，写入对应文件。写入规则：
- 追加为主，不删除现有内容
- 标注来源（VS Code Claude）和日期
- 不确定就标注 [待确认]
- 敏感信息不入文件

Cowork Claude 是唯一记忆馆长，负责整体整理和质量把控。
详见 /Volumes/home/AI备份/mem/README.md。

---

# 资料通工程管理系统 — CLAUDE.md

## 项目概述

施工企业的多租户 SaaS 管理平台，整合 **物资管理（WMS）** 和 **劳资管理** 两大模块。技术栈：前端 React 19 + TypeScript + Vite + TailwindCSS 3，后端 Express 4 + TypeScript + Prisma + SQLite。

## 启动方式

```bash
# 后端（port 4001，自动热重载）
cd backend && npm run dev

# 前端（port 5173，代理 /api → localhost:4001）
cd frontend && npm run dev
```

## 核心架构约束（重要！）

### 三级数据隔离

```
合同(Contract) → 项目部(Department) → 项目名称(projectName)
    一级              二级                三级
```

- 一个合同可有多个项目部，一个项目部可有多个项目名称
- **每层之间数据隔离**：跨项目部/项目名称的库存不能混淆
- 未来权限规则也将按此三级结构设置
- 所有 WMS 查询/操作必须遵循此层级过滤

### 库存唯一键

`Inventory` 模型复合唯一键：`@@unique([subProjectId, materialId, projectName])`

`projectName = null` 表示"待分配库存"，用于未指定项目名称的物资。

## 关键模型

| 领域 | 模型 |
|------|------|
| 核心结构 | Contract, Department, SubProject, Supplier, WorkTeam |
| 入库 | InboundOrder + InboundItem → 写入 Inventory |
| 出库 | OutboundOrder + OutboundItem → 扣减 Inventory |
| 退库 | ReturnOrder + ReturnItem → 恢复 Inventory |
| 调拨 | TransferOrder + TransferItem → A→B Inventory |
| 送货单 | DeliveryOrder + OCR 识别 → 自动生成入库单 |
| 权限 | User, Role, Permission（动态 RBAC） |
| 租户 | Tenant（多租户隔离，软删除 deletedAt） |

## 近期已修复的问题

### 1. inventory.update 安全模式（2026-04-29）
全文件 5 处 `inventory.update` 全部改为 `findFirst` + 条件 `update` 模式，防止 "Record to update not found" 错误：
- 入库删除/编辑时 subProjectId 可能为 null → 回退到「待分配库存」子项目
- 出库删除/创建/调拨均加 findFirst 保护

### 2. 前端出库登记项目名称显示（2026-04-29）
- React key 冲突：`key={p.projectName}` 改为 `key={p.subProjectId + p.projectName}`，修复同名项目只显示一个
- 库存表格 key 统一为 `subProjectId__materialId__projectName` 格式
- 列名「子项目」改为「项目名称」

### 3. 入库表单三级联动（2026-04-29）
- 项目部下拉框按合同过滤（`filteredDepartments = depts.filter(d => d.contractId === selectedContractId)`）
- 项目名称输入框改为带 datalist 建议，根据已选项目部加载已有项目名称

### 4. 入库删除误报出库冲突（2026-04-29）
冲突检测未过滤软删除（`isActive: false`）的出库单 → 加了 `isActive: true` 条件

### 5. contractId 过滤路径修复（2026-04-29）
`getInboundProjectNames` 中 `contractId` 过滤从错误的 `subProject.contractId`（SubProject 表无此字段）改为 `subProject.department.contractId`

## 文件要点

| 文件 | 说明 |
|------|------|
| `backend/src/modules/wms/routes.ts` | 全部 WMS 路由（约 4000 行），包含入库/出库/送货/退库/调拨/库存/班组 |
| `frontend/src/pages/wms/Inbound.tsx` | 入库管理页：手动录入 + Excel 导入 + OCR 识别 |
| `frontend/src/pages/wms/Outbound.tsx` | 出库管理页：多项目选择 + 库存勾选 + PDF 下载 |
| `backend/prisma/schema.prisma` | 37 个模型定义 |

## 交互约定

- 用中文交流，代码注释保持英文
- 用户是技术小白，解释需通俗易懂，说明"为什么"这样做
- 修改代码时考虑关联位置，不只看一处改一处
- 调试→修复→验证 三步骤，确认成功后再交付

## Cowork 升级机制
同一问题3次未解决，追加到 `/Users/Namson/dev-bridge/escalation.md`：
```
## [issue-{序号}] {时间}
项目: 工程系统
问题: {描述}
尝试1: {简述} → ❌ {原因}
尝试2: {简述} → ❌ {原因}
尝试3: {简述} → ❌ {原因}
→ 已升级到 Cowork
```
然后对用户说「已升级到 Cowork」。Cowork 出方案后读取 `## [issue-{序号}-solution]` 执行。
