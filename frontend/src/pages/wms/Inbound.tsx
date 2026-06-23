/**
 * 资料通工程管理系统 - 入库管理
 * 支持手动录入、Excel 导入、OCR 识别三种方式
 */

import React, { useEffect, useState, useRef } from 'react';
import { wmsApi, contractApi, departmentApi, downloadBlob } from '../../api';
import { Plus, Search, Upload, Download, Trash2, Camera, Edit3, X, Eye, AlertTriangle, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination, EmptyState, formatDate } from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

interface InboundRecord {
  id: string;
  orderNo?: string;
  supplierName?: string;
  inboundDate?: string;
  deliveryDate?: string;
  remark?: string;
  createdAt?: string;
  contract?: { id: string; name: string };
  subProject?: { id: string; name: string; department?: { id: string; name: string } };
  items?: InboundRecordItem[];
}

interface InboundRecordItem {
  id: string;
  materialName: string;
  unit: string;
  deliveryQty: number;
  receivedQty: number;
  quantity?: number;
  unitPrice?: number;
  projectName: string;
  material?: { id: string; name: string; unit: string };
}

interface FormItem {
  materialName: string;
  unit: string;
  deliveryQty: string;
  receivedQty: string;
  unitPrice: string;
  projectName: string;
}

const emptyFormItem = (): FormItem => ({
  materialName: '', unit: '', deliveryQty: '', receivedQty: '', unitPrice: '', projectName: '',
});

/* ========================================
 * 主组件
 * ======================================== */

