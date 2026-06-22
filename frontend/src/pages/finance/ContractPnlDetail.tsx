/**
 * 资料通工程管理系统 - 单合同收支详情
 *
 * Phase 5: 单个合同的收入与支出详细分析
 * - 合同头部信息（名称、金额、经理、状态）
 * - 左右双列布局：收入明细 / 支出明细
 * - 底部分析摘要栏：利润、垫付、利润率、状态
 * - 返回列表按钮
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { financeApi } from '../../api';
import { formatMoney } from '../../components/ui/Common';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Receipt,
  FileText,
  ChevronRight,
  CircleDollarSign,
  Wallet,
  HardHat,
  Building2,
  Calculator,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface ExpenseCategory {
  categoryName: string;
  amount: number;
  percentage?: number;
}

interface ContractPnlDetailData {
  contractId: string;
  contractName: string;
  contractAmount: number;
  managerName: string;

  /* 收入 */
  receiptTotal: number;
  invoiceTotal: number;
  progressPaymentTotal: number;

  /* 支出 */
  totalExpense: number;
  expenseByCategory: ExpenseCategory[];
  pettyCashExpenseTotal: number;
  companyDirectExpenseTotal: number;
  subcontractPaid: number;
  subcontractOwed: number;
  workerSalaryTotal: number;

  /* 分析 */
  profit: number;
  advanceAmount: number;
  profitMargin: number;
  status: string;
}

/* ========================================
 * 常量
 * ======================================== */

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  '盈利': {
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-300',
    icon: '🟢',
    label: '盈利',
  },
  '平账': {
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    icon: '🟡',
    label: '平账',
  },
  '垫付': {
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: '🔴',
    label: '垫付',
  },
};

/** 费用类别颜色调色板 */
const CATEGORY_COLORS = [
  'oklch(0.55 0.18 250)',
  'oklch(0.65 0.18 145)',
  'oklch(0.75 0.15 85)',
  'oklch(0.54 0.22 25)',
  'oklch(0.50 0.16 200)',
  'oklch(0.58 0.17 315)',
  'oklch(0.52 0.15 30)',
  'oklch(0.45 0.14 270)',
];

/* ========================================
 * 子组件 - 详情行
 * ======================================== */

interface DetailRowProps {
  label: string;
  value: string;
  indent?: boolean;
  highlight?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  sublabel?: string;
}

