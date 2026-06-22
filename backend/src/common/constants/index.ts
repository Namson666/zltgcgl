// ============================================
// 常量定义模块
// ============================================
// 集中定义系统中使用的常量配置，包括：
// - 订阅计划价格配置
// - 各角色默认权限
// - 操作类型映射
// 避免在代码中硬编码魔法值，提高可维护性。
// ============================================

// Enum types removed after SQLite migration - using string literals directly

// ============================================
// 订阅计划价格配置
// ============================================

/**
 * 订阅计划价格配置
 *
 * 定义各订阅计划和层级的月度价格。
* 价格结构：
* - 计划维度：单板块（物资/劳资）或全系统
* - 层级维度：小型企业（<=5人）、中型企业（6-20人）、大型企业（>20人）
 *
 * @property plan - 订阅计划类型
 * @property tier - 企业规模层级
 * @property pricePerMonth - 月度价格（元）
 * @property maxUsers - 最大用户数
 * @property pricePerExtraUser - 超出用户数的额外费用（元/人/月）
 * @property description - 计划描述
 */
export const SUBSCRIPTION_PLANS: Record<
  string,
  {
    plan: string;
    tier: string;
    pricePerMonth: number;
    maxUsers: number;
    pricePerExtraUser: number;
    description: string;
  }
> = {
  // 单板块：物资管理 - 小型企业
  'wms_small': {
    plan: 'SINGLE_WMS',
    tier: 'SMALL',
    pricePerMonth: 388,
    maxUsers: 5,
    pricePerExtraUser: 80,
    description: '物资管理单板块 - 小型企业（最多5人）',
  },
  // 单板块：物资管理 - 中型企业
  'wms_medium': {
    plan: 'SINGLE_WMS',
    tier: 'MEDIUM',
    pricePerMonth: 688,
    maxUsers: 20,
    pricePerExtraUser: 60,
    description: '物资管理单板块 - 中型企业（最多20人）',
  },
  // 单板块：物资管理 - 大型企业
  'wms_large': {
    plan: 'SINGLE_WMS',
    tier: 'LARGE',
    pricePerMonth: 1288,
    maxUsers: 100,
    pricePerExtraUser: 40,
    description: '物资管理单板块 - 大型企业（最多100人）',
  },
  // 单板块：劳资管理 - 小型企业
  'labor_small': {
    plan: 'SINGLE_LABOR',
    tier: 'SMALL',
    pricePerMonth: 388,
    maxUsers: 5,
    pricePerExtraUser: 80,
    description: '劳资管理单板块 - 小型企业（最多5人）',
  },
  // 单板块：劳资管理 - 中型企业
  'labor_medium': {
    plan: 'SINGLE_LABOR',
    tier: 'MEDIUM',
    pricePerMonth: 688,
    maxUsers: 20,
    pricePerExtraUser: 60,
    description: '劳资管理单板块 - 中型企业（最多20人）',
  },
  // 单板块：劳资管理 - 大型企业
  'labor_large': {
    plan: 'SINGLE_LABOR',
    tier: 'LARGE',
    pricePerMonth: 1288,
    maxUsers: 100,
    pricePerExtraUser: 40,
    description: '劳资管理单板块 - 大型企业（最多100人）',
  },
  // 全系统会员 - 小型企业
  'full_small': {
    plan: 'FULL',
    tier: 'SMALL',
    pricePerMonth: 588,
    maxUsers: 5,
    pricePerExtraUser: 100,
    description: '全系统会员 - 小型企业（最多5人）',
  },
  // 全系统会员 - 中型企业
  'full_medium': {
    plan: 'FULL',
    tier: 'MEDIUM',
    pricePerMonth: 1088,
    maxUsers: 20,
    pricePerExtraUser: 80,
    description: '全系统会员 - 中型企业（最多20人）',
  },
  // 全系统会员 - 大型企业
  'full_large': {
    plan: 'FULL',
    tier: 'LARGE',
    pricePerMonth: 2088,
    maxUsers: 100,
    pricePerExtraUser: 60,
    description: '全系统会员 - 大型企业（最多100人）',
  },
};

// ============================================
// 各角色默认权限配置
// ============================================

