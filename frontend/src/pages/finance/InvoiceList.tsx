/**
 * 资料通工程管理系统 - 开票记录列表
 * Phase 4: 发票管理列表，支持筛选、查看详情、编辑和删除
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { financeApi, contractApi } from '../../api';
import { Pagination, EmptyState, StatusBadge, formatDate, formatMoney } from '../../components/ui/Common';
import Modal from '../../components/ui/Modal';
import {
  Search,
  Eye,
  Edit3,
  Trash2,
  Plus,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  contract?: { id: string; name: string };
  contractName?: string;
  invoiceDate: string;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  invoiceType?: string;
  buyerName?: string;
  description?: string;
  status: 'draft' | 'issued' | 'voided';
  imageUrl?: string;
  createdAt?: string;
  totalReceived?: number;
}

interface ContractOption {
  id: string;
  name: string;
}

interface ReceiptRecord {
  id: string;
  receiptDate: string;
  amount: number;
  payerName?: string;
  paymentMethod?: string;
  transactionNo?: string;
  accountName?: string;
  description?: string;
}

interface Filters {
  contractId: string;
  status: string;
  startDate: string;
  endDate: string;
}

const initialFilters: Filters = {
  contractId: '',
  status: '',
  startDate: '',
  endDate: '',
};

/* ========================================
 * 常量映射
 * ======================================== */

const statusConfig: Record<string, { label: string; type: 'success' | 'default' | 'warning' }> = {
  issued: { label: '已开票', type: 'success' },
  voided: { label: '已作废', type: 'default' },
  draft: { label: '草稿', type: 'warning' },
};

const invoiceTypeLabels: Record<string, string> = {
  vat_special: '增值税专票',
  vat_normal: '增值税普票',
  normal: '普通发票',
  other: '其他',
};

/* ========================================
 * 子组件 - 收款状态指示器
 * ======================================== */

const ReceiptStatusIndicator: React.FC<{ invoice: InvoiceRecord }> = ({ invoice }) => {
  const received = invoice.totalReceived ?? 0;
  const total = invoice.amount ?? 0;

  if (total <= 0) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  if (received <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
        <XCircle size={12} />
        未收
      </span>
    );
  }

  if (received >= total) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle size={12} />
        已收完
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-orange-500 font-medium">
      <AlertTriangle size={12} />
      部分
    </span>
  );
};

/* ========================================
 * 主组件
 * ======================================== */

