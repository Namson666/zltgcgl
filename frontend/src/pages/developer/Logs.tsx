/**
 * 资料通工程管理系统 - 全局操作日志页面
 *
 * 功能说明：
 * 开发者后台的全局操作日志查看页面，支持按模块、操作类型、时间范围筛选，
 * 以及分页浏览所有系统操作日志记录。
 *
 * 页面结构：
 * 1. 页面标题区域
 * 2. 筛选栏（按模块、操作类型、时间范围筛选）
 * 3. 日志列表表格（时间、企业/用户、操作类型、模块、描述、IP）
 * 4. 分页功能
 *
 * API 调用：
 * - logApi.getLogs() - 获取操作日志列表（支持分页和筛选）
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  Filter,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { logApi } from '../../api';
import {
  Pagination,
  EmptyState,
  formatDate,
} from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

/** 操作日志记录接口 */
interface LogRecord {
  id: number;                     /* 日志 ID */
  timestamp: string;              /* 操作时间 */
  userName: string;               /* 操作用户名 */
  tenantName?: string;            /* 所属企业名称 */
  action: string;                 /* 操作类型 */
  module: string;                 /* 所属模块 */
  description: string;            /* 操作描述 */
  ip: string;                     /* 操作 IP 地址 */
}

/* ========================================
 * 常量定义
 * ======================================== */

/** 可选模块列表 */
const MODULE_OPTIONS = [
  { value: '', label: '全部模块' },
  { value: 'auth', label: '认证' },
  { value: 'tenant', label: '租户管理' },
  { value: 'contract', label: '合同管理' },
  { value: 'department', label: '项目部管理' },
  { value: 'wms', label: '物资管理' },
  { value: 'labor', label: '劳资管理' },
  { value: 'subscription', label: '订阅管理' },
  { value: 'system', label: '系统配置' },
  { value: 'integration', label: '第三方集成' },
  { value: 'security', label: '安全策略' },
];

/** 可选操作类型列表 */
const ACTION_OPTIONS = [
  { value: '', label: '全部操作' },
  { value: 'CREATE', label: '创建' },
  { value: 'UPDATE', label: '更新' },
  { value: 'DELETE', label: '删除' },
  { value: 'LOGIN', label: '登录' },
  { value: 'LOGOUT', label: '登出' },
  { value: 'EXPORT', label: '导出' },
  { value: 'IMPORT', label: '导入' },
  { value: 'other', label: '其他' },
];

/* ========================================
 * Logs 全局操作日志组件
 * ======================================== */
