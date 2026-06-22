/**
 * 资料通工程管理系统 - 工资发放
 * 发放记录查询、新增发放、批量确认
 */

import React, { useEffect, useState } from 'react';
import { laborApi, downloadBlob } from '../../api';
import { Plus, Search, CheckCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { Pagination, EmptyState, formatMoney, formatDate } from '../../components/ui/Common';

interface PaymentRecord {
  id: number;
  recipientName: string;
  idCardNo: string;
  amount: number;
  bankAccount?: string;
  paymentDate?: string;
  month?: string;
  isConfirmed: boolean;
  confirmedAt?: string;
  remark?: string;
  createdAt?: string;
  personnel?: {
    name: string;
    type: 'STAFF' | 'WORKER';
    subcontractor?: { companyName?: string; contactName?: string };
  };
}

const Payment: React.FC = () => {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const pageSize = 50;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ recipientName: '', idCardNo: '', amount: '', bankAccount: '', month: new Date().toISOString().slice(0, 7), remark: '' });
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<number[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await laborApi.getPayments({ page, pageSize, search: search || undefined });
      const data = (res.data as any).data;
      setRecords(data.records || []);
      setTotal(data.total || 0);
    } catch { toast.error('加载发放记录失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { fetchData(); }, [page, search]);

  const totalPages = Math.ceil(total / pageSize);
  const totalAmount = records.reduce((s, r) => s + Number(r.amount), 0);
  const confirmedCount = records.filter(r => r.isConfirmed).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientName.trim()) return toast.error('请输入收款人姓名');
    if (!form.idCardNo.trim()) return toast.error('请输入身份证号');
    if (!Number(form.amount) || Number(form.amount) <= 0) return toast.error('请输入有效发放金额');
    setSaving(true);
    try {
      await laborApi.createPayment({
        recipientName: form.recipientName.trim(),
        idCardNo: form.idCardNo.trim(),
        amount: Number(form.amount),
        bankAccount: form.bankAccount || undefined,
        month: form.month,
        remark: form.remark || undefined,
      });
      toast.success('发放记录创建成功');
      setShowCreateModal(false);
      setForm({ recipientName: '', idCardNo: '', amount: '', bankAccount: '', month: new Date().toISOString().slice(0, 7), remark: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '提交失败');
    } finally { setSaving(false); }
  };

  const handleConfirm = async (id: number) => {
    setConfirming(prev => [...prev, id]);
    try {
      await laborApi.confirmBatchPayment([id]);
      toast.success('已确认');
      fetchData();
    } catch { toast.error('确认失败'); }
    finally { setConfirming(prev => prev.filter(x => x !== id)); }
  };

  const handleBatchConfirm = async () => {
    const unconfirmed = records.filter(r => !r.isConfirmed).map(r => r.id);
    if (!unconfirmed.length) return toast.error('没有待确认的记录');
    setConfirming(unconfirmed);
    try {
      await laborApi.confirmBatchPayment(unconfirmed);
      toast.success(`已批量确认 ${unconfirmed.length} 条`);
      fetchData();
    } catch { toast.error('批量确认失败'); }
    finally { setConfirming([]); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await laborApi.exportPayments({ search: search || undefined });
      downloadBlob(res.data as Blob, '工资发放明细.xlsx');
      toast.success('工资发放明细已导出');
    } catch { toast.error('导出失败'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">工资发放</h1>
          <p className="page-subtitle">发放记录管理、批量确认</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? '导出中...' : '导出'}
          </button>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> 新增发放
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-white">
          <div className="text-sm text-gray-500">总发放笔数</div>
          <div className="text-2xl font-bold text-primary-600">{total}</div>
        </div>
        <div className="card bg-gradient-to-br from-emerald-50 to-white">
          <div className="text-sm text-gray-500">已确认</div>
          <div className="text-2xl font-bold text-emerald-600">{confirmedCount}</div>
        </div>
        <div className="card bg-gradient-to-br from-amber-50 to-white">
          <div className="text-sm text-gray-500">总发放金额</div>
          <div className="text-2xl font-bold text-amber-600">{formatMoney(totalAmount)}</div>
        </div>
      </div>

      {/* 搜索和操作 */}
      <div className="card py-3 flex items-center justify-between">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 text-sm w-full" placeholder="搜索收款人/身份证号..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn-secondary btn-sm" onClick={handleBatchConfirm}
          disabled={records.filter(r => !r.isConfirmed).length === 0}>
          <CheckCircle size={14} /> 批量确认
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="table-th">收款人</th>
              <th className="table-th">身份证号</th>
              <th className="table-th">类型</th>
              <th className="table-th">发放金额</th>
              <th className="table-th">银行卡号</th>
              <th className="table-th">发放月份</th>
              <th className="table-th">状态</th>
              <th className="table-th">操作</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                : !records.length ? <tr><td colSpan={8} className="table-td text-center py-12"><EmptyState title="暂无发放记录" /></td></tr>
                : records.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-td font-medium">{r.recipientName}</td>
                    <td className="table-td font-mono text-xs">{r.idCardNo ? `${r.idCardNo.slice(0, 6)}********${r.idCardNo.slice(-4)}` : '—'}</td>
                    <td className="table-td">
                      {r.personnel?.type === 'STAFF' ? <span className="badge-blue">项目部</span>
                        : r.personnel?.type === 'WORKER' ? <span className="badge-green">务工</span>
                        : <span className="badge-gray">外部</span>}
                    </td>
                    <td className="table-td font-bold text-emerald-600">{formatMoney(r.amount)}</td>
                    <td className="table-td font-mono text-xs">{r.bankAccount || '—'}</td>
                    <td className="table-td text-xs">{r.month || '—'}</td>
                    <td className="table-td">
                      {r.isConfirmed
                        ? <span className="badge-green">已确认</span>
                        : <span className="badge-yellow">待确认</span>}
                    </td>
                    <td className="table-td">
                      {!r.isConfirmed && (
                        <button className="btn-primary btn-sm" onClick={() => handleConfirm(r.id)}
                          disabled={confirming.includes(r.id)}>
                          <CheckCircle size={13} /> 确认
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <Pagination current={page} total={totalPages} totalRecords={total} onChange={setPage} />
          </div>
        )}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="新增工资发放" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">收款人姓名 <span className="text-red-500">*</span></label>
              <input className="input" placeholder="收款人姓名" value={form.recipientName}
                onChange={e => setForm({ ...form, recipientName: e.target.value })} />
            </div>
            <div>
              <label className="label">身份证号 <span className="text-red-500">*</span></label>
              <input className="input font-mono" placeholder="18位身份证号" maxLength={18} value={form.idCardNo}
                onChange={e => setForm({ ...form, idCardNo: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">发放金额（元）<span className="text-red-500">*</span></label>
              <input className="input" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">发放月份</label>
              <input className="input" type="month" value={form.month}
                onChange={e => setForm({ ...form, month: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">银行卡号（选填）</label>
            <input className="input font-mono" placeholder="银行卡号" value={form.bankAccount}
              onChange={e => setForm({ ...form, bankAccount: e.target.value })} />
          </div>
          <div>
            <label className="label">备注（选填）</label>
            <input className="input" placeholder="备注" value={form.remark}
              onChange={e => setForm({ ...form, remark: e.target.value })} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-ghost" onClick={() => setShowCreateModal(false)}>取消</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '提交中...' : '确认发放'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Payment;
