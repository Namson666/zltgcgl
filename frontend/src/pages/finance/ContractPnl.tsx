/**
 * 资料通工程管理系统 - 合同盈利分析列表
 *
 * Phase 5: 全部合同盈利概览
 * - 4 张统计摘要卡片（合同总数、盈利数、垫付数、总利润）
 * - 状态筛选下拉框（全部/盈利/平账/垫付）
 * - 可排序表格（合同名称、收入、支出、利润、垫付、利润率、状态、操作）
 * - 点击行或"查看详情"按钮跳转到单合同收支详情页
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { financeApi } from '../../api';
import { EmptyState, formatMoney } from '../../components/ui/Common';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Search,
  FileQuestion,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface ContractPnlItem {
  contractId: string;
  contractName: string;
  receiptTotal: number;
  invoiceTotal: number;
  totalExpense: number;
  profit: number;
  advanceAmount: number;
  profitMargin: number;
  status: string;
  managerName?: string;
}

type FilterStatus = '全部' | '盈利' | '平账' | '垫付';
type SortField = 'profit' | 'receiptTotal' | 'totalExpense' | 'profitMargin' | 'contractName';
type SortDirection = 'asc' | 'desc';

/* ========================================
 * 常量
 * ======================================== */

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: '全部', label: '全部状态' },
  { value: '盈利', label: '盈利' },
  { value: '平账', label: '平账' },
  { value: '垫付', label: '垫付' },
];

const STATUS_BADGE_MAP: Record<string, { color: string; bg: string; icon: string }> = {
  '盈利': { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: '🟢' },
  '平账': { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: '🟡' },
  '垫付': { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '🔴' },
};

/* ========================================
 * 子组件 - 摘要卡片
 * ======================================== */

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
  valueColor?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  bgColor,
  iconColor,
  valueColor,
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
    <div className="flex flex-col gap-0.5">
      <span className={`text-2xl font-bold leading-none ${valueColor || 'text-gray-900'}`}>
        {value}
      </span>
      {subtitle && (
        <span className="text-xs text-gray-400">{subtitle}</span>
      )}
    </div>
  </div>
);

/* ========================================
 * 子组件 - 状态徽章
 * ======================================== */

interface PnlStatusBadgeProps {
  status: string;
}

