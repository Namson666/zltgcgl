/**
 * 资料通工程管理系统 - 费用列表
 * 查看、筛选、审核和管理所有费用记录
 */

import React, { useEffect, useState } from 'react';
import { financeApi } from '../../api';
import { Pagination, EmptyState, StatusBadge, formatDate, formatMoney } from '../../components/ui/Common';
import Modal from '../../components/ui/Modal';
import { Search, Eye, Edit3, Trash2, CheckCircle, X, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface ExpenseRecord {
  id: string;
  expenseDate: string;
  handler: string;
  category?: { id: string; name: string };
  subCategory?: { id: string; name: string };
  categoryName?: string;
  subCategoryName?: string;
  amount: number;
  paymentMethod: string;
  payer?: string;
  status: 'pending' | 'approved' | 'rejected';
  detail?: string;
  vehiclePlate?: string;
  contract?: { id: string; name: string };
  department?: { id: string; name: string };
  pettyCashAccount?: { id: string; accountName: string };
  receiptUrl?: string;
  createdAt?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Filters {
  startDate: string;
  endDate: string;
  categoryId: string;
  paymentMethod: string;
  status: string;
  keyword: string;
}

const initialFilters: Filters = {
  startDate: '',
  endDate: '',
  categoryId: '',
  paymentMethod: '',
  status: '',
  keyword: '',
};

/* ========================================
 * 支付方式 & 状态映射
 * ======================================== */

const paymentMethodLabels: Record<string, string> = {
  petty_cash: '备用金',
  company_direct: '公司直付',
};

const statusConfig: Record<string, { label: string; type: 'warning' | 'success' | 'danger' }> = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '已审核', type: 'success' },
  rejected: { label: '已拒绝', type: 'danger' },
};

/* ========================================
 * 主组件
 * ======================================== */

