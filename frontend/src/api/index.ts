/**
 * 资料通工程管理系统 - API 接口统一封装
 *
 * 功能说明：
 * 将所有后端 API 接口按模块分组封装，提供类型安全的调用方式。
 * 所有方法返回 Promise，调用方通过 async/await 处理响应。
 *
 * 模块划分：
 * - authApi: 认证相关（登录、注册、密码修改等）
 * - developerApi: 开发者后台（租户管理、AI/OCR 配置等）
 * - tenantApi: 租户/项目部管理（用户、角色、部门等）
 * - subscriptionApi: 订阅与套餐管理
 * - contractApi: 合同管理
 * - departmentApi: 项目部管理（子项目、成员等）
 * - wmsApi: 物资管理系统
 * - laborApi: 劳资管理系统
 * - logApi: 操作日志
 */

import { http, ocrClient } from './client';

/* ========================================
 * 通用类型定义
 * ======================================== */

/** 分页请求参数 */
export interface PaginationParams {
  page?: number;                  /* 当前页码，从 1 开始 */
  pageSize?: number;              /* 每页条数 */
  keyword?: string;               /* 搜索关键词 */
  search?: string;                /* 搜索关键词（兼容后端 search 参数） */
  sortBy?: string;                /* 排序字段 */
  sortOrder?: 'asc' | 'desc';     /* 排序方向 */
}

/** 分页响应数据 */
export interface PaginatedResponse<T> {
  items: T[];                     /* 数据列表 */
  total: number;                  /* 总条数 */
  page: number;                   /* 当前页码 */
  pageSize: number;               /* 每页条数 */
  totalPages: number;             /* 总页数 */
}

/** 通用 API 响应结构 */
export interface ApiResponse<T = any> {
  code: number;                   /* 状态码 */
  message: string;                /* 响应消息 */
  data: T;                        /* 响应数据 */
}

/* ========================================
 * 1. 认证模块 API (authApi)
 * 处理用户登录、登出、密码管理、租户切换等
 * ======================================== */
export const authApi = {
  /**
   * 开发者登录
   * @param params - 用户名和密码
   * @returns 登录令牌和用户信息
   */
  developerLogin: (params: { username: string; password: string }) =>
    http.post('/auth/developer/login', params),

  /**
   * 企业用户登录
   * @param params - 企业代码、用户名和密码
   * @returns 登录令牌和用户信息
   */
  userLogin: (params: { tenantCode?: string; portalHost?: string; username: string; password: string }) =>
    http.post('/auth/user/login', params),

  /**
   * 按当前访问域名获取企业独立登录页配置
   */
  getPortalConfig: (hostname: string) =>
    http.get('/auth/portal-config', { hostname }),

  /**
   * 获取当前登录用户信息
   * 用于刷新用户数据和权限
   * @returns 当前用户详细信息
   */
  getMe: () =>
    http.get('/auth/me'),

  /**
   * 修改密码
   * @param params - 旧密码和新密码
   */
  changePassword: (params: { oldPassword: string; newPassword: string }) =>
    http.put('/auth/password', params),

  /**
   * 进入租户（切换项目部）
   * 开发者切换到指定租户进行管理
   * @param tenantId - 目标租户 ID
   */
  enterTenant: (tenantId: string) =>
    http.post(`/auth/developer/enter-tenant/${tenantId}`),

  /**
   * 退出租户
   * 从当前租户退出，返回开发者视角
   */
  exitTenant: () =>
    http.post('/auth/developer/exit-tenant'),

  /**
   * 用户自注册
   * 注册新企业并自动创建管理员账号，开启30天全功能试用
   * @param params - 注册信息
   */
  register: (params: {
    companyName: string;
    contactName: string;
    phone: string;
    password: string;
    username?: string;
  }) =>
    http.post('/auth/register', params),
};

/* ========================================
 * 2. 开发者模块 API (developerApi)
 * 开发者后台管理功能：租户管理、AI/OCR 配置等
 * ======================================== */
