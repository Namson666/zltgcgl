/**
 * 资料通工程管理系统 - 主布局组件
 *
 * 功能说明：
 * 1. 左侧可折叠侧边栏（桌面端固定，移动端抽屉式）
 * 2. 顶部导航栏（系统名称、用户信息、项目部选择器、退出按钮）
 * 3. 主内容区域（通过 Outlet 渲染子路由）
 * 4. 侧边栏菜单按模块分组，根据权限显示/隐藏
 * 5. 开发者视角提示横幅
 *
 * 布局结构：
 * ┌──────────────────────────────────────────┐
 * │              顶部导航栏                    │
 * ├──────────┬───────────────────────────────┤
 * │          │                               │
 * │  侧边栏  │        主内容区域              │
 * │          │                               │
 * │          │                               │
 * └──────────┴───────────────────────────────┘
 */

import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  User,
  Shield,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  ArrowLeftRight,
  BookOpen,
  ClipboardList,
  CalendarCheck,
  Calculator,
  Banknote,
  ShieldCheck,
  FileSpreadsheet,
  UserCog,
  Key,
  Truck,
  HardHat,
  Eye,
  Globe,
  HardDrive,
  Bell,
  Activity,
  Receipt,
  ScrollText,
  Wallet,
  TrendingUp,
  PieChart,
  FileUp,
} from 'lucide-react';
import { useAuthStore } from '../../lib/AuthContext';

/* ========================================
 * 类型定义
 * ======================================== */

/** 菜单项接口 */
interface MenuItem {
  name: string;                    /* 菜单显示名称 */
  path: string;                    /* 路由路径 */
  icon: React.ReactNode;           /* 菜单图标 */
  permission?: string;             /* 所需权限（不设置则所有人可见） */
  developerOnly?: boolean;         /* 是否仅开发者可见 */
  moduleKey?: 'wms' | 'labor' | 'finance'; /* 所属开通模块 */
}

/** 菜单分组接口 */
interface MenuGroup {
  name: string;                    /* 分组名称 */
  icon?: React.ReactNode;          /* 分组图标 */
  items: MenuItem[];               /* 分组下的菜单项 */
  permission?: string;             /* 所需权限 */
  developerOnly?: boolean;         /* 是否仅开发者可见 */
  moduleKey?: 'wms' | 'labor' | 'finance'; /* 所属开通模块 */
}

/* ========================================
 * 菜单配置
 * 根据系统功能模块定义侧边栏菜单结构
 * ======================================== */

