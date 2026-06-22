/**
 * 资料通工程管理系统 - 收款记录列表
 * Phase 4: 收款记录管理列表，支持筛选、汇总和操作
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { financeApi, contractApi } from '../../api';
import { Pagination, EmptyState, formatDate, formatMoney } from '../../components/ui/Common';
import Modal from '../../components/ui/Modal';
import { Search, Edit3, Trash2, Plus, DollarSign, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface ReceiptRecord {
  id: string;
  receiptDate: string;
  contract?: { id: string; name: string };
  contractName?: string;
  invoice?: { id: string; invoiceNumber: string };
  invoiceNumber?: string;
  amount: number;
  payerName?: string;
  paymentMethod?: string;
  transactionNo?: string;
  accountName?: string;
  description?: string;
  createdAt?: string;
}

interface ContractOption {
  id: string;
  name: string;
}

interface Filters {
  contractId: string;
  startDate: string;
  endDate: string;
  keyword: string;
}

const initialFilters: Filters = {
  contractId: '',
  startDate: '',
  endDate: '',
  keyword: '',
};

/* ========================================
 * 常量映射
 * ======================================== */

const paymentMethodLabels: Record<string, string> = {
  bank_transfer: '银行转账',
  cash: '现金',
  check: '支票',
  other: '其他',
};

const getPaymentMethodLabel = (method?: string): string => {
  if (!method) return '-';
  return paymentMethodLabels[method] || method;
};

/* ========================================
 * 主组件
 * ======================================== */

const ReceiptList: React.FC = () => {
  const navigate = useNavigate();

  /* ---------- 列表状态 ---------- */
  const [records, setRecords] = useState<ReceiptRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(false);

  /* 汇总数据 */
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);

  /* 合同下拉选项 */
  const [contracts, setContracts] = useState<ContractOption[]>([]);

  /* 删除确认 */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 20;

  /* ---------- 初始加载 ---------- */

  useEffect(() => {
    loadContracts();
    loadSummary();
  }, []);

  const loadContracts = async () => {
    try {
      const res = await contractApi.getList({ pageSize: 500 });
      const body = res.data as any;
      const list = body?.data?.items || body?.data || body || [];
      setContracts(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('加载合同列表失败:', err);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await financeApi.getReceiptsSummary();
      const body = res.data as any;
      const data = body?.data || body || {};
      setSummaryTotal(data.totalAmount || data.total_amount || data.total || 0);
    } catch {
      /* 汇总加载失败不影响主列表 */
      setSummaryTotal(0);
    } finally {
      setSummaryLoading(false);
    }
  };

  /* ---------- 加载数据 ---------- */

  useEffect(() => {
    loadData();
  }, [page, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (filters.contractId) params.contractId = filters.contractId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.keyword) params.keyword = filters.keyword;

      const res = await financeApi.getReceipts(params);
      const body = res.data as any;
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      const totalCount = body?.meta?.total ?? listData?.total ?? items.length;
      setRecords(items);
      setTotal(totalCount);

      /* 如果内部汇总无数据则使用列表数据重新计算 */
      if (summaryTotal === 0 && items.length > 0) {
        const listSum = items.reduce((sum: number, r: ReceiptRecord) => sum + (r.amount || 0), 0);
        setSummaryTotal(listSum);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '加载收款列表失败');
      console.error(err);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- 筛选操作 ---------- */

  const updateFilter = (field: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  const hasFilters = Object.values(filters).some((v) => v !== '');

  /* ---------- 删除操作 ---------- */

  const openDeleteConfirm = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await financeApi.deleteReceipt(deletingId);
      toast.success('收款记录已删除');
      setShowDeleteConfirm(false);
      setDeletingId(null);
      /* 重新加载汇总和列表 */
      loadSummary();
      if (records.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        loadData();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '删除失败');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- 计算 ---------- */

  const totalPages = Math.ceil(total / pageSize);

  const getContractName = (record: ReceiptRecord): string => {
    return record.contract?.name || record.contractName || '-';
  };

  const getInvoiceNumber = (record: ReceiptRecord): string => {
    return record.invoice?.invoiceNumber || record.invoiceNumber || '-';
  };

  /* ---------- 渲染 ---------- */

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">收款记录</h1>
          <p className="page-subtitle">管理所有收款记录，跟踪每笔进款和关联发票</p>
        </div>
        <button
          className="btn-primary flex items-center gap-1.5"
          onClick={() => navigate('/finance/receipts/form')}
        >
          <Plus size={16} />
          新增收款
        </button>
      </div>

      {/* 汇总卡片 */}
      <div className="card p-5 bg-gradient-to-r from-green-50 to-blue-50 border border-green-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <DollarSign size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">总收款金额</p>
            <p className="text-xl font-bold text-gray-900">
              {summaryLoading ? (
                <span className="inline-flex items-center gap-1 text-base text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                  加载中...
                </span>
              ) : (
                formatMoney(summaryTotal)
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="card py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">合同</label>
            <select
              className="input text-sm w-44"
              value={filters.contractId}
              onChange={(e) => updateFilter('contractId', e.target.value)}
            >
              <option value="">全部合同</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">开始日期</label>
            <input
              type="date"
              className="input text-sm w-36"
              value={filters.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">结束日期</label>
            <input
              type="date"
              className="input text-sm w-36"
              value={filters.endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">搜索</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9 text-sm w-48"
                placeholder="付款方/流水号..."
                value={filters.keyword}
                onChange={(e) => updateFilter('keyword', e.target.value)}
              />
            </div>
          </div>
          {hasFilters && (
            <button
              className="text-xs text-blue-600 hover:underline pb-2"
              onClick={clearFilters}
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* 表格 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-th">收款日期</th>
                <th className="table-th">合同</th>
                <th className="table-th">关联发票号</th>
                <th className="table-th text-right">进款金额</th>
                <th className="table-th">付款方</th>
                <th className="table-th">收款方式</th>
                <th className="table-th">流水号</th>
                <th className="table-th">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="table-td text-center py-12 text-gray-400">
                    加载中...
                  </td>
                </tr>
              ) : !records.length ? (
                <tr>
                  <td colSpan={8} className="table-td text-center py-12">
                    <EmptyState title="暂无收款记录" description="点击「新增收款」开始录入" />
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="table-td text-xs whitespace-nowrap">
                      {r.receiptDate ? formatDate(r.receiptDate) : '-'}
                    </td>
                    <td className="table-td text-xs max-w-[140px] truncate">
                      {getContractName(r)}
                    </td>
                    <td className="table-td font-mono text-xs">
                      {getInvoiceNumber(r)}
                    </td>
                    <td className="table-td text-right font-mono text-sm font-semibold text-green-600">
                      {formatMoney(r.amount)}
                    </td>
                    <td className="table-td text-xs">{r.payerName || '-'}</td>
                    <td className="table-td text-xs">
                      {getPaymentMethodLabel(r.paymentMethod)}
                    </td>
                    <td className="table-td font-mono text-xs text-gray-500">
                      {r.transactionNo || '-'}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/finance/receipts/form?id=${r.id}`)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="编辑"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(r.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100">
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

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="删除确认"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            确定要删除这笔收款记录吗？删除后对应发票的已收款金额将会减少。此操作不可撤销。
          </p>
          <div className="flex gap-3 justify-end">
            <button
              className="btn-secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              取消
            </button>
            <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReceiptList;