export const developerApi = {
  /**
   * 获取开发者看板统计数据
   */
  getDashboard: () =>
    http.get('/developer/dashboard'),

  /**
   * 获取综合统计数据
   */
  getStats: () =>
    http.get('/developer/stats'),

  /**
   * 获取按企业用量排行
   */
  getUsageRanking: (params?: { sortBy?: string; sortOrder?: string; limit?: number }) =>
    http.get('/developer/stats/usage', params),

  /**
   * 获取收入趋势
   */
  getRevenueTrend: (months?: number) =>
    http.get('/developer/stats/revenue', { months }),

  /**
   * 获取每日注册统计
   */
  getDailyStats: (days?: number) =>
    http.get('/developer/stats/daily', { days }),

  /**
   * 获取所有系统配置
   */
  getSystemConfigs: () =>
    http.get('/developer/system-config'),

  /**
   * 保存系统配置
   */
  saveSystemConfig: (data: { key: string; value: string; description?: string }) =>
    http.put('/developer/system-config', data),

  /**
   * 删除系统配置
   */
  deleteSystemConfig: (key: string) =>
    http.delete(`/developer/system-config/${key}`),

  /**
   * 获取租户列表
   * @param params - 分页和搜索参数
   * @returns 分页的租户列表
   */
  getTenants: (params?: PaginationParams) =>
    http.get('/developer/tenants', params),

  /**
   * 创建新租户（企业）
   * @param data - 租户信息（企业名称、联系人、套餐等）
   * @returns 新创建的租户信息
   */
  createTenant: (data: any) =>
    http.post('/developer/tenants', data),

  /**
   * 更新租户信息
   * @param id - 租户 ID
   * @param data - 要更新的字段
   */
  updateTenant: (id: number, data: any) =>
    http.put(`/developer/tenants/${id}`, data),

  /**
   * 启用/禁用租户
   * @param id - 租户 ID
   * @returns 更新后的租户状态
   */
  toggleTenant: (id: number) =>
    http.patch(`/developer/tenants/${id}/toggle`),

  /**
   * 获取企业模块开通状态
   */
  getTenantModules: (tenantId: string) =>
    http.get(`/developer/tenants/${tenantId}/modules`),

  /**
   * 更新企业模块开通状态
   */
  updateTenantModules: (tenantId: string, modules: Array<{ moduleKey: string; isEnabled: boolean; expiresAt?: string | null; remark?: string | null }>) =>
    http.put(`/developer/tenants/${tenantId}/modules`, { modules }),

  /**
   * 获取企业独立登录页配置
   */
  getTenantPortal: (tenantId: string) =>
    http.get(`/developer/tenants/${tenantId}/portal`),

  /**
   * 更新企业独立登录页配置
   */
  updateTenantPortal: (tenantId: string, data: {
    domain?: string | null;
    logoUrl?: string | null;
    companyName?: string | null;
    loginTitle?: string | null;
    themeColor?: string | null;
    isEnabled?: boolean;
  }) =>
    http.put(`/developer/tenants/${tenantId}/portal`, data),

  getDefaultMiniProgram: () =>
    http.get('/developer/mini-program/default'),

  updateDefaultMiniProgram: (data: any) =>
    http.put('/developer/mini-program/default', data),

  getTenantMiniProgram: (tenantId: string) =>
    http.get(`/developer/tenants/${tenantId}/mini-program`),

  updateTenantMiniProgram: (tenantId: string, data: any) =>
    http.put(`/developer/tenants/${tenantId}/mini-program`, data),

  /* ---------- 回收站管理 ---------- */

  /**
   * 获取回收站中的企业列表
   */
  getRecycleTenants: (params?: PaginationParams) =>
    http.get('/developer/tenants/recycle', params),

  /**
   * 删除企业（移入回收站）
   */
  deleteTenant: (id: number) =>
    http.delete(`/developer/tenants/${id}`),

  /**
   * 从回收站恢复企业
   */
  restoreTenant: (id: number) =>
    http.post(`/developer/tenants/${id}/restore`),

  /**
   * 永久删除企业
   */
  permanentDeleteTenant: (id: number) =>
    http.delete(`/developer/tenants/${id}/permanent`),

  /**
   * 清空回收站
   */
  clearRecycleBin: () =>
    http.delete('/developer/tenants/recycle/clear'),

  /**
   * 获取租户用户列表
   * @param tenantId - 租户 ID
   */
  getTenantUsers: (tenantId: string) =>
    http.get(`/developer/tenants/${tenantId}/users`),

  /**
   * 获取 AI 配置
   * @returns 当前 AI 服务配置信息
   */
  getAiConfig: () =>
    http.get('/developer/ai-config'),

  /**
   * 更新 AI 配置
   * @param data - AI 配置参数（API Key、模型等）
   */
  updateAiConfig: (data: any) =>
    http.put('/developer/ai-config', data),

  /**
   * 测试 AI 配置连通性
   * @param data - 要测试的 AI 配置
   * @returns 测试结果
   */
  testAiConfig: (data: any) =>
    http.post('/developer/ai-config/test', data),

  /**
   * 删除 AI 配置
   * @param id - 配置ID
   */
  deleteAiConfig: (id: string) =>
    http.delete(`/developer/ai-config/${id}`),

  /**
   * 启用/停用 AI 配置
   * @param id - 配置ID
   * @param enabled - true 启用，false 停用
   */
  toggleAiConfig: (id: string, enabled: boolean) =>
    http.patch(`/developer/ai-config/${id}/toggle`, { enabled }),

  /**
   * 获取 OCR 配置
   * @returns 当前 OCR 服务配置信息
   */
  getOcrConfig: () =>
    http.get('/developer/ocr-config'),

  /**
   * 更新 OCR 配置
   * @param data - OCR 配置参数
   */
  updateOcrConfig: (data: any) =>
    http.put('/developer/ocr-config', data),

  /**
   * 测试 OCR 配置连通性
   * @param data - 要测试的 OCR 配置
   * @returns 测试结果
   */
  testOcrConfig: (data: any) =>
    http.post('/developer/ocr-config/test', data),

  /**
   * 删除 OCR 配置
   * @param id - 配置ID
   */
  deleteOcrConfig: (id: string) =>
    http.delete(`/developer/ocr-config/${id}`),

  /**
   * 启用/停用 OCR 配置
   * @param id - 配置ID
   * @param enabled - true 启用，false 停用
   */
  toggleOcrConfig: (id: string, enabled: boolean) =>
    http.patch(`/developer/ocr-config/${id}/toggle`, { enabled }),

  /* ---------- 套餐管理 ---------- */

  getPlans: () =>
    http.get('/developer/plans'),

  createPlan: (data: any) =>
    http.post('/developer/plans', data),

  updatePlan: (id: string, data: any) =>
    http.put(`/developer/plans/${id}`, data),

  deletePlan: (id: string) =>
    http.delete(`/developer/plans/${id}`),

  /** 获取租户订阅详情 */
  getTenantSubscription: (tenantId: string) =>
    http.get(`/developer/tenants/${tenantId}/subscription`),

  /** 更新租户订阅 */
  updateTenantSubscription: (tenantId: string, data: any) =>
    http.put(`/developer/tenants/${tenantId}/subscription`, data),

  /* ---------- 支付记录 ---------- */

  getPayments: (params?: any) =>
    http.get('/developer/payments', params),

  /* ---------- 发票管理 ---------- */

  getInvoices: (params?: any) =>
    http.get('/developer/invoices', params),

  createInvoice: (data: any) =>
    http.post('/developer/invoices', data),

  issueInvoice: (id: string) =>
    http.post(`/developer/invoices/${id}/issue`),

  /* ---------- 第三方集成 ---------- */

  getIntegrations: () =>
    http.get('/developer/integrations'),

  saveIntegration: (data: { platform: string; config: any }) =>
    http.put('/developer/integrations', data),

  testIntegration: (platform: string) =>
    http.post('/developer/integrations/test', { platform }),

  /* ---------- 存储管理 ---------- */

  getStorageStats: (params?: any) =>
    http.get('/developer/storage/stats', params),

  getStorageFiles: (params?: any) =>
    http.get('/developer/storage/files', params),

  /* ---------- API 密钥管理 ---------- */

  getApiKeys: (params?: any) =>
    http.get('/developer/api-keys', params),

  createApiKey: (data: { tenantId: string; name: string; expiresAt?: string }) =>
    http.post('/developer/api-keys', data),

  updateApiKey: (id: string, data: any) =>
    http.put(`/developer/api-keys/${id}`, data),

  deleteApiKey: (id: string) =>
    http.delete(`/developer/api-keys/${id}`),

  /* ---------- 系统公告 ---------- */

  getAnnouncements: (params?: any) =>
    http.get('/developer/announcements', params),

  createAnnouncement: (data: any) =>
    http.post('/developer/announcements', data),

  updateAnnouncement: (id: string, data: any) =>
    http.put(`/developer/announcements/${id}`, data),

  deleteAnnouncement: (id: string) =>
    http.delete(`/developer/announcements/${id}`),

  toggleAnnouncement: (id: string) =>
    http.post(`/developer/announcements/${id}/publish`),

  /* ---------- 安全策略 ---------- */

  getSecuritySettings: () =>
    http.get('/developer/security-settings'),

  updateSecuritySettings: (data: any) =>
    http.put('/developer/security-settings', data),

  /* ---------- 系统监控 ---------- */

  getMonitoring: () =>
    http.get('/developer/monitoring'),
};

