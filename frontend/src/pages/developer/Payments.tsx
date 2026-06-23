/**
 * 资料通工程管理系统 - 支付记录页面
 *
 * 功能说明：
 * 开发者后台的支付记录查询页面，支持分页查看所有企业的支付记录。
 *
 * 页面结构：
 * 1. 页面标题区域 + 刷新按钮
 * 2. 搜索筛选栏
 * 3. 支付记录表格（含状态标签）
 * 4. 分页功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Banknote, Search, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';
import {
  Pagination,
  EmptyState,
  SearchInput,
  StatusBadge,
  formatDate,
  formatMoney,
} from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

/** 支付记录接口 */
interface Payment {
  id: string;
  tenantName: string;
  amount: number;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'failed';
  paidAt: string | null;
  createdAt: string;
}

/* ========================================
 * 常量定义
 * ======================================== */

/** 支付状态中文映射 */
const STATUS_LABELS: Record<string, string> = {
  pending: '待支付',
  completed: '已完成',
  failed: '支付失败',
};

/** 支付状态徽章类型映射 */
const STATUS_BADGE_TYPE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  pending: 'warning',
  completed: 'success',
  failed: 'danger',
};

/* ========================================
 * Payments 支付记录组件
 * ======================================== */

const Payments: React.FC = () => {
  /* ---------- 列表状态 ---------- */
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  /* ---------- 数据加载 ---------- */

  /**
   * 加载支付记录列表
   */
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        pageSize: number;
        keyword?: string;
        status?: string;
      } = {
        page,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      };
      const res = await developerApi.getPayments(params);
      const body = res.data || res;
      setPayments(body.data || []);
      setTotal(body.pagination?.total || 0);
      setTotalPages(body.pagination?.totalPages || 0);
    } catch (error) {
      console.error('加载支付记录失败:', error);
      toast.error('加载支付记录失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  /* ---------- 搜索处理 ---------- */

  /**
   * 处理搜索操作
   * @param value - 搜索关键词
   */
  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  /* ==========================================
   * 页面渲染
   * ========================================== */

  return (
    <div>
      {/* ========================================
       * 页面标题区域
       * ======================================== */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A2B3C' }}>支付记录</h1>
          <p className="text-sm mt-1" style={{ color: '#8899AA' }}>查看所有企业的订阅支付记录</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPayments}
            data-testid="developer-payments-refresh"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#8899AA' }}
            title="刷新"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ========================================
       * 搜索筛选栏
       * ======================================== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              onSearch={handleSearch}
              placeholder="搜索企业名称..."
            />
          </div>
          <select
            data-testid="developer-payments-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input text-sm max-w-[160px]"
          >
            <option value="">全部状态</option>
            <option value="pending">待支付</option>
            <option value="completed">已完成</option>
            <option value="failed">支付失败</option>
          </select>
          <span className="text-sm" style={{ color: '#8899AA' }}>
            共 {total} 条记录
          </span>
        </div>
      </div>

      {/* ========================================
       * 支付记录列表
       * ======================================== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">企业名称</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">金额</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">支付方式</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">支付时间</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">创建时间</th>
              </tr>
            </thead>
            {/* 表体 */}
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                /* 加载中骨架屏 */
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : payments.length === 0 ? (
                /* 无数据 */
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Banknote size={64} className="text-gray-200 mb-4" />
                      <h3 className="text-lg font-medium text-gray-500 mb-1">暂无支付记录</h3>
                      <p className="text-sm text-gray-400 max-w-sm">当有企业完成订阅支付后，记录将显示在这里</p>
                    </div>
                  </td>
                </tr>
              ) : (
                /* 支付记录数据行 */
                payments.map((payment) => (
                  <tr key={payment.id} data-testid={`developer-payment-row-${payment.id}`} className="hover:bg-gray-50 transition-colors">
                    {/* 企业名称 */}
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium text-gray-800">{payment.tenantName}</span>
                    </td>
                    {/* 金额 */}
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-semibold text-gray-800">{formatMoney(payment.amount)}</span>
                    </td>
                    {/* 支付方式 */}
                    <td className="px-5 py-3">
                      <span className="text-sm text-gray-600">{payment.paymentMethod || '-'}</span>
                    </td>
                    {/* 状态 */}
                    <td className="px-5 py-3">
                      <StatusBadge
                        status={STATUS_LABELS[payment.status] || payment.status}
                        type={STATUS_BADGE_TYPE[payment.status] || 'default'}
                      />
                    </td>
                    {/* 支付时间 */}
                    <td className="px-5 py-3">
                      <span className="text-sm text-gray-500">
                        {payment.paidAt ? formatDate(payment.paidAt, 'YYYY-MM-DD HH:mm') : '-'}
                      </span>
                    </td>
                    {/* 创建时间 */}
                    <td className="px-5 py-3">
                      <span className="text-sm" style={{ color: '#8899AA' }}>
                        {formatDate(payment.createdAt, 'YYYY-MM-DD HH:mm')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!loading && payments.length > 0 && (
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

export default Payments;
