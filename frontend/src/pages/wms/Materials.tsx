/**
 * 资料通工程管理系统 - 物资总览
 * 按项目明细：逐行显示每条入库清单，不再合并
 * 按物资汇总：按合同+物资名称合并数量
 */

import React, { useEffect, useState, useMemo } from 'react';
import { wmsApi } from '../../api';
import { Download, AlertTriangle, BarChart2, List, Package, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination, EmptyState, formatDate } from '../../components/ui/Common';

interface Material {
  id: string;
  name: string;
  unit: string;
  code: string;
  spec?: string | null;
  unitPrice?: number | null;
  alertThreshold?: number | null;
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
  isLowStock: boolean;
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'in' | 'out'>('in');
  const [viewMode, setViewMode] = useState<'detail' | 'summary'>('detail');
  const [keyword, setKeyword] = useState('');
  const pageSize = 50;

  const loadData = async () => {
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
          isLowStock: false,
        });
      }
      const entry = map.get(key)!;
      entry.quantity += inv.quantity;
      if (inv.isLowStock) entry.isLowStock = true;
    }
    return [...map.values()].sort((a, b) => a.contractName.localeCompare(b.contractName));
  }, [items, viewMode, tab]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">物资总览</h1>
          <p className="page-subtitle">管理所有物资信息和库存，共 {total} 条记录</p>
        </div>
      </div>

      {/* 标签切换 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-1">
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
          <input className="input pl-9 text-sm w-full" placeholder="搜索物资名称..."
            value={keyword} onChange={e => setKeyword(e.target.value)} />
        </div>
      </div>

      {/* 表格 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'in' && viewMode === 'summary' ? (
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
                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${item.isLowStock ? 'bg-yellow-50' : ''}`}>
                      <td className="table-td font-medium text-primary-700">{item.contractName}</td>
                      <td className="table-td font-medium">
                        {item.isLowStock && <AlertTriangle size={13} className="inline mr-1 text-yellow-500" />}
                        {item.materialName}
                      </td>
                      <td className="table-td">{item.unit}</td>
                      <td className="table-td font-bold text-primary-600 text-lg">{item.quantity}</td>
                      <td className="table-td">
                        {item.isLowStock ? <span className="badge-yellow">库存预警</span> : <span className="badge-green">正常</span>}
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
    </div>
  );
};

export default Materials;