/* ========================================
 * 3. 租户管理模块 API (tenantApi)
 * 项目部内部管理：用户、角色、部门等
 * ======================================== */
export const tenantApi = {
  /**
   * 获取当前租户/项目部资料
   * @returns 租户详细信息
   */
  getProfile: () =>
    http.get('/tenants/profile'),

  /**
   * 更新租户/项目部资料
   * @param data - 要更新的字段
   */
  updateProfile: (data: any) =>
    http.put('/tenants/profile', data),

  /**
   * 获取用户列表
   * @param params - 分页和搜索参数
   * @returns 分页的用户列表
   */
  getUsers: (params?: PaginationParams) =>
    http.get('/tenants/users', params),

  /**
   * 创建新用户
   * @param data - 用户信息（用户名、密码、角色等）
   * @returns 新创建的用户信息
   */
  createUser: (data: any) =>
    http.post('/tenants/users', data?.realName && !data?.name ? { ...data, name: data.realName } : data),

  /**
   * 更新用户信息
   * @param id - 用户 ID
   * @param data - 要更新的字段
   */
  updateUser: (id: number, data: any) =>
    http.put(`/tenants/users/${id}`, data?.realName && !data?.name ? { ...data, name: data.realName } : data),

  /**
   * 启用/禁用用户
   * @param id - 用户 ID
   */
  toggleUser: (id: number) =>
    http.patch(`/tenants/users/${id}/toggle`),

  /**
   * 重置用户密码
   * @param id - 用户 ID
   * @param data - 新密码
   */
  resetPassword: (id: number, data: { newPassword: string }) =>
    http.post(`/tenants/users/${id}/reset-password`, data),

  /**
   * 获取角色列表
   * @returns 所有角色及其权限配置
   */
  getRoles: () =>
    http.get('/tenants/roles'),

  /**
   * 更新角色权限配置
   * @param roleId - 角色 ID
   * @param data - 权限列表
   */
  updateRolePermissions: (roleId: number, data: { permissions: string[] }) =>
    http.put(`/tenants/roles/${roleId}/permissions`, data),

  createRole: (data: { name: string; displayName: string; description?: string }) =>
    http.post('/tenants/roles', data),

  updateRole: (roleId: number, data: { name?: string; displayName?: string; description?: string }) =>
    http.put(`/tenants/roles/${roleId}`, data),

  deleteRole: (roleId: number) =>
    http.delete(`/tenants/roles/${roleId}`),

  /**
   * 获取部门列表
   * @returns 组织架构部门树
   */
  getDepartments: () =>
    http.get('/tenants/departments'),
};

/* ========================================
 * 4. 订阅模块 API (subscriptionApi)
 * 套餐管理、订阅变更、支付记录等
 * ======================================== */
export const subscriptionApi = {
  /**
   * 获取当前订阅信息
   * @returns 当前套餐详情和使用情况
   */
  getCurrent: () =>
    http.get('/subscription/current'),

  /**
   * 获取可用套餐列表
   * @returns 所有可选套餐及价格
   */
  getPlans: () =>
    http.get('/subscription/plans'),

  /**
   * 变更订阅套餐
   * @param params - 目标套餐和层级
   */
  changePlan: (params: { plan: string; tier: string }) =>
    http.post('/subscription/change-plan', params),

  /**
   * 获取支付记录
   * @param params - 分页参数
   * @returns 分页的支付记录列表
   */
  getPayments: (params?: PaginationParams) =>
    http.get('/subscription/payments', params),
};

/* ========================================
 * 5. 合同管理模块 API (contractApi)
 * 工程合同的增删改查、进度款管理等
 * ======================================== */
