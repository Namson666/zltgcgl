/**
 * 资料通工程管理系统 - 财务仪表盘
 *
 * Phase 3: 综合财务数据概览
 * - 6 张统计卡片（本月支出、本年累计、本月收入、累计收入、备用金余额、待审核数）
 * - 月度支出趋势图（CSS 水平柱状图）
 * - 费用类别占比（排行列表 + 比例条）
 * - 项目部开支排名表
 */

import React, { useEffect, useState } from 'react';
import { financeApi } from '../../api';
import { EmptyState, formatMoney } from '../../components/ui/Common';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Receipt,
  Building2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface SummaryData {
  monthExpense: number;
  yearExpense: number;
  monthIncome: number;
  yearIncome: number;
  pettyCashBalance: number;
  pendingCount: number;
}

interface MonthlyTrendItem {
  month: string;
  amount: number;
}

interface CategoryBreakdownItem {
  categoryName: string;
  amount: number;
  percentage: number;
  count?: number;
}

interface DepartmentRankingItem {
  departmentName: string;
  monthExpense: number;
  count: number;
}

/* ========================================
 * 常量
 * ======================================== */

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

const formatMonthLabel = (month: string): string => {
  const parts = month.split('-');
  if (parts.length !== 2) return month;
  return `${parseInt(parts[1])}月`;
};