/**
 * 角色默认权限配置
 *
 * 定义系统中各预置角色的默认权限。
* 创建新角色时，可根据角色类型自动设置对应的权限。
 *
 * 权限字段说明：
 * - canViewDashboard: 查看数据看板
 * - canManageSystem: 系统管理（用户、角色、配置）
 * - canViewLogs: 查看操作日志
 * - canExport: 导出数据
 * - canViewInventory: 查看库存
 * - canInbound: 入库操作
 * - canOutbound: 出库操作
 * - canReturn: 退库操作
 * - canTransfer: 调拨操作
 * - canViewRecords: 查看记录
 * - canViewWorkTeamLedger: 查看班组台账
 * - canManagePersonnel: 人员管理
 * - canManageAttendance: 考勤管理
 * - canManageSalary: 工资核算
 * - canManagePayment: 工资发放
 * - canManageAnomaly: 风控管理
 * - canManageReport: 报表导出
 * - canManageContract: 合同管理
 * - canManageDepartment: 项目部管理
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<
  string,
  {
    /** 角色标识 */
    name: string;
    /** 角色显示名称 */
    displayName: string;
    /** 默认数据范围 */
    dataScope: 'ALL' | 'DEPARTMENTS' | 'OWN_DEPARTMENT';
    /** 权限配置 */
    permissions: {
      canViewDashboard: boolean;
      canManageSystem: boolean;
      canViewLogs: boolean;
      canExport: boolean;
      canViewInventory: boolean;
      canInbound: boolean;
      canOutbound: boolean;
      canReturn: boolean;
      canTransfer: boolean;
      canViewRecords: boolean;
      canViewWorkTeamLedger: boolean;
      canManagePersonnel: boolean;
      canManageAttendance: boolean;
      canManageSalary: boolean;
      canManagePayment: boolean;
      canManageAnomaly: boolean;
      canManageReport: boolean;
      canManageContract: boolean;
      canManageDepartment: boolean;
    };
  }
