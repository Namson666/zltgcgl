/**
 * 资料通工程管理系统 - 根组件（路由配置）
 *
 * 功能说明：
 * 定义应用的所有路由规则，将 URL 路径映射到对应的页面组件。
 * 使用 React Router v7 的 Routes 和 Route 组件实现声明式路由。
 *
 * 路由结构：
 * /login                    → 登录页面（无需认证）
 * /                         → 主布局（需要认证）
 *   /dashboard              → 数据看板
 *   /wms/*                  → 物资管理页面
 *     /wms/materials        → 物资总览
 *     /wms/inbound          → 入库管理
 *     /wms/outbound         → 出库管理
 *     /wms/returns          → 退库管理
 *     /wms/transfers        → 物资借调
 *     /wms/ledger           → 班组台账
 *     /wms/alerts           → 库存预警
 *   /labor/*                → 劳资管理页面
 *     /labor/personnel      → 人员管理
 *     /labor/attendance     → 考勤管理
 *     /labor/salary         → 工资核算
 *     /labor/payment        → 工资发放
 *     /labor/risk           → 风控管理
 *     /labor/reports        → 报表导出
 *   /contracts              → 合同管理
 *   /departments            → 项目部管理
 *   /admin/*                → 系统管理页面
 *     /admin/users          → 用户管理
 *     /admin/roles          → 角色权限
 *     /admin/suppliers      → 供应商管理
 *     /admin/work-teams     → 班组管理
 *   /dev                    → 开发者后台看板
 *   /dev/tenants            → 租户管理
 *   /dev/ai-config          → AI 模型配置
 *   /dev/ocr-config         → OCR 配置
 *   /dev/logs               → 操作日志
 *   /subscription           → 订阅计划
 * *                         → 404 页面
 */

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

/* 导入布局组件 */
import Layout from './components/layout/Layout';
import Loading from './components/ui/Loading';

/* ========================================
 * 懒加载页面组件
 * 使用 React.lazy 实现按需加载，优化首屏性能
 * ======================================== */

/* 认证相关页面 */
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));

/* 主功能页面 */
const Dashboard = lazy(() => import('./pages/Dashboard'));

/* 物资管理页面（占位组件） */
const WmsMaterials = lazy(() => import('./pages/wms/Materials'));
const WmsInbound = lazy(() => import('./pages/wms/Inbound'));
const WmsOutbound = lazy(() => import('./pages/wms/Outbound'));
const WmsReturns = lazy(() => import('./pages/wms/Returns'));
const WmsTransfers = lazy(() => import('./pages/wms/Transfers'));
const WmsLedger = lazy(() => import('./pages/wms/Ledger'));
const WmsAlerts = lazy(() => import('./pages/wms/Alerts'));

/* 劳资管理页面（占位组件） */
const LaborPersonnel = lazy(() => import('./pages/labor/Personnel'));
const LaborAttendance = lazy(() => import('./pages/labor/Attendance'));
const LaborSalary = lazy(() => import('./pages/labor/Salary'));
const LaborPayment = lazy(() => import('./pages/labor/Payment'));
const LaborRisk = lazy(() => import('./pages/labor/Risk'));
const LaborReports = lazy(() => import('./pages/labor/Reports'));

/* 合同管理页面 */
const Contracts = lazy(() => import('./pages/contracts/List'));

/* 项目部管理页面 */
const Departments = lazy(() => import('./pages/departments/List'));

/* 系统管理页面 */
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminRoles = lazy(() => import('./pages/admin/Roles'));
const AdminSuppliers = lazy(() => import('./pages/admin/Suppliers'));
const AdminWorkTeams = lazy(() => import('./pages/admin/WorkTeams'));
const AdminRecycleBin = lazy(() => import('./pages/admin/RecycleBin'));

/* 开发者后台页面 */
const DeveloperDashboard = lazy(() => import('./pages/developer/Dashboard'));
const DevTenants = lazy(() => import('./pages/developer/Tenants'));
const DevTenantView = lazy(() => import('./pages/developer/TenantView'));
const DevAiConfig = lazy(() => import('./pages/developer/AiConfig'));
const DevOcrConfig = lazy(() => import('./pages/developer/OcrConfig'));
const DevSystemConfig = lazy(() => import('./pages/developer/SystemConfig'));
const DevLogs = lazy(() => import('./pages/developer/Logs'));
const DevPlans = lazy(() => import('./pages/developer/Plans'));
const DevPayments = lazy(() => import('./pages/developer/Payments'));
const DevInvoices = lazy(() => import('./pages/developer/Invoices'));
const DevIntegrations = lazy(() => import('./pages/developer/Integrations'));
const DevStorage = lazy(() => import('./pages/developer/Storage'));
const DevApiKeys = lazy(() => import('./pages/developer/ApiKeys'));
const DevAnnouncements = lazy(() => import('./pages/developer/Announcements'));
const DevSecurity = lazy(() => import('./pages/developer/Security'));
const DevMonitoring = lazy(() => import('./pages/developer/Monitoring'));