export const contractApi = {
  /**
   * 获取合同列表
   * @param params - 分页和筛选参数
   * @returns 分页的合同列表
   */
  getList: (params?: PaginationParams & { status?: string }) =>
    http.get('/contracts', params),

  /**
   * 获取分包合同列表
   * 合同管理是基础功能，因此走 /contracts 入口，不依赖劳资模块开通。
   */
  getSubContracts: (params?: PaginationParams & { contractId?: string; subcontractorId?: string; search?: string }) =>
    http.get('/contracts/sub-contracts', params),

  getContractWorkTeams: () =>
    http.get('/contracts/work-teams'),

  createSubContract: (data: any) =>
    http.post('/contracts/sub-contracts', data),

  updateSubContract: (id: string, data: any) =>
    http.put(`/contracts/sub-contracts/${id}`, data),

  deleteSubContract: (id: string) =>
    http.delete(`/contracts/sub-contracts/${id}`),

  getSubContractDetail: (id: string) =>
    http.get(`/contracts/sub-contracts/${id}`),

  getSubContractPayments: (id: string) =>
    http.get(`/contracts/sub-contracts/${id}/payments`),

  createSubContractPayment: (id: string, data: any) =>
    http.post(`/contracts/sub-contracts/${id}/payments`, data),

  getSubContractAttachments: (id: string, category?: string) =>
    http.get(`/contracts/sub-contracts/${id}/attachments`, { category }),

  uploadSubContractAttachment: (id: string, formData: FormData) =>
    http.upload(`/contracts/sub-contracts/${id}/attachments/upload`, formData),

  /**
   * 创建新合同
   * @param data - 合同信息（合同编号、甲方、金额等）
   * @returns 新创建的合同信息
   */
  create: (data: any) =>
    http.post('/contracts', data),

  /**
   * 获取合同详情
   * @param id - 合同 ID
   * @returns 合同完整信息
   */
  getDetail: (id: number) =>
    http.get(`/contracts/${id}`),

  /**
   * 更新合同信息
   * @param id - 合同 ID
   * @param data - 要更新的字段
   */
  update: (id: number, data: any) =>
    http.put(`/contracts/${id}`, data),

  /**
   * 删除合同
   * @param id - 合同 ID
   */
  delete: (id: number) =>
    http.delete(`/contracts/${id}`),

  /**
   * 获取合同进度款列表
   * @param contractId - 合同 ID
   * @returns 进度款记录列表
   */
  getProgressPayments: (contractId: number) =>
    http.get(`/contracts/${contractId}/progress-payments`),

  /**
   * 创建合同进度款记录
   * @param contractId - 合同 ID
   * @param data - 进度款信息（期次、金额、比例等）
   */
  createProgressPayment: (contractId: number, data: any) =>
    http.post(`/contracts/${contractId}/progress-payments`, data),

  /**
   * 获取合同附件列表
   */
  getAttachments: (contractId: string | number, category?: string) =>
    http.get('/contracts/attachments', { contractId: String(contractId), category }),

  /**
   * 上传合同附件（支持多文件）
   */
  uploadAttachment: (formData: FormData) =>
    http.upload('/contracts/attachments/upload', formData),

  /**
   * 下载合同附件
   */
  downloadAttachment: (id: string) =>
    http.get(`/contracts/attachments/${id}/download`, {}, { responseType: 'blob' }),

  /**
   * 删除合同附件
   */
  deleteAttachment: (id: string) =>
    http.delete(`/contracts/attachments/${id}`),

  /**
   * 获取采购合同付款记录
   */
  getPayments: (contractId: number | string) =>
    http.get(`/contracts/${contractId}/payments`),

  /**
   * 创建采购合同付款记录
   */
  createPayment: (contractId: number | string, data: any) =>
    http.post(`/contracts/${contractId}/payments`, data),
};

/* ========================================
 * 6. 项目部管理模块 API (departmentApi)
 * 项目部的子项目、成员管理等
 * ======================================== */
export const departmentApi = {
  /**
   * 获取项目部列表
   * @param params - 分页参数
   * @returns 分页的项目部列表
   */
  getList: (params?: PaginationParams) =>
    http.get('/departments', params),

  /**
   * 创建新项目部
   * @param data - 项目部信息
   * @returns 新创建的项目部信息
   */
  create: (data: any) =>
    http.post('/departments', data),

  /**
   * 获取项目部详情
   * @param id - 项目部 ID
   * @returns 项目部完整信息
   */
  getDetail: (id: number) =>
    http.get(`/departments/${id}`),

  /**
   * 更新项目部信息
   * @param id - 项目部 ID
   * @param data - 要更新的字段
   */
  update: (id: number, data: any) =>
    http.put(`/departments/${id}`, data),

  /**
   * 启用/禁用项目部
   * @param id - 项目部 ID
   */
  toggle: (id: number) =>
    http.patch(`/departments/${id}/toggle`),

  /**
   * 获取子项目列表
   * @param departmentId - 项目部 ID
   * @returns 子项目列表
   */
  getSubProjects: (departmentId: number) =>
    http.get(`/departments/${departmentId}/sub-projects`),

  /**
   * 创建子项目
   * @param departmentId - 项目部 ID
   * @param data - 子项目信息
   */
  createSubProject: (departmentId: number, data: any) =>
    http.post(`/departments/${departmentId}/sub-projects`, data),

  /**
   * 更新子项目信息
   * @param departmentId - 项目部 ID
   * @param subProjectId - 子项目 ID
   * @param data - 要更新的字段
   */
  updateSubProject: (departmentId: number, subProjectId: number, data: any) =>
    http.put(`/departments/${departmentId}/sub-projects/${subProjectId}`, data),

  /**
   * 添加项目成员
   * @param departmentId - 项目部 ID
   * @param data - 成员信息（用户 ID、角色等）
   */
  addMember: (departmentId: number, data: any) =>
    http.post(`/departments/${departmentId}/members`, data?.userIds ? data : { ...data, userIds: data?.userId ? [data.userId] : [] }),

  /**
   * 移除项目成员
   * @param departmentId - 项目部 ID
   * @param userId - 用户 ID
   */
  removeMember: (departmentId: number, userId: number) =>
    http.delete(`/departments/${departmentId}/members/${userId}`),
};

/* ========================================
 * 7. 物资管理模块 API (wmsApi)
 * 仓库物资的入库、出库、退库、借调等
 * ======================================== */
