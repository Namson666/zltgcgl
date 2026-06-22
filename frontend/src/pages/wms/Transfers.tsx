/**
 * 资料通工程管理系统 - 物资调拨
 * 跨合同/项目部物资调拨管理，保留完整溯源记录
 */

import React, { useEffect, useState, useMemo } from 'react';
import { wmsApi, contractApi, departmentApi, downloadBlob } from '../../api';
import { Plus, Search, ChevronDown, X, Trash2, Eye, AlertTriangle, Archive, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination, EmptyState, formatDate } from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

interface TransferRecord {
  id: string;
  orderNo?: string;
  transferDate?: string;
  remark?: string;
  createdAt?: string;
  fromSubProject?: { name: string; department?: { name: string; contract?: { name: string } } };
  toSubProject?: { name: string; department?: { name: string; contract?: { name: string } } };
  items?: TransferItem[];
}

interface TransferItem {
  id: string;
  materialId: string;
  quantity: number;
  material?: { name: string; unit: string; code?: string };
}

interface InventoryItem {
  id: string;
  subProjectId: string;
  materialId: string;
  projectName?: string;
  material: { name: string; unit: string; code?: string };
  quantity: number;
  subProject?: { name: string; department?: { name: string; contract?: { name: string } } };
  department?: { name: string; contract?: { name: string } };
}

/* ========================================
 * 主组件
 * ======================================== */