const Logs: React.FC = () => {
  /* ---------- 列表状态 ---------- */
  const [logs, setLogs] = useState<LogRecord[]>([]);            /* 日志列表数据 */
  const [loading, setLoading] = useState(false);                  /* 加载状态 */
  const [total, setTotal] = useState(0);                          /* 总记录数 */
  const [totalPages, setTotalPages] = useState(0);                /* 总页数 */
  const [page, setPage] = useState(1);                            /* 当前页码 */
  const [pageSize] = useState(20);                                /* 每页条数 */

  /* ---------- 筛选状态 ---------- */
  const [moduleFilter, setModuleFilter] = useState('');           /* 模块筛选 */
  const [actionFilter, setActionFilter] = useState('');           /* 操作类型筛选 */
  const [startDate, setStartDate] = useState('');                 /* 开始日期 */
  const [endDate, setEndDate] = useState('');                     /* 结束日期 */

  /* ---------- 数据加载 ---------- */

  /**
   * 加载操作日志列表
   * 调用 logApi.getLogs() 获取分页和筛选后的日志数据
   */
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await logApi.getLogs({
        page,
        pageSize,
        module: moduleFilter || undefined,
        action: actionFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const body = res.data || res;
      setLogs(body.data || []);
      setTotal(body.pagination?.total || 0);
      setTotalPages(body.pagination?.totalPages || 0);
    } catch (error) {
      console.error('加载操作日志失败:', error);
      toast.error('加载操作日志失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, moduleFilter, actionFilter, startDate, endDate]);

  /* 页码或筛选条件变化时重新加载数据 */
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /* ---------- 筛选处理 ---------- */

  /**
   * 重置所有筛选条件
   */
  const handleResetFilters = () => {
    setModuleFilter('');
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  /**
   * 操作类型中文映射
   */
  const actionTextMap: Record<string, string> = {
    CREATE: '创建',
    UPDATE: '更新',
    DELETE: '删除',
    LOGIN: '登录',
    LOGOUT: '登出',
    EXPORT: '导出',
    IMPORT: '导入',
    create: '创建',
    update: '更新',
    delete: '删除',
    login: '登录',
    logout: '登出',
    export: '导出',
    import: '导入',
    other: '其他',
  };

  /**
   * 模块名称中文映射
   */
  const moduleTextMap: Record<string, string> = {
    auth: '认证',
    tenant: '租户管理',
    contract: '合同管理',
    department: '项目部管理',
    wms: '物资管理',
    labor: '劳资管理',
    subscription: '订阅管理',
    system: '系统配置',
    integration: '第三方集成',
    security: '安全策略',
  };

  /**
   * 根据操作类型返回对应的标签颜色类名
   */
  const getActionBadgeClass = (action: string): string => {
    switch (action) {
      case 'CREATE':
      case 'create': return 'bg-green-100 text-green-800';       /* 创建 - 绿色 */
      case 'UPDATE':
      case 'update': return 'bg-blue-100 text-blue-800';         /* 更新 - 蓝色 */
      case 'DELETE':
      case 'delete': return 'bg-red-100 text-red-800';           /* 删除 - 红色 */
      case 'LOGIN':
      case 'login': return 'bg-purple-100 text-purple-800';      /* 登录 - 紫色 */
      case 'LOGOUT':
      case 'logout': return 'bg-gray-100 text-gray-800';         /* 登出 - 灰色 */
      case 'EXPORT':
      case 'export': return 'bg-indigo-100 text-indigo-800';     /* 导出 - 靛蓝 */
      case 'IMPORT':
      case 'import': return 'bg-teal-100 text-teal-800';         /* 导入 - 青色 */
      default: return 'bg-gray-100 text-gray-800';               /* 其他 - 灰色 */
    }
  };

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">操作日志</h1>
          <p className="page-subtitle">全局系统操作日志查看</p>
        </div>
        {/* 日志图标 */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium">
          <ScrollText size={16} />
          日志中心
        </div>
      </div>

      {/* ==========================================
       * 筛选栏
       * ========================================== */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600">筛选条件</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 模块筛选 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">模块</label>
              <select
                data-testid="logs-module-filter"
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setPage(1);
                }}
                className="input text-sm"
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 操作类型筛选 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">操作类型</label>
              <select
                data-testid="logs-action-filter"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="input text-sm"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 开始日期 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">开始日期</label>
              <input
                type="date"
                data-testid="logs-start-date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="input text-sm"
              />
            </div>

            {/* 结束日期 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">结束日期</label>
              <input
                type="date"
                data-testid="logs-end-date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="input text-sm"
              />
            </div>

            {/* 重置按钮 */}
            <div className="flex items-end">
              <button
                onClick={handleResetFilters}
                data-testid="logs-reset-filters"
                className="btn-secondary btn-sm w-full flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} />
                重置
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
       * 日志列表表格
       * ========================================== */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">时间</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">企业/用户</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作类型</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">模块</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">描述</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP 地址</th>
              </tr>
            </thead>
            {/* 表体 */}
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                /* 加载中骨架屏 */
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                /* 无数据 */
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="暂无日志记录"
                      description="当前筛选条件下没有操作日志"
                    />
                  </td>
                </tr>
              ) : (
                /* 日志数据行 */
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    {/* 操作时间 */}
                    <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(log.timestamp, 'YYYY-MM-DD HH:mm:ss')}
                    </td>
                    {/* 企业/用户 */}
                    <td className="px-5 py-3">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{log.userName}</span>
                        {log.tenantName && (
                          <span className="text-xs text-gray-400 ml-1">({log.tenantName})</span>
                        )}
                      </div>
                    </td>
                    {/* 操作类型 */}
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                        {actionTextMap[log.action] || log.action}
                      </span>
                    </td>
                    {/* 模块 */}
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {moduleTextMap[log.module] || log.module}
                    </td>
                    {/* 描述 */}
                    <td className="px-5 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {log.description}
                    </td>
                    {/* IP 地址 */}
                    <td className="px-5 py-3 text-sm text-gray-400 font-mono">
                      {log.ip}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!loading && logs.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100">
            <Pagination
              current={page}
              total={totalPages}
              pageSize={pageSize}
              totalRecords={total}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Logs;
