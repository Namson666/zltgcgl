/**
 * 资料通工程管理系统 - 工资核算
 * 基于考勤自动生成月度工资明细，支持手动调整
 */

import React, { useEffect, useState } from 'react';
import { laborApi, downloadBlob } from '../../api';
import { Download, Calculator, RefreshCw, AlertTriangle, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { Pagination, EmptyState, formatMoney, formatDate } from '../../components/ui/Common';

interface SalaryRecord {
  id: number;
  month: string;
  personnelId: number;
  attendanceDays: number;
  overtimeDays: number;
  totalPayable: number;
  totalDeductions: number;
  totalPaid: number;
  arrearsAmount: number;
  socialInsuranceDeduction: number;
  overtimePay: number;
  isManuallyEdited?: boolean;
  needsRecalculation?: boolean;
  personnel?: {
    name: string;
    type: 'STAFF' | 'WORKER';
    salaryMode?: string;
    department?: { name: string };
    subcontractor?: { companyName?: string; contactName?: string };
  };
}

const Salary: React.FC = () => {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalaryRecord | null>(null);
  const [editForm, setEditForm] = useState({ totalPayable: '', overtimePay: '', remark: '' });
  const [calculating, setCalculating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pageSize = 50;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await laborApi.getSalary({ month, page, pageSize });
      const data = (res.data as any).data;
      setRecords(data.records || []);
      setTotal(data.total || 0);
    } catch { toast.error('加载工资数据失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [month, page]);

  const totalPages = Math.ceil(total / pageSize);
  const summary = records.reduce((s, r) => ({
    payable: s.payable + Number(r.totalPayable),
    paid: s.paid + Number(r.totalPaid),
    arrears: s.arrears + Number(r.arrearsAmount),
    deduction: s.deduction + Number(r.totalDeductions),
  }), { payable: 0, paid: 0, arrears: 0, deduction: 0 });

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await laborApi.calculateSalary(month);
      const data = (res.data as any).data;
      toast.success(`核算完成，共 ${data.total || 0} 人`);
      setShowCalcModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '核算失败');
    } finally { setCalculating(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await laborApi.exportSalary(month);
      downloadBlob(res.data as Blob, `${month}工资核算明细.xlsx`);
      toast.success('工资核算报表已导出');
    } catch { toast.error('导出失败'); }
    finally { setExporting(false); }
  };

  const openEdit = (record: SalaryRecord) => {
    setEditingRecord(record);
    setEditForm({
      totalPayable: String(record.totalPayable ?? ''),
      overtimePay: String(record.overtimePay ?? 0),
      remark: '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    const totalPayable = Number(editForm.totalPayable);
    const overtimePay = Number(editForm.overtimePay || 0);
    if (!Number.isFinite(totalPayable) || totalPayable < 0) return toast.error('请输入有效应发工资');
    if (!Number.isFinite(overtimePay) || overtimePay < 0) return toast.error('请输入有效加班工资');
    setSavingEdit(true);
    try {
      await laborApi.updateSalary(editingRecord.id, {
        totalPayable,
        overtimePay,
        remark: editForm.remark,
      });
      toast.success('工资记录修改成功');
      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '修改失败');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">工资核算</h1>
          <p className="page-subtitle">基于考勤数据自动生成月度工资明细</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? '导出中...' : '导出报表'}
          </button>
          <button className="btn-primary" onClick={() => setShowCalcModal(true)}>
            <Calculator size={16} /> 工资核算
          </button>
        </div>
      </div>

      {/* 月份切换 & 汇总 */}
      <div className="card py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">核算月份</label>
            <input className="input w-40" type="month" value={month}
              onChange={e => { setMonth(e.target.value); setPage(1); }} />
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-gray-500">应发：</span>
              <span className="font-semibold text-gray-800">{formatMoney(summary.payable)}</span>
            </div>
            <div>
              <span className="text-gray-500">扣除：</span>
              <span className="font-semibold text-gray-500">{formatMoney(summary.deduction)}</span>
            </div>
            <div>
              <span className="text-gray-500">实发：</span>
              <span className="font-semibold text-emerald-600">{formatMoney(summary.paid)}</span>
            </div>
            <div>
              <span className="text-gray-500">欠薪：</span>
              <span className={`font-semibold ${summary.arrears > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {formatMoney(summary.arrears)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="table-th">姓名</th>
              <th className="table-th">类型</th>
              <th className="table-th">所属单位</th>
              <th className="table-th">出勤天数</th>
              <th className="table-th">加班天数</th>
              <th className="table-th">应发工资</th>
              <th className="table-th">社保扣除</th>
              <th className="table-th">实发工资</th>
              <th className="table-th">欠薪</th>
              <th className="table-th">状态</th>
              <th className="table-th">操作</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={11} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                : !records.length ? <tr><td colSpan={11} className="table-td text-center py-12"><EmptyState title="暂无工资数据" description="请点击「工资核算」按钮进行自动核算" /></td></tr>
                : records.map(r => (
                  <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50
                    ${Number(r.arrearsAmount) > 0 ? 'bg-red-50/30' : ''}
                    ${r.needsRecalculation ? 'bg-amber-50/50' : ''}`}>
                    <td className="table-td font-medium">{r.personnel?.name || '—'}</td>
                    <td className="table-td">
                      {r.personnel?.type === 'STAFF' ? <span className="badge-blue">项目部</span> : <span className="badge-green">务工</span>}
                    </td>
                    <td className="table-td text-xs text-gray-500">
                      {r.personnel?.subcontractor?.companyName || r.personnel?.subcontractor?.contactName || r.personnel?.department?.name || '—'}
                    </td>
                    <td className="table-td">{Number(r.attendanceDays)} 天</td>
                    <td className="table-td">{Number(r.overtimeDays) > 0 ? `${r.overtimeDays} 天` : '—'}</td>
                    <td className="table-td font-semibold">{formatMoney(r.totalPayable)}</td>
                    <td className="table-td text-gray-400">{Number(r.socialInsuranceDeduction) > 0 ? formatMoney(r.socialInsuranceDeduction) : '—'}</td>
                    <td className="table-td text-emerald-600 font-semibold">{formatMoney(r.totalPaid)}</td>
                    <td className="table-td">
                      {Number(r.arrearsAmount) > 0
                        ? <span className="font-bold text-red-600">{formatMoney(r.arrearsAmount)}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="table-td">
                      {r.needsRecalculation && <span className="badge-yellow"><AlertTriangle size={10} className="inline" /> 需重算</span>}
                      {r.isManuallyEdited && <span className="badge-blue">已手改</span>}
                    </td>
                    <td className="table-td">
                      <button className="btn-ghost btn-sm" title="手动调整工资" onClick={() => openEdit(r)}>
                        <Edit size={14} />
                      </button>
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

      <Modal isOpen={showCalcModal} onClose={() => setShowCalcModal(false)} title="工资自动核算" size="sm">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            系统将根据 <strong>{month}</strong> 的考勤数据和薪资标准自动计算应发工资。
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setShowCalcModal(false)}>取消</button>
            <button className="btn-primary" onClick={handleCalculate} disabled={calculating}>
              {calculating ? <><RefreshCw size={14} className="animate-spin" />核算中...</> : '开始核算'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="手动调整工资" size="sm">
        {editingRecord && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              正在调整：{editingRecord.personnel?.name || '未知人员'} · {editingRecord.month}
            </div>
            <div>
              <label className="label">应发工资</label>
              <input className="input" type="number" min="0" step="0.01"
                value={editForm.totalPayable}
                onChange={e => setEditForm({ ...editForm, totalPayable: e.target.value })} />
            </div>
            <div>
              <label className="label">加班工资</label>
              <input className="input" type="number" min="0" step="0.01"
                value={editForm.overtimePay}
                onChange={e => setEditForm({ ...editForm, overtimePay: e.target.value })} />
            </div>
            <div>
              <label className="label">调整备注</label>
              <input className="input" placeholder="请输入调整原因"
                value={editForm.remark}
                onChange={e => setEditForm({ ...editForm, remark: e.target.value })} />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-ghost" onClick={() => setShowEditModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? '保存中...' : '保存调整'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Salary;