const Transfers: React.FC = () => {
  // ── 列表页状态 ──
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  // ── 调拨操作页状态 ──
  const [showCreate, setShowCreate] = useState(false);
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; contractId?: string }[]>([]);
  const [projectNames, setProjectNames] = useState<{ projectName: string; subProjectId: string | null }[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // 调出方（多选合同 + 多选项目部）
  const [fromContractIds, setFromContractIds] = useState<string[]>([]);
  const [fromDepartmentIds, setFromDepartmentIds] = useState<string[]>([]);
  // 调入方（单选合同 + 单选项目部 + 单选项目名称）
  const [toContractId, setToContractId] = useState('');
  const [toDepartmentId, setToDepartmentId] = useState('');
  const [toProjectName, setToProjectName] = useState('');

  const [showFromContractModal, setShowFromContractModal] = useState(false);
  const [showFromDeptModal, setShowFromDeptModal] = useState(false);
  const [showToContractModal, setShowToContractModal] = useState(false);
  const [showToDeptModal, setShowToDeptModal] = useState(false);
  const [showToProjectModal, setShowToProjectModal] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');

  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [remark, setRemark] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── 详情弹窗 ──
  const [showDetail, setShowDetail] = useState(false);
  const [detailRecord, setDetailRecord] = useState<TransferRecord | null>(null);

  // ── 删除确认 ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cascadeData, setCascadeData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await wmsApi.getTransfers({ page, pageSize, keyword });
      const body = (res.data as any);
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      setRecords(items);
      setTotal(body?.meta?.total || (listData?.total) || items.length);
    } catch { toast.error('加载调拨记录失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [page, keyword]);

  const totalPages = Math.ceil(total / pageSize);

  // ── 打开调拨操作弹窗 ──
  const openCreate = async () => {
    setShowCreate(true);
    setFromContractIds([]); setFromDepartmentIds([]);
    setToContractId(''); setToDepartmentId(''); setToProjectName('');
    setInventorySearch(''); setSelectedItems({});
    try {
      const [cRes, dRes] = await Promise.all([
        contractApi.getList({ pageSize: 500 }),
        departmentApi.getList({ pageSize: 500 }),
      ]);
      const cBody = cRes.data as any;
      setContracts(cBody?.data || cBody || []);
      const dBody = dRes.data as any;
      setDepartments(dBody?.data || dBody || []);
    } catch { /* ignore */ }
  };

  // ── 选择调出项目部后加载库存 ──
  useEffect(() => {
    if (!fromDepartmentIds.length) { setInventory([]); setSelectedItems({}); return; }
    const fetchInventory = async () => {
      try {
        const res = await wmsApi.getInventory({ departmentIds: fromDepartmentIds.join(','), pageSize: 500 } as any);
        const listData = (res.data as any)?.data || res.data;
        const items = Array.isArray(listData) ? listData : (listData?.items || []);
        setInventory(items.filter((i: any) => i.quantity > 0));
        setSelectedItems({});
      } catch { setInventory([]); }
    };
    fetchInventory();
  }, [fromDepartmentIds]);

  // ── 选择调入方后加载可选项目名称 ──
  useEffect(() => {
    const loadProjectNames = async () => {
      if (!toDepartmentId) { setProjectNames([]); return; }
      try {
        const params: any = { departmentId: toDepartmentId };
        if (toContractId) params.contractId = toContractId;
        const pnRes = await wmsApi.getInboundProjectNames(params);
        const pnBody = (pnRes.data as any)?.data || pnRes.data || [];
        setProjectNames(Array.isArray(pnBody) ? pnBody : []);
      } catch { setProjectNames([]); }
    };
    loadProjectNames();
  }, [toDepartmentId, toContractId]);

  // 前端过滤库存
  const filteredInventory = useMemo(() => {
    let list = inventory;
    if (inventorySearch) list = list.filter(i => i.material?.name?.toLowerCase().includes(inventorySearch.toLowerCase()));
    return list;
  }, [inventory, inventorySearch]);

  const toggleItem = (key: string, qty: number, checked: boolean) => {
    setSelectedItems(prev => ({ ...prev, [key]: checked ? String(qty) : '0' }));
  };

  const selectAll = () => {
    const all = { ...selectedItems };
    filteredInventory.forEach(i => { all[`${i.subProjectId}__${i.materialId}__${i.projectName || ''}`] = String(i.quantity); });
    setSelectedItems(all);
  };

  const isItemChecked = (key: string) => {
    const v = selectedItems[key];
    return v !== undefined && Number(v) > 0;
  };

  // ── 提交调拨 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDepartmentIds.length) return toast.error('请选择调出项目部');
    if (!toDepartmentId) return toast.error('请选择调入项目部');

    const allItems: { materialId: string; quantity: number; projectName: string }[] = [];
    for (const [key, qtyStr] of Object.entries(selectedItems)) {
      const qty = Number(qtyStr) || 0;
      if (!qty) continue;
      const [, materialId, projectName = ''] = key.split('__');
      allItems.push({ materialId, quantity: qty, projectName });
    }
    if (!allItems.length) return toast.error('请勾选至少一种物资并填写数量');

    setSaving(true);
    try {
      await wmsApi.createTransfer({
        fromDepartmentId: fromDepartmentIds[0],
        toDepartmentId,
        transferDate, remark,
        items: allItems,
      });
      toast.success('调拨成功');
      setShowCreate(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '调拨失败');
    } finally { setSaving(false); }
  };

  // ── 下载调拨单 PDF ──
  const downloadPdf = async (id: string, orderNo: string) => {
    try {
      const r = await wmsApi.getTransferPdf(id);
      downloadBlob(r.data, `调拨单-${orderNo || id}.pdf`);
    } catch { toast.error('下载失败'); }
  };

  // ── 删除调拨单 ──
  const openDeleteConfirm = async (id: string) => {
    setDeletingId(id);
    setCascadeData(null);
    setLoadingPreview(true);
    setShowDeleteConfirm(true);
    try {
      const res = await wmsApi.getTransferCascadePreview(id);
      setCascadeData((res.data as any)?.data || res.data);
    } catch {
      setCascadeData({ _error: true });
    } finally { setLoadingPreview(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await wmsApi.deleteTransfer(deletingId);
      toast.success('调拨单已删除，可在回收站恢复');
      setShowDeleteConfirm(false);
      setDeletingId(null);
      setCascadeData(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
    } finally { setDeleting(false); }
  };

  // 调入方可选项目部：按合同过滤
  const toDepartments = useMemo(() => {
    if (!toContractId) return departments;
    return departments.filter(d => d.contractId === toContractId);
  }, [departments, toContractId]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">物资调拨</h1>
          <p className="page-subtitle">跨合同/跨项目部物资调拨管理，完整溯源</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> 新增调拨
        </button>
      </div>

      {/* 搜索 */}
      <div className="card py-3">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm w-full" placeholder="搜索物资名称..."
            value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* 调拨列表 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="table-th">调拨单号</th>
              <th className="table-th">调出合同</th>
              <th className="table-th">调出项目部</th>
              <th className="table-th">调入合同</th>
              <th className="table-th">调入项目部</th>
              <th className="table-th">物资数</th>
              <th className="table-th">调拨日期</th>
              <th className="table-th">备注</th>
              <th className="table-th">操作</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                : !records.length ? <tr><td colSpan={9} className="table-td text-center py-12"><EmptyState title="暂无调拨记录" /></td></tr>
                : records.map(r => {
                  const fromContract = r.fromSubProject?.department?.contract?.name || '—';
                  const fromDept = r.fromSubProject?.department?.name || r.fromSubProject?.name || '—';
                  const toContract = r.toSubProject?.department?.contract?.name || '—';
                  const toDept = r.toSubProject?.department?.name || r.toSubProject?.name || '—';
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setDetailRecord(r); setShowDetail(true); }}>
                      <td className="table-td font-mono text-xs text-primary-600">{r.orderNo || r.id.slice(0, 8)}</td>
                      <td className="table-td text-xs">{fromContract}</td>
                      <td className="table-td font-medium">{fromDept}</td>
                      <td className="table-td text-xs">{toContract}</td>
                      <td className="table-td font-medium">{toDept}</td>
                      <td className="table-td">{r.items?.length || 0} 项</td>
                      <td className="table-td">{r.transferDate ? formatDate(r.transferDate) : '—'}</td>
                      <td className="table-td text-xs text-gray-400 max-w-[150px] truncate">{r.remark || '—'}</td>
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setDetailRecord(r); setShowDetail(true); }}
                            className="p-1 text-gray-400 hover:text-primary-600 transition-colors" title="查看明细">
                            <Eye size={14} />
                          </button>
                          <button onClick={async (e) => { e.stopPropagation(); downloadPdf(r.id, r.orderNo || ''); }}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="下载调拨单">
                            <Download size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(r.id); }}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="删除">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* ── 新增调拨弹窗 ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl mx-4 flex flex-col max-h-[calc(100vh-120px)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-800">新增物资调拨</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form id="transferForm" onSubmit={handleSubmit} className="space-y-4">
                {/* 调出方 */}
                <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                  <h3 className="font-semibold text-orange-800 mb-3">调出方</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">合同 <span className="text-xs text-gray-400">（可多选）</span></label>
                      <button type="button" onClick={() => { setContractSearch(''); setShowFromContractModal(true); }}
                        className="input flex items-center justify-between gap-2 cursor-pointer text-left w-full">
                        <span className={`truncate ${fromContractIds.length ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                          {fromContractIds.length === 0 ? '请选择合同' : `已选 ${fromContractIds.length} 个合同`}
                        </span>
                        <ChevronDown size={14} className="shrink-0 text-gray-400" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">项目部 <span className="text-xs text-gray-400">（可多选）</span></label>
                      <button type="button" onClick={() => { setDeptSearch(''); setShowFromDeptModal(true); }}
                        className="input flex items-center justify-between gap-2 cursor-pointer text-left w-full">
                        <span className={`truncate ${fromDepartmentIds.length ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                          {fromDepartmentIds.length === 0 ? '请选择项目部' : `已选 ${fromDepartmentIds.length} 个项目部`}
                        </span>
                        <ChevronDown size={14} className="shrink-0 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 调入方 */}
                <div className="border border-green-200 bg-green-50 rounded-xl p-4">
                  <h3 className="font-semibold text-green-800 mb-3">调入方</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">合同</label>
                      <button type="button" onClick={() => { setContractSearch(''); setShowToContractModal(true); }}
                        className="input flex items-center justify-between gap-2 cursor-pointer text-left w-full">
                        <span className={`truncate ${toContractId ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                          {toContractId ? (contracts.find(c => c.id === toContractId)?.name || '—') : '请选择合同'}
                        </span>
                        <ChevronDown size={14} className="shrink-0 text-gray-400" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">项目部 <span className="text-red-500">*</span></label>
                      <button type="button" onClick={() => { setDeptSearch(''); setShowToDeptModal(true); }}
                        className="input flex items-center justify-between gap-2 cursor-pointer text-left w-full">
                        <span className={`truncate ${toDepartmentId ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                          {toDepartmentId ? (departments.find(d => d.id === toDepartmentId)?.name || '—') : '请选择项目部'}
                        </span>
                        <ChevronDown size={14} className="shrink-0 text-gray-400" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">项目名称</label>
                      <button type="button" onClick={() => { setProjectSearch(''); setShowToProjectModal(true); }}
                        className="input flex items-center justify-between gap-2 cursor-pointer text-left w-full">
                        <span className={`truncate ${toProjectName ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                          {toProjectName || '全部（可选）'}
                        </span>
                        <ChevronDown size={14} className="shrink-0 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 调拨信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">调拨日期</label>
                    <input type="date" className="input" value={transferDate} onChange={e => setTransferDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
                    <input className="input" placeholder="可选" value={remark} onChange={e => setRemark(e.target.value)} />
                  </div>
                </div>

                {/* 库存列表 */}
                {fromDepartmentIds.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-700">调出物资</h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            已勾选 {Object.values(selectedItems).filter(v => Number(v) > 0).length} 种，
                            合计 {Object.values(selectedItems).reduce((s, q) => s + (Number(q) || 0), 0)} 件
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={selectAll} className="btn-secondary text-xs px-3 py-1.5">全选可见</button>
                          <button type="button" onClick={() => {
                            const zeroed = { ...selectedItems };
                            filteredInventory.forEach(i => { zeroed[`${i.subProjectId}__${i.materialId}__${i.projectName || ''}`] = '0'; });
                            setSelectedItems(zeroed);
                          }} className="btn-ghost text-xs px-3 py-1.5">清空可见</button>
                        </div>
                      </div>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input className="input pl-9 text-sm w-full" placeholder="搜索物资名称..."
                          value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} />
                      </div>
                    </div>

                    {!inventory.length ? (
                      <p className="text-sm text-gray-400 text-center py-10">所选项目部暂无在库物资</p>
                    ) : !filteredInventory.length ? (
                      <p className="text-sm text-gray-400 text-center py-10">无匹配物资</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead><tr className="bg-gray-50 border-b border-gray-100">
                            <th className="table-th w-10">选</th>
                            <th className="table-th">项目名称</th>
                            <th className="table-th">所属合同</th>
                            <th className="table-th">所在项目部</th>
                            <th className="table-th">物资名称</th>
                            <th className="table-th">单位</th>
                            <th className="table-th">在库数量</th>
                            <th className="table-th">调拨数量</th>
                          </tr></thead>
                          <tbody>
                            {filteredInventory.map(inv => {
                              const key = `${inv.subProjectId}__${inv.materialId}__${inv.projectName || ''}`;
                              const checked = isItemChecked(key);
                              const invAny = inv as any;
                              const contractName = invAny.subProject?.department?.contract?.name || invAny.department?.contract?.name || '—';
                              const deptName = invAny.subProject?.department?.name || invAny.department?.name || '—';
                              return (
                                <tr key={key} className={`border-b border-gray-50 ${checked ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                                  <td className="px-3 py-2">
                                    <input type="checkbox" checked={checked}
                                      onChange={e => toggleItem(key, inv.quantity, e.target.checked)}
                                      className="w-4 h-4 text-primary-600 rounded" />
                                  </td>
                                  <td className="table-td text-xs text-gray-500">{inv.projectName || inv.subProject?.name || '—'}</td>
                                  <td className="table-td text-xs text-primary-700 font-medium">{contractName}</td>
                                  <td className="table-td text-xs">{deptName}</td>
                                  <td className="table-td font-medium">{inv.material?.name}</td>
                                  <td className="table-td">{inv.material?.unit}</td>
                                  <td className="table-td font-bold text-primary-600">{inv.quantity}</td>
                                  <td className="px-2 py-1.5">
                                    <input type="number" min="0" max={inv.quantity} step="any"
                                      className="input w-28 text-sm" value={selectedItems[key] || '0'}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setSelectedItems(prev => ({ ...prev, [key]: val }));
                                      }} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
            <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end">
              <button type="submit" form="transferForm" disabled={saving || !Object.values(selectedItems).some(v => Number(v) > 0)}
                className="btn-primary flex items-center gap-2 px-8">
                {saving ? '调拨中...' : `确认调拨（${Object.values(selectedItems).filter(v => Number(v) > 0).length} 种物资）`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 调出方合同弹窗（多选） ── */}
      {showFromContractModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowFromContractModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800">选择调出合同（多选）</h3>
              <button onClick={() => setShowFromContractModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-3 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 text-sm w-full" placeholder="搜索合同名称..."
                  value={contractSearch} onChange={e => setContractSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-3 py-2 space-y-0.5">
              {(() => {
                const filtered = contracts.filter(c => c.name.toLowerCase().includes(contractSearch.toLowerCase()));
                if (!filtered.length) return <p className="text-sm text-gray-400 text-center py-6">无匹配合同</p>;
                const allSelected = filtered.every(c => fromContractIds.includes(c.id));
                return (
                  <>
                    <label className="flex items-center gap-2.5 px-2 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 text-sm font-medium text-gray-600 rounded-lg">
                      <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
                        checked={allSelected}
                        onChange={() => {
                          if (allSelected) setFromContractIds(prev => prev.filter(id => !filtered.find(f => f.id === id)));
                          else setFromContractIds(prev => [...new Set([...prev, ...filtered.map(f => f.id)])]);
                        }} />
                      全选（{filtered.length} 个）
                    </label>
                    {filtered.map(c => {
                      const checked = fromContractIds.includes(c.id);
                      return (
                        <label key={c.id} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm ${checked ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                          <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
                            checked={checked}
                            onChange={() => setFromContractIds(prev =>
                              checked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            )} />
                          <span className="flex-1">{c.name}</span>
                        </label>
                      );
                    })}
                  </>
                );
              })()}
            </div>
            <div className="p-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
              <span className="text-sm text-gray-500">已选 {fromContractIds.length} 个合同</span>
              <button type="button" onClick={() => setShowFromContractModal(false)}
                className="btn-primary text-sm px-6">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 调出方项目部弹窗（多选） ── */}
      {showFromDeptModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowFromDeptModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800">选择调出项目部（多选）</h3>
              <button onClick={() => setShowFromDeptModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-3 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 text-sm w-full" placeholder="搜索项目部名称..."
                  value={deptSearch} onChange={e => setDeptSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-3 py-2 space-y-0.5">
              {(() => {
                const baseDepts = fromContractIds.length > 0
                  ? departments.filter(d => d.contractId && fromContractIds.includes(d.contractId))
                  : departments;
                const filtered = baseDepts.filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase()));
                if (!filtered.length) return <p className="text-sm text-gray-400 text-center py-6">无匹配项目部</p>;
                const allSelected = filtered.every(d => fromDepartmentIds.includes(d.id));
                return (
                  <>
                    <label className="flex items-center gap-2.5 px-2 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 text-sm font-medium text-gray-600 rounded-lg">
                      <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
                        checked={allSelected}
                        onChange={() => {
                          if (allSelected) setFromDepartmentIds(prev => prev.filter(id => !filtered.find(f => f.id === id)));
                          else setFromDepartmentIds(prev => [...new Set([...prev, ...filtered.map(f => f.id)])]);
                        }} />
                      全选（{filtered.length} 个）
                    </label>
                    {filtered.map(d => {
                      const checked = fromDepartmentIds.includes(d.id);
                      return (
                        <label key={d.id} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm ${checked ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                          <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
                            checked={checked}
                            onChange={() => setFromDepartmentIds(prev =>
                              checked ? prev.filter(id => id !== d.id) : [...prev, d.id]
                            )} />
                          <span className="flex-1">{d.name}</span>
                        </label>
                      );
                    })}
                  </>
                );
              })()}
            </div>
            <div className="p-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
              <span className="text-sm text-gray-500">已选 {fromDepartmentIds.length} 个项目部</span>
              <button type="button" onClick={() => setShowFromDeptModal(false)}
                className="btn-primary text-sm px-6">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 调入方合同弹窗（单选） ── */}
      {showToContractModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowToContractModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800">选择调入合同</h3>
              <button onClick={() => setShowToContractModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-3 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 text-sm w-full" placeholder="搜索合同名称..."
                  value={contractSearch} onChange={e => setContractSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-3 py-2 space-y-0.5">
              {contracts.filter(c => c.name.toLowerCase().includes(contractSearch.toLowerCase())).map(c => (
                <button key={c.id} type="button"
                  onClick={() => { setToContractId(c.id); setToDepartmentId(''); setToProjectName(''); setShowToContractModal(false); }}
                  className={`w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm ${toContractId === c.id ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50'}`}>
                  <span className="flex-1">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 调入方项目部弹窗（单选） ── */}
      {showToDeptModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowToDeptModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800">选择调入项目部</h3>
              <button onClick={() => setShowToDeptModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-3 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 text-sm w-full" placeholder="搜索项目部名称..."
                  value={deptSearch} onChange={e => setDeptSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-3 py-2 space-y-0.5">
              {toDepartments.filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase())).map(d => (
                <button key={d.id} type="button"
                  onClick={() => { setToDepartmentId(d.id); setToProjectName(''); setShowToDeptModal(false); }}
                  className={`w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm ${toDepartmentId === d.id ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50'}`}>
                  <span className="flex-1">{d.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 调入方项目名称弹窗（单选） ── */}
      {showToProjectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowToProjectModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800">选择项目名称</h3>
              <button onClick={() => setShowToProjectModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-3 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 text-sm w-full" placeholder="搜索项目名称..."
                  value={projectSearch} onChange={e => setProjectSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-3 py-2 space-y-0.5">
              {(() => {
                const filtered = projectNames.filter(p =>
                  p.projectName.toLowerCase().includes(projectSearch.toLowerCase())
                );
                if (!filtered.length) return <p className="text-sm text-gray-400 text-center py-6">无匹配项目</p>;
                return filtered.map(p => {
                  const checked = toProjectName === p.projectName;
                  return (
                    <button key={`${p.subProjectId}__${p.projectName}`} type="button"
                      onClick={() => { setToProjectName(p.projectName); setShowToProjectModal(false); }}
                      className={`w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm ${checked ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50'}`}>
                      <span className="flex-1">{p.projectName}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── 调拨明细弹窗 ── */}
      {showDetail && detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-800">调拨明细</h2>
                <p className="text-xs text-gray-400 mt-0.5">单号：{detailRecord.orderNo || detailRecord.id.slice(0, 8)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadPdf(detailRecord.id, detailRecord.orderNo || '')}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                  <Download size={12} />下载 PDF
                </button>
                <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
            </div>
            <div className="px-6 py-3 border-b border-gray-100 shrink-0">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-gray-500">调出合同：<span className="font-medium text-gray-700">{detailRecord.fromSubProject?.department?.contract?.name || '—'}</span></span>
                <span className="text-gray-500">调出项目部：<span className="font-medium text-gray-700">{detailRecord.fromSubProject?.department?.name || detailRecord.fromSubProject?.name || '—'}</span></span>
                <span className="text-gray-500">调入合同：<span className="font-medium text-gray-700">{detailRecord.toSubProject?.department?.contract?.name || '—'}</span></span>
                <span className="text-gray-500">调入项目部：<span className="font-medium text-gray-700">{detailRecord.toSubProject?.department?.name || detailRecord.toSubProject?.name || '—'}</span></span>
                <span className="text-gray-500">调拨日期：<span className="font-medium text-gray-700">{detailRecord.transferDate ? formatDate(detailRecord.transferDate) : '—'}</span></span>
              </div>
              {detailRecord.remark && <p className="text-sm text-gray-500 mt-2">备注：{detailRecord.remark}</p>}
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="table-th w-12">序号</th>
                  <th className="table-th">物资名称</th>
                  <th className="table-th">单位</th>
                  <th className="table-th">调拨数量</th>
                </tr></thead>
                <tbody>
                  {(!detailRecord.items || detailRecord.items.length === 0) ? (
                    <tr><td colSpan={4} className="table-td text-center text-gray-400 py-8">无物资明细</td></tr>
                  ) : detailRecord.items.map((item: any, idx: number) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="table-td text-gray-400 text-xs">{idx + 1}</td>
                      <td className="table-td font-medium">{item.material?.name || '—'}</td>
                      <td className="table-td text-gray-500">{item.material?.unit || '—'}</td>
                      <td className="table-td font-bold text-primary-600">{Number(item.quantity || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 删除确认弹窗 ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!deleting) { setShowDeleteConfirm(false); setDeletingId(null); setCascadeData(null); } }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-3">确认删除调拨单</h3>
            {loadingPreview ? (
              <div className="py-8 text-center text-gray-400">正在分析级联影响...</div>
            ) : cascadeData?._error ? (
              <div className="py-4 text-center text-amber-600 text-sm">无法获取级联信息，确定要继续删除吗？</div>
            ) : cascadeData ? (
              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <span className="text-gray-500">调拨单号：</span>
                  <span className="font-mono text-primary-600 font-medium">{cascadeData.order?.orderNo || deletingId}</span>
                  <span className="text-gray-400 ml-3">共 {cascadeData.order?.itemCount || 0} 项物资</span>
                </div>
                {cascadeData.affectedInventory?.length > 0 && (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800 mb-2">库存影响（将反向恢复库存）</p>
                    <div className="space-y-1">
                      {cascadeData.affectedInventory.map((inv: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white rounded px-2.5 py-1.5 border border-blue-100">
                          <span>{inv.materialName}</span>
                          <span className="text-xs text-gray-400">{inv.side || ''}</span>
                          <span className={`font-medium ${inv.change > 0 ? 'text-green-600' : 'text-red-600'}`}>{inv.change > 0 ? '+' : ''}{inv.change}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                  <Archive size={14} className="shrink-0 mt-0.5" />
                  <span>删除后可到<strong className="text-gray-600">回收站</strong>恢复</span>
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

export default Transfers;
