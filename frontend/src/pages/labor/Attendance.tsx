/**
 * 资料通工程管理系统 - 考勤管理
 * 批量录入、补卡管理，支持按人员类型筛选
 */

import React, { useEffect, useState } from 'react';
import { laborApi } from '../../api';
import { Search, Calendar, CheckSquare, AlertTriangle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/Common';

const ATTENDANCE_OPTIONS = [
  { value: 'FULL', label: '1天', color: 'bg-emerald-500' },
  { value: 'HALF', label: '0.5天', color: 'bg-blue-400' },
  { value: 'ONE_HALF', label: '1.5天', color: 'bg-amber-400' },
  { value: 'DOUBLE', label: '2天', color: 'bg-violet-500' },
];
const OVERTIME_OPTIONS = [
  { value: 'NONE', label: '无加班' },
  { value: 'HALF', label: '加班0.5天' },
  { value: 'FULL', label: '加班1天' },
];

interface PersonnelBrief {
  id: number;
  name: string;
  type: 'STAFF' | 'WORKER';
  status: string;
  subcontractor?: { companyName?: string; contactName?: string };
  department?: { name: string };
  consecutiveAbsentDays?: number;
  absenceWarning?: string | null;
}

/* 日历组件 */
function CalendarPicker({ year, month, selectedDates, onToggle, existingDates }: {
  year: number; month: number;
  selectedDates: Set<string>; onToggle: (d: string) => void;
  existingDates: Set<string>;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return (
    <div className="select-none">
      <div className="grid grid-cols-7 mb-1">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} />;
          const isSelected = selectedDates.has(dateStr);
          const hasRecord = existingDates.has(dateStr);
          const isFuture = dateStr > today;
          return (
            <button key={dateStr} type="button" disabled={isFuture}
              onClick={() => !isFuture && onToggle(dateStr)}
              className={`relative h-8 w-full rounded text-xs font-medium transition-colors
                ${isFuture ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected ? 'bg-primary-500 text-white' : ''}
                ${!isSelected && hasRecord ? 'bg-emerald-100 text-emerald-700' : ''}
                ${!isSelected && !hasRecord && !isFuture ? 'hover:bg-gray-100 text-gray-700' : ''}`}>
              {parseInt(dateStr.slice(-2))}
              {hasRecord && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const Attendance: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [personnel, setPersonnel] = useState<PersonnelBrief[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Set<number>>(new Set());
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [batchValue, setBatchValue] = useState('FULL');
  const [batchOvertime, setBatchOvertime] = useState('NONE');
  const [submitting, setSubmitting] = useState(false);

  const [showPatchModal, setShowPatchModal] = useState(false);
  const [patchPersonnel, setPatchPersonnel] = useState<PersonnelBrief[]>([]);
  const [patchYear, setPatchYear] = useState(new Date().getFullYear());
  const [patchMonth, setPatchMonth] = useState(new Date().getMonth());
  const [patchSelectedDates, setPatchSelectedDates] = useState<Set<string>>(new Set());
  const [patchValue, setPatchValue] = useState('FULL');
  const [patchOvertime, setPatchOvertime] = useState('NONE');
  const [patchSubmitting, setPatchSubmitting] = useState(false);

  const loadPersonnel = async () => {
    setLoadingPersonnel(true);
    try {
      const params: any = { limit: 200, status: 'active' };
      if (filterType) params.type = filterType;
      if (search) params.search = search;
      const res = await laborApi.getPersonnel(params);
      const data = (res.data as any).data;
      setPersonnel(data.personnel || []);
    } finally { setLoadingPersonnel(false); }
  };

  useEffect(() => { loadPersonnel(); }, [filterType, search]);

  const toggleSelect = (id: number) => {
    setSelectedPersonnel(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedPersonnel(new Set(personnel.map(p => p.id)));
  const clearSelect = () => setSelectedPersonnel(new Set());

  const submitBatch = async () => {
    if (!selectedPersonnel.size) return toast.error('请先勾选人员');
    if (!batchDate) return toast.error('请选择日期');
    setSubmitting(true);
    try {
      const ids = [...selectedPersonnel];
      await Promise.all(ids.map(personnelId =>
        laborApi.createAttendance({ personnelId, date: batchDate, value: batchValue, overtimeValue: batchOvertime })
          .catch(() => null)
      ));
      toast.success(`已为 ${ids.length} 人录入考勤`);
      setSelectedPersonnel(new Set());
    } catch { toast.error('录入失败'); }
    finally { setSubmitting(false); }
  };

  const openPatch = () => {
    const targets = selectedPersonnel.size > 0
      ? personnel.filter(p => selectedPersonnel.has(p.id))
      : personnel;
    if (!targets.length) return toast.error('没有可补卡的人员');
    setPatchPersonnel(targets);
    setPatchSelectedDates(new Set());
    setPatchYear(new Date().getFullYear());
    setPatchMonth(new Date().getMonth());
    setShowPatchModal(true);
  };

  const togglePatchDate = (d: string) => {
    setPatchSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const submitPatch = async () => {
    if (!patchSelectedDates.size) return toast.error('请在日历上选择补卡日期');
    setPatchSubmitting(true);
    let success = 0, fail = 0;
    try {
      for (const p of patchPersonnel) {
        for (const date of patchSelectedDates) {
          try {
            await laborApi.createAttendance({
              personnelId: p.id, date, value: patchValue,
              overtimeValue: p.type === 'STAFF' ? patchOvertime : 'NONE',
            });
            success++;
          } catch { fail++; }
        }
      }
      toast.success(`补卡完成：${success} 条成功${fail ? `，${fail} 条失败` : ''}`);
      setShowPatchModal(false);
    } finally { setPatchSubmitting(false); }
  };

  const prevMonth = () => {
    if (patchMonth === 0) { setPatchYear(y => y - 1); setPatchMonth(11); }
    else setPatchMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (patchMonth === 11) { setPatchYear(y => y + 1); setPatchMonth(0); }
    else setPatchMonth(m => m + 1);
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">考勤管理</h1>
          <p className="page-subtitle">批量录入、补卡管理</p>
        </div>
        <button className="btn-secondary" onClick={openPatch}>
          <Calendar size={16} /> 批量补卡
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：人员选择区 */}
        <div className="lg:col-span-2 space-y-3">
          <div className="card py-3 flex flex-wrap gap-3">
            <div className="flex gap-2">
              {[
                { v: '', l: '全部' },
                { v: 'STAFF', l: '项目部人员' },
                { v: 'WORKER', l: '务工人员' },
              ].map(({ v, l }) => (
                <button key={v} type="button"
                  onClick={() => { setFilterType(v); }}
                  className={`btn-sm ${filterType === v ? 'btn-primary' : 'btn-secondary'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-8 text-sm w-44" placeholder="搜索姓名"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  共 {personnel.length} 人，已选 <strong className="text-primary-600">{selectedPersonnel.size}</strong> 人
                </span>
                {selectedPersonnel.size < personnel.length
                  ? <button className="text-xs text-primary-600 hover:underline" onClick={selectAll}>全选</button>
                  : <button className="text-xs text-gray-500 hover:underline" onClick={clearSelect}>取消全选</button>}
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {loadingPersonnel ? <div className="py-10 text-center text-gray-400">加载中...</div>
                : personnel.map(p => {
                  const checked = selectedPersonnel.has(p.id);
                  return (
                    <div key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                        ${checked ? 'bg-primary-50' : 'hover:bg-gray-50'}
                        ${p.absenceWarning === 'red' ? 'border-l-4 border-red-400' : p.absenceWarning === 'yellow' ? 'border-l-4 border-amber-400' : ''}`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                        ${checked ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`}>
                        {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-800">{p.name}</span>
                          {p.type === 'STAFF'
                            ? <span className="badge-blue text-xs">项目部</span>
                            : <span className="badge-green text-xs">务工</span>}
                          {p.absenceWarning === 'red' && <span className="badge-red text-xs"><AlertTriangle size={9} className="inline" />{p.consecutiveAbsentDays}天未打卡</span>}
                          {p.absenceWarning === 'yellow' && <span className="badge-yellow text-xs"><AlertTriangle size={9} className="inline" />{p.consecutiveAbsentDays}天未打卡</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {p.subcontractor?.companyName || p.subcontractor?.contactName || p.department?.name || '-'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              {!loadingPersonnel && personnel.length === 0 && (
                <div className="py-10 text-center text-gray-400 text-sm">暂无在职人员</div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：快速录入区 */}
        <div className="space-y-3">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">批量录入考勤</h3>
            <div className="space-y-3">
              <div>
                <label className="label">考勤日期 <span className="text-red-500">*</span></label>
                <input type="date" className="input" value={batchDate}
                  onChange={e => setBatchDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <label className="label">出勤天数 <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {ATTENDANCE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setBatchValue(opt.value)}
                      className={`py-2 rounded-lg text-sm font-medium border-2 transition-all
                        ${batchValue === opt.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">加班（项目部人员）</label>
                <select className="select text-sm" value={batchOvertime} onChange={e => setBatchOvertime(e.target.value)}>
                  {OVERTIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <button className="btn-primary w-full justify-center" onClick={submitBatch}
                disabled={submitting || !selectedPersonnel.size}>
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" />录入中...</>
                  : <><CheckSquare size={14} />录入 {selectedPersonnel.size || ''} 人</>}
              </button>
              {selectedPersonnel.size > 0 && (
                <button className="btn-secondary w-full justify-center text-sm" onClick={openPatch}>
                  <Calendar size={14} /> 为已选人员补卡
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 补卡弹窗 */}
      <Modal isOpen={showPatchModal} onClose={() => setShowPatchModal(false)} title="批量补卡" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">补卡人员（{patchPersonnel.length} 人）</label>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-gray-50 rounded-lg">
              {patchPersonnel.map(p => <span key={p.id} className="badge-blue">{p.name}</span>)}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={prevMonth} className="btn-ghost btn-sm"><ChevronLeft size={16} /></button>
              <span className="font-semibold text-gray-800">{patchYear}年{patchMonth + 1}月</span>
              <button type="button" onClick={nextMonth} className="btn-ghost btn-sm"
                disabled={patchYear === new Date().getFullYear() && patchMonth >= new Date().getMonth()}>
                <ChevronRight size={16} />
              </button>
            </div>
            <CalendarPicker year={patchYear} month={patchMonth}
              selectedDates={patchSelectedDates} onToggle={togglePatchDate} existingDates={new Set()} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">出勤值 <span className="text-red-500">*</span></label>
              <select className="select" value={patchValue} onChange={e => setPatchValue(e.target.value)}>
                {ATTENDANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">加班</label>
              <select className="select" value={patchOvertime} onChange={e => setPatchOvertime(e.target.value)}>
                {OVERTIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button className="btn-ghost" onClick={() => setShowPatchModal(false)}>取消</button>
            <button className="btn-primary" onClick={submitPatch} disabled={patchSubmitting || !patchSelectedDates.size}>
              {patchSubmitting ? <><Loader2 size={14} className="animate-spin" />提交中...</>
                : `提交补卡（${patchSelectedDates.size * patchPersonnel.length} 条）`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Attendance;
