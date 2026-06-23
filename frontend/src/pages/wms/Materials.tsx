/**
 * 资料通工程管理系统 - 物资总览
 * 按项目明细：逐行显示每条入库清单，不再合并
 * 按物资汇总：按合同+物资名称合并数量
 */

import React, { useEffect, useState, useMemo } from 'react';
import { downloadBlob, wmsApi } from '../../api';
import { Download, BarChart2, List, Package, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination, EmptyState, ConfirmDialog, formatDate } from '../../components/ui/Common';
import Modal from '../../components/ui/Modal';

interface Material {
  id: string;
  name: string;
  unit: string;
  code: string;
  spec?: string | null;
  unitPrice?: number | null;
  category?: string | null;
}

interface Contract {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  contract: Contract;
}

interface SubProject {
  id: string;
  name: string;
  department: Department;
}

// 入库明细模式（逐行显示入库清单）
interface InboundItemDetail {
  id: string;
  materialId: string;
  quantity: number;
  unitPrice: number | null;
  unit: string | null;
  projectName: string | null;
  material: Material;
  inboundOrder: {
    id: string;
    orderNo: string;
    inboundDate: string;
    subProject: SubProject | null;
  };
}

// 库存合并模式（按物资汇总）
interface InventoryItem {
  id: string;
  tenantId: string;
  subProjectId: string | null;
  materialId: string;
  quantity: number;
  outQuantity: number;
  material: Material;
  subProject: SubProject | null;
}

interface PaginatedData {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const Materials: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [materialCatalog, setMaterialCatalog] = useState<Material[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'catalog' | 'in' | 'out'>('in');
  const [viewMode, setViewMode] = useState<'detail' | 'summary'>('detail');
  const [keyword, setKeyword] = useState('');
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialForm, setMaterialForm] = useState({ code: '', name: '', unit: '', spec: '', unitPrice: '', category: '' });
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [deleteMaterialTarget, setDeleteMaterialTarget] = useState<Material | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState(false);
  const [exportingMaterials, setExportingMaterials] = useState(false);
  const pageSize = 50;

