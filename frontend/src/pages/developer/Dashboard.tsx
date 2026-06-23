/**
 * 资料通工程管理系统 - 开发者后台看板页面
 *
 * 功能说明：
 * 综合数据看板，展示系统级统计数据和趋势图表。
 * 支持企业/用户统计、收入趋势、企业注册趋势、用量排行、快捷操作。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, DollarSign, Activity, HardDrive, Globe,
  Shield, ArrowRight, Cpu, FileSearch, ScrollText, Settings,
  TrendingUp, TrendingDown, Minus, RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../lib/AuthContext';
import { developerApi } from '../../api';

/* ========================================
 * 类型定义
 * ======================================== */

interface StatsData {
  tenants: { total: number; active: number; newThisMonth: number };
  users: { total: number; active: number; newThisMonth: number };
  revenue: { total: number; thisMonth: number };
  subscriptions: { byStatus: Record<string, number>; total: number };
  attachments: { totalSize: number; newThisMonth: number };
  apiUsage: { total: number; thisMonth: number };
  onlineUsers: number;
}

interface UsageItem {
  id: string; name: string; code: string;
  userCount: number; apiUsage: number; storage: number;
}

interface RevenueItem { month: string; amount: number }
interface DailyItem { date: string; tenants: number; users: number }

/* ========================================
 * 辅助函数
 * ======================================== */

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatMoney = (amount: number): string => {
  if (amount >= 10000) return '¥' + (amount / 10000).toFixed(1) + '万';
  return '¥' + amount.toFixed(0);
};

const getTrendIcon = (current: number, previous: number) => {
  if (previous === 0) return { icon: <Minus size={14} />, color: '#8899AA' };
  const ratio = current / previous;
  if (ratio > 1.05) return { icon: <TrendingUp size={14} />, color: '#22C55E' };
  if (ratio < 0.95) return { icon: <TrendingDown size={14} />, color: '#EF4444' };
  return { icon: <Minus size={14} />, color: '#F59E0B' };
};

/* ========================================
 * DeveloperDashboard 组件
 * ======================================== */
const DeveloperDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isDeveloper } = useAuthStore();

  const [stats, setStats] = useState<StatsData | null>(null);
  const [usageData, setUsageData] = useState<UsageItem[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueItem[]>([]);
  const [dailyData, setDailyData] = useState<DailyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageSortBy, setUsageSortBy] = useState<'apiUsage' | 'storage' | 'users'>('apiUsage');

  /** 从 Axios 响应中提取实际数据 */
  const extractData = <T,>(response: any, fallback: T): T => {
    try {
      const body = response?.data ?? response;
      return (body?.data ?? body) as T;
    } catch {
      return fallback;
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usageRes, revenueRes, dailyRes] = await Promise.all([
        developerApi.getStats(),
        developerApi.getUsageRanking({ sortBy: usageSortBy, limit: 10 }),
        developerApi.getRevenueTrend(12),
        developerApi.getDailyStats(30),
      ]);
      setStats(extractData<StatsData>(statsRes, null!));
      setUsageData(extractData<UsageItem[]>(usageRes, []));
      setRevenueData(extractData<RevenueItem[]>(revenueRes, []));
      setDailyData(extractData<DailyItem[]>(dailyRes, []));
    } catch (error) {
      console.error('加载看板数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [usageSortBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => { fetchData(); };

  if (!isDeveloper) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">无权限访问</h2>
        <p className="text-gray-400">该页面仅开发者账号可访问</p>
      </div>
    );
  }

  /* ---------- 渲染统计卡片 ---------- */
  const renderStatCard = (
    title: string, value: string | number, subtitle: string,
    icon: React.ReactNode, bgColor: string, iconColor: string, testId?: string
  ) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 mb-1 truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-800">
            {loading ? (
              <span className="inline-block w-16 h-7 bg-gray-200 rounded animate-pulse" />
            ) : value}
          </p>
          <p className="text-xs text-gray-400 mt-1 truncate">{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${bgColor} ${iconColor} flex items-center justify-center flex-shrink-0 ml-3`}>
          {icon}
        </div>
      </div>
    </div>
  );

  /* ---------- 渲染条形图 ---------- */
  const renderBarChart = (
    data: { label: string; value: number; color?: string }[],
    maxValue: number,
    unit: string
  ) => (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-20 text-right flex-shrink-0 truncate">{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-1.5"
              style={{
                width: maxValue > 0 ? `${Math.max((item.value / maxValue) * 100, 2)}%` : '0%',
                backgroundColor: item.color || '#1A3A5C',
              }}
            >
              {item.value > 0 && (
                <span className="text-[10px] text-white font-medium">{item.value}{unit}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  /* ---------- 获取最大收入用于图表 ---------- */
  const maxRevenue = Math.max(...revenueData.map((r) => r.amount), 1);
  const maxDailyTenants = Math.max(...dailyData.map((d) => d.tenants), 1);
  const maxDailyUsers = Math.max(...dailyData.map((d) => d.users), 1);

  /* 使用排行表格的列配置 */
  const usageColumns: { key: string; label: string; sortKey: typeof usageSortBy }[] = [
    { key: 'name', label: '企业名称', sortKey: 'apiUsage' },
    { key: 'userCount', label: '用户数', sortKey: 'users' },
    { key: 'apiUsage', label: 'API调用', sortKey: 'apiUsage' },
    { key: 'storage', label: '存储', sortKey: 'storage' },
  ];

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A2B3C' }}>开发者后台</h1>
          <p className="text-sm mt-1" style={{ color: '#8899AA' }}>系统管理与数据监控中心</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium">
            <Shield size={16} />
            开发者模式
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#8899AA' }}
            title="刷新数据"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ==========================================
       * 顶部统计卡片行（6个）
       * ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {renderStatCard('企业总数', stats?.tenants.total ?? '--', `本月新增 ${stats?.tenants.newThisMonth ?? 0}`,
          <Building2 size={22} />, 'bg-blue-50', 'text-blue-600', 'developer-dashboard-tenants')}
        {renderStatCard('用户总数', stats?.users.total ?? '--', `本月新增 ${stats?.users.newThisMonth ?? 0}`,
          <Users size={22} />, 'bg-green-50', 'text-green-600', 'developer-dashboard-users')}
        {renderStatCard('本月收入', stats ? formatMoney(stats.revenue.thisMonth) : '--',
          `累计 ${stats ? formatMoney(stats.revenue.total) : '--'}`,
          <DollarSign size={22} />, 'bg-emerald-50', 'text-emerald-600', 'developer-dashboard-revenue')}
        {renderStatCard('API调用', stats?.apiUsage.total ?? '--',
          `本月 ${stats?.apiUsage.thisMonth ?? 0} 次`,
          <Activity size={22} />, 'bg-purple-50', 'text-purple-600', 'developer-dashboard-api-usage')}
        {renderStatCard('附件存储', stats ? formatBytes(stats.attachments.totalSize) : '--',
          `本月新增 ${stats ? formatBytes(stats.attachments.newThisMonth) : '--'}`,
          <HardDrive size={22} />, 'bg-amber-50', 'text-amber-600', 'developer-dashboard-storage')}
        {renderStatCard('当前在线', stats?.onlineUsers ?? '--', '实时在线用户数',
          <Globe size={22} />, 'bg-rose-50', 'text-rose-600', 'developer-dashboard-online-users')}
      </div>

      {/* ==========================================
       * 第二行：收入趋势 + 注册趋势
       * ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* ---------- 收入趋势 ---------- */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" data-testid="developer-dashboard-revenue-trend">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>
              <DollarSign size={16} className="inline mr-1.5 text-emerald-500" />
              收入趋势（近12个月）
            </h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : revenueData.length > 0 ? (
            renderBarChart(
              revenueData.map((r) => ({
                label: r.month.slice(5),
                value: r.amount,
                color: '#10B981',
              })),
              maxRevenue,
              ''
            )
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">暂无收入数据</p>
          )}
        </div>

        {/* ---------- 每日注册趋势 ---------- */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" data-testid="developer-dashboard-daily-trend">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>
              <TrendingUp size={16} className="inline mr-1.5 text-blue-500" />
              每日注册趋势（近30天）
            </h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : dailyData.length > 0 ? (
            <div className="space-y-1.5">
              {dailyData.filter((_, i) => i % 3 === 0).map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 text-right flex-shrink-0">{d.date.slice(5)}</span>
                  <div className="flex-1 flex gap-1">
                    <div className="flex-1 bg-blue-50 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(d.tenants / maxDailyTenants) * 100}%`, minWidth: d.tenants > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <div className="flex-1 bg-green-50 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${(d.users / maxDailyUsers) * 100}%`, minWidth: d.users > 0 ? '4px' : '0' }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right flex-shrink-0">
                    {d.tenants}/{d.users}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-3 rounded bg-blue-500" /> 新企业
                <span className="inline-block w-3 h-3 rounded bg-green-500 ml-3" /> 新用户
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">暂无注册数据</p>
          )}
        </div>
      </div>

      {/* ==========================================
       * 第三行：用量排行 + 快捷操作
       * ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* ---------- 用量排行 ---------- */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm" data-testid="developer-dashboard-usage-ranking">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>
              <Activity size={16} className="inline mr-1.5 text-purple-500" />
              企业用量排行
            </h2>
            <div className="flex items-center gap-1 text-xs">
              {usageColumns.filter((c) => c.sortKey).map((col) => (
                <button
                  key={col.sortKey}
                  onClick={() => setUsageSortBy(col.sortKey)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    usageSortBy === col.sortKey
                      ? 'text-white font-medium'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  style={usageSortBy === col.sortKey ? { backgroundColor: '#1A3A5C' } : {}}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-0">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : usageData.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {usageData.map((item, i) => (
                  <div key={item.id} className="flex items-center px-5 py-2.5 hover:bg-gray-50 transition-colors">
                    <span className={`w-6 text-xs font-bold ${i < 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.code}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {item.userCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity size={12} /> {item.apiUsage}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive size={12} /> {formatBytes(item.storage)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">暂无用量数据</p>
            )}
          </div>
        </div>

        {/* ---------- 快捷操作 ---------- */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>
              <Settings size={16} className="inline mr-1.5 text-gray-500" />
              快捷操作
            </h2>
          </div>
          <div className="p-4 space-y-1.5">
            <ActionButton
              icon={<Building2 size={18} />}
              label="管理企业"
              desc="创建和管理租户"
              bgColor="bg-blue-50"
              iconColor="text-blue-600"
              onClick={() => navigate('/dev/tenants')}
              testId="developer-dashboard-action-tenants"
            />
            <ActionButton
              icon={<Cpu size={18} />}
              label="AI 配置"
              desc="模型和 API 密钥"
              bgColor="bg-purple-50"
              iconColor="text-purple-600"
              onClick={() => navigate('/dev/ai-config')}
              testId="developer-dashboard-action-ai-config"
            />
            <ActionButton
              icon={<FileSearch size={18} />}
              label="OCR 配置"
              desc="识别引擎设置"
              bgColor="bg-green-50"
              iconColor="text-green-600"
              onClick={() => navigate('/dev/ocr-config')}
              testId="developer-dashboard-action-ocr-config"
            />
            <ActionButton
              icon={<Settings size={18} />}
              label="系统配置"
              desc="系统参数管理"
              bgColor="bg-cyan-50"
              iconColor="text-cyan-600"
              onClick={() => navigate('/dev/system-config')}
              testId="developer-dashboard-action-system-config"
            />
            <ActionButton
              icon={<ScrollText size={18} />}
              label="查看日志"
              desc="全局操作日志"
              bgColor="bg-amber-50"
              iconColor="text-amber-600"
              onClick={() => navigate('/dev/logs')}
              testId="developer-dashboard-action-logs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================
 * ActionButton 子组件
 * ======================================== */
const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  desc: string;
  bgColor: string;
  iconColor: string;
  onClick: () => void;
  testId?: string;
}> = ({ icon, label, desc, bgColor, iconColor, onClick, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
  >
    <div className={`w-9 h-9 rounded-lg ${bgColor} ${iconColor} flex items-center justify-center flex-shrink-0`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
    <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
  </button>
);

export default DeveloperDashboard;