const PnlStatusBadge: React.FC<PnlStatusBadgeProps> = ({ status }) => {
  const config = STATUS_BADGE_MAP[status] || STATUS_BADGE_MAP['平账'];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.color}`}
    >
      <span className="text-xs">{config.icon}</span>
      {status}
    </span>
  );
};

/* ========================================
 * 子组件 - 错误横幅
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
 * 主组件 - ContractPnl
 * ======================================== */

const ContractPnl: React.FC = () => {
  const navigate = useNavigate();

  /* ---------- 状态 ---------- */
  const [data, setData] = useState<ContractPnlItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('全部');
  const [sortField, setSortField] = useState<SortField>('profit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchKeyword, setSearchKeyword] = useState('');

  /* ---------- 数据加载 ---------- */

  const loadData = async () => {
    setError(null);
    setLoading(true);

    try {
      const res: any = await financeApi.getContractsPnl();
      const body = res.data;
      const list = body?.data?.items || body?.data || body || [];
      const items: ContractPnlItem[] = Array.isArray(list)
        ? list.map((item: any) => ({
            contractId: item.contractId || item.contract_id || item.id || '',
            contractName:
              item.contractName || item.contract_name || item.name || '未命名合同',
            receiptTotal: item.receiptTotal || item.receipt_total || item.income || 0,
            invoiceTotal: item.invoiceTotal || item.invoice_total || 0,
            totalExpense:
              item.totalExpense || item.total_expense || item.expense || 0,
            profit: item.profit || 0,
            advanceAmount:
              item.advanceAmount || item.advance_amount || item.advance || 0,
            profitMargin:
              item.profitMargin || item.profit_margin || item.margin || 0,
            status: item.status || getStatusFromProfit(
              item.profit || 0,
              item.advanceAmount || item.advance_amount || item.advance || 0
            ),
            managerName:
              item.managerName || item.manager_name || item.projectManager || '',
          }))
        : [];
      setData(items);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || '加载合同盈利数据失败';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ---------- 工具函数 ---------- */

  /** 根据利润和垫付金额推断状态 */
  function getStatusFromProfit(profit: number, advanceAmount: number): string {
    if (advanceAmount > 0 && profit < 0) return '垫付';
    if (profit > 0) return '盈利';
    if (profit < 0) return '垫付';
    return '平账';
  }

  /* ---------- 处理后的数据 ---------- */

  const filteredData = useMemo(() => {
    let result = [...data];

    /* 关键词搜索 */
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.contractName.toLowerCase().includes(kw) ||
          (item.managerName && item.managerName.toLowerCase().includes(kw))
      );
    }

    /* 状态筛选 */
    if (filterStatus !== '全部') {
      result = result.filter((item) => item.status === filterStatus);
    }

    /* 排序 */
    result.sort((a, b) => {
      let va: number;
      let vb: number;

      if (sortField === 'contractName') {
        return sortDirection === 'asc'
          ? a.contractName.localeCompare(b.contractName, 'zh-CN')
          : b.contractName.localeCompare(a.contractName, 'zh-CN');
      }

      va = a[sortField] as number;
      vb = b[sortField] as number;
      return sortDirection === 'asc' ? va - vb : vb - va;
    });

    return result;
  }, [data, filterStatus, sortField, sortDirection, searchKeyword]);

  /* ---------- 摘要统计 ---------- */

  const summary = useMemo(() => {
    const total = data.length;
    const profitable = data.filter((d) => d.status === '盈利').length;
    const advance = data.filter((d) => d.status === '垫付').length;
    const totalProfit = data.reduce((sum, d) => sum + d.profit, 0);
    return { total, profitable, advance, totalProfit };
  }, [data]);

  /* ---------- 排序切换 ---------- */

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-gray-300" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} className="text-blue-500" />
    ) : (
      <ChevronDown size={14} className="text-blue-500" />
    );
  };

  /* ---------- 导航 ---------- */

  const goToDetail = (contractId: string) => {
    navigate(`/finance/contract-pnl/${contractId}`);
  };

  /* ---------- 渲染 ---------- */

  return (
    <div className="space-y-5">
      {/* ========================================
       * 页面标题
       * ======================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">合同盈利分析</h1>
          <p className="page-subtitle">全部合同盈利概览</p>
        </div>
        <button
          onClick={loadData}
          className="btn-outline btn-sm flex items-center gap-1.5"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新数据
        </button>
      </div>

      {/* 全局错误提示 */}
      {error && <ErrorBanner message={error} onRetry={loadData} />}

      {/* ========================================
       * 摘要卡片区域（4 张）
       * ======================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 合同总数 */}
        <SummaryCard
          title="合同总数"
          value={loading ? '...' : `${summary.total} 个`}
          icon={<FileText size={20} />}
          bgColor="oklch(0.55 0.18 250 / 0.12)"
          iconColor="oklch(0.46 0.19 250)"
        />

        {/* 盈利合同数 */}
        <SummaryCard
          title="盈利合同"
          value={loading ? '...' : `${summary.profitable} 个`}
          icon={<TrendingUp size={20} />}
          bgColor="oklch(0.65 0.18 145 / 0.12)"
          iconColor="oklch(0.65 0.18 145)"
          valueColor="text-green-600"
        />

        {/* 垫付合同数 */}
        <SummaryCard
          title="垫付合同"
          value={loading ? '...' : `${summary.advance} 个`}
          icon={<AlertTriangle size={20} />}
          bgColor="oklch(0.54 0.22 25 / 0.10)"
          iconColor="oklch(0.54 0.22 25)"
          valueColor={summary.advance > 0 ? 'text-red-600' : undefined}
        />

        {/* 总利润 */}
        <SummaryCard
          title="总利润"
          value={loading ? '...' : formatMoney(summary.totalProfit)}
          icon={<DollarSign size={20} />}
          bgColor="oklch(0.75 0.15 85 / 0.15)"
          iconColor="oklch(0.75 0.15 85)"
          valueColor={
            summary.totalProfit > 0
              ? 'text-green-600'
              : summary.totalProfit < 0
                ? 'text-red-600'
                : undefined
          }
        />
      </div>

      {/* ========================================
       * 数据表格区域
       * ======================================== */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-500" />
            <h2 className="card-title">合同盈利明细</h2>
          </div>
          <span className="text-xs text-gray-400">
            共 {filteredData.length} 条记录
          </span>
        </div>

        {/* 工具栏：搜索 + 筛选 */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索合同名称..."
              className="input pl-9 text-sm"
            />
          </div>

          {/* 状态筛选 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 whitespace-nowrap">筛选:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="input text-sm py-1.5 w-28"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 表格内容 */}
        <div className="overflow-x-auto">
          {loading ? (
            /* ---- 加载状态 ---- */
            <div className="flex items-center justify-center h-64 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              <span className="text-sm">加载合同盈利数据...</span>
            </div>
          ) : error ? null : filteredData.length === 0 ? (
            /* ---- 空状态 ---- */
            <div className="flex items-center justify-center py-20">
              <EmptyState
                title={
                  searchKeyword || filterStatus !== '全部'
                    ? '未找到匹配的合同'
                    : '暂无合同盈利数据'
                }
                description={
                  searchKeyword || filterStatus !== '全部'
                    ? '请调整搜索条件或筛选状态后重试'
                    : '当前没有可显示的合同盈利记录'
                }
                icon={<FileQuestion size={64} />}
                action={
                  (searchKeyword || filterStatus !== '全部') ? (
                    <button
                      onClick={() => {
                        setSearchKeyword('');
                        setFilterStatus('全部');
                      }}
                      className="btn-outline btn-sm"
                    >
                      清除筛选
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            /* ---- 数据表格 ---- */
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    合同名称
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors w-36"
                    onClick={() => handleSort('receiptTotal')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      收入
                      {renderSortIcon('receiptTotal')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors w-36"
                    onClick={() => handleSort('totalExpense')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      支出
                      {renderSortIcon('totalExpense')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors w-36"
                    onClick={() => handleSort('profit')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      利润
                      {renderSortIcon('profit')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    垫付
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors w-28"
                    onClick={() => handleSort('profitMargin')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      利润率
                      {renderSortIcon('profitMargin')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    状态
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => {
                  const isProfitPositive = item.profit > 0;
                  const isProfitNegative = item.profit < 0;

                  return (
                    <tr
                      key={item.contractId}
                      className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() => goToDetail(item.contractId)}
                    >
                      {/* 合同名称 */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-800">
                            {item.contractName}
                          </span>
                          {item.managerName && (
                            <span className="text-xs text-gray-400 mt-0.5">
                              {item.managerName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 收入 */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-mono text-gray-700">
                          {formatMoney(item.receiptTotal)}
                        </span>
                      </td>

                      {/* 支出 */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-mono text-gray-700">
                          {formatMoney(item.totalExpense)}
                        </span>
                      </td>

                      {/* 利润 */}
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`text-sm font-mono font-semibold ${
                            isProfitPositive
                              ? 'text-green-600'
                              : isProfitNegative
                                ? 'text-red-600'
                                : 'text-gray-500'
                          }`}
                        >
                          {item.profit > 0 ? '+' : ''}
                          {formatMoney(item.profit)}
                        </span>
                      </td>

                      {/* 垫付 */}
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`text-sm font-mono ${
                            item.advanceAmount > 0
                              ? 'text-red-600 font-semibold'
                              : 'text-gray-400'
                          }`}
                        >
                          {item.advanceAmount > 0
                            ? formatMoney(item.advanceAmount)
                            : '-'}
                        </span>
                      </td>

                      {/* 利润率 */}
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`text-sm font-mono font-medium ${
                            item.profitMargin > 0
                              ? 'text-green-600'
                              : item.profitMargin < 0
                                ? 'text-red-600'
                                : 'text-gray-500'
                          }`}
                        >
                          {item.profitMargin > 0 ? '+' : ''}
                          {item.profitMargin.toFixed(1)}%
                        </span>
                      </td>

                      {/* 状态 */}
                      <td className="px-4 py-3.5 text-center">
                        <PnlStatusBadge status={item.status} />
                      </td>

                      {/* 操作 */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            goToDetail(item.contractId);
                          }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractPnl;
