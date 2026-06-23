/**
 * 资料通工程管理系统 - 发票管理页面
 *
 * 功能说明：
 * 开发者后台的发票管理页面，支持创建发票、查看发票列表、
 * 对未开具的发票进行开具操作。
 *
 * 页面结构：
 * 1. 页面标题区域 + 创建发票按钮
 * 2. 创建发票内联表单（点击按钮展开）
 * 3. 发票列表表格（发票号、企业名称、抬头、金额、状态、创建时间、开具时间、操作）
 * 4. 分页功能
 *
 * API 调用：
 * - developerApi.getInvoices(params) - 获取发票列表
 * - developerApi.createInvoice(data) - 创建发票
 * - developerApi.issueInvoice(id) - 开具发票
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';
import {
  Pagination,
  EmptyState,
  formatDate,
} from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

/** 发票记录接口 */
interface Invoice {
  id: string;                       /* 发票 ID */
  invoiceNo: string;                /* 发票号码 */
  tenantName: string;               /* 企业名称 */
  title: string;                    /* 发票抬头 */
  taxId: string;                    /* 税号 */
  amount: number;                   /* 金额 */
  status: 'pending' | 'issued' | 'cancelled';  /* 状态 */
  createdAt: string;                /* 创建时间 */
  issuedAt?: string;                 /* 开具时间 */
}

interface TenantOption {
  id: string;
  name: string;
  code: string;
}

/** 创建发票表单数据接口 */
interface InvoiceFormData {
  tenantId: string;                 /* 企业 ID */
  title: string;                    /* 发票抬头 */
  taxId: string;                    /* 税号 */
  amount: string;                   /* 金额（字符串，方便输入） */
}

/* ========================================
 * 常量定义
 * ======================================== */

/** 状态中文映射 */
const STATUS_TEXT: Record<string, string> = {
  pending: '待开具',
  issued: '已开具',
  cancelled: '已作废',
};

/** 状态对应的标签样式 */
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  issued: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

/* ========================================
 * 辅助函数
 * ======================================== */

/**
 * 格式化金额
 * 将数值转换为带千分位分隔符的金额字符串
 */