/* ========================================
 * 子组件 - 统计卡片
 * ======================================== */

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | null;
  trendLabel?: string;
  bgColor: string;
  iconColor: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  trendLabel,
  bgColor,
  iconColor,
}) => (
  <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500 font-medium">{title}</span>
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
    </div>
    <div className="flex items-end gap-3">
      <span className="text-2xl font-bold text-gray-900 leading-none">
        {value}
      </span>
      {trend && (
        <span
          className={`flex items-center gap-0.5 text-xs font-medium pb-0.5 ${
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trendLabel}
        </span>
      )}
    </div>
  </div>
);

/* ========================================
 * 子组件 - 月度柱状图
 * ======================================== */

interface MonthlyBarChartProps {
  data: MonthlyTrendItem[];
  loading: boolean;
}

const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-sm">加载趋势数据...</span>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState title="暂无月度数据" description="当前没有可显示的月度支出记录" />
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const barWidth = (item.amount / maxAmount) * 100;
        return (
          <div key={item.month} className="flex items-center gap-3 group">
            {/* 月份标签 */}
            <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0">
              {formatMonthLabel(item.month)}
            </span>
            {/* 柱状条 */}
            <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(barWidth, 2)}%`,
                  background: `linear-gradient(90deg, oklch(0.55 0.18 250), oklch(0.46 0.19 250))`,
                }}
              />
            </div>
            {/* 金额 */}
            <span className="text-xs font-mono text-gray-700 w-24 flex-shrink-0 group-hover:text-blue-600 transition-colors">
              {formatMoney(item.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ========================================
 * 子组件 - 类别占比
 * ======================================== */

interface CategoryBreakdownProps {
  data: CategoryBreakdownItem[];
  loading: boolean;
}

const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-sm">加载类别数据...</span>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState title="暂无类别数据" description="当前没有可显示的费用类别记录" />
      </div>
    );
  }

  /** 类别颜色调色板 */
  const categoryColors = [
    'oklch(0.55 0.18 250)',
    'oklch(0.65 0.18 145)',
    'oklch(0.75 0.15 85)',
    'oklch(0.54 0.22 25)',
    'oklch(0.50 0.16 200)',
    'oklch(0.58 0.17 315)',
    'oklch(0.52 0.15 30)',
    'oklch(0.45 0.14 270)',
  ];

  const sorted = [...data].sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-3">
      {sorted.map((item, index) => {
        const pct = Math.max(item.percentage, 0);
        const color = categoryColors[index % categoryColors.length];
        return (
          <div key={item.categoryName} className="group">
            {/* 类别名称 + 金额 */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  {item.categoryName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{pct.toFixed(1)}%</span>
                <span className="text-sm font-mono text-gray-700 font-medium">
                  {formatMoney(item.amount)}
                </span>
              </div>
            </div>
            {/* 比例条 */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ========================================
 * 子组件 - 部门排名表
 * ======================================== */

interface DepartmentRankingProps {
  data: DepartmentRankingItem[];
  loading: boolean;
}

const DepartmentRanking: React.FC<DepartmentRankingProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-sm">加载排名数据...</span>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="py-12">
        <EmptyState title="暂无项目部数据" description="当前没有可显示的项目部开支记录" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
              排名
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              项目部
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
              本月支出
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              笔数
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            return (
              <tr
                key={item.departmentName}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3">
                  {isTop3 ? (
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                      style={{
                        backgroundColor:
                          rank === 1
                            ? 'oklch(0.75 0.15 85)'
                            : rank === 2
                              ? 'oklch(0.65 0.03 240)'
                              : 'oklch(0.55 0.06 40)',
                      }}
                    >
                      {rank}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 pl-2">{rank}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800">
                      {item.departmentName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-mono font-semibold text-gray-800">
                    {formatMoney(item.monthExpense)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-gray-500">{item.count} 笔</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ========================================
 * 子组件 - 错误提示横幅
 * ======================================== */

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => (
  <div className="flex items-center justify-between p-4 rounded-xl border border-red-200 bg-red-50">
    <div className="flex items-center gap-2">
      <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
      <span className="text-sm text-red-700">{message}</span>
    </div>
    <button
      onClick={onRetry}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
    >
      <RefreshCw size={12} />
      重试
    </button>
  </div>
);

/* ========================================
 * 主组件 - FinanceDashboard
 * ======================================== */

const FinanceDashboard: React.FC = () => {
  /* ---------- 状态 ---------- */

  const [summary, setSummary] = useState<SummaryData>({
    monthExpense: 0,
    yearExpense: 0,
    monthIncome: 0,
    yearIncome: 0,
    pettyCashBalance: 0,
    pendingCount: 0,
  });

  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendItem[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [departmentRanking, setDepartmentRanking] = useState<DepartmentRankingItem[]>([]);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [loadingCategory, setLoadingCategory] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(true);

  const [error, setError] = useState<string | null>(null);

  /* ---------- 数据加载 ---------- */

  const loadAllData = async () => {
    setError(null);
    setLoadingSummary(true);
    setLoadingTrend(true);
    setLoadingCategory(true);
    setLoadingRanking(true);

    /* 并行加载所有数据 */
    const loadSummary = financeApi
      .getSummary({ year: currentYear, month: currentMonth })
      .then((res: any) => {
        const body = res.data;
        const d = body?.data || body || {};
        setSummary({
          monthExpense: d.monthExpense || d.month_expense || d.totalMonth || 0,
          yearExpense: d.yearExpense || d.year_expense || d.totalYear || 0,
          monthIncome: d.monthIncome || d.month_income || 0,
          yearIncome: d.yearIncome || d.year_income || 0,
          pettyCashBalance: d.pettyCashBalance || d.petty_cash_balance || d.balance || 0,
          pendingCount: d.pendingCount || d.pending_count || d.pending || 0,
        });
      })
      .catch((err: any) => {
        console.error('加载汇总数据失败:', err);
      })
      .finally(() => setLoadingSummary(false));

    const loadTrend = financeApi
      .getMonthlySummary({ months: 12 })
      .then((res: any) => {
        const body = res.data;
        const list = body?.data || body || [];
        const items: MonthlyTrendItem[] = Array.isArray(list)
          ? list.map((item: any) => ({
              month: item.month || item.period || '',
              amount: item.amount || item.expense || item.total || 0,
            }))
          : [];
        /* 按月份排序 */
        items.sort((a, b) => a.month.localeCompare(b.month));
        setMonthlyTrend(items);
      })
      .catch((err: any) => {
        console.error('加载月度趋势失败:', err);
      })
      .finally(() => setLoadingTrend(false));

    const loadCategory = financeApi
      .getCategorySummary({ year: currentYear, month: currentMonth })
      .then((res: any) => {
        const body = res.data;
        const list = body?.data || body || [];
        const items: CategoryBreakdownItem[] = Array.isArray(list)
          ? list.map((item: any) => ({
              categoryName: item.categoryName || item.category_name || item.name || '未知',
              amount: item.amount || item.total || 0,
              percentage: item.percentage || item.ratio || item.percent || 0,
              count: item.count || item.expenseCount || undefined,
            }))
          : [];
        setCategoryBreakdown(items);
      })
      .catch((err: any) => {
        console.error('加载类别汇总失败:', err);
      })
      .finally(() => setLoadingCategory(false));

    const loadRanking = financeApi
      .getSummary({ year: currentYear, month: currentMonth, groupBy: 'department' })
      .then((res: any) => {
        const body = res.data;
        const list = body?.data?.departments || body?.departments || body?.data || body || [];
        const items: DepartmentRankingItem[] = Array.isArray(list)
          ? list.map((item: any) => ({
              departmentName:
                item.departmentName || item.department_name || item.name || '未知',
              monthExpense: item.monthExpense || item.month_expense || item.amount || 0,
              count: item.count || item.expenseCount || item.billCount || 0,
            }))
          : [];
        /* 按金额降序排列 */
        items.sort((a, b) => b.monthExpense - a.monthExpense);
        setDepartmentRanking(items);
      })
      .catch((err: any) => {
        console.error('加载部门排名失败:', err);
      })
      .finally(() => setLoadingRanking(false));

    /* 单独加载备用金余额（如果汇总中没返回） */
    if (summary.pettyCashBalance === 0) {
      financeApi
        .getBalanceSummary()
        .then((res: any) => {
          const body = res.data;
          const d = body?.data || body || {};
          const balance = d.totalBalance || d.total_balance || d.balance || 0;
          if (balance > 0) {
            setSummary((prev) => ({ ...prev, pettyCashBalance: balance }));
          }
        })
        .catch((err: any) => {
          console.error('加载备用金余额失败:', err);
        });
    }

    try {
      await Promise.all([loadSummary, loadTrend, loadCategory, loadRanking]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '加载数据失败';
      setError(msg);
      toast.error(msg);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  /* ---------- 渲染 ---------- */

  return (
    <div className="space-y-5">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">财务仪表盘</h1>
          <p className="page-subtitle">
            {currentYear}年{parseInt(currentMonth)}月 财务数据概览
          </p>
        </div>
        <button
          onClick={loadAllData}
          className="btn-outline btn-sm flex items-center gap-1.5"
          disabled={loadingSummary && loadingTrend && loadingCategory}
        >
          <RefreshCw
            size={14}
            className={
              loadingSummary && loadingTrend && loadingCategory ? 'animate-spin' : ''
            }
          />
          刷新数据
        </button>
      </div>

      {/* 全局错误提示 */}
      {error && <ErrorBanner message={error} onRetry={loadAllData} />}

      {/* ========================================
       * 一、统计卡片区域（6 张）
       * ======================================== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 本月支出 */}
        <StatCard
          title="本月支出"
          value={loadingSummary ? '...' : formatMoney(summary.monthExpense)}
          icon={<TrendingUp size={20} />}
          trend={summary.monthExpense > 0 ? 'up' : null}
          bgColor="oklch(0.95 0.04 25 / 0.12)"
          iconColor="oklch(0.54 0.22 25)"
        />

        {/* 本年累计 */}
        <StatCard
          title="本年累计"
          value={loadingSummary ? '...' : formatMoney(summary.yearExpense)}
          icon={<DollarSign size={20} />}
          trend={summary.yearExpense > 0 ? 'up' : null}
          bgColor="oklch(0.55 0.18 250 / 0.12)"
          iconColor="oklch(0.46 0.19 250)"
        />

        {/* 本月收入 */}
        <StatCard
          title="本月收入"
          value={loadingSummary ? '...' : formatMoney(summary.monthIncome)}
          icon={<ArrowUpRight size={20} />}
          trend={summary.monthIncome > 0 ? 'up' : null}
          trendLabel={summary.monthIncome > 0 ? '待完善' : undefined}
          bgColor="oklch(0.65 0.18 145 / 0.12)"
          iconColor="oklch(0.65 0.18 145)"
        />

        {/* 累计收入 */}
        <StatCard
          title="累计收入"
          value={loadingSummary ? '...' : formatMoney(summary.yearIncome)}
          icon={<TrendingDown size={20} />}
          bgColor="oklch(0.75 0.15 85 / 0.15)"
          iconColor="oklch(0.75 0.15 85)"
        />

        {/* 备用金余额 */}
        <StatCard
          title="备用金余额"
          value={loadingSummary ? '...' : formatMoney(summary.pettyCashBalance)}
          icon={<Wallet size={20} />}
          bgColor="oklch(0.50 0.16 200 / 0.12)"
          iconColor="oklch(0.50 0.16 200)"
        />

        {/* 待审核 */}
        <StatCard
          title="待审核"
          value={loadingSummary ? '...' : `${summary.pendingCount} 笔`}
          icon={<Clock size={20} />}
          trend={summary.pendingCount > 0 ? 'up' : null}
          bgColor="oklch(0.58 0.17 315 / 0.10)"
          iconColor="oklch(0.58 0.17 315)"
        />
      </div>

      {/* ========================================
       * 二、图表区域（左右两栏）
       * ======================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 左侧：月度支出趋势 */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-blue-500" />
              <h2 className="card-title">月度支出趋势</h2>
            </div>
            <span className="text-xs text-gray-400">最近 12 个月</span>
          </div>
          <div className="card-body">
            <MonthlyBarChart data={monthlyTrend} loading={loadingTrend} />
          </div>
        </div>

        {/* 右侧：费用类别占比 */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <DollarSign size={18} className="text-green-500" />
              <h2 className="card-title">费用类别占比</h2>
            </div>
            <span className="text-xs text-gray-400">
              {currentYear}年{parseInt(currentMonth)}月
            </span>
          </div>
          <div className="card-body">
            <CategoryBreakdown data={categoryBreakdown} loading={loadingCategory} />
          </div>
        </div>
      </div>

      {/* ========================================
       * 三、项目部开支排名
       * ======================================== */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-orange-500" />
            <h2 className="card-title">项目部开支排名</h2>
          </div>
          <span className="text-xs text-gray-400">
            {currentYear}年{parseInt(currentMonth)}月
          </span>
        </div>
        <div className="p-0">
          <DepartmentRanking data={departmentRanking} loading={loadingRanking} />
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
