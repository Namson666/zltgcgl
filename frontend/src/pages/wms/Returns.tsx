/**
 * 资料通工程管理系统 - 退库管理
 * 从出库记录勾选退库，支持 Excel 批量退库
 */

import React, { useEffect, useState, useRef } from 'react';
import { wmsApi, downloadBlob } from '../../api';
import { Plus, Search, Upload, Download, CheckSquare, Trash2, X, AlertTriangle, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { Pagination, EmptyState, formatDate } from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

interface ReturnRecord {
  id: string;
  orderNo?: string;
  returnDate?: string;
  source?: string;
  remark?: string;
  createdAt?: string;
  items?: any[];
}

interface OutboundItem {
  id: string;
  outboundOrderId?: string;
  materialId: string;
  material: { name: string; code?: string; unit: string };
  quantity: number;
  returnedQuantity: number;
  availableQuantity: number;
  outboundOrder?: {
    workTeam?: { name: string };
    subProject?: { name: string };
  };
}

interface SubProject {
  id: string;
  name: string;
}

interface WorkTeam {
  id: string;
  name: string;
}

/* ========================================
 * 主组件
 * ======================================== */

const Returns: React.FC = () => {
  // ── 列表页状态 ──
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  // ── 删除确认 + 级联预览 ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cascadeData, setCascadeData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // ── 退库操作状态 ──
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<'records' | 'excel'>('records');
  const [subProjects, setSubProjects] = useState<SubProject[]>([]);
  const [workTeams, setWorkTeams] = useState<WorkTeam[]>([]);
  const [outboundItems, setOutboundItems] = useState<OutboundItem[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState({ subProjectId: '', workTeamId: '', startDate: '', endDate: '' });
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [remark, setRemark] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await wmsApi.getReturns({ page, pageSize, keyword });
      const body = (res.data as any);
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      setRecords(items);
      setTotal(body?.meta?.total || (listData?.total) || items.length);
    } catch { toast.error('加载退库记录失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [page, keyword]);

  const totalPages = Math.ceil(total / pageSize);

  // ── 删除退库单（含级联预览） ──
  const openDeleteConfirm = async (id: string) => {
    setDeletingId(id);
    setCascadeData(null);
    setLoadingPreview(true);
    setShowDeleteConfirm(true);
    try {
      const res = await wmsApi.getReturnCascadePreview(id);
      setCascadeData((res.data as any)?.data || res.data);
    } catch {
      setCascadeData({ _error: true });
    } finally { setLoadingPreview(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await wmsApi.deleteReturn(deletingId);
      toast.success('退库单已删除，可在回收站恢复');
      setShowDeleteConfirm(false);
      setDeletingId(null);
      setCascadeData(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
    } finally { setDeleting(false); }
  };

  // ── 打开退库操作 ──
  const openCreate = async () => {
    setShowCreate(true);
    try {
      const [spRes, wtRes] = await Promise.all([
        wmsApi.getSubProjects(),
        wmsApi.getWorkTeams({ pageSize: 500 }),
      ]);
      setSubProjects((spRes.data as any)?.data || spRes.data || []);
      setWorkTeams((wtRes.data as any)?.data || []);
    } catch { /* ignore */ }
  };

  // ── 查询领料记录 ──
  const loadOutboundItems = async () => {
    if (!filters.subProjectId) return toast.error('请先选择子项目');
    setLoading(true);
    try {
      const res = await wmsApi.getReturnOutboundItems(filters);
      const data = (res.data as any)?.data || res.data;
      setOutboundItems(Array.isArray(data) ? data : data?.items || []);
      setSelected({});
    } catch { toast.error('加载领料记录失败'); }
    finally { setLoading(false); }
  };

  const toggleSelect = (itemId: string, qty: number) => {
    setSelected(prev => {
      if (prev[itemId] !== undefined) { const n = { ...prev }; delete n[itemId]; return n; }
      return { ...prev, [itemId]: qty };
    });
  };

  // ── 提交退库（基于领料记录） ──
  const handleReturnFromRecords = async () => {
    if (!filters.subProjectId) return toast.error('请选择子项目');
    const entries = Object.entries(selected);
    if (!entries.length) return toast.error('请勾选需要退库的物资');

    // 使用 outboundItemId 关联出库明细（后端 ReturnItem 模型使用 outboundItemId）
    const items = entries.map(([id, qty]) => {
      const item = outboundItems.find(i => i.id === id);
      return { outboundItemId: id, materialId: item!.materialId, quantity: qty, unit: item!.material.unit };
    });

    setSaving(true);
    try {
      await wmsApi.createReturn({ subProjectId: filters.subProjectId, returnDate, remark, items });
      toast.success('退库成功！');
      setSelected({});
      loadOutboundItems();
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '退库失败');
    } finally { setSaving(false); }
  };

  // ── Excel 批量退库 ──
  const handleExcelReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filters.subProjectId) return toast.error('请选择子项目');
    if (!file) return toast.error('请选择 Excel 文件');
    setSaving(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('subProjectId', filters.subProjectId);
    fd.append('returnDate', returnDate);
    try {
      await wmsApi.uploadReturnExcel(fd);
      toast.success('Excel 退库成功！');
      setFile(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '导入失败');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">退库管理</h1>
          <p className="page-subtitle">物资退库登记与查询，支持从出库记录退库和 Excel 批量退库</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> 新增退库
        </button>
      </div>

      {/* 搜索 */}
      <div className="card py-3">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm w-full" placeholder="搜索..."
            value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* 列表 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="table-th">退库单号</th>
              <th className="table-th">退库日期</th>
              <th className="table-th">物资数</th>
              <th className="table-th">来源</th>
              <th className="table-th">备注</th>
              <th className="table-th">创建时间</th>
              <th className="table-th">操作</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                : !records.length ? <tr><td colSpan={7} className="table-td text-center py-12"><EmptyState title="暂无退库记录" /></td></tr>
                : records.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-td font-mono text-xs text-primary-600">{r.orderNo || r.id}</td>
                    <td className="table-td">{r.returnDate ? formatDate(r.returnDate) : '—'}</td>
                    <td className="table-td">{r.items?.length || 0} 项</td>
                    <td className="table-td"><span className="badge-blue">{r.source === 'excel' ? 'Excel导入' : '手动'}</span></td>
                    <td className="table-td text-xs text-gray-400">{r.remark || '—'}</td>
                    <td className="table-td text-xs text-gray-400">{r.createdAt ? formatDate(r.createdAt) : '—'}</td>
                    <td className="table-td">
                      <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(r.id); }}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="删除">
                        <Trash2 size={14} />
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

      {/* ── 新增退库弹窗 ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">新增退库登记</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Tab 切换 */}
              <div className="flex bg-gray-100 rounded-lg p-1 w-fit mb-4">
                <button onClick={() => setTab('records')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'records' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
                  <CheckSquare size={14} />从记录退库
                </button>
                <button onClick={() => setTab('excel')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'excel' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
                  <Upload size={14} />Excel 退库
                </button>
              </div>

              {/* 筛选条件 */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select className="select" value={filters.subProjectId}
                    onChange={e => setFilters(f => ({ ...f, subProjectId: e.target.value }))}>
                    <option value="">请选择子项目 *</option>
                    {subProjects.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                  </select>
                  <select className="select" value={filters.workTeamId}
                    onChange={e => setFilters(f => ({ ...f, workTeamId: e.target.value }))}>
                    <option value="">全部班组</option>
                    {workTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input type="date" className="input" value={filters.startDate}
                    onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} placeholder="开始日期" />
                  <input type="date" className="input" value={filters.endDate}
                    onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} placeholder="结束日期" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">退库日期</label>
                    <input type="date" className="input" value={returnDate}
                      onChange={e => setReturnDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
                    <input className="input" placeholder="可选" value={remark}
                      onChange={e => setRemark(e.target.value)} />
                  </div>
                </div>

                {tab === 'records' ? (
                  <>
                    <button onClick={loadOutboundItems} disabled={loading}
                      className="btn-primary flex items-center gap-2">
                      <Search size={14} />{loading ? '加载中...' : '查询领料记录'}
                    </button>

                    {outboundItems.length > 0 && (
                      <>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-gray-50 border-b border-gray-200">
                              <th className="table-th w-10">选择</th>
                              <th className="table-th">物资名称</th>
                              <th className="table-th">子项目</th>
                              <th className="table-th">班组</th>
                              <th className="table-th">原领数量</th>
                              <th className="table-th">已退数量</th>
                              <th className="table-th">可退数量</th>
                              <th className="table-th">本次退库</th>
                            </tr></thead>
                            <tbody>
                              {outboundItems.map(item => {
                                const isSelected = selected[item.id] !== undefined;
                                return (
                                  <tr key={item.id}
                                    className={`border-b border-gray-50 hover:bg-gray-50 ${isSelected ? 'bg-primary-50' : ''}`}>
                                    <td className="px-3 py-2">
                                      <input type="checkbox" checked={isSelected}
                                        onChange={() => toggleSelect(item.id, item.availableQuantity)}
                                        className="w-4 h-4 text-primary-600 rounded" />
                                    </td>
                                    <td className="table-td font-medium">{item.material?.name}</td>
                                    <td className="table-td text-xs text-gray-500">{item.outboundOrder?.subProject?.name}</td>
                                    <td className="table-td text-xs">{item.outboundOrder?.workTeam?.name || '—'}</td>
                                    <td className="table-td">{item.quantity}</td>
                                    <td className="table-td text-orange-600">{item.returnedQuantity}</td>
                                    <td className="table-td font-bold text-green-600">{item.availableQuantity}</td>
                                    <td className="px-2 py-2">
                                      {isSelected && (
                                        <input type="number" min={0.01} max={item.availableQuantity} step={0.01}
                                          className="input w-24 text-sm" value={selected[item.id]}
                                          onChange={e => setSelected(prev => ({ ...prev, [item.id]: Number(e.target.value) }))} />
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end">
                          <button onClick={handleReturnFromRecords} disabled={saving || !Object.keys(selected).length}
                            className="btn-primary px-8">
                            {saving ? '提交中...' : `确认退库（已选 ${Object.keys(selected).length} 种）`}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <form onSubmit={handleExcelReturn} className="space-y-4">
                    <div
                      className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
                      onClick={() => fileRef.current?.click()}>
                      <Upload size={32} className="mx-auto text-gray-300 mb-3" />
                      {file ? (
                        <p className="text-primary-600 font-medium">{file.name}</p>
                      ) : (
                        <div>
                          <p className="text-gray-500">点击选择退库 Excel 文件</p>
                          <p className="text-xs text-gray-400 mt-1">支持 .xlsx .xls 格式</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                      onChange={e => setFile(e.target.files?.[0] || null)} />
                    <div className="flex justify-between items-center">
                      <button type="button" onClick={async () => {
                        try { const r = await wmsApi.downloadReturnTemplate(); downloadBlob(r.data, '退库模板.xlsx'); }
                        catch { toast.error('下载模板失败'); }
                      }} className="btn-secondary flex items-center gap-2 text-xs">
                        <Download size={14} />下载退库模板
                      </button>
                      <button type="submit" disabled={saving || !file} className="btn-primary px-8">
                        {saving ? '导入中...' : '开始退库'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 删除确认弹窗（含级联预览） ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!deleting) { setShowDeleteConfirm(false); setDeletingId(null); setCascadeData(null); } }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-3">确认删除退库单</h3>

            {loadingPreview ? (
              <div className="py-8 text-center text-gray-400">正在分析级联影响...</div>
            ) : cascadeData?._error ? (
              <div className="py-4 text-center text-amber-600 text-sm">无法获取级联信息，确定要继续删除吗？</div>
            ) : cascadeData ? (
              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <span className="text-gray-500">退库单号：</span>
                  <span className="font-mono text-primary-600 font-medium">{cascadeData.order?.orderNo || deletingId}</span>
                  <span className="text-gray-400 ml-3">共 {cascadeData.order?.itemCount || 0} 项物资</span>
                </div>

                {cascadeData.affectedInventory?.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-2">库存影响（将扣回以下库存）</p>
                    <div className="space-y-1">
                      {cascadeData.affectedInventory.map((inv: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white rounded px-2.5 py-1.5 border border-amber-100">
                          <span>{inv.materialName}</span>
                          <span className="text-gray-400">{inv.projectName || '—'}</span>
                          <span className="text-red-600 font-medium">{inv.change}</span>
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

export default Returns;