  const loadMaterialCatalog = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (keyword.trim()) params.name = keyword.trim();
      const res = await wmsApi.getMaterials(params);
      const list = (res.data as any)?.data || [];
      setMaterialCatalog(Array.isArray(list) ? list : []);
      setTotal(Array.isArray(list) ? list.length : 0);
    } catch {
      toast.error('加载物资档案失败');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (tab === 'catalog') {
      await loadMaterialCatalog();
      return;
    }
    setLoading(true);
    try {
      const params: any = { page, pageSize, keyword };
      if (tab === 'in') {
        params.status = 'in';
        if (viewMode === 'detail') params.viewMode = 'detail';
      } else {
        params.status = 'out';
      }
      const res = await wmsApi.getInventory(params);
      const body = (res.data as any);
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      setItems(items);
      setTotal(body?.meta?.total || (listData?.total) || items.length);
    } catch {
      toast.error('加载物资列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [tab, keyword, viewMode]);
  useEffect(() => { loadData(); }, [tab, keyword, page, viewMode]);

  const totalPages = Math.ceil(total / pageSize);

  // 汇总模式：按合同+物资名称合并数量
  const summaryItems = useMemo(() => {
    if (viewMode !== 'summary' || tab !== 'in') return [];
    const map = new Map<string, any>();
    for (const item of items) {
      const inv = item as InventoryItem;
      const key = `${inv.subProject?.department?.contract?.name || '—'}__${inv.material?.name}__${inv.material?.unit}`;
      if (!map.has(key)) {
        map.set(key, {
          contractName: inv.subProject?.department?.contract?.name || '—',
          materialName: inv.material?.name,
          unit: inv.material?.unit,
          quantity: 0,
        });
      }
      const entry = map.get(key)!;
      entry.quantity += inv.quantity;
    }
    return [...map.values()].sort((a, b) => a.contractName.localeCompare(b.contractName));
  }, [items, viewMode, tab]);

  const openCreateMaterial = () => {
    setEditingMaterial(null);
    setMaterialForm({ code: '', name: '', unit: '', spec: '', unitPrice: '', category: '' });
    setShowMaterialModal(true);
  };

  const openEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setMaterialForm({
      code: material.code || '',
      name: material.name || '',
      unit: material.unit || '',
      spec: material.spec || '',
      unitPrice: material.unitPrice != null ? String(material.unitPrice) : '',
      category: material.category || '',
    });
    setShowMaterialModal(true);
  };

  const handleSaveMaterial = async () => {
    if (!materialForm.name.trim()) return toast.error('请输入物资名称');
    if (!materialForm.unit.trim()) return toast.error('请输入单位');
    try {
      setSavingMaterial(true);
      const payload = {
        code: materialForm.code.trim() || undefined,
        name: materialForm.name.trim(),
        unit: materialForm.unit.trim(),
        spec: materialForm.spec.trim() || undefined,
        unitPrice: materialForm.unitPrice ? Number(materialForm.unitPrice) : 0,
        category: materialForm.category.trim() || undefined,
      };
      if (editingMaterial) {
        await wmsApi.updateMaterial(editingMaterial.id, payload);
        toast.success('物资已更新');
      } else {
        await wmsApi.createMaterial(payload);
        toast.success('物资已创建');
      }
      setShowMaterialModal(false);
      await loadMaterialCatalog();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (editingMaterial ? '更新物资失败' : '创建物资失败'));
    } finally {
      setSavingMaterial(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!deleteMaterialTarget) return;
    try {
      setDeletingMaterial(true);
      await wmsApi.deleteMaterial(deleteMaterialTarget.id);
      toast.success('物资已删除');
      setDeleteMaterialTarget(null);
      await loadMaterialCatalog();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || '删除物资失败');
    } finally {
      setDeletingMaterial(false);
    }
  };

  const handleExportMaterials = async () => {
    try {
      setExportingMaterials(true);
      const res = await wmsApi.exportMaterials();
      downloadBlob(res.data as Blob, '物资档案.xlsx');
      toast.success('物资档案已导出');
    } catch {
      toast.error('导出物资档案失败');
    } finally {
      setExportingMaterials(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">物资总览</h1>
          <p className="page-subtitle">管理所有物资信息和库存，共 {total} 条记录</p>
        </div>
        {tab === 'catalog' && (
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-1.5" onClick={handleExportMaterials} disabled={exportingMaterials}>
              <Download size={16} />{exportingMaterials ? '导出中...' : '导出物资档案'}
            </button>
            <button className="btn-primary flex items-center gap-1.5" onClick={openCreateMaterial}>
              <Plus size={16} />新增物资
            </button>
          </div>
        )}
      </div>

      {/* 标签切换 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button onClick={() => setTab('catalog')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${tab === 'catalog' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
            <Package size={15} className="inline mr-1" />物资档案
          </button>
          <button onClick={() => setTab('in')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${tab === 'in' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
            <Package size={15} className="inline mr-1" />在库
          </button>
          <button onClick={() => setTab('out')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${tab === 'out' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
            <List size={15} className="inline mr-1" />已出库
          </button>
        </div>
        {tab === 'in' && (
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('detail')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'detail' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
              <List size={14} />按项目明细
            </button>
            <button onClick={() => setViewMode('summary')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'summary' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
              <BarChart2 size={14} />按物资汇总
            </button>
          </div>
        )}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm w-full" placeholder={tab === 'catalog' ? '搜索物资档案...' : '搜索物资名称...'}
            value={keyword} onChange={e => setKeyword(e.target.value)} />
        </div>
      </div>

      {/* 表格 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'catalog' ? (
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-th">物资编码</th>
                <th className="table-th">物资名称</th>
                <th className="table-th">规格型号</th>
                <th className="table-th">单位</th>
                <th className="table-th">单价</th>
                <th className="table-th">分类</th>
                <th className="table-th text-right">操作</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                  : !materialCatalog.length ? <tr><td colSpan={7} className="table-td text-center py-12"><EmptyState title="暂无物资档案" description="点击新增物资开始维护" /></td></tr>
                  : materialCatalog.map((material) => (
                    <tr key={material.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-td font-mono text-xs text-primary-600">{material.code || '—'}</td>
                      <td className="table-td font-medium">{material.name}</td>
                      <td className="table-td">{material.spec || '—'}</td>
                      <td className="table-td">{material.unit}</td>
                      <td className="table-td">¥{Number(material.unitPrice || 0).toFixed(2)}</td>
                      <td className="table-td">{material.category || '—'}</td>
                      <td className="table-td">
                        <div className="flex justify-end gap-2">
                          <button title="编辑物资" className="btn-icon text-blue-600" onClick={() => openEditMaterial(material)}>
                            <Pencil size={15} />
                          </button>
                          <button title="删除物资" className="btn-icon text-red-600" onClick={() => setDeleteMaterialTarget(material)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          ) : tab === 'in' && viewMode === 'summary' ? (
            /* ===== 汇总模式 ===== */
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-th">合同名称</th>
                <th className="table-th">物资名称</th>
                <th className="table-th">单位</th>
                <th className="table-th">汇总在库数量</th>
                <th className="table-th">状态</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                  : !summaryItems.length ? <tr><td colSpan={5} className="table-td text-center py-12"><EmptyState title="暂无数据" description="当前没有库存记录" /></td></tr>
                  : summaryItems.map((item, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-td font-medium text-primary-700">{item.contractName}</td>
                      <td className="table-td font-medium">
                        {item.materialName}
                      </td>
                      <td className="table-td">{item.unit}</td>
                      <td className="table-td font-bold text-primary-600 text-lg">{item.quantity}</td>
                      <td className="table-td">
                        <span className="badge-green">正常</span>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          ) : tab === 'in' ? (
            /* ===== 明细模式（逐行显示入库清单） ===== */
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-th">入库单号</th>
                <th className="table-th">入库时间</th>
                <th className="table-th">合同名称</th>
                <th className="table-th">项目名称</th>
                <th className="table-th">物资名称</th>
                <th className="table-th">单位</th>
                <th className="table-th">数量</th>
                <th className="table-th">单价</th>
                <th className="table-th">小计</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={9} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                  : !items.length ? <tr><td colSpan={9} className="table-td text-center py-12"><EmptyState title="暂无数据" description="当前没有入库记录" /></td></tr>
                  : items.map((item: InboundItemDetail) => {
                    const contractName = item.inboundOrder?.subProject?.department?.contract?.name || '—';
                    const projectName = item.inboundOrder?.subProject?.name || item.projectName || '—';
                    const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="table-td font-mono text-xs text-primary-600">{item.inboundOrder?.orderNo || item.id.slice(0, 8)}</td>
                        <td className="table-td text-xs text-gray-500">
                          {item.inboundOrder?.inboundDate ? formatDate(item.inboundOrder.inboundDate, 'YYYY-MM-DD HH:mm:ss') : '—'}
                        </td>
                        <td className="table-td font-medium text-primary-700">{contractName}</td>
                        <td className="table-td text-xs">{projectName}</td>
                        <td className="table-td font-medium">{item.material?.name || '—'}</td>
                        <td className="table-td">{item.material?.unit || item.unit || '—'}</td>
                        <td className="table-td font-bold text-primary-600">{item.quantity}</td>
                        <td className="table-td">¥{(item.unitPrice || 0).toFixed(2)}</td>
                        <td className="table-td text-primary-600 font-medium">¥{subtotal.toFixed(2)}</td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          ) : (
            /* ===== 已出库模式 ===== */
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-th">合同名称</th>
                <th className="table-th">项目名称</th>
                <th className="table-th">物资名称</th>
                <th className="table-th">班组</th>
                <th className="table-th">出库数量</th>
                <th className="table-th">出库日期</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                  : !items.length ? <tr><td colSpan={6} className="table-td text-center py-12"><EmptyState title="暂无数据" description="当前没有出库记录" /></td></tr>
                  : items.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-td font-medium text-primary-700">{item.outboundOrder?.subProject?.department?.contract?.name || '—'}</td>
                      <td className="table-td">{item.outboundOrder?.subProject?.name}</td>
                      <td className="table-td font-medium">{item.material?.name}</td>
                      <td className="table-td"><span className="badge-blue">{item.outboundOrder?.workTeamName || '—'}</span></td>
                      <td className="table-td font-bold text-orange-600">{item.quantity}</td>
                      <td className="table-td">{item.outboundOrder?.outboundDate ? new Date(item.outboundOrder.outboundDate).toLocaleDateString('zh-CN') : '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <Pagination current={page} total={totalPages} totalRecords={total} onChange={setPage} />
          </div>
        )}
      </div>

      <Modal
        isOpen={showMaterialModal}
        onClose={() => setShowMaterialModal(false)}
        title={editingMaterial ? '编辑物资' : '新增物资'}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowMaterialModal(false)} disabled={savingMaterial}>取消</button>
            <button className="btn-primary" onClick={handleSaveMaterial} disabled={savingMaterial}>
              {savingMaterial ? '保存中...' : (editingMaterial ? '保存修改' : '创建物资')}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">物资编码</label>
            <input className="input" placeholder="请输入物资编码" value={materialForm.code}
              onChange={(e) => setMaterialForm({ ...materialForm, code: e.target.value })} />
          </div>
          <div>
            <label className="form-label">物资名称 <span className="text-red-500">*</span></label>
            <input className="input" placeholder="请输入物资名称" value={materialForm.name}
              onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} />
          </div>
          <div>
            <label className="form-label">规格型号</label>
            <input className="input" placeholder="请输入规格型号" value={materialForm.spec}
              onChange={(e) => setMaterialForm({ ...materialForm, spec: e.target.value })} />
          </div>
          <div>
            <label className="form-label">单位 <span className="text-red-500">*</span></label>
            <input className="input" placeholder="请输入单位" value={materialForm.unit}
              onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })} />
          </div>
          <div>
            <label className="form-label">单价</label>
            <input className="input" type="number" min="0" step="0.01" placeholder="请输入单价" value={materialForm.unitPrice}
              onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: e.target.value })} />
          </div>
          <div>
            <label className="form-label">分类</label>
            <input className="input" placeholder="请输入分类" value={materialForm.category}
              onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteMaterialTarget)}
        onClose={() => setDeleteMaterialTarget(null)}
        onConfirm={handleDeleteMaterial}
        title="删除物资"
        message={`确定要删除物资「${deleteMaterialTarget?.name || ''}」吗？`}
        confirmText="确认删除"
        type="danger"
        loading={deletingMaterial}
      />
    </div>
  );
};

export default Materials;