/** 侧边栏菜单分组配置 */
const menuGroups: MenuGroup[] = [
  {
    name: '数据看板',
    items: [
      {
        name: '数据看板',
        path: '/dashboard',
        icon: <LayoutDashboard size={20} />,
      },
    ],
  },
  {
    name: '合同管理',
    permission: 'contract:view',
    items: [
      {
        name: '合同管理',
        path: '/contracts',
        icon: <FileText size={20} />,
        permission: 'contract:view',
      },
    ],
  },
  {
    name: '物资管理',
    permission: 'wms:view',
    moduleKey: 'wms',
    items: [
      {
        name: '物资总览',
        path: '/wms/materials',
        icon: <Package size={20} />,
        permission: 'wms:view',
      },
      {
        name: '入库管理',
        path: '/wms/inbound',
        icon: <ArrowDownToLine size={20} />,
        permission: 'wms:inbound',
      },
      {
        name: '出库管理',
        path: '/wms/outbound',
        icon: <ArrowUpFromLine size={20} />,
        permission: 'wms:outbound',
      },
      {
        name: '退库管理',
        path: '/wms/returns',
        icon: <RotateCcw size={20} />,
        permission: 'wms:return',
      },
      {
        name: '物资借调',
        path: '/wms/transfers',
        icon: <ArrowLeftRight size={20} />,
        permission: 'wms:transfer',
      },
      {
        name: '班组台账',
        path: '/wms/ledger',
        icon: <BookOpen size={20} />,
        permission: 'wms:ledger',
      },
    ],
  },
  {
    name: '劳资管理',
    permission: 'labor:view',
    moduleKey: 'labor',
    items: [
      {
        name: '人员管理',
        path: '/labor/personnel',
        icon: <Users size={20} />,
        permission: 'labor:personnel',
      },
      {
        name: '考勤管理',
        path: '/labor/attendance',
        icon: <CalendarCheck size={20} />,
        permission: 'labor:attendance',
      },
      {
        name: '工资核算',
        path: '/labor/salary',
        icon: <Calculator size={20} />,
        permission: 'labor:salary',
      },
      {
        name: '工资发放',
        path: '/labor/payment',
        icon: <Banknote size={20} />,
        permission: 'labor:payment',
      },
      {
        name: '风控管理',
        path: '/labor/risk',
        icon: <ShieldCheck size={20} />,
        permission: 'labor:risk',
      },
      {
        name: '报表导出',
        path: '/labor/reports',
        icon: <FileSpreadsheet size={20} />,
        permission: 'labor:report',
      },
    ],
  },
  {
    name: '财务管理',
    permission: 'finance:view',
    moduleKey: 'finance',
    items: [
      {
        name: '项目部报账',
        path: '/finance/dept-entry',
        icon: <Receipt size={20} />,
        permission: 'finance:entry_dept',
      },
      {
        name: '公司财务凭证',
        path: '/finance/finance-entry',
        icon: <ScrollText size={20} />,
        permission: 'finance:entry_finance',
      },
      {
        name: '备用金管理',
        path: '/finance/petty-cash',
        icon: <Wallet size={20} />,
        permission: 'finance:petty_cash',
      },
      {
        name: '费用列表',
        path: '/finance/expenses',
        icon: <ClipboardList size={20} />,
        permission: 'finance:view',
      },
      {
        name: '开票记录',
        path: '/finance/invoices',
        icon: <FileText size={20} />,
        permission: 'finance:invoice',
      },
      {
        name: '收款记录',
        path: '/finance/receipts',
        icon: <Banknote size={20} />,
        permission: 'finance:receipt',
      },
      {
        name: '合同盈利分析',
        path: '/finance/contract-pnl',
        icon: <TrendingUp size={20} />,
        permission: 'finance:pnl',
      },
      {
        name: '财务看板',
        path: '/finance/dashboard',
        icon: <PieChart size={20} />,
        permission: 'finance:view',
      },
      {
        name: '类别设置',
        path: '/finance/settings',
        icon: <Settings size={20} />,
        permission: 'finance:view',
      },
      {
        name: '台账导入',
        path: '/finance/import',
        icon: <FileUp size={20} />,
        permission: 'finance:view',
      },
    ],
  },
  {
    name: '项目部管理',
    permission: 'department:view',
    items: [
      {
        name: '项目部管理',
        path: '/departments',
        icon: <Building2 size={20} />,
        permission: 'department:view',
      },
    ],
  },
  {
    name: '系统管理',
    permission: 'admin:view',
    items: [
      {
        name: '用户管理',
        path: '/admin/users',
        icon: <UserCog size={20} />,
        permission: 'admin:user',
      },
      {
        name: '角色权限',
        path: '/admin/roles',
        icon: <Key size={20} />,
        permission: 'admin:role',
      },
      {
        name: '供应商管理',
        path: '/admin/suppliers',
        icon: <Truck size={20} />,
        permission: 'admin:supplier',
      },
      {
        name: '班组管理',
        path: '/admin/work-teams',
        icon: <HardHat size={20} />,
        permission: 'admin:workteam',
      },
      {
        name: '回收站',
        path: '/admin/recycle-bin',
        icon: <RotateCcw size={20} />,
      },
    ],
  },
];