/* 财务管理页面 */
const FinanceExpenseEntryDept = lazy(() => import('./pages/finance/ExpenseEntryDept'));
const FinanceExpenseEntryFinance = lazy(() => import('./pages/finance/ExpenseEntryFinance'));
const FinanceExpenseList = lazy(() => import('./pages/finance/ExpenseList'));
const FinanceCategorySettings = lazy(() => import('./pages/finance/CategorySettings'));
const FinancePettyCashManage = lazy(() => import('./pages/finance/PettyCashManage'));
const FinanceDashboard = lazy(() => import('./pages/finance/FinanceDashboard'));
const FinanceImportExcel = lazy(() => import('./pages/finance/ImportExcel'));
const FinanceInvoices = lazy(() => import('./pages/finance/InvoiceList'));
const FinanceInvoiceForm = lazy(() => import('./pages/finance/InvoiceForm'));
const FinanceReceipts = lazy(() => import('./pages/finance/ReceiptList'));
const FinanceReceiptForm = lazy(() => import('./pages/finance/ReceiptForm'));
const FinanceContractPnl = lazy(() => import('./pages/finance/ContractPnl'));
const FinanceContractPnlDetail = lazy(() => import('./pages/finance/ContractPnlDetail'));

/* 订阅管理页面 */
const SubscriptionPlans = lazy(() => import('./pages/subscription/Plans'));

/* 404 页面 */
const NotFound = lazy(() => import('./pages/NotFound'));

/* ========================================
 * App 根组件
 * ======================================== */
const App: React.FC = () => {
  return (
    /**
     * Suspense 包裹所有懒加载组件
     * 在组件加载过程中显示 Loading 指示器
     */
    <Suspense fallback={<Loading text="页面加载中..." />}>
      <Routes>
        {/* ==========================================
         * 登录页面路由
         * 无需认证，独立于主布局之外
         * ========================================== */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ==========================================
         * 主应用路由
         * 所有需要认证的页面都包裹在 Layout 组件中
         * Layout 提供侧边栏、导航栏等公共 UI
         * ========================================== */}
        <Route element={<Layout />}>
          {/* 数据看板 */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* ---------- 物资管理模块 ---------- */}
          <Route path="/wms/materials" element={<WmsMaterials />} />
          <Route path="/wms/inbound" element={<WmsInbound />} />
          <Route path="/wms/outbound" element={<WmsOutbound />} />
          <Route path="/wms/returns" element={<WmsReturns />} />
          <Route path="/wms/transfers" element={<WmsTransfers />} />
          <Route path="/wms/ledger" element={<WmsLedger />} />
          <Route path="/wms/alerts" element={<WmsAlerts />} />

          {/* ---------- 劳资管理模块 ---------- */}
          <Route path="/labor/personnel" element={<LaborPersonnel />} />
          <Route path="/labor/attendance" element={<LaborAttendance />} />
          <Route path="/labor/salary" element={<LaborSalary />} />
          <Route path="/labor/payment" element={<LaborPayment />} />
          <Route path="/labor/risk" element={<LaborRisk />} />
          <Route path="/labor/reports" element={<LaborReports />} />

          {/* ---------- 财务管理模块 ---------- */}
          <Route path="/finance/dept-entry" element={<FinanceExpenseEntryDept />} />
          <Route path="/finance/finance-entry" element={<FinanceExpenseEntryFinance />} />
          <Route path="/finance/expenses" element={<FinanceExpenseList />} />
          <Route path="/finance/settings" element={<FinanceCategorySettings />} />
          <Route path="/finance/petty-cash" element={<FinancePettyCashManage />} />
          <Route path="/finance/dashboard" element={<FinanceDashboard />} />
          <Route path="/finance/import" element={<FinanceImportExcel />} />
          <Route path="/finance/invoices" element={<FinanceInvoices />} />
          <Route path="/finance/invoices/form" element={<FinanceInvoiceForm />} />
          <Route path="/finance/receipts" element={<FinanceReceipts />} />
          <Route path="/finance/receipts/form" element={<FinanceReceiptForm />} />
          <Route path="/finance/contract-pnl" element={<FinanceContractPnl />} />
          <Route path="/finance/contract-pnl/:contractId" element={<FinanceContractPnlDetail />} />

          {/* ---------- 合同管理 ---------- */}
          <Route path="/contracts" element={<Contracts />} />

          {/* ---------- 项目部管理 ---------- */}
          <Route path="/departments" element={<Departments />} />

          {/* ---------- 系统管理模块 ---------- */}
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/roles" element={<AdminRoles />} />
          <Route path="/admin/suppliers" element={<AdminSuppliers />} />
          <Route path="/admin/work-teams" element={<AdminWorkTeams />} />
          <Route path="/admin/recycle-bin" element={<AdminRecycleBin />} />

          {/* ---------- 开发者后台 ---------- */}
          <Route path="/dev" element={<DeveloperDashboard />} />
          <Route path="/dev/tenants" element={<DevTenants />} />
          <Route path="/dev/tenants/:id/view" element={<DevTenantView />} />
          <Route path="/dev/ai-config" element={<DevAiConfig />} />
          <Route path="/dev/ocr-config" element={<DevOcrConfig />} />
          <Route path="/dev/system-config" element={<DevSystemConfig />} />
          <Route path="/dev/logs" element={<DevLogs />} />
          <Route path="/dev/plans" element={<DevPlans />} />
          <Route path="/dev/payments" element={<DevPayments />} />
          <Route path="/dev/invoices" element={<DevInvoices />} />
          <Route path="/dev/integrations" element={<DevIntegrations />} />
          <Route path="/dev/storage" element={<DevStorage />} />
          <Route path="/dev/api-keys" element={<DevApiKeys />} />
          <Route path="/dev/announcements" element={<DevAnnouncements />} />
          <Route path="/dev/security" element={<DevSecurity />} />
          <Route path="/dev/monitoring" element={<DevMonitoring />} />

          {/* ---------- 订阅管理 ---------- */}
          <Route path="/subscription" element={<SubscriptionPlans />} />

          {/* 默认路由：重定向到数据看板 */}
          <Route index element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* ==========================================
         * 404 页面
         * 未匹配到任何路由时显示
         * ========================================== */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

export default App;
