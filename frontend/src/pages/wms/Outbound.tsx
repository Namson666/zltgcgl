/**
 * 资料通工程管理系统 - 出库管理
 * 支持多项目选择、库存勾选出库、出库单 PDF 下载
 */

import React, { useEffect, useState, useMemo } from 'react';
import { wmsApi, contractApi, departmentApi, downloadBlob } from '../../api';
import { Plus, Search, FileDown, Check, ChevronDown, X, Download, Trash2, Eye, AlertTriangle, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination, EmptyState, formatDate } from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

interface OutboundRecord {
  id: string;
  orderNo?: string;
  outboundDate?: string;
  workTeam?: { name: string };
  workTeamName?: string;
  subProject?: { name: string; department?: { id: string; name: string; contract?: { name: string } } };
  remark?: string;
  createdAt?: string;
  items?: OutboundItem[];
}

interface OutboundItem {
  id: string;
  materialName: string;
  material?: { name: string; unit: string };
  subProjectName?: string;
  subProjectId?: string;
  unit: string;
  quantity: number;
}

interface WorkTeam {
  id: string;
  name: string;
  phone?: string;
  isActive?: boolean;
}

interface InventoryItem {
  id: string;
  subProjectId: string;
  materialId: string;
  projectName?: string;
  material: { name: string; unit: string; code?: string };
  quantity: number;
  subProject?: { name: string };
}

/* ========================================
 * 主组件
 * ======================================== */