/** 开发者菜单分组 */
const developerMenuGroup: MenuGroup = {
  name: '开发者后台',
  developerOnly: true,
  items: [
    {
      name: '综合看板',
      path: '/dev',
      icon: <LayoutDashboard size={20} />,
      developerOnly: true,
    },
    {
      name: '企业管理',
      path: '/dev/tenants',
      icon: <Building2 size={20} />,
      developerOnly: true,
    },
    {
      name: '套餐订阅',
      path: '/dev/plans',
      icon: <Package size={20} />,
      developerOnly: true,
    },
    {
      name: '支付记录',
      path: '/dev/payments',
      icon: <Banknote size={20} />,
      developerOnly: true,
    },
    {
      name: '发票管理',
      path: '/dev/invoices',
      icon: <FileText size={20} />,
      developerOnly: true,
    },
    {
      name: 'AI 模型配置',
      path: '/dev/ai-config',
      icon: <Shield size={20} />,
      developerOnly: true,
    },
    {
      name: 'OCR 配置',
      path: '/dev/ocr-config',
      icon: <FileText size={20} />,
      developerOnly: true,
    },
    {
      name: '第三方集成',
      path: '/dev/integrations',
      icon: <Globe size={20} />,
      developerOnly: true,
    },
    {
      name: '存储管理',
      path: '/dev/storage',
      icon: <HardDrive size={20} />,
      developerOnly: true,
    },
    {
      name: 'API 密钥',
      path: '/dev/api-keys',
      icon: <Key size={20} />,
      developerOnly: true,
    },
    {
      name: '系统公告',
      path: '/dev/announcements',
      icon: <Bell size={20} />,
      developerOnly: true,
    },
    {
      name: '安全策略',
      path: '/dev/security',
      icon: <ShieldCheck size={20} />,
      developerOnly: true,
    },
    {
      name: '系统监控',
      path: '/dev/monitoring',
      icon: <Activity size={20} />,
      developerOnly: true,
    },
    {
      name: '系统配置',
      path: '/dev/system-config',
      icon: <Settings size={20} />,
      developerOnly: true,
    },
    {
      name: '操作日志',
      path: '/dev/logs',
      icon: <ClipboardList size={20} />,
      developerOnly: true,
    },
  ],
};

/* ========================================
 * Layout 主布局组件
 * ======================================== */