const ExpenseList: React.FC = () => {
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const pageSize = 20;

  /* 详情弹窗 */
  const [showDetail, setShowDetail] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ExpenseRecord | null>(null);

  /* 删除确认 */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* 编辑弹窗 */
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRecord, setEditRecord] = useState<ExpenseRecord | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  /* 审核中 */
  const [approving, setApproving] = useState<string | null>(null);

  /* ---------- 加载数据 ---------- */

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await financeApi.getCategories();
      const body = res.data as any;
      setCategories(body?.data || body || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
  }, [page, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
      if (filters.status) params.status = filters.status;
      if (filters.keyword) params.keyword = filters.keyword;

      const res = await financeApi.getExpenses(params);
      const body = res.data as any;
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      const totalCount = body?.meta?.total || listData?.total || items.length;
      setRecords(items);
      setTotal(totalCount);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '加载费用列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- 筛选变更 ---------- */

  const updateFilter = (field: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  const hasFilters = Object.values(filters).some((v) => v !== '');

  /* ---------- 审核操作 ---------- */

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      await financeApi.approveExpense(id);
      toast.success('审核通过');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '审核失败');
      console.error(err);
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (id: string) => {
    setApproving(id);
    try {
      await financeApi.rejectExpense(id);
      toast.success('已驳回');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '驳回失败');
      console.error(err);
    } finally {
      setApproving(null);
    }
  };

  /* ---------- 删除操作 ---------- */

  const openDeleteConfirm = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await financeApi.deleteExpense(deletingId);
      toast.success('删除成功');
      setShowDeleteConfirm(false);
      setDeletingId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- 编辑操作 ---------- */

  const openEdit = (record: ExpenseRecord) => {
    setEditRecord(record);
    setEditAmount(String(record.amount));
    setEditDetail(record.detail || '');
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editRecord) return;
    if (!editAmount || Number(editAmount) <= 0) return toast.error('请输入有效金额');
    if (!editDetail.trim()) return toast.error('请填写费用明细');

    setEditSaving(true);
    try {
      await financeApi.updateExpense(editRecord.id, {
        amount: Number(editAmount),
        detail: editDetail.trim(),
      });
      toast.success('修改成功');
      setShowEditModal(false);
      setEditRecord(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '修改失败');
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  };

  /* ---------- 查看详情 ---------- */

  const openDetail = (record: ExpenseRecord) => {
    setDetailRecord(record);
    setShowDetail(true);
  };

  /* ---------- 计算 ---------- */

  const totalPages = Math.ceil(total / pageSize);

  const getCategoryName = (record: ExpenseRecord): string => {
    return record.category?.name || record.categoryName || '-';
  };

  /* ---------- 渲染 ---------- */

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">费用列表</h1>
          <p className="page-subtitle">查看和管理所有费用报账记录</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="card py-3">
        <div className="flex flex-wrap items-end gap-3">
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
            <label className="block text-xs text-gray-500 mb-1">费用类别</label>
            <select
              className="input text-sm w-36"
              value={filters.categoryId}
              onChange={(e) => updateFilter('categoryId', e.target.value)}
            >
              <option value="">全部</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">支付方式</label>
            <select
              className="input text-sm w-32"
              value={filters.paymentMethod}
              onChange={(e) => updateFilter('paymentMethod', e.target.value)}
            >
              <option value="">全部</option>
              <option value="petty_cash">备用金</option>
              <option value="company_direct">公司直付</option>
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
              <option value="pending">待审核</option>
              <option value="approved">已审核</option>
              <option value="rejected">已拒绝</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">搜索</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9 text-sm w-48"
                placeholder="经办人/明细..."
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
                <th className="table-th">日期</th>
                <th className="table-th">经办人</th>
                <th className="table-th">合同</th>
                <th className="table-th">项目部</th>
                <th className="table-th">类别</th>
                <th className="table-th text-right">金额</th>
                <th className="table-th">支付方式</th>
                <th className="table-th">支付人</th>
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
                    <EmptyState title="暂无费用记录" />
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const statusCfg = statusConfig[r.status] || { label: r.status, type: 'default' as const };
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => openDetail(r)}
                    >
                      <td className="table-td text-xs whitespace-nowrap">
                        {r.expenseDate ? formatDate(r.expenseDate) : '-'}
                      </td>
                      <td className="table-td font-medium">{r.handler || '-'}</td>
                      <td className="table-td text-xs max-w-[120px] truncate">
                        {r.contract?.name || '-'}
                      </td>
                      <td className="table-td text-xs max-w-[100px] truncate">
                        {r.department?.name || '-'}
                      </td>
                      <td className="table-td text-xs">
                        {getCategoryName(r)}
                        {r.subCategory?.name || r.subCategoryName ? ` / ${r.subCategory?.name || r.subCategoryName}` : ''}
                      </td>
                      <td className="table-td text-right font-mono text-sm font-medium">
                        {formatMoney(r.amount)}
                      </td>
                      <td className="table-td text-xs">
                        {paymentMethodLabels[r.paymentMethod] || r.paymentMethod}
                      </td>
                      <td className="table-td text-xs">{r.payer || '-'}</td>
                      <td className="table-td">
                        <StatusBadge
                          status={statusCfg.label}
                          type={statusCfg.type}
                        />
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleApprove(r.id); }}
                                disabled={approving === r.id}
                                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                title="审核通过"
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReject(r.id); }}
                                disabled={approving === r.id}
                                className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                                title="审核驳回"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="编辑"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openDeleteConfirm(r.id); }}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
        title="费用详情"
        size="md"
      >
        {detailRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500">费用日期</span>
                <p className="text-sm font-medium">{formatDate(detailRecord.expenseDate)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">经办人</span>
                <p className="text-sm font-medium">{detailRecord.handler || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">合同</span>
                <p className="text-sm font-medium">{detailRecord.contract?.name || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">项目部</span>
                <p className="text-sm font-medium">{detailRecord.department?.name || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">费用类别</span>
                <p className="text-sm font-medium">
                  {getCategoryName(detailRecord)}
                  {detailRecord.subCategory?.name ? ` / ${detailRecord.subCategory.name}` : ''}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">金额</span>
                <p className="text-sm font-semibold text-blue-600">{formatMoney(detailRecord.amount)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">支付方式</span>
                <p className="text-sm font-medium">
                  {paymentMethodLabels[detailRecord.paymentMethod] || detailRecord.paymentMethod}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">支付人</span>
                <p className="text-sm font-medium">{detailRecord.payer || '-'}</p>
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
              {detailRecord.vehiclePlate && (
                <div>
                  <span className="text-xs text-gray-500">车牌号</span>
                  <p className="text-sm font-medium">{detailRecord.vehiclePlate}</p>
                </div>
              )}
              {detailRecord.pettyCashAccount && (
                <div>
                  <span className="text-xs text-gray-500">备用金账户</span>
                  <p className="text-sm font-medium">{detailRecord.pettyCashAccount.accountName}</p>
                </div>
              )}
            </div>
            <div>
              <span className="text-xs text-gray-500">费用明细</span>
              <p className="text-sm mt-1 p-3 bg-gray-50 rounded-lg">{detailRecord.detail || '-'}</p>
            </div>
            {detailRecord.receiptUrl && (
              <div>
                <span className="text-xs text-gray-500">凭证照片</span>
                <img
                  src={detailRecord.receiptUrl}
                  alt="凭证"
                  className="mt-1 max-h-64 rounded-lg border border-gray-200"
                />
              </div>
            )}
            <div>
              <span className="text-xs text-gray-500">录入时间</span>
              <p className="text-sm text-gray-400">{detailRecord.createdAt ? formatDate(detailRecord.createdAt, 'YYYY-MM-DD HH:mm:ss') : '-'}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="编辑费用"
        size="sm"
      >
        {editRecord && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                金额 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                <input
                  type="number"
                  className="input pl-8"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                费用明细 <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input min-h-[80px]"
                value={editDetail}
                onChange={(e) => setEditDetail(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                className="btn-secondary"
                onClick={() => setShowEditModal(false)}
                disabled={editSaving}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleEditSave}
                disabled={editSaving}
              >
                {editSaving ? '保存中...' : '保存修改'}
              </button>
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
          <p className="text-sm text-gray-600">确定要删除这笔费用记录吗？此操作不可撤销。</p>
          <div className="flex gap-3 justify-end">
            <button
              className="btn-secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              取消
            </button>
            <button
              className="btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ExpenseList;