const Outbound: React.FC = () => {
  // ── 列表页状态 ──
  const [records, setRecords] = useState<OutboundRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  // ── 出库操作页状态 ──
  const [showCreate, setShowCreate] = useState(false);
  const [projectNames, setProjectNames] = useState<{ projectName: string; subProjectId: string | null }[]>([]);
  const [workTeams, setWorkTeams] = useState<WorkTeam[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; contractId?: string }[]>([]);
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [workTeamId, setWorkTeamId] = useState('');
  const [outboundDate, setOutboundDate] = useState(new Date().toISOString().slice(0, 10));
  const [remark, setRemark] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [successOrders, setSuccessOrders] = useState<any[] | null>(null);

  // ── 详情弹窗 ──
  const [showDetail, setShowDetail] = useState(false);
  const [detailRecord, setDetailRecord] = useState<OutboundRecord | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // ── 删除确认 + 级联预览 ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cascadeData, setCascadeData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // 物资汇总：按物资名称合并数量
  const mergedItems = useMemo(() => {
    if (!detailRecord?.items) return [];
    const map = new Map<string, { name: string; unit: string; quantity: number; subProjectName: string }>();
    const projName = detailRecord.subProject?.department?.contract?.name || '—';
    for (const item of detailRecord.items) {
      const name = item.material?.name || item.materialName || '—';
      const unit = item.material?.unit || item.unit || '—';
      const existing = map.get(name);
      if (existing) {
        existing.quantity += Number(item.quantity || 0);
      } else {
        map.set(name, { name, unit, quantity: Number(item.quantity || 0), subProjectName: projName });
      }
    }
    return Array.from(map.values());
  }, [detailRecord?.items]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await wmsApi.getOutbound({ page, pageSize, keyword });
      const body = (res.data as any);
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      setRecords(items);
      setTotal(body?.meta?.total || (listData?.total) || items.length);
    } catch (err: any) { toast.error(err?.friendlyMessage || err?.message || '加载出库记录失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [page, keyword]);

  const totalPages = Math.ceil(total / pageSize);

  // ── 打开出库操作弹窗 ──
  const openCreate = async () => {
    setShowCreate(true);
    setSelectedContractIds([]); setSelectedDepartmentIds([]); setSelectedProjectName('');
    setInventorySearch('');
    try {
      const [pnRes, wtRes, cRes, dRes] = await Promise.all([
        wmsApi.getInboundProjectNames(),
        wmsApi.getWorkTeams({ pageSize: 500 }),
        contractApi.getList({ pageSize: 500 }),
        departmentApi.getList({ pageSize: 500 }),
      ]);
      const pnBody = (pnRes.data as any)?.data || pnRes.data || [];
      setProjectNames(Array.isArray(pnBody) ? pnBody : []);
      setWorkTeams((wtRes.data as any)?.data || []);
      const cBody = cRes.data as any;
      setContracts(cBody?.data || cBody || []);
      const dBody = dRes.data as any;
      setDepartments(dBody?.data || dBody || []);
    } catch { /* ignore */ }
  };

  // ── 合同或项目部任一选择即加载库存，可组合过滤 ──
  useEffect(() => {
    if (!selectedContractIds.length && !selectedDepartmentIds.length) { setInventory([]); setSelectedItems({}); return; }
    const fetchInventory = async () => {
      try {
        const params: any = { pageSize: 500 };
        if (selectedContractIds.length) params.contractIds = selectedContractIds.join(',');
        if (selectedDepartmentIds.length) params.departmentIds = selectedDepartmentIds.join(',');
        const res = await wmsApi.getInventory(params);
        const listData = (res.data as any)?.data || res.data;
        const items = Array.isArray(listData) ? listData : (listData?.items || []);
        setInventory(items.filter((i: any) => i.quantity > 0));
        setSelectedItems({});
        setInventorySearch('');
      } catch { setInventory([]); }
    };
    fetchInventory();
  }, [selectedContractIds, selectedDepartmentIds]);

  // 初始化所有物资数量为 0
  useEffect(() => {
    if (!inventory.length) return;
    setSelectedItems(prev => {
      const next = { ...prev };
      for (const inv of inventory) {
        const key = `${inv.subProjectId}__${inv.materialId}__${inv.projectName || ''}`;
        if (next[key] === undefined) next[key] = '0';
      }
      return next;
    });
  }, [inventory]);

  const toggleItem = (key: string, qty: number, checked: boolean) => {
    setSelectedItems(prev => ({ ...prev, [key]: checked ? String(qty) : '0' }));
  };

  // 前端过滤：项目名称 + 关键字搜索
  const filteredInventory = useMemo(() => {
    let list = inventory;
    if (selectedProjectName) list = list.filter(i => (i as any).projectName === selectedProjectName);
    if (inventorySearch) list = list.filter(i => i.material?.name?.toLowerCase().includes(inventorySearch.toLowerCase()));
    return list;
  }, [inventory, selectedProjectName, inventorySearch]);

  const selectAll = () => {
    const all = { ...selectedItems };
    filteredInventory.forEach(i => { all[`${i.subProjectId}__${i.materialId}__${i.projectName || ''}`] = String(i.quantity); });
    setSelectedItems(all);
  };

  const isItemChecked = (key: string) => {
    const v = selectedItems[key];
    return v !== undefined && Number(v) > 0;
  };

  const isAllSelected = filteredInventory.length > 0 && filteredInventory.every(i => isItemChecked(`${i.subProjectId}__${i.materialId}__${i.projectName || ''}`));

  // 合同/项目部选择变化时，重新从后端加载有库存的项目名称
  useEffect(() => {
    const loadProjectNames = async () => {
      try {
        const params: any = {};
        if (selectedContractIds.length === 1) params.contractId = selectedContractIds[0];
        if (selectedDepartmentIds.length) params.departmentId = selectedDepartmentIds.join(',');
        const pnRes = await wmsApi.getInboundProjectNames(params);
        const pnBody = (pnRes.data as any)?.data || pnRes.data || [];
        setProjectNames(Array.isArray(pnBody) ? pnBody : []);
      } catch { /* ignore */ }
    };
    loadProjectNames();
  }, [selectedContractIds, selectedDepartmentIds]);

  // 当可用项目列表变化时，清除不在列表中的已选项
  useEffect(() => {
    if (!selectedProjectName) return;
    const available = new Set(projectNames.map(p => p.projectName));
    if (!available.has(selectedProjectName)) setSelectedProjectName('');
  }, [projectNames]);

  // ── 提交出库 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepartmentIds.length) return toast.error('请选择项目部');
    if (!workTeamId) return toast.error('请选择领料班组');

    const allItems: { materialId: string; quantity: number; projectName: string; subProjectId?: string }[] = [];
    for (const [key, qtyStr] of Object.entries(selectedItems)) {
      const qty = Number(qtyStr) || 0;
      if (!qty) continue;
      const [spId, materialId, projectName = ''] = key.split('__');
      allItems.push({ materialId, quantity: qty, projectName, subProjectId: spId && spId !== 'null' ? spId : undefined });
    }

    if (!allItems.length) return toast.error('请勾选至少一种物资并填写数量');

    setSaving(true);
    try {
      const res = await wmsApi.createOutbound({
        subProjectId: allItems[0]?.subProjectId || undefined,
        departmentId: selectedDepartmentIds[0] || undefined,
        workTeamId, outboundDate, remark,
        items: allItems.map(i => ({ materialId: i.materialId, quantity: i.quantity, projectName: i.projectName })),
      });
      const orderData = (res.data as any)?.data?.order || (res.data as any)?.data;
      setSuccessOrders([orderData].filter(Boolean));
      toast.success('出库成功');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '出库失败');
    } finally { setSaving(false); }
  };

  // ── 下载所有出库单 PDF ──
  const downloadAllPdf = async () => {
    if (!successOrders?.length) return;
    for (const o of successOrders) {
      try {
        const r = await wmsApi.getOutboundPdf(o.id);
        downloadBlob(r.data, `出库单-${o.orderNo || o.id}.pdf`);
      } catch { toast.error(`下载 ${o.orderNo || o.id} 失败`); }
    }
  };

  // ── 删除出库单（含级联预览） ──
  const openDeleteConfirm = async (id: string) => {
    setDeletingId(id);
    setCascadeData(null);
    setLoadingPreview(true);
    setShowDeleteConfirm(true);
    try {
      const res = await wmsApi.getOutboundCascadePreview(id);
      setCascadeData((res.data as any)?.data || res.data);
    } catch {
      setCascadeData({ _error: true });
    } finally { setLoadingPreview(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await wmsApi.deleteOutbound(deletingId);
      toast.success('出库单已删除，可在回收站恢复');
      setShowDeleteConfirm(false);
      setDeletingId(null);
      setCascadeData(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
    } finally { setDeleting(false); }
  };

  // ── 出库成功页 ──
  if (successOrders) {
    const orders = Array.isArray(successOrders) ? successOrders : [successOrders];
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check size={40} className="text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">出库成功</h1>
          <p className="text-gray-500 mt-1">共生成 {orders.length} 张出库单</p>
          <div className="mt-3 space-y-1">
            {orders.map((o: any) => (
              <p key={o.id} className="text-sm text-gray-400">单号：{o.orderNo}</p>
            ))}
          </div>
        </div>
        <div className="flex gap-4 justify-center flex-wrap">
          <button onClick={downloadAllPdf} className="btn-primary flex items-center gap-2 px-8">
            <Download size={16} />下载出库单 PDF
          </button>
          <button onClick={() => { setSuccessOrders(null); setSelectedItems({}); setSelectedProjectName(''); setProjectSearch(''); setInventorySearch(''); setShowCreate(false); loadData(); }} className="btn-secondary px-8">返回继续出库</button>
        </div>
      </div>
    );
  }

  // ── 主页面渲染 ──
  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">出库管理</h1>
          <p className="page-subtitle">领料单管理、出库登记与查询</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> 新增出库
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="card py-3">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm w-full" placeholder="搜索物资名称..."
            value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* 列表 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="table-th">出库单号</th>
              <th className="table-th">合同</th>
              <th className="table-th">子项目</th>
              <th className="table-th">领料班组</th>
              <th className="table-th">物资数</th>
              <th className="table-th">出库日期</th>
              <th className="table-th">备注</th>
              <th className="table-th">操作</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                : !records.length ? <tr><td colSpan={8} className="table-td text-center py-12"><EmptyState title="暂无出库记录" /></td></tr>
                : records.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => { setDetailRecord(r); setShowDetail(true); }}>
                    <td className="table-td font-mono text-xs text-primary-600">{r.orderNo || r.id}</td>
                    <td className="table-td font-medium">{r.subProject?.department?.contract?.name || '—'}</td>
                    <td className="table-td">{r.subProject?.name || '—'}</td>
                    <td className="table-td"><span className="badge-blue">{r.workTeam?.name || r.workTeamName || '—'}</span></td>
                    <td className="table-td">{r.items?.length || 0} 项</td>
                    <td className="table-td">{r.outboundDate ? formatDate(r.outboundDate) : '—'}</td>
                    <td className="table-td text-xs text-gray-400 max-w-[150px] truncate">{r.remark || '—'}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setDetailRecord(r); setShowDetail(true); }}
                          className="p-1 text-gray-400 hover:text-primary-600 transition-colors" title="查看明细">
                          <Eye size={14} />
                        </button>
                        <button onClick={async (e) => { e.stopPropagation(); try { const res = await wmsApi.getOutboundPdf(r.id); downloadBlob(res.data, `出库单-${r.orderNo || r.id}.pdf`); } catch { toast.error('下载失败'); } }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="打印出库单">
                          <Download size={14} />
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
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <Pagination current={page} total={totalPages} totalRecords={total} onChange={setPage} />
          </div>
        )}
      </div>

      {/* ── 新增出库弹窗 ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl mx-4 flex flex-col max-h-[calc(100vh-120px)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-800">新增出库登记</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form id="outboundForm" onSubmit={handleSubmit} className="space-y-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">合同名称 <span className="text-xs text-gray-400">（可多选）</span></label>
                    <button type="button" onClick={() => { setContractSearch(''); setShowContractModal(true); }}
                      className="input flex items-center justify-between gap-2 cursor-pointer text-left w-full">
                      <span className={`truncate ${selectedContractIds.length ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                        {selectedContractIds.length === 0 ? '请选择合同'
                          : selectedContractIds.length === 1 ? (contracts.find(c => c.id === selectedContractIds[0])?.name || '—')
                          : `已选 ${selectedContractIds.length} 个合同`}
                      </span>
                      <ChevronDown size={14} className="shrink-0 text-gray-400" />
                    </button>
                    {selectedContractIds.length > 0 && (
                      <button type="button" onClick={() => setSelectedContractIds([])}
                        className="text-xs text-gray-400 hover:text-red-500 mt-1">清空选择</button>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">项目部 <span className="text-xs text-gray-400">（可多选）</span></label>
                    <button type="button" onClick={() => { setDeptSearch(''); setShowDeptModal(true); }}
                      className="input flex items-center justify-between gap-2 cursor-pointer text-left w-full">
                      <span className={`truncate ${selectedDepartmentIds.length ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                        {selectedDepartmentIds.length === 0 ? '请选择项目部'
                          : selectedDepartmentIds.length === 1 ? (departments.find(d => d.id === selectedDepartmentIds[0])?.name || '—')
                          : `已选 ${selectedDepartmentIds.length} 个项目部`}
                      </span>
                      <ChevronDown size={14} className="shrink-0 text-gray-400" />
                    </button>
                    {selectedDepartmentIds.length > 0 && (
                      <button type="button" onClick={() => { setSelectedDepartmentIds([]); setSelectedProjectName(''); }}
                        className="text-xs text-gray-400 hover:text-red-500 mt-1">清空选择</button>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      项目名称 <span className="text-xs text-gray-400">（单选筛选）</span>
                    </label>
                    <button type="button" onClick={() => { setProjectSearch(''); setShowProjectModal(true); }}
                      className="input flex items-center justify-between gap-2 cursor-pointer text-left w-full">
                      <span className={`truncate ${!selectedProjectName ? 'text-gray-400' : 'text-gray-800 font-medium'}`}>
                        {selectedProjectName || '全部（点击筛选）'}
                      </span>
                      <ChevronDown size={14} className="shrink-0 text-gray-400" />
                    </button>
                    {selectedProjectName && (
                      <button type="button" onClick={() => setSelectedProjectName('')}
                        className="text-xs text-gray-400 hover:text-red-500 mt-1">清除筛选</button>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">领料班组 <span className="text-red-500">*</span></label>
                    <select className="select" value={workTeamId} onChange={e => setWorkTeamId(e.target.value)}>
                      <option value="">请选择班组</option>
                      {workTeams.map(t => <option key={t.id} value={t.id}>{t.name}{t.phone ? ` (${t.phone})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">出库日期</label>
                    <input type="date" className="input" value={outboundDate} onChange={e => setOutboundDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
                    <input className="input" placeholder="可选" value={remark} onChange={e => setRemark(e.target.value)} />
                  </div>
                </div>

                {/* 库存列表 */}
                {(selectedContractIds.length > 0 || selectedDepartmentIds.length > 0) && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-700">在库物资</h3>
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
                            <th className="table-th">出库数量</th>
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
              <button type="submit" form="outboundForm" disabled={saving || !Object.values(selectedItems).some(v => Number(v) > 0)}
                className="btn-primary flex items-center gap-2 px-8">
                <FileDown size={15} />
                {saving ? '出库中...' : `确认出库（${Object.values(selectedItems).filter(v => Number(v) > 0).length} 种物资）`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 项目选择弹窗（单选） ── */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowProjectModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800">选择项目名称（单选）</h3>
              <button onClick={() => setShowProjectModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
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
                return (
                  <>
                    <button type="button"
                      onClick={() => { setSelectedProjectName(''); setShowProjectModal(false); }}
                      className={`w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm border-b border-gray-50 ${!selectedProjectName ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}>
                      <input type="radio" className="w-4 h-4 text-primary-600" checked={!selectedProjectName} readOnly />
                      <span>全部项目名称</span>
                    </button>
                    {filtered.map(p => {
                      const checked = selectedProjectName === p.projectName;
                      return (
                        <button key={`${p.subProjectId}__${p.projectName}`} type="button"
                          onClick={() => { setSelectedProjectName(p.projectName); setShowProjectModal(false); }}
                          className={`w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm ${checked ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50'}`}>
                          <input type="radio" className="w-4 h-4 text-primary-600" checked={checked} readOnly />
                          <span className="flex-1">{p.projectName}</span>
                        </button>
                      );
                    })}
                  </>
                );
              })()}
            </div>
            <div className="p-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
              <span className="text-sm text-gray-500">{selectedProjectName ? `已选：${selectedProjectName}` : '显示全部'}</span>
              <button type="button" onClick={() => setShowProjectModal(false)}
                className="btn-primary text-sm px-6">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 选择合同弹窗（多选） ── */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowContractModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800">选择合同（多选）</h3>
              <button onClick={() => setShowContractModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
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
                const allSelected = filtered.every(c => selectedContractIds.includes(c.id));
                return (
                  <>
                    <label className="flex items-center gap-2.5 px-2 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 text-sm font-medium text-gray-600 rounded-lg">
                      <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
                        checked={allSelected}
                        onChange={() => {
                          if (allSelected) setSelectedContractIds(prev => prev.filter(id => !filtered.find(f => f.id === id)));
                          else setSelectedContractIds(prev => [...new Set([...prev, ...filtered.map(f => f.id)])]);
                        }} />
                      全选（{filtered.length} 个）
                    </label>
                    {filtered.map(c => {
                      const checked = selectedContractIds.includes(c.id);
                      return (
                        <label key={c.id} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm ${checked ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                          <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
                            checked={checked}
                            onChange={() => setSelectedContractIds(prev =>
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
              <span className="text-sm text-gray-500">已选 {selectedContractIds.length} 个合同</span>
              <button type="button" onClick={() => setShowContractModal(false)}
                className="btn-primary text-sm px-6">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 选择项目部弹窗（多选） ── */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDeptModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800">选择项目部（多选）</h3>
              <button onClick={() => setShowDeptModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
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
                const baseDepts = selectedContractIds.length > 0
                  ? departments.filter(d => d.contractId && selectedContractIds.includes(d.contractId))
                  : departments;
                const filtered = baseDepts.filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase()));
                if (!filtered.length) return <p className="text-sm text-gray-400 text-center py-6">无匹配项目部</p>;
                const allSelected = filtered.every(d => selectedDepartmentIds.includes(d.id));
                return (
                  <>
                    <label className="flex items-center gap-2.5 px-2 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 text-sm font-medium text-gray-600 rounded-lg">
                      <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
                        checked={allSelected}
                        onChange={() => {
                          if (allSelected) setSelectedDepartmentIds(prev => prev.filter(id => !filtered.find(f => f.id === id)));
                          else setSelectedDepartmentIds(prev => [...new Set([...prev, ...filtered.map(f => f.id)])]);
                        }} />
                      全选（{filtered.length} 个）
                    </label>
                    {filtered.map(d => {
                      const checked = selectedDepartmentIds.includes(d.id);
                      return (
                        <label key={d.id} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm ${checked ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                          <input type="checkbox" className="w-4 h-4 text-primary-600 rounded"
                            checked={checked}
                            onChange={() => setSelectedDepartmentIds(prev =>
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
              <span className="text-sm text-gray-500">已选 {selectedDepartmentIds.length} 个项目部</span>
              <button type="button" onClick={() => { setSelectedProjectName(''); setShowDeptModal(false); }}
                className="btn-primary text-sm px-6">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 出库明细弹窗 ── */}
      {showDetail && detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-800">出库明细</h2>
                <p className="text-xs text-gray-400 mt-0.5">单号：{detailRecord.orderNo || detailRecord.id.slice(0, 8)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowSummary(s => !s)}
                  className="btn-secondary text-xs px-3 py-1.5">
                  {showSummary ? '物资明细' : '物资汇总'}
                </button>
                <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
            </div>
            <div className="px-6 py-3 border-b border-gray-100 shrink-0">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-gray-500">合同：<span className="font-medium text-gray-700">{detailRecord.subProject?.department?.contract?.name || '—'}</span></span>
                <span className="text-gray-500">项目部：<span className="font-medium text-gray-700">{detailRecord.subProject?.department?.name || detailRecord.subProject?.name || '—'}</span></span>
                <span className="text-gray-500">领料班组：<span className="font-medium text-gray-700">{detailRecord.workTeam?.name || detailRecord.workTeamName || '—'}</span></span>
                <span className="text-gray-500">出库日期：<span className="font-medium text-gray-700">{detailRecord.outboundDate ? formatDate(detailRecord.outboundDate) : '—'}</span></span>
                <span className="text-gray-500">出库时间：<span className="font-medium text-gray-700">{detailRecord.createdAt ? formatDate(detailRecord.createdAt, 'YYYY-MM-DD HH:mm:ss') : '—'}</span></span>
              </div>
              {detailRecord.remark && <p className="text-sm text-gray-500 mt-2">备注：{detailRecord.remark}</p>}
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="table-th w-12">序号</th>
                  {!showSummary && <th className="table-th">项目名称</th>}
                  <th className="table-th">物资名称</th>
                  <th className="table-th">单位</th>
                  <th className="table-th">出库数量</th>
                </tr></thead>
                <tbody>
                  {showSummary ? (
                    // 物资汇总：按物资名称合并
                    mergedItems.length === 0 ? (
                      <tr><td colSpan={4} className="table-td text-center text-gray-400 py-8">无物资明细</td></tr>
                    ) : mergedItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="table-td text-gray-400 text-xs">{idx + 1}</td>
                        <td className="table-td font-medium">{item.name}</td>
                        <td className="table-td text-gray-500">{item.unit}</td>
                        <td className="table-td font-bold text-primary-600">{item.quantity}</td>
                      </tr>
                    ))
                  ) : (
                    // 物资明细：每项一行
                    (!detailRecord.items || detailRecord.items.length === 0) ? (
                      <tr><td colSpan={5} className="table-td text-center text-gray-400 py-8">无物资明细</td></tr>
                    ) : detailRecord.items.map((item: any, idx: number) => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="table-td text-gray-400 text-xs">{idx + 1}</td>
                        <td className="table-td text-xs text-gray-600">{item.projectName || item.subProjectName || detailRecord.subProject?.name || '—'}</td>
                        <td className="table-td font-medium">{item.material?.name || item.materialName || '—'}</td>
                        <td className="table-td text-gray-500">{item.material?.unit || item.unit || '—'}</td>
                        <td className="table-td font-bold text-primary-600">{Number(item.quantity || 0)}</td>
                      </tr>
                    ))
                  )}
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
            <h3 className="text-lg font-bold text-gray-800 mb-3">确认删除出库单</h3>

            {loadingPreview ? (
              <div className="py-8 text-center text-gray-400">正在分析级联影响...</div>
            ) : cascadeData?._error ? (
              <div className="py-4 text-center text-amber-600 text-sm">无法获取级联信息，确定要继续删除吗？</div>
            ) : cascadeData ? (
              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <span className="text-gray-500">出库单号：</span>
                  <span className="font-mono text-primary-600 font-medium">{cascadeData.order?.orderNo || deletingId}</span>
                  <span className="text-gray-400 ml-3">共 {cascadeData.order?.itemCount || 0} 项物资</span>
                </div>

                {cascadeData.relatedReturns?.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> 关联退库记录（不会被删除，但关联将断开）
                    </p>
                    <div className="space-y-1.5">
                      {cascadeData.relatedReturns.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded px-2.5 py-1.5 border border-amber-100">
                          <span className="font-mono text-amber-700">{r.orderNo}</span>
                          <span className="text-gray-400">{r.returnDate ? formatDate(r.returnDate) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {cascadeData.affectedInventory?.length > 0 && (
                  <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-800 mb-2">库存影响（将恢复以下库存）</p>
                    <div className="space-y-1">
                      {cascadeData.affectedInventory.map((inv: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white rounded px-2.5 py-1.5 border border-green-100">
                          <span>{inv.materialName}</span>
                          <span className="text-gray-400">{inv.projectName || '—'}</span>
                          <span className="text-green-600 font-medium">+{inv.change}</span>
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

export default Outbound;