const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  /* 从认证 Store 获取状态和方法 */
  const { user, isAuthenticated, isDeveloper, isDevView, can, hasModule, logout, toggleDevView, exitEnterpriseView } =
    useAuthStore();

  /* ---------- 本地状态 ---------- */
  const [sidebarOpen, setSidebarOpen] = useState(false);   /* 移动端侧边栏是否展开 */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); /* 桌面端侧边栏是否折叠 */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set()); /* 展开的菜单分组 */

  /* ---------- 初始化 ---------- */
  useEffect(() => {
    /* 默认展开所有菜单分组 */
    const allGroups = new Set(menuGroups.map((g) => g.name));
    setExpandedGroups(allGroups);
  }, []);

  /* 未登录时跳转到登录页 */
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  /* 路由变化时关闭移动端侧边栏 */
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  /* ---------- 事件处理 ---------- */

  /**
   * 切换菜单分组展开/折叠
   * @param groupName - 分组名称
   */
  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  /**
   * 处理菜单点击
   * @param path - 目标路由路径
   */
  const handleMenuClick = (path: string) => {
    navigate(path);
  };

  /**
   * 处理退出登录
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /**
   * 判断菜单项是否可见
   * 根据权限和开发者状态过滤
   */
  const isMenuItemVisible = (item: MenuItem): boolean => {
    /* 开发者专属菜单仅开发者可见 */
    if (item.developerOnly && !isDeveloper) return false;
    /* 企业未开通模块时隐藏对应菜单项 */
    if (item.moduleKey && !hasModule(item.moduleKey)) return false;
    /* 权限检查 */
    if (item.permission && !can(item.permission)) return false;
    return true;
  };

  /**
   * 判断菜单分组是否可见
   */
  const isMenuGroupVisible = (group: MenuGroup): boolean => {
    /* 开发者登录但未进入企业视角：隐藏所有业务分组 */
    if (isDeveloper && !isDevView && !group.developerOnly) return false;
    /* 开发者已进入企业视角：隐藏开发者专属分组 */
    if (isDeveloper && isDevView && group.developerOnly) return false;
    /* 开发者专属分组仅开发者可见 */
    if (group.developerOnly && !isDeveloper) return false;
    /* 企业未开通模块时隐藏对应分组 */
    if (group.moduleKey && !hasModule(group.moduleKey)) return false;
    /* 权限检查 */
    if (group.permission && !can(group.permission)) return false;
    /* 分组内至少有一个可见菜单项 */
    return group.items.some(isMenuItemVisible);
  };

  /**
   * 判断菜单项是否为当前激活项
   * 精确匹配优先；对层级路径（2+段）支持前缀匹配
   */
  const isActive = (path: string): boolean => {
    if (location.pathname === path) return true;
    /* 仅对二级及以上路径启用前缀匹配（避免 /dev 误匹配 /dev/tenants） */
    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return location.pathname.startsWith(path + '/');
    }
    return false;
  };

  /* ---------- 渲染辅助函数 ---------- */

  /**
   * 渲染单个菜单项
   */
  const renderMenuItem = (item: MenuItem, isSubItem: boolean = false) => {
    if (!isMenuItemVisible(item)) return null;

    const active = isActive(item.path);
    const baseClasses = isSubItem
      ? `flex items-center gap-3 pl-11 pr-3 py-2 rounded-lg text-sm transition-colors duration-200 cursor-pointer`
      : `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 cursor-pointer`;

    const activeStyle = active
      ? { backgroundColor: 'var(--sidebar-accent)', color: 'var(--sidebar-foreground)', fontWeight: 500 }
      : { color: 'oklch(0.85 0.01 250)' };

    return (
      <div
        key={item.path}
        className={baseClasses}
        style={activeStyle}
        onClick={() => handleMenuClick(item.path)}
        onMouseEnter={(e) => { if (!active) (e.currentTarget.style.backgroundColor = 'var(--sidebar-accent)'); }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget.style.backgroundColor = 'transparent'); }}
      >
        {item.icon}
        {/* 折叠状态下隐藏文字 */}
        {(!sidebarCollapsed || sidebarOpen) && <span>{item.name}</span>}
      </div>
    );
  };

  /**
   * 渲染菜单分组（含子菜单展开/折叠）
   */
  const renderMenuGroup = (group: MenuGroup) => {
    if (!isMenuGroupVisible(group)) return null;

    const visibleItems = group.items.filter(isMenuItemVisible);
    if (visibleItems.length === 0) return null;

    const isExpanded = expandedGroups.has(group.name);
    const hasActiveItem = visibleItems.some((item) => isActive(item.path));

    return (
      <div key={group.name} className="mb-2">
        {/* 分组标题（可点击展开/折叠） */}
        <div
          className="px-3 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer"
          style={{ color: 'oklch(0.60 0.02 250)' }}
          onClick={() => toggleGroup(group.name)}
        >
          {(!sidebarCollapsed || sidebarOpen) && (
            <>
              <span className="flex-1">{group.name}</span>
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </>
          )}
        </div>

        {/* 展开的菜单项列表 */}
        {isExpanded && (
          <div className="space-y-1">
            {visibleItems.map((item) => renderMenuItem(item))}
          </div>
        )}

        {/* 折叠状态下仅显示图标 */}
        {!isExpanded && hasActiveItem && (
          <div className="space-y-1">
            {visibleItems
              .filter((item) => isActive(item.path))
              .map((item) => renderMenuItem(item))}
          </div>
        )}
      </div>
    );
  };

  /* ---------- 主渲染 ---------- */
  if (!isAuthenticated) return null;

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      {/* ==========================================
       * 开发者视角提示横幅
       * 仅在开发者视角模式下显示
       * ========================================== */}
      {isDevView && (
        <div className="text-white text-center py-1.5 text-sm font-medium flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--warning)' }}>
          <Eye size={16} />
          <span>开发者视角模式 - 您正在以开发者身份查看系统</span>
          <button
            onClick={exitEnterpriseView}
            className="ml-2 px-2 py-0.5 rounded text-xs transition-colors text-white"
            style={{ backgroundColor: 'oklch(0.60 0.16 55)' }}
          >
            退出视角
          </button>
        </div>
      )}

      {/* ==========================================
       * 顶部导航栏
       * ========================================== */}
      <header
        className="bg-white flex items-center justify-between px-4 flex-shrink-0 z-30"
        style={{ height: 'var(--navbar-height)', borderBottom: '1px solid var(--border)' }}
      >
        {/* 左侧：汉堡菜单按钮 + 系统名称 */}
        <div className="flex items-center gap-3">
          {/* 移动端汉堡菜单按钮 */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* 系统名称 + 图标 */}
          <h1 className="text-lg font-bold hide-mobile flex items-center gap-2" style={{ color: 'var(--primary)' }}>
            <img src="/icon.png" alt="" className="w-6 h-6 object-contain" />
            资料通工程管理系统
          </h1>
          <h1 className="text-lg font-bold hide-desktop flex items-center gap-1.5" style={{ color: 'var(--primary)' }}>
            <img src="/icon.png" alt="" className="w-5 h-5 object-contain" />
            资料通
          </h1>
        </div>

        {/* 右侧：项目部选择器 + 用户信息 + 退出按钮 */}
        <div className="flex items-center gap-3">
          {/* 项目部选择器（非开发者模式显示） */}
          {user?.tenantName && !isDeveloper && (
            <div className="hidden sm:flex items-center gap-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <Building2 size={16} />
              <span className="max-w-[150px] truncate">{user.tenantName}</span>
            </div>
          )}

          {/* 开发者切换视角按钮 */}
          {isDeveloper && (
            <button
              onClick={isDevView ? exitEnterpriseView : toggleDevView}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: isDevView ? 'var(--warning-bg)' : 'var(--primary-bg)',
                color: isDevView ? 'var(--warning-foreground)' : 'var(--muted-foreground)'
              }}
            >
              <Eye size={14} />
              {isDevView ? '退出视角' : '开发者视角'}
            </button>
          )}

          {/* 用户信息 */}
          <div className="flex items-center gap-2">
            {/* 用户头像（无头像时显示默认图标） */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary-bg)' }}>
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.realName || user.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <User size={16} style={{ color: 'var(--primary)' }} />
              )}
            </div>

            {/* 用户名（桌面端显示） */}
            <span className="hidden sm:block text-sm max-w-[120px] truncate" style={{ color: 'var(--foreground)' }}>
              {user?.realName || user?.username || '用户'}
            </span>
          </div>

          {/* 退出登录按钮 */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            title="退出登录"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ==========================================
       * 主体区域：侧边栏 + 内容区
       * ========================================== */}
      <div className="flex flex-1 overflow-hidden">
        {/* ==========================================
         * 移动端遮罩层
         * 点击遮罩关闭侧边栏
         * ========================================== */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ==========================================
         * 侧边栏
         * 桌面端：固定在左侧，可折叠
         * 移动端：抽屉式弹出
         * ========================================== */}
        <aside
          className={`
            flex-shrink-0 overflow-y-auto scrollbar-hidden
            transition-all duration-300 z-50
            /* 桌面端样式 */
            md:relative md:z-auto
            ${sidebarCollapsed ? 'md:w-16' : 'md:w-60'}
            /* 移动端样式：抽屉式 */
            fixed top-0 left-0 h-full w-60 pt-14
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 md:top-0 md:pt-0
          `}
          style={{ backgroundColor: 'var(--sidebar)' }}
        >
          {/* 侧边栏内容区域 */}
          <div className="py-4 px-3">
            {/* 企业名称 */}
            {user?.tenantName && !sidebarCollapsed && (
              <div className="px-3 pb-4 mb-2 text-center" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                <div className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-foreground)', opacity: 0.8 }}>{user.tenantName}</div>
              </div>
            )}

            {/* 菜单分组列表（isMenuGroupVisible 自动过滤业务/开发者分组） */}
            {menuGroups.map(renderMenuGroup)}

            {/* 开发者后台菜单 - 扁平列表（仅在非企业视角时显示） */}
            {isDeveloper && !isDevView && (
              <>
                {/* 分割线 */}
                <div className="my-3 mx-3" style={{ borderTop: '1px solid var(--sidebar-border)' }} />
                {/* 开发者菜单标题 */}
                {!sidebarCollapsed && (
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.60 0.02 250)' }}>
                    开发者后台
                  </div>
                )}
                {developerMenuGroup.items.filter(isMenuItemVisible).map((item) => renderMenuItem(item))}
              </>
            )}
          </div>

          {/* 桌面端折叠/展开按钮 */}
          <div className="hidden md:block p-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center p-2 rounded-lg transition-colors"
              style={{ color: 'oklch(0.60 0.02 250)' }}
              title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            >
              <ChevronRight
                size={18}
                className={`transition-transform duration-300 ${
                  sidebarCollapsed ? '' : 'rotate-180'
                }`}
              />
            </button>
          </div>
        </aside>

        {/* ==========================================
         * 主内容区域
         * 通过 React Router Outlet 渲染子路由页面
         * ========================================== */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