export const wmsApi = {
  /**
   * 获取物资列表
   * @param params - 分页和搜索参数
   * @returns 分页的物资列表
   */
  getMaterials: (params?: PaginationParams) =>
    http.get('/wms/materials', params),

  /**
   * 创建物资
   * @param data - 物资信息（名称、规格、单位等）
   * @returns 新创建的物资信息
   */
  createMaterial: (data: any) =>
    http.post('/wms/materials', data),

  /**
   * 获取库存列表
   * @param params - 分页和筛选参数
   * @returns 分页的库存列表
   */
  getInventory: (params?: PaginationParams) =>
    http.get('/wms/inventory', params),

  /**
   * 获取领料单列表
   * @param params - 分页参数
   * @returns 分页的领料单列表
   */
  getDeliveryOrders: (params?: PaginationParams) =>
    http.get('/wms/delivery-orders', params),

  /**
   * 创建领料单
   * @param data - 领料单信息
   */
  createDeliveryOrder: (data: any) =>
    http.post('/wms/delivery-orders', data),

  /**
   * 获取入库记录列表
   * @param params - 分页参数
   * @returns 分页的入库记录
   */
  getInbound: (params?: PaginationParams) =>
    http.get('/wms/inbound', params),

  /**
   * 创建入库记录
   * @param data - 入库信息（物资、数量、供应商等）
   */
  createInbound: (data: any) =>
    http.post('/wms/inbound/manual', data),

  /**
   * 删除入库记录
   * @param id - 入库单 ID
   */
  getInboundCascadePreview: (id: string) =>
    http.get(`/wms/inbound/${id}/cascade-preview`),

  deleteInbound: (id: string) =>
    http.delete(`/wms/inbound/${id}`),

  /**
   * 修改入库记录
   * @param id - 入库单 ID
   * @param data - 更新数据
   */
  updateInbound: (id: string, data: any) =>
    http.put(`/wms/inbound/${id}`, data),

  /**
   * Excel 批量入库
   * @param formData - 包含 file、subProjectId、deliveryDate 等字段
   */
  uploadInboundExcel: (formData: FormData) =>
    http.post('/wms/inbound/excel', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  /**
   * 下载入库模板
   */
  downloadInboundTemplate: () =>
    http.get('/wms/inbound/template', {}, { responseType: 'blob' }),

  /**
   * 获取入库物资的去重项目名称列表
   * 用于出库时选择项目
   */
  getInboundProjectNames: (params?: { contractId?: string; departmentId?: string }) =>
    http.get('/wms/inbound/project-names', params),

  /**
   * OCR 识别送货单
   * @param data - FormData 包含 file 字段（图片或 PDF）
   * @returns OCR 识别结果（供应商、物资明细等）
   */
  ocrInbound: (data: FormData) =>
    ocrClient.post('/wms/delivery-orders/ocr', data, { headers: { 'Content-Type': 'multipart/form-data' } }),

  /**
   * 获取出库记录列表
   * @param params - 分页参数
   * @returns 分页的出库记录
   */
  getOutbound: (params?: PaginationParams) =>
    http.get('/wms/outbound', params),

  /**
   * 创建出库记录
   * @param data - 出库信息
   */
  createOutbound: (data: any) =>
    http.post('/wms/outbound', data),

  /**
   * 删除出库记录
   * @param id - 出库单 ID
   */
  getOutboundCascadePreview: (id: string) =>
    http.get(`/wms/outbound/${id}/cascade-preview`),

  deleteOutbound: (id: string) =>
    http.delete(`/wms/outbound/${id}`),

  /**
   * 获取退库记录列表
   * @param params - 分页参数
   * @returns 分页的退库记录
   */
  getReturns: (params?: PaginationParams) =>
    http.get('/wms/returns', params),

  /**
   * 创建退库记录
   * @param data - 退库信息
   */
  createReturn: (data: any) =>
    http.post('/wms/returns', data),

  getReturnCascadePreview: (id: string) =>
    http.get(`/wms/returns/${id}/cascade-preview`),

  deleteReturn: (id: string) =>
    http.delete(`/wms/returns/${id}`),

  /**
   * 获取物资借调记录列表
   * @param params - 分页参数
   * @returns 分页的借调记录
   */
  getTransfers: (params?: PaginationParams) =>
    http.get('/wms/transfers', params),

  /**
   * 创建物资借调记录
   * @param data - 借调信息（调出方、调入方、物资明细等）
   */
  createTransfer: (data: any) =>
    http.post('/wms/transfers', data),

  getTransferCascadePreview: (id: string) =>
    http.get(`/wms/transfers/${id}/cascade-preview`),

  deleteTransfer: (id: string) =>
    http.delete(`/wms/transfers/${id}`),

  /**
   * 下载调拨单 PDF
   * @param id - 调拨单 ID
   */
  getTransferPdf: (id: string) =>
    http.get(`/wms/transfers/${id}/pdf`, {}, { responseType: 'blob' }),

  /**
   * 获取班组台账
   * @param params - 分页参数
   * @returns 分页的班组台账记录
   */
  getWorkTeamLedger: (params?: PaginationParams) =>
    http.get('/wms/work-team-ledger', params),

  /**
   * 获取供应商列表
   * @param params - 分页参数
   * @returns 分页的供应商列表
   */
  getSuppliers: (params?: PaginationParams) =>
    http.get('/wms/suppliers', params),

  createSupplier: (data: any) =>
    http.post('/wms/suppliers', data),

  updateSupplier: (id: string | number, data: any) =>
    http.put(`/wms/suppliers/${id}`, data),

  deleteSupplier: (id: string | number) =>
    http.delete(`/wms/suppliers/${id}`),

  /**
   * 获取班组列表
   * @param params - 分页参数
   * @returns 分页的班组列表
   */
  getWorkTeams: (params?: PaginationParams) =>
    http.get('/wms/work-teams', params),

  /**
   * 创建班组
   * @param data - 班组信息
   */
  createWorkTeam: (data: any) =>
    http.post('/wms/work-teams', data),

  /**
   * 更新班组
   * @param id - 班组 ID
   * @param data - 班组信息
   */
  updateWorkTeam: (id: string | number, data: any) =>
    http.put(`/wms/work-teams/${id}`, data),

  deleteWorkTeam: (id: string | number) =>
    http.delete(`/wms/work-teams/${id}`),

  /**
   * 获取子项目列表（当前租户下全部）
   */
  getSubProjects: () =>
    http.get('/wms/sub-projects'),

  /**
   * 下载出库单 PDF
   * @param id - 出库单 ID
   */
  getOutboundPdf: (id: string) =>
    http.get(`/wms/outbound/${id}/pdf`, {}, { responseType: 'blob' }),

  /**
   * 获取可退库的出库明细
   * @param params - 筛选参数（subProjectId, workTeamId, startDate, endDate）
   */
  getReturnOutboundItems: (params?: any) =>
    http.get('/wms/returns/outbound-items', params),

  /**
   * 下载退库 Excel 模板
   */
  downloadReturnTemplate: () =>
    http.get('/wms/returns/template', {}, { responseType: 'blob' }),

  /**
   * Excel 批量退库
   * @param formData - 包含 file 和 subProjectId 的 FormData
   */
  uploadReturnExcel: (formData: FormData) =>
    http.post('/wms/returns/excel', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

/* ========================================
 * 8. 劳资管理模块 API (laborApi)
 * 人员管理、考勤、工资核算、风控、报表等
 * ======================================== */
export const laborApi = {
  /* ---------- 人员管理 ---------- */

  /**
   * 获取人员列表
   * @param params - 分页和搜索参数
   * @returns 分页的人员列表
   */
  getPersonnel: (params?: PaginationParams) =>
    http.get('/labor/personnel', params),

  /**
   * 创建人员档案
   * @param data - 人员信息（姓名、身份证、工种、班组等）
   * @returns 新创建的人员信息
   */
  createPersonnel: (data: any) =>
    http.post('/labor/personnel', data),

  updatePersonnel: (id: string | number, data: any) =>
    http.put(`/labor/personnel/${id}`, data),

  leavePersonnel: (id: string | number, leftAt: string) =>
    http.post(`/labor/personnel/${id}/leave`, { leftAt }),

  rejoinPersonnel: (id: string | number) =>
    http.post(`/labor/personnel/${id}/rejoin`),

  /* ---------- 考勤管理 ---------- */

  /**
   * 获取考勤记录列表
   * @param params - 分页和日期筛选参数
   * @returns 分页的考勤记录
   */
  getAttendance: (params?: PaginationParams & { month?: string }) =>
    http.get('/labor/attendance', params),

  /**
   * 创建单条考勤记录
   * @param data - 考勤信息（人员、日期、出勤状态等）
   */
  createAttendance: (data: any) =>
    http.post('/labor/attendance', data),

  getAttendanceSetting: () =>
    http.get('/labor/attendance/mobile/settings'),

  updateAttendanceSetting: (data: any) =>
    http.put('/labor/attendance/mobile/settings', data),

  getMobileCheckIns: (params?: any) =>
    http.get('/labor/attendance/mobile/check-ins', params),

  resolveMobileCheckIns: (data: { ids: string[]; resolveReason?: string }) =>
    http.post('/labor/attendance/mobile/check-ins/resolve-batch', data),

  getTrustedLocations: (params?: any) =>
    http.get('/labor/attendance/mobile/trusted-locations', params),

  addTrustedLocation: (data: any) =>
    http.post('/labor/attendance/mobile/trusted-locations', data),

  deleteTrustedLocation: (id: string) =>
    http.delete(`/labor/attendance/mobile/trusted-locations/${id}`),

  /**
   * 批量导入考勤记录
   * @param data - 批量考勤数据
   * @returns 导入结果（成功数、失败数等）
   */
  batchAttendance: (data: any) =>
    http.post('/labor/attendance/batch', data),

  /**
   * 获取月度考勤汇总
   * @param month - 月份（格式：YYYY-MM）
   * @returns 月度考勤汇总数据
   */
  getMonthlySummary: (month: string) =>
    http.get('/labor/attendance/summary', { month }),

  /* ---------- 工资核算 ---------- */

  /**
   * 计算月度工资
   * 根据考勤记录和工资标准自动计算
   * @param month - 月份（格式：YYYY-MM）
   * @returns 计算结果
   */
  calculateSalary: (month: string) =>
    http.post('/labor/salary/calculate', { month }),

  /**
   * 获取工资明细列表
   * @param params - 分页和月份筛选参数
   * @returns 分页的工资明细
   */
  getSalary: (params?: PaginationParams & { month?: string }) =>
    http.get('/labor/salary', params ? { ...params, limit: params.pageSize } : params),

  /**
   * 更新工资记录（手动调整）
   * @param salaryId - 工资记录 ID
   * @param data - 调整字段
   */
  updateSalary: (salaryId: number, data: any) =>
    http.put(`/labor/salary/${salaryId}`, data),

  /**
   * 获取工资汇总统计
   * @param month - 月份（格式：YYYY-MM）
   * @returns 工资汇总数据（总应发、总扣款、总实发等）
   */
  getSalarySummary: (month: string) =>
    http.get('/labor/salary/summary', { month }),

  exportSalary: (month: string) =>
    http.get('/labor/salary/export', { month }, { responseType: 'blob' }),

  /* ---------- 工资发放 ---------- */

  /**
   * 获取发放记录列表
   * @param params - 分页参数
   * @returns 分页的发放记录
   */
  getPayments: (params?: PaginationParams & { month?: string; isConfirmed?: boolean }) =>
    http.get('/labor/payment', params ? { ...params, search: params.search || params.keyword, limit: params.pageSize } : params),

  exportPayments: (params?: { search?: string; keyword?: string; month?: string; isConfirmed?: boolean }) =>
    http.get('/labor/payment/export', params ? { ...params, search: params.search || params.keyword } : params, { responseType: 'blob' }),

  /**
   * 创建工资发放记录
   * @param data - 发放信息（月份、人员、金额等）
   */
  createPayment: (data: any) =>
    http.post('/labor/payment', data),

  /**
   * 批量确认发放
   * @param paymentIds - 发放记录 ID 列表
   */
  confirmBatchPayment: (paymentIds: number[]) =>
    http.post('/labor/payment/confirm-batch', { ids: paymentIds }),

  /* ---------- 分包管理 ---------- */

  /**
   * 获取分包商列表
   * @param params - 分页参数
   * @returns 分页的分包商列表
   */
  getSubcontractors: (params?: PaginationParams) =>
    http.get('/labor/subcontractor', params),

  /**
   * 创建分包商
   * @param data - 分包商信息
   */
  createSubcontractor: (data: any) =>
    http.post('/labor/subcontractor', data),

  /**
   * 获取分包合同列表
   * @param params - 分页参数
   * @returns 分页的分包合同列表
   */
  getSubContracts: (params?: PaginationParams) =>
    http.get('/labor/sub-contract', params),

  /**
   * 创建分包合同
   * @param data - 分包合同信息
   */
  createSubContract: (data: any) =>
    http.post('/labor/sub-contract', data),

  /* ---------- 产值管理 ---------- */

  /**
   * 获取产值记录列表
   * @param params - 分页参数
   * @returns 分页的产值记录
   */
  getOutputValues: (params?: PaginationParams) =>
    http.get('/labor/output-value', params),

  /**
   * 创建产值记录
   * @param data - 产值信息（项目、金额、日期等）
   */
  createOutputValue: (data: any) =>
    http.post('/labor/output-value', data),

  /**
   * 创建分包进度款
   * @param data - 进度款信息
   */
  createSubProgressPayment: (data: any) =>
    http.post('/labor/sub-progress-payments', data),

  /* ---------- 风控管理 ---------- */

  /**
   * 获取异常记录列表
   * @param params - 分页和筛选参数
   * @returns 分页的异常记录
   */
  getAnomalies: (params?: PaginationParams & { resolved?: boolean }) =>
    http.get('/labor/anomalies', params),

  /**
   * 处理异常记录
   * @param anomalyId - 异常记录 ID
   * @param data - 处理结果
   */
  resolveAnomaly: (anomalyId: number | string, data: any) =>
    http.post(`/labor/anomalies/${anomalyId}/resolve`, data),

  /**
   * 获取异常统计数据
   * @returns 异常分类统计（按类型、月份等）
   */
  getAnomalyStats: () =>
    http.get('/labor/anomalies/stats'),

  /**
   * 获取合规检查结果
   * @param params - 筛选参数
   * @returns 合规检查记录列表
   */
  getCompliance: (params?: PaginationParams) =>
    http.get('/labor/anomalies/compliance', params),

  /* ---------- 附件管理 ---------- */

  /**
   * 上传附件（支持多文件）
   * @param formData - FormData 包含 files, entityType, entityId
   */
  uploadAttachment: (formData: FormData) =>
    http.post('/labor/attachment/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  uploadFacePhoto: (personnelId: string, formData: FormData) =>
    http.post(`/labor/personnel/${personnelId}/face`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  /**
   * 获取附件列表
   * @param entityType - 实体类型（personnel, contract 等）
   * @param entityId - 实体 ID
   */
  getAttachments: (entityType: string, entityId: string) =>
    http.get('/labor/attachment', { entityType, entityId }),

  /**
   * 删除附件
   * @param id - 附件 ID
   */
  deleteAttachment: (id: string) =>
    http.delete(`/labor/attachment/${id}`),

  /* ---------- 报表导出 ---------- */

  /**
   * 获取可导出报表的月份列表
   * @returns 有数据的月份列表
   */
  getReportMonths: () =>
    http.get('/labor/reports/available-months'),

  /**
   * 预览报表数据
   * @param month - 月份
   * @param reportType - 报表类型
   * @returns 报表预览数据
   */
  previewReport: (month: string, reportType: string) =>
    http.get('/labor/reports/preview', { months: month, type: reportType }),

  /**
   * 导出报表（下载 Excel 文件）
   * @param month - 月份
   * @param reportType - 报表类型
   * @returns 文件下载响应
   */
  exportReport: (month: string, reportType: string) =>
    http.get('/labor/reports/export', { months: month, type: reportType }, { responseType: 'blob' }),

};

/* ========================================
 * 9. 操作日志模块 API (logApi)
 * 系统操作日志查询
 * ======================================== */
export const logApi = {
  /**
   * 获取操作日志列表
   * @param params - 分页和筛选参数（可按操作人、操作类型、时间范围筛选）
   * @returns 分页的操作日志列表
   */
  getLogs: (params?: PaginationParams & {
    userId?: number;              /* 操作人 ID */
    module?: string;              /* 操作模块 */
    action?: string;              /* 操作类型 */
    startDate?: string;           /* 开始日期 */
    endDate?: string;             /* 结束日期 */
  }) =>
    http.get('/logs', params),
};

/* ========================================
 * 工具函数
 * ======================================== */

/**
 * 下载 Blob 文件
 * 创建临时链接并触发下载
 * @param blob - 文件数据
 * @param filename - 下载文件名
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ========================================
 * 13. 回收站管理 API (recycleBinApi)
 * 合同、入库单、出库单的回收与永久删除
 * ======================================== */
export const recycleBinApi = {
  /**
   * 获取回收站列表
   * @param params - 分页、类型筛选、搜索参数
   * @returns 已删除的项目列表
   */
  getList: (params?: PaginationParams & { type?: string }) =>
    http.get('/recycle-bin', params),

  /**
   * 恢复回收站项目
   * @param items - 要恢复的项目列表 [{ id, type }]
   */
  restore: (items: { id: string; type: string }[]) =>
    http.post('/recycle-bin/restore', { items }),

  /**
   * 永久删除回收站项目
   * @param items - 要永久删除的项目列表 [{ id, type }]
   */
  permanentDelete: (items: { id: string; type: string }[]) =>
    http.post('/recycle-bin/permanent-delete', { items }),
};

/* ========================================
 * 10. 财务管理模块 API (financeApi)
 * 费用报账、类别管理、备用金、发票、收款、盈利分析
 * ======================================== */
export const financeApi = {
  /* ---------- 费用类别 ---------- */

  /** 获取费用类别列表 */
  getCategories: () =>
    http.get('/finance/categories'),

  /** 创建费用类别 */
  createCategory: (data: any) =>
    http.post('/finance/categories', data),

  /** 更新费用类别 */
  updateCategory: (id: string, data: any) =>
    http.put(`/finance/categories/${id}`, data),

  /** 删除费用类别 */
  deleteCategory: (id: string) =>
    http.delete(`/finance/categories/${id}`),

  /** 获取某个类别下的子类别列表 */
  getSubCategories: (categoryId: string) =>
    http.get(`/finance/categories/${categoryId}/sub`),

  /** 创建子类别 */
  createSubCategory: (data: any) =>
    http.post('/finance/sub-categories', data),

  /** 更新子类别 */
  updateSubCategory: (id: string, data: any) =>
    http.put(`/finance/sub-categories/${id}`, data),

  /** 删除子类别 */
  deleteSubCategory: (id: string) =>
    http.delete(`/finance/sub-categories/${id}`),

  /* ---------- 费用记录 ---------- */

  /** 获取费用记录列表（支持分页和筛选） */
  getExpenses: (params?: any) =>
    http.get('/finance/expenses', params),

  /** 创建费用记录 */
  createExpense: (data: any) =>
    data instanceof FormData
      ? http.upload('/finance/expenses', data)
      : http.post('/finance/expenses', data),

  /** 更新费用记录 */
  updateExpense: (id: string, data: any) =>
    http.put(`/finance/expenses/${id}`, data),

  /** 删除费用记录 */
  deleteExpense: (id: string) =>
    http.delete(`/finance/expenses/${id}`),

  /** 审核通过费用记录 */
  approveExpense: (id: string) =>
    http.put(`/finance/expenses/${id}/approve`),

  /** 驳回费用记录 */
  rejectExpense: (id: string) =>
    http.put(`/finance/expenses/${id}/reject`),

  /* ---------- 汇总查询 ---------- */

  /** 获取费用汇总 */
  getSummary: (params?: any) =>
    http.get('/finance/summary', params),

  /** 获取月度汇总 */
  getMonthlySummary: (params?: any) =>
    http.get('/finance/summary/monthly', params),

  /** 获取按类别汇总 */
  getCategorySummary: (params?: any) =>
    http.get('/finance/summary/by-category', params),

  /* ---------- 导入导出 ---------- */

  /** Excel 导入费用数据 */
  importExcel: (formData: FormData) =>
    http.post('/finance/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  /** 导出费用数据 */
  exportExcel: (params?: any) =>
    http.get('/finance/export', params, { responseType: 'blob' }),

  /** 导出汇总数据 */
  exportSummary: (params?: any) =>
    http.get('/finance/export-summary', params, { responseType: 'blob' }),

  /* ---------- 备用金 ---------- */

  /** 获取备用金账户列表 */
  getPettyCashAccounts: (params?: any) =>
    http.get('/finance/petty-cash/accounts', params),

  /** 创建备用金账户 */
  createPettyCashAccount: (data: any) =>
    http.post('/finance/petty-cash/accounts', data),

  /** 获取备用金账户余额 */
  getPettyCashBalance: (accountId: string) =>
    http.get(`/finance/petty-cash/accounts/${accountId}/balance`),

  /** 创建备用金预支申请 */
  createPettyCashAdvance: (data: any) =>
    http.post('/finance/petty-cash/advances', data),

  /** 获取备用金预支记录 */
  getPettyCashAdvances: (params?: any) =>
    http.get('/finance/petty-cash/advances', params),

  /** 获取备用金余额汇总 */
  getBalanceSummary: () =>
    http.get('/finance/summary/balance'),

  /* ---------- 发票管理 ---------- */

  /** 获取发票列表 */
  getInvoices: (params?: any) =>
    http.get('/finance/invoices', params),

  /** 获取发票详情 */
  getInvoiceDetail: (id: string) =>
    http.get(`/finance/invoices/${id}`),

  /** 获取发票关联的收款记录 */
  getInvoiceReceipts: (id: string) =>
    http.get(`/finance/invoices/${id}/receipts`),

  /** 创建发票 */
  createInvoice: (data: any) =>
    http.post('/finance/invoices', data),

  /** 更新发票 */
  updateInvoice: (id: string, data: any) =>
    http.put(`/finance/invoices/${id}`, data),

  /** 删除发票 */
  deleteInvoice: (id: string) =>
    http.delete(`/finance/invoices/${id}`),

  /* ---------- 收款管理 ---------- */

  /** 获取收款记录列表 */
  getReceipts: (params?: any) =>
    http.get('/finance/receipts', params),

  /** 获取收款记录详情 */
  getReceiptDetail: (id: string) =>
    http.get(`/finance/receipts/${id}`),

  /** 创建收款记录 */
  createReceipt: (data: any) =>
    http.post('/finance/receipts', data),

  /** 更新收款记录 */
  updateReceipt: (id: string, data: any) =>
    http.put(`/finance/receipts/${id}`, data),

  /** 删除收款记录 */
  deleteReceipt: (id: string) =>
    http.delete(`/finance/receipts/${id}`),

  /** 获取收款汇总 */
  getReceiptsSummary: () =>
    http.get('/finance/receipts/summary'),

  /** 获取逾期未收款列表 */
  getOverdueReceipts: () =>
    http.get('/finance/receipts/overdue'),

  /* ---------- 合同盈利分析 ---------- */

  /** 获取单个合同盈亏分析 */
  getContractPnl: (contractId: string) =>
    http.get(`/finance/contract/${contractId}/pnl`),

  /** 获取所有合同盈亏分析列表 */
  getContractsPnl: (params?: any) =>
    http.get('/finance/contracts/pnl', params),
};
