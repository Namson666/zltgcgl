/**
 * 资料通工程管理系统 - 人员管理
 * 劳务人员档案管理、进退场登记、附件上传
 */

import React, { useEffect, useState, useRef } from 'react';
import { laborApi } from '../../api';
import {
  Plus, Search, Edit, LogOut, AlertTriangle, Upload, Download,
  CheckCircle, XCircle, Eye, RefreshCw, FileText, Loader2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { Pagination, EmptyState, formatDate, formatMoney } from '../../components/ui/Common';
import { departmentApi } from '../../api';

interface PersonnelRecord {
  id: number;
  type: 'STAFF' | 'WORKER';
  name: string;
  idCardNo: string;
  phone: string;
  status: 'active' | 'left' | 'rejoin';
  salaryMode?: string;
  monthlySalary?: number;
  dailySalary?: number;
  joinDate?: string;
  leaveDate?: string;
  hasSocialInsurance?: boolean;
  socialInsuranceMonthly?: number;
  bankAccount?: string;
  department?: { id: number; name: string };
  subcontractor?: { companyName?: string; contactName?: string };
  consecutiveAbsentDays?: number;
  absenceWarning?: string | null;
  facePhotoUrl?: string;
  faceStatus?: string;
  faceUpdatedAt?: string;
  createdAt?: string;
}

interface PersonnelForm {
  type: string;
  name: string;
  idCardNo: string;
  phone: string;
  joinDate: string;
  departmentId: string;
  salaryMode: string;
  monthlySalary: string;
  dailySalary: string;
  hasSocialInsurance: boolean;
  socialInsuranceMonthly: string;
  bankAccount: string;
  remark: string;
}

const defaultForm = (type: string): PersonnelForm => ({
  type, name: '', idCardNo: '', phone: '', joinDate: '',
  departmentId: '', salaryMode: 'MONTHLY', monthlySalary: '', dailySalary: '',
  hasSocialInsurance: false, socialInsuranceMonthly: '',
  bankAccount: '', remark: '',
});

const Personnel: React.FC = () => {
  const [list, setList] = useState<PersonnelRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'left' | ''>('active');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<PersonnelRecord | null>(null);
  const [form, setForm] = useState<PersonnelForm>(defaultForm('STAFF'));
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<number>(0);
  const [leaveDate, setLeaveDate] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState<PersonnelRecord | null>(null);

  // 附件管理
  const [attachments, setAttachments] = useState<Record<string, any[]>>({});
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadCategoryRef = useRef<string>('');

  const fetchAttachments = async (personId: number) => {
    try {
      const res = await laborApi.getAttachments('personnel', String(personId));
      const list = (res.data as any)?.data || [];
      const grouped: Record<string, any[]> = {};
      list.forEach((a: any) => {
        const cat = a.entityType === 'personnel' ? 'other' : (a.category || 'other');
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(a);
      });
      setAttachments(grouped);
    } catch { /* ignore */ }
  };

  const handleUploadClick = (category: string) => {
    uploadCategoryRef.current = category;
    if (uploadRef.current) {
      uploadRef.current.value = '';
      uploadRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !detailItem) return;
    const category = uploadCategoryRef.current;
    setUploadingCategory(category);
    try {
      const fd = new FormData();
      if (category === 'face') {
        fd.append('photo', files[0]);
        await laborApi.uploadFacePhoto(String(detailItem.id), fd);
        toast.success('人脸照片已录入');
        setDetailItem({ ...detailItem, faceStatus: 'enrolled', facePhotoUrl: URL.createObjectURL(files[0]) });
        fetchData();
        return;
      }
      Array.from(files).forEach(f => fd.append('files', f));
      fd.append('entityType', 'personnel');
      fd.append('entityId', String(detailItem.id));
      if (category) fd.append('category', category);
      await laborApi.uploadAttachment(fd);
      toast.success(`已上传 ${files.length} 个文件`);
      fetchAttachments(detailItem.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || '上传失败');
    } finally { setUploadingCategory(null); }
  };

  const handleDeleteAttachment = async (id: string) => {
    try {
      await laborApi.deleteAttachment(id);
      toast.success('附件已删除');
      if (detailItem) fetchAttachments(detailItem.id);
    } catch { toast.error('删除失败'); }
  };

  const getFileIcon = (mime: string) => {
    if (mime?.startsWith('image/')) return '🖼';
    if (mime === 'application/pdf') return '📄';
    return '📎';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      const res = await laborApi.getPersonnel(params);
      const data = (res.data as any).data;
      setList(data.personnel || []);
      setTotal(data.total || 0);
    } catch { toast.error('加载人员列表失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setPage(1); }, [search, filterType, filterStatus]);
  useEffect(() => { fetchData(); }, [page, search, filterType, filterStatus]);

  // 加载项目部列表
  const loadDepartments = async () => {
    setDeptsLoading(true);
    try {
      const res = await departmentApi.getList({ pageSize: 500 });
      const data = (res.data as any)?.data || res.data || [];
      setDepartments(data);
    } catch { /* ignore */ }
    finally { setDeptsLoading(false); }
  };
  useEffect(() => { loadDepartments(); }, []);

  const openCreate = (type: string) => {
    setEditItem(null);
    setForm(defaultForm(type));
    setShowModal(true);
  };

  const openEdit = (item: PersonnelRecord) => {
    setEditItem(item);
    setForm({
      type: item.type,
      name: item.name,
      idCardNo: item.idCardNo,
      phone: item.phone,
      joinDate: item.joinDate ? item.joinDate.slice(0, 10) : '',
      departmentId: item.department?.id?.toString() || '',
      salaryMode: item.salaryMode || 'MONTHLY',
      monthlySalary: item.monthlySalary?.toString() || '',
      dailySalary: item.dailySalary?.toString() || '',
      hasSocialInsurance: item.hasSocialInsurance || false,
      socialInsuranceMonthly: item.socialInsuranceMonthly?.toString() || '',
      bankAccount: item.bankAccount || '',
      remark: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type) return toast.error('请选择人员类型');
    if (!form.departmentId) return toast.error('请选择所属项目部');
    if (!form.name.trim()) return toast.error('请输入姓名');
    if (!form.idCardNo.trim()) return toast.error('请输入身份证号');
    if (!form.phone.trim()) return toast.error('请输入联系电话');
    setSaving(true);
    try {
      const payload = {
        ...form,
        monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : undefined,
        dailySalary: form.dailySalary ? Number(form.dailySalary) : undefined,
        socialInsurance: form.hasSocialInsurance && form.socialInsuranceMonthly ? Number(form.socialInsuranceMonthly) : undefined,
      };
      if (editItem) {
        const { http } = await import('../../api/client');
        await http.put(`/labor/personnel/${editItem.id}`, payload);
      } else {
        await laborApi.createPersonnel(payload);
      }
      toast.success(editItem ? '更新成功' : '人员添加成功');
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '操作失败');
    } finally { setSaving(false); }
  };

  // Actually, let me recheck the API client - it has getPersonnel and createPersonnel
  // For update, leave, rejoin I'll need to use http directly

  const totalPages = Math.ceil(total / 50);

  const handleLeave = async () => {
    try {
      // Using http directly since there's no dedicated method
      const { http } = await import('../../api/client');
      await http.post(`/labor/personnel/${leaveTarget}/leave`, { leaveDate });
      toast.success('离职登记成功');
      setShowLeaveModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '操作失败');
    }
  };

  const openDetail = (item: PersonnelRecord) => {
    setDetailItem(item);
    setAttachments({});
    setShowDetailModal(true);
    fetchAttachments(item.id);
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">人员管理</h1>
          <p className="page-subtitle">劳务人员实名制管理，支持合同/安全协议上传与筛选</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => openCreate('STAFF')}>
            <Plus size={16} /> 新增项目部人员
          </button>
          <button className="btn-primary" onClick={() => openCreate('WORKER')}>
            <Plus size={16} /> 新增务工人员
          </button>
        </div>
      </div>

      {/* 筛选条 */}
      <div className="card py-3 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 w-44 text-sm" placeholder="姓名/身份证号" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="select w-36 text-sm" value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">全部类型</option>
          <option value="STAFF">项目部人员</option>
          <option value="WORKER">务工人员</option>
        </select>
        <div className="flex rounded-lg bg-gray-100 p-1 gap-0.5">
          {[{ v: '', l: '全部' }, { v: 'active', l: '在职' }, { v: 'left', l: '离职' }].map(({ v, l }) => (
            <button key={v} type="button"
              onClick={() => setFilterStatus(v as any)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterStatus === v ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">共 {total} 人</span>
      </div>

      {/* 列表 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="table-th">姓名</th>
              <th className="table-th">类型</th>
              <th className="table-th">身份证号</th>
              <th className="table-th">联系电话</th>
              <th className="table-th">薪资标准</th>
              <th className="table-th">所属单位</th>
              <th className="table-th">入职日期</th>
              <th className="table-th">状态</th>
              <th className="table-th">操作</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                : !list.length ? <tr><td colSpan={9} className="table-td text-center py-12"><EmptyState title="暂无人员" description="请新增人员或调整筛选条件" /></td></tr>
                : list.map(p => (
                  <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50
                    ${p.absenceWarning === 'red' ? 'bg-red-50/30' : p.absenceWarning === 'yellow' ? 'bg-amber-50/30' : ''}`}>
                    <td className="table-td font-medium text-gray-800">
                      <div className="flex items-center gap-1.5">
                        {p.name}
                        {p.absenceWarning === 'red' && <span className="badge-red text-xs">{p.consecutiveAbsentDays}天未打卡</span>}
                        {p.absenceWarning === 'yellow' && <span className="badge-yellow text-xs">{p.consecutiveAbsentDays}天未打卡</span>}
                      </div>
                    </td>
                    <td className="table-td">
                      {p.type === 'STAFF' ? <span className="badge-blue">项目部</span> : <span className="badge-green">务工</span>}
                    </td>
                    <td className="table-td font-mono text-xs">{p.idCardNo ? `${p.idCardNo.slice(0, 6)}********${p.idCardNo.slice(-4)}` : '—'}</td>
                    <td className="table-td">{p.phone || '—'}</td>
                    <td className="table-td text-emerald-600 font-medium">
                      {p.salaryMode === 'MONTHLY' ? (p.monthlySalary ? `¥${p.monthlySalary}/月` : '—')
                        : p.salaryMode === 'DAILY' ? (p.dailySalary ? `¥${p.dailySalary}/天` : '—')
                        : '—'}
                    </td>
                    <td className="table-td text-xs text-gray-500">
                      {p.subcontractor?.companyName || p.subcontractor?.contactName || p.department?.name || '—'}
                    </td>
                    <td className="table-td text-xs text-gray-400">{p.joinDate ? formatDate(p.joinDate) : '—'}</td>
                    <td className="table-td">
                      {p.status === 'left'
                        ? <span className="badge-gray">已离职</span>
                        : <span className="badge-green">在职</span>}
                    </td>
                    <td className="table-td">
                      <div className="flex gap-1">
                        <button className="btn-ghost btn-sm" onClick={() => openDetail(p)} title="查看详情">
                          <Eye size={14} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => openEdit(p)} title="编辑">
                          <Edit size={14} />
                        </button>
                        {p.status === 'active' && (
                          <button className="btn-ghost btn-sm text-orange-500" title="登记离职"
                            onClick={() => { setLeaveTarget(p.id); setLeaveDate(''); setShowLeaveModal(true); }}>
                            <LogOut size={14} />
                          </button>
                        )}
                      </div>
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

      {/* 新增/编辑弹窗 */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? '编辑人员信息' : `新增${form.type === 'STAFF' ? '项目部' : '务工'}人员`} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">人员类型 <span className="text-red-500">*</span></label>
              <select className="select" value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="">请选择人员类型</option>
                <option value="STAFF">项目部人员</option>
                <option value="WORKER">务工人员</option>
              </select>
            </div>
            <div>
              <label className="label">姓名 <span className="text-red-500">*</span></label>
              <input className="input" placeholder="姓名" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">联系电话 <span className="text-red-500">*</span></label>
              <input className="input" placeholder="联系电话" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">身份证号 <span className="text-red-500">*</span></label>
              <input className="input font-mono" placeholder="18位身份证号" maxLength={18}
                value={form.idCardNo} onChange={e => setForm({ ...form, idCardNo: e.target.value })} />
            </div>
            <div>
              <label className="label">入职日期 <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={form.joinDate}
                onChange={e => setForm({ ...form, joinDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">所属项目部 <span className="text-red-500">*</span></label>
            <select className="select" value={form.departmentId}
              onChange={e => setForm({ ...form, departmentId: e.target.value })}
              disabled={deptsLoading}>
              <option value="">{deptsLoading ? '加载中...' : '请选择项目部'}</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          {form.type === 'STAFF' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">薪资模式</label>
                  <select className="select" value={form.salaryMode}
                    onChange={e => setForm({ ...form, salaryMode: e.target.value })}>
                    <option value="MONTHLY">月薪制</option>
                    <option value="DAILY">日薪制</option>
                  </select>
                </div>
                <div>
                  <label className="label">{form.salaryMode === 'MONTHLY' ? '月薪（元）' : '日薪（元）'}</label>
                  <input className="input" type="number" min="0" step="0.01"
                    value={form.salaryMode === 'MONTHLY' ? form.monthlySalary : form.dailySalary}
                    onChange={e => setForm({ ...form, [form.salaryMode === 'MONTHLY' ? 'monthlySalary' : 'dailySalary']: e.target.value })} />
                </div>
                <div>
                  <label className="label">银行卡号（选填）</label>
                  <input className="input font-mono" value={form.bankAccount}
                    onChange={e => setForm({ ...form, bankAccount: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="social" checked={form.hasSocialInsurance}
                  onChange={e => setForm({ ...form, hasSocialInsurance: e.target.checked })} />
                <label htmlFor="social" className="text-sm text-gray-700">已购买社保</label>
                {form.hasSocialInsurance && (
                  <input className="input w-44" type="number" min="0" step="0.01"
                    placeholder="个人月扣除额（元）" value={form.socialInsuranceMonthly}
                    onChange={e => setForm({ ...form, socialInsuranceMonthly: e.target.value })} />
                )}
              </div>
            </>
          )}
          {form.type === 'WORKER' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">日薪标准（元）</label>
                <input className="input" type="number" min="0" step="0.01" value={form.dailySalary}
                  onChange={e => setForm({ ...form, dailySalary: e.target.value })} />
              </div>
              <div>
                <label className="label">银行卡号（选填）</label>
                <input className="input font-mono" value={form.bankAccount}
                  onChange={e => setForm({ ...form, bankAccount: e.target.value })} />
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>取消</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </Modal>

      {/* 隐藏的 file input */}
      <input ref={uploadRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />

      {/* 人员详情弹窗 */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)}
        title={detailItem ? `人员详情 — ${detailItem.name}` : ''} size="lg">
        {detailItem && (
          <div className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ['姓名', detailItem.name],
                ['类型', detailItem.type === 'STAFF' ? '项目部人员' : '务工人员'],
                ['身份证号', detailItem.idCardNo ? `${detailItem.idCardNo.slice(0, 6)}********${detailItem.idCardNo.slice(-4)}` : '—'],
                ['联系电话', detailItem.phone || '—'],
                ['入职日期', detailItem.joinDate ? formatDate(detailItem.joinDate) : '—'],
                ['离职日期', detailItem.leaveDate ? formatDate(detailItem.leaveDate) : '在职中'],
                ['薪资标准', detailItem.salaryMode === 'MONTHLY'
                  ? `¥${detailItem.monthlySalary || 0}/月`
                  : detailItem.salaryMode === 'DAILY'
                  ? `¥${detailItem.dailySalary || 0}/天`
                  : '—'],
                ['所属单位', detailItem.subcontractor?.companyName || detailItem.subcontractor?.contactName || detailItem.department?.name || '—'],
                ['银行卡号', detailItem.bankAccount || '—'],
                ['社保', detailItem.hasSocialInsurance ? `已购，月扣 ¥${detailItem.socialInsuranceMonthly || 0}` : '未购'],
                ['人脸状态', detailItem.faceStatus === 'enrolled' ? '已录入' : detailItem.faceStatus || '未录入'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-gray-400 flex-shrink-0 w-20">{k}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>

            {/* 人脸资料 */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">人脸资料</h4>
                  <p className="text-xs text-gray-400">用于微信小程序拍照打卡时进行人员身份核验</p>
                </div>
                <button onClick={() => handleUploadClick('face')}
                  disabled={uploadingCategory === 'face'}
                  className="btn-secondary btn-sm">
                  <Upload size={13} />
                  {uploadingCategory === 'face' ? '上传中...' : '上传人脸照片'}
                </button>
              </div>
              {detailItem.facePhotoUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle size={16} />
                  已录入人脸照片，后续打卡将尝试调用人脸识别适配层
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-400">
                  暂未录入人脸照片
                </div>
              )}
            </div>

            {/* 附件区域 */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">附件资料</h4>
              {[
                { key: 'contract', label: '合同/协议' },
                { key: 'training', label: '安全培训' },
                { key: 'idcard', label: '身份证' },
                { key: 'other', label: '其他附件' },
              ].map(cat => (
                <div key={cat.key} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">{cat.label}</span>
                    <button onClick={() => handleUploadClick(cat.key)}
                      disabled={uploadingCategory === cat.key}
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                      <Upload size={12} />
                      {uploadingCategory === cat.key ? '上传中...' : '上传文件'}
                    </button>
                  </div>
                  {(!attachments[cat.key] || attachments[cat.key].length === 0) ? (
                    <p className="text-xs text-gray-400 pl-1">暂无附件</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {attachments[cat.key].map((file: any) => (
                        <div key={file.id}
                          className="group relative flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                          <span className="text-sm">{getFileIcon(file.mimeType)}</span>
                          <div className="min-w-0 max-w-[180px]">
                            <a href={file.filePath} target="_blank" rel="noreferrer"
                              className="text-xs text-gray-700 hover:text-primary-600 truncate block">
                              {file.fileName}
                            </a>
                            <span className="text-[10px] text-gray-400">
                              {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : ''}
                            </span>
                          </div>
                          <button onClick={() => handleDeleteAttachment(file.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600 transition-all">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 离职弹窗 */}
      <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="登记离职" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">离职日期</label>
            <input type="date" className="input" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setShowLeaveModal(false)}>取消</button>
            <button className="btn-danger" onClick={handleLeave}>确认离职</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Personnel;