const Inbound: React.FC = () => {
  const [records, setRecords] = useState<InboundRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'manual' | 'excel' | 'ocr'>('manual');
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; contractId?: string }[]>([]);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  // 按合同过滤项目部
  const filteredDepartments = selectedContractId
    ? departments.filter(d => d.contractId === selectedContractId)
    : departments;

  const [supplierName, setSupplierName] = useState('');
  const [supplierLocked, setSupplierLocked] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [remark, setRemark] = useState('');

  const [formItems, setFormItems] = useState<FormItem[]>([emptyFormItem()]);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const excelRef = useRef<HTMLInputElement>(null);
  const ocrRef = useRef<HTMLInputElement>(null);

  // 项目名称建议列表（按已选项目部加载已有入库项目名称）
  const [existingProjectNames, setExistingProjectNames] = useState<string[]>([]);
  useEffect(() => {
    if (!selectedDepartmentId) { setExistingProjectNames([]); return; }
    (async () => {
      try {
        const res = await wmsApi.getInboundProjectNames({ departmentId: selectedDepartmentId });
        const body = (res.data as any)?.data || res.data || [];
        setExistingProjectNames([...new Set((body as any[]).map((p: any) => p.projectName).filter(Boolean) as string[])]);
      } catch { setExistingProjectNames([]); }
    })();
  }, [selectedDepartmentId]);

  // ── 详情弹窗 ──
  const [showDetail, setShowDetail] = useState(false);
  const [detailRecord, setDetailRecord] = useState<InboundRecord | null>(null);

  // ── 删除确认 + 级联预览 ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cascadeData, setCascadeData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await wmsApi.getInbound({ page, pageSize, keyword });
      const body = (res.data as any);
      const listData = body?.data;
      // 后端返回 data 可能是数组或 { items, total } 格式，兼容两种
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      const totalCount = body?.meta?.total || (listData?.total) || items.length;
      setRecords(items);
      setTotal(totalCount);
    } catch (err: any) { toast.error(err?.friendlyMessage || err?.message || '加载入库记录失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [page, keyword]);
  const totalPages = Math.ceil(total / pageSize);

  const openCreate = async () => {
    setShowCreate(true);
    setSelectedContractId(''); setSelectedDepartmentId('');
    try {
      const [cRes, dRes] = await Promise.all([
        contractApi.getList({ pageSize: 500 }),
        departmentApi.getList({ pageSize: 500 }),
      ]);
      const contractBody = cRes.data as any;
      setContracts(contractBody?.data || contractBody || []);
      const deptBody = dRes.data as any;
      setDepartments(deptBody?.data || deptBody || []);
    } catch { /* ignore */ }
  };

  const handleEdit = async (record: InboundRecord) => {
    setEditingId(record.id);
    try {
      // 加载合同、项目部等选项
      const [cRes, dRes] = await Promise.all([
        contractApi.getList({ pageSize: 500 }),
        departmentApi.getList({ pageSize: 500 }),
      ]);
      const contractBody = cRes.data as any;
      setContracts(contractBody?.data || contractBody || []);
      const deptBody = dRes.data as any;
      setDepartments(deptBody?.data || deptBody || []);
    } catch { /* ignore */ }

    // 预填表单
    setSupplierName(record.supplierName || '');
    setSupplierLocked(true);
    setDeliveryDate(record.deliveryDate ? record.deliveryDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setRemark(record.remark || '');
    setSelectedContractId(record.contract?.id || '');
    setSelectedDepartmentId((record as any).departmentId || record.subProject?.department?.id || '');

    // 预填物资明细
    if (record.items?.length) {
      setFormItems(record.items.map(i => ({
        materialName: (i as any).material?.name || i.materialName || '',
        unit: (i as any).material?.unit || i.unit || '',
        deliveryQty: String(i.deliveryQty || i.quantity || ''),
        receivedQty: String(i.receivedQty || i.quantity || ''),
        unitPrice: String((i as any).unitPrice || ''),
        projectName: i.projectName || '',
      })));
    } else {
      setFormItems([emptyFormItem()]);
    }

    setShowCreate(true);
    setTab('manual');
  };

  const resetForm = () => {
    setEditingId(null);
    setSupplierName(''); setSupplierLocked(false);
    setDeliveryDate(new Date().toISOString().slice(0, 10));
    setSelectedContractId(''); setSelectedDepartmentId('');
    setRemark(''); setFormItems([emptyFormItem()]);
    setFile(null); setTab('manual');
  };

  const addItem = () => setFormItems(prev => [...prev, emptyFormItem()]);
  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof FormItem, value: string) => {
    setFormItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target.files?.[0];
    if (!fileInput) return;
    setOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', fileInput);
      const res = await wmsApi.ocrInbound(fd);
      const body = (res.data as any)?.data || {};
      const parsed = body.parsed || {};
      if (parsed.supplier) { setSupplierName(parsed.supplier); setSupplierLocked(true); }
      if (parsed.deliveryDate) setDeliveryDate(parsed.deliveryDate);
      if (parsed.items?.length > 0) {
        setFormItems(parsed.items.map((i: any) => ({
          materialName: i.name || i.materialName || '',
          unit: i.unit || '', deliveryQty: String(i.qty || i.deliveryQty || i.quantity || ''),
          receivedQty: String(i.qty || i.receivedQty || i.quantity || ''), unitPrice: String(i.unitPrice || ''),
          projectName: i.projectName || '',
        })));
      }
      toast.success(`OCR 识别成功${parsed.items?.length ? `，识别到 ${parsed.items.length} 种物资` : ''}`);
      setTab('manual');
    } catch (err: any) { toast.error(err.response?.data?.message || '识别失败'); }
    finally { setOcrLoading(false); if (ocrRef.current) ocrRef.current.value = ''; }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) return toast.error('请输入供应商名称');
    // 检查数量是否为有效数字
    for (const i of formItems) {
      if (!i.materialName?.trim()) continue;
      if (i.deliveryQty.trim() && isNaN(Number(i.deliveryQty))) {
        return toast.error(`"${i.materialName}"的送货数量"${i.deliveryQty}"不是有效数字`);
      }
    }
    const validItems = formItems.filter(i => i.materialName?.trim() && Number(i.deliveryQty) > 0);
    if (!validItems.length) return toast.error('请至少填写一条有效物资');
    setSaving(true);
    try {
      const itemsPayload = validItems.map(i => ({
        materialName: i.materialName,
        unit: i.unit,
        quantity: Number(i.receivedQty) || Number(i.deliveryQty),
        unitPrice: Number(i.unitPrice) || 0,
        projectName: i.projectName || '待分配物资',
      }));

      if (editingId) {
        await wmsApi.updateInbound(editingId, {
          contractId: selectedContractId || undefined,
          departmentId: selectedDepartmentId || undefined,
          supplierName: supplierName.trim() || undefined,
          inboundDate: deliveryDate,
          remark,
          items: itemsPayload,
        });
        toast.success('入库单修改成功');
      } else {
        await wmsApi.createInbound({
          contractId: selectedContractId || undefined,
          departmentId: selectedDepartmentId || undefined,
          supplierName: supplierName.trim() || undefined,
          inboundDate: deliveryDate,
          remark,
          items: itemsPayload,
        });
        toast.success('入库登记成功');
      }
      setShowCreate(false); resetForm(); loadData();
    } catch (err: any) { toast.error(err.response?.data?.message || '提交失败'); }
    finally { setSaving(false); }
  };

  const handleExcelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('请选择 Excel 文件');
    setSaving(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('deliveryDate', deliveryDate);
    if (selectedContractId) fd.append('contractId', selectedContractId);
    if (selectedDepartmentId) fd.append('departmentId', selectedDepartmentId);
    if (supplierName.trim()) fd.append('supplierName', supplierName.trim());
    try {
      await wmsApi.uploadInboundExcel(fd);
      toast.success('Excel 导入成功！'); setFile(null); setShowCreate(false); resetForm(); loadData();
    } catch (err: any) { toast.error(err.response?.data?.message || '导入失败'); }
    finally { setSaving(false); }
  };

  // ── 删除入库单（含级联预览） ──
  const openDeleteConfirm = async (id: string) => {
    setDeletingId(id);
    setCascadeData(null);
    setLoadingPreview(true);
    setShowDeleteConfirm(true);
    try {
      const res = await wmsApi.getInboundCascadePreview(id);
      setCascadeData((res.data as any)?.data || res.data);
    } catch {
      setCascadeData({ _error: true });
    } finally { setLoadingPreview(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await wmsApi.deleteInbound(deletingId);
      toast.success('入库单已删除，可在回收站恢复');
      setShowDeleteConfirm(false);
      setDeletingId(null);
      setCascadeData(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
    } finally { setDeleting(false); }
  };

  const handleExportInbound = async () => {
    setExporting(true);
    try {
      const res = await wmsApi.exportInbound();
      downloadBlob(res.data as Blob, '入库记录.xlsx');
      toast.success('入库记录已导出');
    } catch {
      toast.error('导出入库记录失败');
    } finally {
      setExporting(false);
    }
  };

  const calcSubtotal = (item: FormItem) => (Number(item.deliveryQty) || 0) * (Number(item.unitPrice) || 0);
  const calcTotal = () => formItems.reduce((sum, item) => sum + calcSubtotal(item), 0);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">入库管理</h1>
          <p className="page-subtitle">物资入库登记与查询，支持送货单 OCR 识别和 Excel 批量导入</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handleExportInbound} disabled={exporting}>
            <Download size={16} /> {exporting ? '导出中...' : '导出入库记录'}
          </button>
          <button className="btn-primary" onClick={openCreate}><Plus size={16} /> 新增入库</button>
        </div>
      </div>

      <div className="card py-3">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm w-full" placeholder="搜索供应商/物资名称..."
            value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="table-th">入库单号</th>
              <th className="table-th">合同名称</th>
              <th className="table-th">项目部</th>
              <th className="table-th">供应商</th>
              <th className="table-th">物资数</th>
              <th className="table-th">入库时间</th>
              <th className="table-th">备注</th>
              <th className="table-th">操作</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                : !records.length ? <tr><td colSpan={8} className="table-td text-center py-12"><EmptyState title="暂无入库记录" /></td></tr>
                : records.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => { setDetailRecord(r); setShowDetail(true); }}>
                    <td className="table-td">
                      <span className="font-mono text-xs text-primary-600">{r.orderNo || r.id.slice(0, 8)}</span>
                    </td>
                    <td className="table-td font-medium text-xs">{r.contract?.name || '—'}</td>
                    <td className="table-td text-xs">{(r as any).department?.name || r.subProject?.department?.name || '—'}</td>
                    <td className="table-td font-medium">{r.supplierName || '—'}</td>
                    <td className="table-td">{r.items?.length || 0} 项</td>
                    <td className="table-td text-xs text-gray-400">{r.inboundDate ? formatDate(r.inboundDate, 'YYYY-MM-DD HH:mm:ss') : (r.createdAt ? formatDate(r.createdAt, 'YYYY-MM-DD HH:mm:ss') : '—')}</td>
                    <td className="table-td text-xs text-gray-400 max-w-[150px] truncate">{r.remark || '—'}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setDetailRecord(r); setShowDetail(true); }}
                          className="p-1 text-gray-400 hover:text-primary-600 transition-colors" title="查看明细">
                          <Eye size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(r); }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="编辑">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(r.id); }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="删除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <Pagination current={page} total={totalPages} totalRecords={total} onChange={setPage} />
          </div>
        )}
      </div>
      </div>

      {/* ── 新增入库弹窗 ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto bg-black/40">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl mx-4 flex flex-col max-h-[calc(100vh-120px)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-800">{editingId ? '编辑入库单' : '新增入库登记'}</h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Tab 切换 */}
              <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
                <button onClick={() => setTab('manual')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'manual' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
                  <Plus size={14} />手动录入
                </button>
                <button onClick={() => setTab('excel')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'excel' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
                  <Upload size={14} />Excel 导入
                </button>
                <button onClick={() => { setTab('ocr'); setTimeout(() => ocrRef.current?.click(), 50); }}
                  className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'ocr' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
                  <Camera size={14} />OCR 识别
                </button>
              </div>

              {/* 供应商 */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-gray-700">供应商：</span>
                  {supplierLocked ? (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-700 text-base bg-green-50 px-3 py-1 rounded-lg">{supplierName}</span>
                      <button onClick={() => setSupplierLocked(false)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 border border-gray-200 rounded px-2 py-0.5">
                        <Edit3 size={11} />修改
                      </button>
                    </div>
                  ) : (
                    <input className="input w-64" placeholder="输入供应商名称"
                      value={supplierName} onChange={e => setSupplierName(e.target.value)} />
                  )}
                  {supplierName && !supplierLocked && (
                    <button type="button" onClick={() => setSupplierLocked(true)}
                      className="btn-secondary text-xs px-3 py-1.5">确认</button>
                  )}
                </div>
              </div>

              {/* 合同与项目部 */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">关联合同：</span>
                    <select className="input text-sm w-56"
                      value={selectedContractId} onChange={e => { setSelectedContractId(e.target.value); setSelectedDepartmentId(''); }}>
                      <option value="">不关联合同</option>
                      {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">项目部：</span>
                    <select className="input text-sm w-56"
                      value={selectedDepartmentId} onChange={e => setSelectedDepartmentId(e.target.value)}>
                      <option value="">不选择项目部</option>
                      {filteredDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* 基础信息 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">送货日期</label>
                  <input type="date" className="input" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
                  <input className="input" placeholder="选填" value={remark} onChange={e => setRemark(e.target.value)} />
                </div>
              </div>

              {/* 手动录入 Tab */}
              {tab === 'manual' && (
                <form id="manualForm" onSubmit={handleManualSubmit}>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-700">物资明细</h3>
                      <span className="text-xs text-gray-400">共 {formItems.length} 行，合计 ¥{calcTotal().toFixed(2)}</span>
                    </div>
                    <div>
                      <table className="w-full table-fixed">
                        <thead><tr className="bg-gray-50">
                          <th className="table-th w-8">序</th>
                          <th className="table-th w-[180px]">物资名称 *</th>
                          <th className="table-th w-14">单位</th>
                          <th className="table-th">项目名称</th>
                          <th className="table-th w-20">送货数量</th>
                          <th className="table-th w-20">实收数量</th>
                          <th className="table-th w-20">单价</th>
                          <th className="table-th w-20">小计</th>
                          <th className="table-th w-8"></th>
                        </tr></thead>
                        <tbody>
                          {formItems.map((item, idx) => {
                            const subtotal = calcSubtotal(item);
                            return (
                              <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-3 py-2 text-center text-xs text-gray-400">{idx + 1}</td>
                                <td className="px-2 py-1.5 w-[180px]">
                                  <textarea className="input text-xs w-full resize-none leading-tight" rows={2}
                                    placeholder="输入物资名称" value={item.materialName}
                                    onChange={e => updateItem(idx, 'materialName', e.target.value)} />
                                </td>
                                <td className="px-2 py-1.5 w-14">
                                  <input className="input text-xs w-14 text-center" placeholder="单位"
                                    value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input className="input text-xs w-full" list={`projectNameList-${idx}`}
                                    placeholder="项目名称" value={item.projectName}
                                    onChange={e => updateItem(idx, 'projectName', e.target.value)} />
                                  <datalist id={`projectNameList-${idx}`}>
                                    {existingProjectNames.filter(n => n !== item.projectName).map(n => (
                                      <option key={n} value={n} />
                                    ))}
                                  </datalist>
                                </td>
                                <td className="px-2 py-1.5 w-20">
                                  <input type="number" step="any" className="input text-xs w-20"
                                    placeholder="数量" value={item.deliveryQty}
                                    onChange={e => updateItem(idx, 'deliveryQty', e.target.value)} />
                                </td>
                                <td className="px-2 py-1.5 w-20">
                                  <input type="number" step="any" className="input text-xs w-20"
                                    placeholder="实收" value={item.receivedQty}
                                    onChange={e => updateItem(idx, 'receivedQty', e.target.value)} />
                                </td>
                                <td className="px-2 py-1.5 w-20">
                                  <input type="number" step="any" className="input text-xs w-20"
                                    placeholder="单价" value={item.unitPrice}
                                    onChange={e => updateItem(idx, 'unitPrice', e.target.value)} />
                                </td>
                                <td className="px-3 py-2 text-right text-primary-600 font-medium text-xs w-20">
                                  ¥{subtotal.toFixed(2)}
                                </td>
                                <td className="px-2 py-1.5 w-8">
                                  <button type="button" onClick={() => removeItem(idx)}
                                    className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center px-4 py-3 border-t border-gray-100">
                      <button type="button" onClick={addItem}
                        className="text-primary-600 text-sm hover:underline flex items-center gap-1">
                        <Plus size={14} />添加一行
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Excel 导入 Tab */}
              {tab === 'excel' && (
                <form id="excelForm" onSubmit={handleExcelSubmit} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={async () => {
                      try {
                        const res = await wmsApi.downloadInboundTemplate();
                        downloadBlob(res.data as Blob, '入库模板.xlsx');
                      } catch { toast.error('下载模板失败'); }
                    }} className="btn-secondary text-sm flex items-center gap-1.5">
                      <Download size={14} />下载模板
                    </button>
                  </div>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
                    onClick={() => excelRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}>
                    <Upload size={32} className="mx-auto text-gray-300 mb-3" />
                    {file ? (
                      <div><p className="text-primary-600 font-medium">{file.name}</p><p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p></div>
                    ) : (
                      <div><p className="text-gray-500">点击选择或拖拽 Excel 文件到此处</p><p className="text-xs text-gray-400 mt-1">支持 .xlsx .xls 格式</p></div>
                    )}
                  </div>
                  <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => setFile(e.target.files?.[0] || null)} />
                </form>
              )}

              {/* OCR 识别 */}
              <input ref={ocrRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleOcr} />
              {tab === 'ocr' && (
                <div className="text-center py-12 text-gray-500">
                  <Camera size={56} className="mx-auto text-gray-300 mb-4" />
                  {ocrLoading ? (
                    <>
                      <p className="text-base font-medium text-gray-700 mb-1">
                        识别中<span className="animate-pulse">.</span><span className="animate-pulse" style={{ animationDelay: '0.3s' }}>.</span><span className="animate-pulse" style={{ animationDelay: '0.6s' }}>.</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-3">
                        根据文件大小，预计需等待 <span className="font-medium text-amber-500">30 秒 ~ 3 分钟</span>
                      </p>
                      <div className="mt-5 inline-flex items-center gap-2.5">
                        <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500">已触发文件选择，请选择送货单图片或 PDF</p>
                      <p className="text-xs text-gray-400 mt-2">支持 JPG / PNG / PDF 格式</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
              {tab === 'manual' && (
                <button type="submit" form="manualForm" disabled={saving} className="btn-primary px-8">
                  {saving ? '提交中...' : (editingId ? '保存修改' : '确认入库')}
                </button>
              )}
              {tab === 'excel' && (
                <button type="submit" form="excelForm" disabled={saving || !file} className="btn-primary px-8">
                  {saving ? '导入中...' : '开始导入'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 入库明细弹窗 ── */}
      {showDetail && detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-800">入库明细</h2>
                <p className="text-xs text-gray-400 mt-0.5">单号：{detailRecord.orderNo || detailRecord.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100 shrink-0">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-gray-500">供应商：<span className="font-medium text-gray-700">{detailRecord.supplierName || '—'}</span></span>
                <span className="text-gray-500">合同：<span className="font-medium text-gray-700">{detailRecord.contract?.name || '—'}</span></span>
                <span className="text-gray-500">项目部：<span className="font-medium text-gray-700">{(detailRecord as any).department?.name || detailRecord.subProject?.department?.name || '—'}</span></span>
                <span className="text-gray-500">入库时间：<span className="font-medium text-gray-700">{(detailRecord as any).inboundDate ? formatDate((detailRecord as any).inboundDate, 'YYYY-MM-DD HH:mm:ss') : (detailRecord.createdAt ? formatDate(detailRecord.createdAt, 'YYYY-MM-DD HH:mm:ss') : '—')}</span></span>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="table-th">物资名称</th>
                  <th className="table-th">单位</th>
                  <th className="table-th">数量</th>
                  <th className="table-th">单价</th>
                  <th className="table-th">小计</th>
                  <th className="table-th">项目名称</th>
                </tr></thead>
                <tbody>
                  {(!detailRecord.items || detailRecord.items.length === 0) ? (
                    <tr><td colSpan={6} className="table-td text-center text-gray-400 py-8">无物资明细</td></tr>
                  ) : detailRecord.items.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="table-td font-medium">{item.material?.name || item.materialName || '—'}</td>
                      <td className="table-td text-gray-500">{item.material?.unit || item.unit || '—'}</td>
                      <td className="table-td">{Number(item.quantity || item.deliveryQty || 0)}</td>
                      <td className="table-td">¥{Number(item.unitPrice || 0).toFixed(2)}</td>
                      <td className="table-td text-primary-600 font-medium">¥{((Number(item.quantity || item.deliveryQty || 0)) * (Number(item.unitPrice || 0))).toFixed(2)}</td>
                      <td className="table-td text-xs text-gray-500">{item.projectName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 删除确认弹窗（含级联预览） ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!deleting) { setShowDeleteConfirm(false); setDeletingId(null); setCascadeData(null); } }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-3">确认删除入库单</h3>

            {loadingPreview ? (
              <div className="py-8 text-center text-gray-400">正在分析级联影响...</div>
            ) : cascadeData?._error ? (
              <div className="py-4 text-center text-amber-600 text-sm">无法获取级联信息，确定要继续删除吗？</div>
            ) : cascadeData ? (
              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <span className="text-gray-500">入库单号：</span>
                  <span className="font-mono text-primary-600 font-medium">{cascadeData.order?.orderNo || deletingId}</span>
                  <span className="text-gray-400 ml-3">共 {cascadeData.order?.itemCount || 0} 项物资</span>
                </div>

                {cascadeData.relatedOutbounds?.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> 级联影响 — 将同时删除以下出库单
                    </p>
                    <div className="space-y-1.5">
                      {cascadeData.relatedOutbounds.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between text-xs bg-white rounded px-2.5 py-1.5 border border-amber-100">
                          <span className="font-mono text-amber-700">{o.orderNo}</span>
                          <span className="text-gray-400">{o.workTeamName || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {cascadeData.affectedInventory?.length > 0 && (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800 mb-2">库存影响</p>
                    <div className="space-y-1">
                      {cascadeData.affectedInventory.map((inv: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white rounded px-2.5 py-1.5 border border-blue-100">
                          <span>{inv.materialName}</span>
                          <span className="text-gray-400">{inv.projectName || '—'}</span>
                          <span className="text-red-600 font-medium">{inv.change > 0 ? '+' : ''}{inv.change}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                  <Archive size={14} className="shrink-0 mt-0.5" />
                  <span>删除后可到<strong className="text-gray-600">回收站</strong>恢复，包括被级联删除的出库单</span>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => { setShowDeleteConfirm(false); setDeletingId(null); setCascadeData(null); }} className="btn-secondary px-6" disabled={deleting}>取消</button>
              <button onClick={handleDelete} disabled={deleting || loadingPreview} className="btn-danger px-6">{deleting ? '删除中...' : '确认删除'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbound;