const formatAmount = (amount: number): string => {
  return '¥' + amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/* ========================================
 * Invoices 发票管理组件
 * ======================================== */
const Invoices: React.FC = () => {
  /* ---------- 列表状态 ---------- */
  const [invoices, setInvoices] = useState<Invoice[]>([]);         /* 发票列表数据 */
  const [loading, setLoading] = useState(false);                    /* 列表加载状态 */
  const [total, setTotal] = useState(0);                            /* 总记录数 */
  const [totalPages, setTotalPages] = useState(0);                  /* 总页数 */
  const [page, setPage] = useState(1);                              /* 当前页码 */
  const [pageSize] = useState(20);                                  /* 每页条数 */
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]); /* 企业选项 */

  /* ---------- 创建发票状态 ---------- */
  const [showForm, setShowForm] = useState(false);                  /* 是否显示创建表单 */
  const [formData, setFormData] = useState<InvoiceFormData>({       /* 创建表单数据 */
    tenantId: '',
    title: '',
    taxId: '',
    amount: '',
  });
  const [creating, setCreating] = useState(false);                  /* 创建中状态 */

  /* ---------- 开具操作状态 ---------- */
  const [issuingId, setIssuingId] = useState<string | null>(null);  /* 正在开具的发票 ID */

  /* ---------- 数据加载 ---------- */

  /**
   * 加载发票列表
   * 调用 developerApi.getInvoices() 获取分页数据
   */
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await developerApi.getInvoices({ page, pageSize });
      const body = res.data || res;
      setInvoices(body.data || []);
      setTotal(body.pagination?.total || 0);
      setTotalPages(body.pagination?.totalPages || 0);
    } catch (error) {
      console.error('加载发票列表失败:', error);
      toast.error('加载发票列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const fetchTenantOptions = useCallback(async () => {
    try {
      const res = await developerApi.getTenants({ page: 1, pageSize: 100 });
      const body = res.data || res;
      setTenantOptions(body.data || []);
    } catch (error) {
      console.error('加载企业选项失败:', error);
      toast.error('加载企业选项失败');
    }
  }, []);

  /* 页码变化时重新加载数据 */
  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    fetchTenantOptions();
  }, [fetchTenantOptions]);

  /* ---------- 创建发票 ---------- */

  /**
   * 重置创建表单
   */
  const resetForm = () => {
    setFormData({ tenantId: '', title: '', taxId: '', amount: '' });
  };

  /**
   * 切换创建表单显示
   */
  const toggleForm = () => {
    setShowForm(!showForm);
    if (showForm) resetForm();
  };

  /**
   * 处理创建发票
   * 调用 developerApi.createInvoice() 提交表单
   */
  const handleCreate = async () => {
    /* 表单验证 */
    if (!formData.tenantId.trim()) {
      toast.error('请选择企业');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('请输入发票抬头');
      return;
    }
    if (!formData.taxId.trim()) {
      toast.error('请输入税号');
      return;
    }
    if (!formData.amount.trim() || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      toast.error('请输入有效金额');
      return;
    }

    try {
      setCreating(true);
      await developerApi.createInvoice({
        tenantId: formData.tenantId.trim(),
        title: formData.title.trim(),
        taxId: formData.taxId.trim(),
        amount: Number(formData.amount),
      });
      toast.success('发票创建成功');
      setShowForm(false);
      resetForm();
      setPage(1);
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message || '创建发票失败');
    } finally {
      setCreating(false);
    }
  };

  /* ---------- 开具发票 ---------- */

  /**
   * 开具发票
   * 调用 developerApi.issueInvoice() 进行开具操作
   * @param id - 发票 ID
   */
  const handleIssue = async (id: string) => {
    try {
      setIssuingId(id);
      await developerApi.issueInvoice(id);
      toast.success('发票已开具');
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message || '开具失败');
    } finally {
      setIssuingId(null);
    }
  };

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">发票管理</h1>
          <p className="page-subtitle">管理系统发票的开具与记录</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchInvoices(); }}
            data-testid="developer-invoices-refresh"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#8899AA' }}
            title="刷新数据"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={toggleForm} data-testid="developer-invoice-new" className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            创建发票
          </button>
        </div>
      </div>

      {/* ==========================================
       * 创建发票内联表单
       * ========================================== */}
      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              创建发票
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 企业名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  企业名称 <span className="text-red-500">*</span>
                </label>
                <select
                  data-testid="developer-invoice-tenant"
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className="input"
                >
                  <option value="">请选择企业</option>
                  {tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}（{tenant.code}）
                    </option>
                  ))}
                </select>
              </div>
              {/* 发票抬头 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  发票抬头 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  data-testid="developer-invoice-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  placeholder="请输入发票抬头"
                />
              </div>
              {/* 税号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  税号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  data-testid="developer-invoice-tax-id"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="input"
                  placeholder="请输入税号"
                />
              </div>
              {/* 金额 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  金额（元） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  data-testid="developer-invoice-amount"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input"
                  placeholder="请输入金额"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            {/* 表单按钮 */}
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={handleCreate}
                data-testid="developer-invoice-create"
                disabled={creating}
                className="btn-primary flex items-center gap-2"
              >
                {creating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                {creating ? '创建中...' : '确认创建'}
              </button>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="btn-secondary"
                disabled={creating}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
       * 发票列表表格
       * ========================================== */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">发票号</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">企业名称</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">抬头</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">金额</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">创建时间</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">开具时间</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            {/* 表体 */}
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                /* 加载中骨架屏 */
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                /* 无数据 */
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="暂无发票数据"
                      description="点击「创建发票」按钮创建第一张发票"
                    />
                  </td>
                </tr>
              ) : (
                /* 发票数据行 */
                invoices.map((invoice) => (
                  <tr key={invoice.id} data-testid={`developer-invoice-row-${invoice.id}`} className="hover:bg-gray-50 transition-colors">
                    {/* 发票号 */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800">{invoice.invoiceNo}</span>
                      </div>
                    </td>
                    {/* 企业名称 */}
                    <td className="px-5 py-3 text-sm text-gray-600">{invoice.tenantName}</td>
                    {/* 抬头 */}
                    <td className="px-5 py-3 text-sm text-gray-600 max-w-[160px] truncate" title={invoice.title}>
                      {invoice.title}
                    </td>
                    {/* 金额 */}
                    <td className="px-5 py-3 text-sm font-medium text-gray-800 text-right">
                      {formatAmount(invoice.amount)}
                    </td>
                    {/* 状态 */}
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[invoice.status]}`}>
                        {invoice.status === 'pending' && <Clock size={12} />}
                        {invoice.status === 'issued' && <CheckCircle2 size={12} />}
                        {invoice.status === 'cancelled' && <XCircle size={12} />}
                        {STATUS_TEXT[invoice.status]}
                      </span>
                    </td>
                    {/* 创建时间 */}
                    <td className="px-5 py-3 text-sm text-gray-400">{formatDate(invoice.createdAt)}</td>
                    {/* 开具时间 */}
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {invoice.issuedAt ? formatDate(invoice.issuedAt) : '-'}
                    </td>
                    {/* 操作按钮 */}
                    <td className="px-5 py-3 text-center">
                      {invoice.status === 'pending' ? (
                        <button
                          onClick={() => handleIssue(invoice.id)}
                          data-testid={`developer-invoice-issue-${invoice.id}`}
                          disabled={issuingId === invoice.id}
                          className="btn-primary btn-sm flex items-center gap-1.5 mx-auto"
                        >
                          {issuingId === invoice.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          {issuingId === invoice.id ? '开具中...' : '开具'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!loading && invoices.length > 0 && (
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

export default Invoices;
