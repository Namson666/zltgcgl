# 资料通工程管理系统 - Bug 和问题修复文档

> 本文档记录开发过程中遇到的问题、Bug 修复和经验教训，避免在后续开发中重复犯错。
> 最后更新时间：2026-04-24

---

## 一、现有系统分析中发现的问题

### 1.1 多租户方案不统一

**问题描述**：
- WMS 使用 Developer→Company 关系模型（Prisma 关系级联）
- Labor 使用 tenantId 字段冗余隔离
- 两个系统的租户概念不同，合并时需要统一

**解决方案**：
- 统一采用 Developer→Tenant 关系模型
- 数据隔离级别提升到 Department（项目部）级别
- 使用 Prisma 中间件全局自动注入过滤条件

**经验教训**：
- 新系统从一开始就应该统一多租户方案
- 数据隔离应该在 ORM 层面实现，而不是在每个路由中手动过滤

### 1.2 合同语义冲突

**问题描述**：
- WMS 的 Contract 指供应商采购合同
- Labor 的 Contract 指承包合同（实际等于项目）
- 两个系统的"合同"概念完全不同

**解决方案**：
- 新系统中区分两种合同类型（通过 contractType 字段）
- 新增 Department（项目部）模型，作为数据隔离的核心
- Labor 的 Contract 拆分为 Contract + Department

**经验教训**：
- 命名应该准确反映业务含义
- 不同业务领域的相同术语需要明确区分

### 1.3 角色模型不一致

**问题描述**：
- WMS 使用动态 Role + Permission 表（灵活）
- Labor 使用枚举 TenantRole（OWNER/FINANCE/LABOR，不灵活）
- 合并时需要统一

**解决方案**：
- 统一使用动态 Role + Permission 模型
- 扩展 Permission 表增加更多权限字段
- 种子数据中预定义 8 种角色

**经验教训**：
- 权限系统应该从一开始就使用动态模型
- 枚举方式的权限系统扩展性差

### 1.4 依赖版本不一致

**问题描述**：
- WMS 使用 Vite 8、React 19.2、TypeScript 6
- Labor 使用 Vite 5.3、React 19.0、TypeScript 5.5
- 合并时需要统一版本

**解决方案**：
- 统一使用较新的版本（Vite 6+、React 19+、TypeScript 5.5+）
- 前端统一 package.json 管理依赖

**经验教训**：
- 多项目应该共享依赖版本管理（Monorepo）
- 定期同步依赖版本

---

## 二、开发过程中的问题

### 2.1 （待补充）

> 在开发过程中遇到的问题将记录在此处。

---

## 三、经验总结

### 3.1 编码规范

- [x] 所有代码必须添加详细中文注释
- [x] API 接口统一响应格式：`{ success: boolean, data?: any, error?: string }`
- [x] 所有数据库操作使用 Prisma，不直接写 SQL
- [x] 敏感信息（密码、API Key）通过环境变量管理，不硬编码

### 3.2 安全注意事项

- [x] JWT Secret 生产环境必须修改
- [x] 密码使用 bcryptjs 加密（10 轮 salt）
- [x] 所有 API 需要认证（除登录/注册）
- [x] 文件上传限制大小和类型
- [x] 使用 Helmet 设置安全 HTTP 头
- [x] 使用 CORS 限制跨域访问
- [x] 使用 express-rate-limit 限流

### 3.3 数据库注意事项

- [x] 所有业务表必须包含 tenantId 字段
- [x] 需要项目部隔离的表必须包含 departmentId 字段
- [x] 使用 UUID 作为主键
- [x] 软删除使用 isActive 字段，不物理删除
- [x] 金额字段使用 Decimal 类型，不使用 Float

### 3.4 前端注意事项

- [x] 使用 TailwindCSS 统一样式
- [x] 移动端适配（768px 断点）
- [x] 所有表单需要验证
- [x] 操作成功/失败使用 Toast 提示
- [x] 加载状态使用 Loading 组件
- [x] 空状态使用 EmptyState 组件