> = {
  // 老板（企业负责人）：拥有所有权限，数据范围为企业全部
  boss: {
    name: 'boss',
    displayName: '老板',
    dataScope: 'ALL',
    permissions: {
      canViewDashboard: true,
      canManageSystem: true,
      canViewLogs: true,
      canExport: true,
      canViewInventory: true,
      canInbound: true,
      canOutbound: true,
      canReturn: true,
      canTransfer: true,
      canViewRecords: true,
      canViewWorkTeamLedger: true,
      canManagePersonnel: true,
      canManageAttendance: true,
      canManageSalary: true,
      canManagePayment: true,
      canManageAnomaly: true,
      canManageReport: true,
      canManageContract: true,
      canManageDepartment: true,
    },
  },

  // 管理员（企业管理员）：拥有大部分权限，数据范围为企业全部
  admin: {
    name: 'admin',
    displayName: '管理员',
    dataScope: 'ALL',
    permissions: {
      canViewDashboard: true,
      canManageSystem: true,
      canViewLogs: true,
      canExport: true,
      canViewInventory: true,
      canInbound: true,
      canOutbound: true,
      canReturn: true,
      canTransfer: true,
      canViewRecords: true,
      canViewWorkTeamLedger: true,
      canManagePersonnel: true,
      canManageAttendance: true,
      canManageSalary: true,
      canManagePayment: true,
      canManageAnomaly: true,
      canManageReport: true,
      canManageContract: true,
      canManageDepartment: true,
    },
  },

  // 物资员：物资管理相关权限，数据范围为授权项目部
  material: {
    name: 'material',
    displayName: '物资员',
    dataScope: 'DEPARTMENTS',
    permissions: {
      canViewDashboard: true,
      canManageSystem: false,
      canViewLogs: false,
      canExport: true,
      canViewInventory: true,
      canInbound: true,
      canOutbound: true,
      canReturn: true,
      canTransfer: true,
      canViewRecords: true,
      canViewWorkTeamLedger: true,
      canManagePersonnel: false,
      canManageAttendance: false,
      canManageSalary: false,
      canManagePayment: false,
      canManageAnomaly: false,
      canManageReport: false,
      canManageContract: false,
      canManageDepartment: false,
    },
  },

  // 劳资员：劳资管理相关权限，数据范围为授权项目部
  labor: {
    name: 'labor',
    displayName: '劳资员',
    dataScope: 'DEPARTMENTS',
    permissions: {
      canViewDashboard: true,
      canManageSystem: false,
      canViewLogs: false,
      canExport: true,
      canViewInventory: false,
      canInbound: false,
      canOutbound: false,
      canReturn: false,
      canTransfer: false,
      canViewRecords: false,
      canViewWorkTeamLedger: false,
      canManagePersonnel: true,
      canManageAttendance: true,
      canManageSalary: true,
      canManagePayment: true,
      canManageAnomaly: true,
      canManageReport: true,
      canManageContract: false,
      canManageDepartment: false,
    },
  },

  // 财务：查看和导出权限，数据范围为企业全部
  finance: {
    name: 'finance',
    displayName: '财务',
    dataScope: 'ALL',
    permissions: {
      canViewDashboard: true,
      canManageSystem: false,
      canViewLogs: false,
      canExport: true,
      canViewInventory: true,
      canInbound: false,
      canOutbound: false,
      canReturn: false,
      canTransfer: false,
      canViewRecords: true,
      canViewWorkTeamLedger: true,
      canManagePersonnel: true,
      canManageAttendance: false,
      canManageSalary: true,
      canManagePayment: true,
      canManageAnomaly: false,
      canManageReport: true,
      canManageContract: true,
      canManageDepartment: false,
    },
  },

  // 出纳：工资发放权限，数据范围为企业全部
  cashier: {
    name: 'cashier',
    displayName: '出纳',
    dataScope: 'ALL',
    permissions: {
      canViewDashboard: false,
      canManageSystem: false,
      canViewLogs: false,
      canExport: true,
      canViewInventory: false,
      canInbound: false,
      canOutbound: false,
      canReturn: false,
      canTransfer: false,
      canViewRecords: false,
      canViewWorkTeamLedger: false,
      canManagePersonnel: false,
      canManageAttendance: false,
      canManageSalary: false,
      canManagePayment: true,
      canManageAnomaly: false,
      canManageReport: true,
      canManageContract: false,
      canManageDepartment: false,
    },
  },

  // 项目出纳：仅所属项目部的工资发放权限
  project_cashier: {
    name: 'project_cashier',
    displayName: '项目出纳',
    dataScope: 'OWN_DEPARTMENT',
    permissions: {
      canViewDashboard: false,
      canManageSystem: false,
      canViewLogs: false,
      canExport: true,
      canViewInventory: false,
      canInbound: false,
      canOutbound: false,
      canReturn: false,
      canTransfer: false,
      canViewRecords: false,
      canViewWorkTeamLedger: false,
      canManagePersonnel: false,
      canManageAttendance: false,
      canManageSalary: false,
      canManagePayment: true,
      canManageAnomaly: false,
      canManageReport: true,
      canManageContract: false,
      canManageDepartment: false,
    },
  },
};

// ============================================
// 操作类型映射
// ============================================

/**
 * 操作类型映射
 *
 * 将 LogAction 枚举值映射为中文描述，用于日志显示和前端展示。
 *
 * @property action - LogAction 枚举值
 * @property label - 中文标签
 * @property description - 操作描述
 */
export const LOG_ACTION: Record<string, { label: string; description: string }> = {
  /** 创建操作 */
  CREATE: {
    label: '创建',
    description: '新增了一条记录',
  },
  /** 更新操作 */
  UPDATE: {
    label: '更新',
    description: '修改了一条记录',
  },
  /** 删除操作 */
  DELETE: {
    label: '删除',
    description: '删除了一条记录',
  },
  /** 登录操作 */
  LOGIN: {
    label: '登录',
    description: '用户登录了系统',
  },
  /** 登出操作 */
  LOGOUT: {
    label: '登出',
    description: '用户登出了系统',
  },
  /** 导出操作 */
  EXPORT: {
    label: '导出',
    description: '导出了数据',
  },
  /** 导入操作 */
  IMPORT: {
    label: '导入',
    description: '导入了数据',
  },
  /** 确认操作 */
  CONFIRM: {
    label: '确认',
    description: '确认了一条记录',
  },
  /** 取消操作 */
  CANCEL: {
    label: '取消',
    description: '取消了一条记录',
  },
};