const InvoiceList: React.FC = () => {
  const navigate = useNavigate();

  /* ---------- 列表状态 ---------- */
  const [records, setRecords] = useState<InvoiceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(false);

  /* 合同下拉选项 */
  const [contracts, setContracts] = useState<ContractOption[]>([]);

  /* 展开行 */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedReceipts, setExpandedReceipts] = useState<ReceiptRecord[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  /* 详情弹窗 */
  const [showDetail, setShowDetail] = useState(false);
  const [detailRecord, setDetailRecord] = useState<InvoiceRecord | null>(null);

  /* 删除确认 */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 20;

  /* ---------- 初始加载 ---------- */

  useEffect(() => {
    loadContracts();
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

  /* ---------- 加载数据 ---------- */

  useEffect(() => {
    loadData();
  }, [page, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (filters.contractId) params.contractId = filters.contractId;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res = await financeApi.getInvoices(params);
      const body = res.data as any;
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      const totalCount = body?.meta?.total ?? listData?.total ?? items.length;
      setRecords(items);
      setTotal(totalCount);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '加载发票列表失败');
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
    setExpandedId(null);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setPage(1);
    setExpandedId(null);
  };

  const hasFilters = Object.values(filters).some((v) => v !== '');

  /* ---------- 展开/收起收款明细 ---------- */

  const toggleExpand = async (record: InvoiceRecord) => {
    if (expandedId === record.id) {
      setExpandedId(null);
      setExpandedReceipts([]);
      return;
    }

    setExpandedId(record.id);
    setLoadingReceipts(true);
    try {
      /* 优先使用 API 获取关联收款 */
      const res = await financeApi.getInvoiceReceipts(record.id);
      const body = res.data as any;
      const data = body?.data || body || [];
      setExpandedReceipts(Array.isArray(data) ? data : (data?.items || []));
    } catch {
      /* 若 API 不可用，回退到列表内嵌数据 */
      const fallback = (record as any).receipts;
      setExpandedReceipts(Array.isArray(fallback) ? fallback : []);
    } finally {
      setLoadingReceipts(false);
    }
  };

  /* ---------- CRUD 操作 ---------- */

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await financeApi.deleteInvoice(deletingId);
      toast.success('发票已删除');
      setShowDeleteConfirm(false);
      setDeletingId(null);
      /* 若当前页仅剩1条且不是第一页，回到上一页 */
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

  const openDeleteConfirm = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const openDetail = (record: InvoiceRecord) => {
    setDetailRecord(record);
    setShowDetail(true);
  };

  /* ---------- 计算 ---------- */

  const totalPages = Math.ceil(total / pageSize);

  const getContractName = (record: InvoiceRecord): string => {
    return record.contract?.name || record.contractName || '-';
  };

  const getInvoiceTypeLabel = (type?: string): string => {
    if (!type) return '-';
    return invoiceTypeLabels[type] || type;
  };

  /* ---------- 渲染 ---------- */

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">开票记录</h1>
          <p className="page-subtitle">管理所有发票的开具、作废和关联收款</p>
        </div>
        <button
          className="btn-primary flex items-center gap-1.5"
          onClick={() => navigate('/finance/invoices/form')}
        >
          <Plus size={16} />
          新增发票
        </button>
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
            <label className="block text-xs text-gray-500 mb-1">状态</label>
            <select
              className="input text-sm w-28"
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="">全部</option>
              <option value="issued">已开票</option>
              <option value="draft">草稿</option>
              <option value="voided">已作废</option>
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
                <th className="table-th w-10"></th>
                <th className="table-th">发票号码</th>
                <th className="table-th">合同名称</th>
                <th className="table-th">开票日期</th>
                <th className="table-th text-right">金额</th>
                <th className="table-th text-right">已收款</th>
                <th className="table-th text-right">未收款</th>
                <th className="table-th">收款状态</th>
                <th className="table-th">状态</th>
                <th className="table-th">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="table-td text-center py-12 text-gray-400">
                    加载中...
                  </td>
                </tr>
              ) : !records.length ? (
                <tr>
                  <td colSpan={10} className="table-td text-center py-12">
                    <EmptyState title="暂无发票记录" description="点击「新增发票」开始录入" />
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const received = r.totalReceived ?? 0;
                  const outstanding = Math.max((r.amount ?? 0) - received, 0);
                  const statusCfg = statusConfig[r.status] || { label: r.status, type: 'default' as const };
                  const isExpanded = expandedId === r.id;

                  return (
                    <React.Fragment key={r.id}>
                      {/* 主行 */}
                      <tr
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpand(r)}
                      >
                        <td className="table-td">
                          {isExpanded ? (
                            <ChevronUp size={14} className="text-blue-500" />
                          ) : (
                            <ChevronDown size={14} className="text-gray-400" />
                          )}
                        </td>
                        <td className="table-td font-medium font-mono text-sm">
                          {r.invoiceNumber || '-'}
                        </td>
                        <td className="table-td text-xs max-w-[140px] truncate">
                          {getContractName(r)}
                        </td>
                        <td className="table-td text-xs whitespace-nowrap">
                          {r.invoiceDate ? formatDate(r.invoiceDate) : '-'}
                        </td>
                        <td className="table-td text-right font-mono text-sm font-semibold">
                          {formatMoney(r.amount)}
                        </td>
                        <td className="table-td text-right font-mono text-sm text-green-600">
                          {formatMoney(received)}
                        </td>
                        <td className="table-td text-right font-mono text-sm text-red-500">
                          {formatMoney(outstanding)}
                        </td>
                        <td className="table-td">
                          <ReceiptStatusIndicator invoice={r} />
                        </td>
                        <td className="table-td">
                          <StatusBadge status={statusCfg.label} type={statusCfg.type} />
                        </td>
                        <td className="table-td">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(r);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="查看详情"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/finance/invoices/form?id=${r.id}`);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="编辑"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteConfirm(r.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 展开行 - 收款明细 */}
                      {isExpanded && (
                        <tr key={`${r.id}-expanded`}>
                          <td colSpan={10} className="bg-blue-50/30 px-4 py-3">
                            {loadingReceipts ? (
                              <div className="text-center text-gray-400 text-sm py-3">
                                加载收款明细...
                              </div>
                            ) : expandedReceipts.length === 0 ? (
                              <div className="text-center text-gray-400 text-sm py-3">
                                暂无关联收款记录
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  关联收款明细（共 {expandedReceipts.length} 笔）
                                </h4>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-200 text-gray-500">
                                      <th className="text-left py-1.5 font-medium">收款日期</th>
                                      <th className="text-right py-1.5 font-medium">金额</th>
                                      <th className="text-left py-1.5 font-medium">付款方</th>
                                      <th className="text-left py-1.5 font-medium">收款方式</th>
                                      <th className="text-left py-1.5 font-medium">备注</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedReceipts.map((receipt, idx) => (
                                      <tr key={receipt.id || idx} className="border-b border-gray-100 last:border-0">
                                        <td className="py-1.5 text-gray-700">
                                          {receipt.receiptDate ? formatDate(receipt.receiptDate) : '-'}
                                        </td>
                                        <td className="py-1.5 text-right font-mono font-medium text-green-600">
                                          {formatMoney(receipt.amount)}
                                        </td>
                                        <td className="py-1.5 text-gray-700">{receipt.payerName || '-'}</td>
                                        <td className="py-1.5 text-gray-700">
                                          {receipt.paymentMethod || '-'}
                                        </td>
                                        <td className="py-1.5 text-gray-500">{receipt.description || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
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

      {/* 详情弹窗 */}
      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title="发票详情"
        size="md"
      >
        {detailRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500">发票号码</span>
                <p className="text-sm font-semibold font-mono">{detailRecord.invoiceNumber || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">合同</span>
                <p className="text-sm font-medium">{getContractName(detailRecord)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">开票日期</span>
                <p className="text-sm font-medium">{formatDate(detailRecord.invoiceDate)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">发票类型</span>
                <p className="text-sm font-medium">{getInvoiceTypeLabel(detailRecord.invoiceType)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">金额</span>
                <p className="text-sm font-semibold text-blue-600">{formatMoney(detailRecord.amount)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">税率</span>
                <p className="text-sm font-medium">
                  {detailRecord.taxRate != null ? `${detailRecord.taxRate}%` : '-'}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">税额</span>
                <p className="text-sm font-medium">
                  {detailRecord.taxAmount != null ? formatMoney(detailRecord.taxAmount) : '-'}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">购买方</span>
                <p className="text-sm font-medium">{detailRecord.buyerName || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">状态</span>
                <p className="text-sm">
                  {(() => {
                    const cfg = statusConfig[detailRecord.status];
                    return cfg ? <StatusBadge status={cfg.label} type={cfg.type} /> : detailRecord.status;
                  })()}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">已收款</span>
                <p className="text-sm font-medium text-green-600">
                  {formatMoney(detailRecord.totalReceived ?? 0)}
                </p>
              </div>
            </div>
            {detailRecord.description && (
              <div>
                <span className="text-xs text-gray-500">描述/备注</span>
                <p className="text-sm mt-1 p-3 bg-gray-50 rounded-lg">{detailRecord.description}</p>
              </div>
            )}
            {detailRecord.imageUrl && (
              <div>
                <span className="text-xs text-gray-500">发票图片</span>
                <img
                  src={detailRecord.imageUrl}
                  alt="发票"
                  className="mt-1 max-h-64 rounded-lg border border-gray-200"
                />
              </div>
            )}
            <div>
              <span className="text-xs text-gray-500">录入时间</span>
              <p className="text-sm text-gray-400">
                {detailRecord.createdAt ? formatDate(detailRecord.createdAt, 'YYYY-MM-DD HH:mm:ss') : '-'}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="删除确认"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            确定要删除这张发票吗？如果存在关联收款，可能无法删除。此操作不可撤销。
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

export default InvoiceList;