const DetailRow: React.FC<DetailRowProps> = ({
  label,
  value,
  indent = false,
  highlight,
  icon,
  sublabel,
}) => {
  const valueColor =
    highlight === 'positive'
      ? 'text-green-600'
      : highlight === 'negative'
        ? 'text-red-600'
        : 'text-gray-700';

  return (
    <div className={`flex items-center justify-between py-2 ${indent ? 'pl-5' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-gray-400 flex-shrink-0">{icon}</span>}
        <span className={`text-sm ${indent ? 'text-gray-500' : 'text-gray-600'} truncate`}>
          {label}
        </span>
      </div>
      <div className="flex flex-col items-end flex-shrink-0 ml-3">
        <span className={`text-sm font-mono font-medium ${valueColor}`}>
          {value}
        </span>
        {sublabel && (
          <span className="text-xs text-gray-400">{sublabel}</span>
        )}
      </div>
    </div>
  );
};

/* ========================================
 * 子组件 - 信息面板
 * ======================================== */

interface InfoPanelProps {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const InfoPanel: React.FC<InfoPanelProps> = ({
  title,
  icon,
  iconColor,
  iconBg,
  children,
  footer,
}) => (
  <div className="card flex flex-col h-full">
    {/* 面板标题 */}
    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
    </div>

    {/* 面板内容 */}
    <div className="px-5 py-3 flex-1 space-y-0.5">{children}</div>

    {/* 面板底部 */}
    {footer && (
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">{footer}</div>
    )}
  </div>
);

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
 * 主组件 - ContractPnlDetail
 * ======================================== */

const ContractPnlDetail: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();

  /* ---------- 状态 ---------- */
  const [data, setData] = useState<ContractPnlDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------- 数据加载 ---------- */

  const loadData = async () => {
    if (!contractId) {
      setError('缺少合同 ID 参数');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res: any = await financeApi.getContractPnl(contractId);
      const body = res.data;
      const d = body?.data || body || {};

      /* 解析类别明细 */
      const rawCategories = d.expenseByCategory || d.expense_by_category || d.categories || [];
      const expenseByCategory: ExpenseCategory[] = Array.isArray(rawCategories)
        ? rawCategories.map((cat: any) => ({
            categoryName:
              cat.categoryName || cat.category_name || cat.name || '未分类',
            amount: cat.amount || cat.total || 0,
            percentage: cat.percentage || cat.ratio || cat.percent || undefined,
          }))
        : [];

      const totalExpense =
        d.totalExpense || d.total_expense || d.expenseTotal || 0;

      /* 自动计算百分比 */
      if (totalExpense > 0) {
        expenseByCategory.forEach((cat) => {
          if (cat.percentage === undefined) {
            cat.percentage = (cat.amount / totalExpense) * 100;
          }
        });
      }

      /* 按金额降序排列类别 */
      expenseByCategory.sort((a, b) => b.amount - a.amount);

      const receiptTotal =
        d.receiptTotal || d.receipt_total || d.income || 0;
      const invoiceTotal =
        d.invoiceTotal || d.invoice_total || 0;
      const progressPaymentTotal =
        d.progressPaymentTotal || d.progress_payment_total || d.progressTotal || 0;

      const profit = d.profit || (receiptTotal - totalExpense) || 0;
      const advanceAmount =
        d.advanceAmount || d.advance_amount || d.advance || 0;
      const profitMargin =
        d.profitMargin || d.profit_margin || d.margin ||
        (receiptTotal > 0 ? (profit / receiptTotal) * 100 : 0);

      /* 推断状态 */
      const status =
        d.status ||
        (advanceAmount > 0 && profit < 0
          ? '垫付'
          : profit > 0
            ? '盈利'
            : '平账');

      setData({
        contractId: d.contractId || d.contract_id || d.id || contractId,
        contractName:
          d.contractName || d.contract_name || d.name || '未命名合同',
        contractAmount:
          d.contractAmount || d.contract_amount || d.amount || 0,
        managerName:
          d.managerName || d.manager_name || d.projectManager || '',
        receiptTotal,
        invoiceTotal,
        progressPaymentTotal,
        totalExpense,
        expenseByCategory,
        pettyCashExpenseTotal:
          d.pettyCashExpenseTotal || d.petty_cash_expense_total || 0,
        companyDirectExpenseTotal:
          d.companyDirectExpenseTotal || d.company_direct_expense_total || 0,
        subcontractPaid:
          d.subcontractPaid || d.subcontract_paid || d.subcontractPaidTotal || 0,
        subcontractOwed:
          d.subcontractOwed || d.subcontract_owed || d.subcontractOwedTotal || 0,
        workerSalaryTotal:
          d.workerSalaryTotal || d.worker_salary_total || d.salaryTotal || 0,
        profit,
        advanceAmount,
        profitMargin,
        status,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || '加载合同收支详情失败';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [contractId]);

  /* ---------- 导航 ---------- */

  const goBack = () => {
    navigate('/finance/contract-pnl');
  };

  /* ---------- 获取状态配置 ---------- */

  const statusConfig = data ? STATUS_CONFIG[data.status] || STATUS_CONFIG['平账'] : null;

  /* ---------- 未收金额计算 ---------- */

  const unreceived = data ? data.invoiceTotal - data.receiptTotal : 0;

  /* ========================================
   * 加载状态
   * ======================================== */
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="btn-outline btn-sm flex items-center gap-1.5">
            <ArrowLeft size={14} />
            返回列表
          </button>
        </div>
        <div className="card">
          <div className="flex items-center justify-center h-96 text-gray-400">
            <Loader2 size={32} className="animate-spin mr-3" />
            <span className="text-base">加载合同收支详情...</span>
          </div>
        </div>
      </div>
    );
  }

  /* ========================================
   * 错误状态
   * ======================================== */
  if (error || !data) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="btn-outline btn-sm flex items-center gap-1.5">
            <ArrowLeft size={14} />
            返回列表
          </button>
        </div>
        <ErrorBanner message={error || '无法加载合同数据'} onRetry={loadData} />
      </div>
    );
  }

  /* ========================================
   * 正常渲染
   * ======================================== */
  return (
    <div className="space-y-5">
      {/* ========================================
       * 页面标题栏
       * ======================================== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={goBack}
            className="btn-outline btn-sm flex items-center gap-1.5 flex-shrink-0"
          >
            <ArrowLeft size={14} />
            返回列表
          </button>
          <div className="min-w-0">
            <h1 className="page-title truncate">{data.contractName}</h1>
            <p className="page-subtitle">合同收支盈利分析</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="btn-outline btn-sm flex items-center gap-1.5 flex-shrink-0"
        >
          <RefreshCw size={14} />
          刷新
        </button>
      </div>

      {/* ========================================
       * 合同信息头部
       * ======================================== */}
      <div className="card">
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6 flex-wrap">
            {/* 合同名称 */}
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-blue-500" />
              <span className="text-sm text-gray-500">合同名称:</span>
              <span className="text-sm font-semibold text-gray-800">
                {data.contractName}
              </span>
            </div>

            {/* 合同金额 */}
            {data.contractAmount > 0 && (
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-amber-500" />
                <span className="text-sm text-gray-500">合同金额:</span>
                <span className="text-sm font-semibold text-gray-800">
                  {formatMoney(data.contractAmount)}
                </span>
              </div>
            )}

            {/* 项目经理 */}
            {data.managerName && (
              <div className="flex items-center gap-2">
                <HardHat size={16} className="text-purple-500" />
                <span className="text-sm text-gray-500">项目经理:</span>
                <span className="text-sm font-medium text-gray-700">
                  {data.managerName}
                </span>
              </div>
            )}
          </div>

          {/* 盈亏状态徽章 */}
          {statusConfig && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
            >
              <span>{statusConfig.icon}</span>
              {statusConfig.label}
            </span>
          )}
        </div>
      </div>

      {/* ========================================
       * 双列布局：收入 / 支出
       * ======================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ---- 左侧：收入明细 ---- */}
        <InfoPanel
          title="收入明细"
          icon={<TrendingUp size={16} />}
          iconColor="oklch(0.65 0.18 145)"
          iconBg="oklch(0.65 0.18 145 / 0.12)"
          footer={
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                进款总额
              </span>
              <span className="text-lg font-bold font-mono text-green-600">
                {formatMoney(data.receiptTotal)}
              </span>
            </div>
          }
        >
          {/* 开票总额 */}
          <DetailRow
            label="开票总额"
            value={formatMoney(data.invoiceTotal)}
            icon={<Receipt size={14} />}
          />

          {/* 进度款总额 */}
          {data.progressPaymentTotal > 0 && (
            <DetailRow
              label="进度款总额"
              value={formatMoney(data.progressPaymentTotal)}
              icon={<CircleDollarSign size={14} />}
            />
          )}

          {/* 分隔线 */}
          <div className="border-t border-gray-100 my-2" />

          {/* 进款总额 */}
          <DetailRow
            label="进款总额"
            value={formatMoney(data.receiptTotal)}
            highlight="positive"
            icon={<TrendingUp size={14} />}
          />

          {/* 未收金额 */}
          <DetailRow
            label="未收金额"
            value={formatMoney(Math.max(unreceived, 0))}
            highlight={unreceived > 0 ? 'negative' : 'neutral'}
            icon={<AlertTriangle size={14} />}
            sublabel={
              unreceived > 0
                ? `开票 ${formatMoney(data.invoiceTotal)} − 进款 ${formatMoney(data.receiptTotal)}`
                : undefined
            }
          />
        </InfoPanel>

        {/* ---- 右侧：支出明细 ---- */}
        <InfoPanel
          title="支出明细"
          icon={<TrendingDown size={16} />}
          iconColor="oklch(0.54 0.22 25)"
          iconBg="oklch(0.54 0.22 25 / 0.10)"
          footer={
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                支出合计
              </span>
              <span className="text-lg font-bold font-mono text-red-600">
                {formatMoney(data.totalExpense)}
              </span>
            </div>
          }
        >
          {/* 费用合计 */}
          <DetailRow
            label="费用合计"
            value={formatMoney(data.totalExpense)}
            highlight="negative"
            icon={<TrendingDown size={14} />}
          />

          {/* 费用类别明细 */}
          {data.expenseByCategory.length > 0 && (
            <>
              <div className="mt-1 mb-1">
                <span className="text-xs text-gray-400 font-medium">费用分类明细</span>
              </div>
              {data.expenseByCategory.map((cat, index) => {
                const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                return (
                  <DetailRow
                    key={cat.categoryName}
                    label={cat.categoryName}
                    value={`${formatMoney(cat.amount)}${cat.percentage !== undefined ? ` (${cat.percentage.toFixed(1)}%)` : ''}`}
                    indent
                    icon={
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    }
                  />
                );
              })}
            </>
          )}

          {/* 分隔线 */}
          <div className="border-t border-gray-100 my-2" />

          {/* 其中：备用金报销 */}
          {data.pettyCashExpenseTotal > 0 && (
            <DetailRow
              label="其中备用金报销"
              value={formatMoney(data.pettyCashExpenseTotal)}
              icon={<Wallet size={14} />}
              indent
            />
          )}

          {/* 其中：公司直付 */}
          {data.companyDirectExpenseTotal > 0 && (
            <DetailRow
              label="其中公司直付"
              value={formatMoney(data.companyDirectExpenseTotal)}
              icon={<Building2 size={14} />}
              indent
            />
          )}

          {/* 分隔线 */}
          <div className="border-t border-gray-100 my-2" />

          {/* 分包已付 */}
          <DetailRow
            label="分包已付"
            value={formatMoney(data.subcontractPaid)}
            icon={<ChevronRight size={14} />}
          />

          {/* 分包欠款 */}
          <DetailRow
            label="分包欠款"
            value={formatMoney(data.subcontractOwed)}
            highlight={data.subcontractOwed > 0 ? 'negative' : 'neutral'}
            icon={<AlertTriangle size={14} />}
          />

          {/* 工人工资 */}
          {data.workerSalaryTotal > 0 && (
            <DetailRow
              label="工人工资"
              value={formatMoney(data.workerSalaryTotal)}
              icon={<HardHat size={14} />}
            />
          )}
        </InfoPanel>
      </div>

      {/* ========================================
       * 底部摘要栏
       * ======================================== */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calculator size={18} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-800">盈利分析</h2>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 利润 */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-medium">利润</span>
              <div className="flex items-center gap-2">
                {data.profit > 0 ? (
                  <TrendingUp size={20} className="text-green-500" />
                ) : data.profit < 0 ? (
                  <TrendingDown size={20} className="text-red-500" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-gray-200" />
                )}
                <span
                  className={`text-xl font-bold font-mono ${
                    data.profit > 0
                      ? 'text-green-600'
                      : data.profit < 0
                        ? 'text-red-600'
                        : 'text-gray-500'
                  }`}
                >
                  {data.profit > 0 ? '+' : ''}
                  {formatMoney(data.profit)}
                </span>
              </div>
              <span className="text-xs text-gray-400 mt-0.5">
                {formatMoney(data.receiptTotal)} − {formatMoney(data.totalExpense)}
              </span>
            </div>

            {/* 垫付金额 */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-medium">垫付金额</span>
              <div className="flex items-center gap-2">
                {data.advanceAmount > 0 ? (
                  <AlertTriangle size={20} className="text-red-500" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-gray-200" />
                )}
                <span
                  className={`text-xl font-bold font-mono ${
                    data.advanceAmount > 0 ? 'text-red-600' : 'text-gray-400'
                  }`}
                >
                  {data.advanceAmount > 0 ? formatMoney(data.advanceAmount) : '¥0.00'}
                </span>
              </div>
              <span className="text-xs text-gray-400 mt-0.5">
                {data.advanceAmount > 0 ? '存在垫付资金' : '无垫付'}
              </span>
            </div>

            {/* 利润率 */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-medium">利润率</span>
              <span
                className={`text-xl font-bold font-mono ${
                  data.profitMargin > 0
                    ? 'text-green-600'
                    : data.profitMargin < 0
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {data.profitMargin > 0 ? '+' : ''}
                {data.profitMargin.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-400 mt-0.5">
                利润 / 收入
              </span>
            </div>

            {/* 状态 */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-medium">盈亏状态</span>
              {statusConfig && (
                <span
                  className={`inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full text-sm font-semibold border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
                >
                  <span>{statusConfig.icon}</span>
                  {statusConfig.label}
                </span>
              )}
              <span className="text-xs text-gray-400 mt-0.5">
                {data.status === '盈利'
                  ? '收入大于支出'
                  : data.status === '垫付'
                    ? '支出大于收入且存在垫资'
                    : '收入与支出持平'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractPnlDetail;
