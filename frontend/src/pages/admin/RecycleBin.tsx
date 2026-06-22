/**
 * 资料通工程管理系统 - 回收站管理
 *
 * 显示已软删除的合同、入库单、出库单，
 * 支持恢复和永久删除操作。
 */

import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Search, AlertTriangle, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { recycleBinApi } from '../../api';
import { Pagination, EmptyState, formatDate } from '../../components/ui/Common';

interface RecycleItem {
  id: string;
  name: string;
  code?: string;
  _type: 'contract' | 'inbound' | 'outbound' | 'return' | 'transfer';
  _typeLabel: string;
  _deletedAt: string;
  supplierName?: string | null;
  totalAmount?: number | null;
}

const RecycleBin: React.FC = () => {
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const pageSize = 20;

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await recycleBinApi.getList({
        page, pageSize,
        type: typeFilter === 'all' ? undefined : typeFilter,
        keyword: keyword || undefined,
      });
      const body = res.data as any;
      const data = body?.data || body?.items || [];
      setItems(data || []);
      setTotal(body?.pagination?.total || body?.total || 0);
    } catch { toast.error('加载回收站失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [page, typeFilter]);

  const handleSearch = () => { setPage(1); loadData(); };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const handleRestore = async (ids?: string[]) => {
    const targetIds = ids || [...selectedIds];
    if (!targetIds.length) return toast.error('请选择要恢复的项目');
    setActionLoading(true);
    try {
      const res: any = await recycleBinApi.restore(
        items.filter(i => targetIds.includes(i.id)).map(i => ({ id: i.id, type: i._type }))
      );
      const body = res.data as any;
      toast.success(body?.message || '恢复成功');
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.message || '恢复失败'); }
    finally { setActionLoading(false); }
  };

  const handlePermanentDelete = async (ids?: string[]) => {
    const targetIds = ids || [...selectedIds];
    if (!targetIds.length) return toast.error('请选择要永久删除的项目');
    if (!window.confirm(`确定要永久删除 ${targetIds.length} 个项目吗？此操作不可撤销！`)) return;
    setActionLoading(true);
    try {
      const res: any = await recycleBinApi.permanentDelete(
        items.filter(i => targetIds.includes(i.id)).map(i => ({ id: i.id, type: i._type }))
      );
      const body = res.data as any;
      toast.success(body?.message || '已永久删除');
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.message || '删除失败'); }
    finally { setActionLoading(false); }
  };

  const totalPages = Math.ceil(total / pageSize);

  const typeTabs = [
    { value: 'all', label: '全部' },
    { value: 'contract', label: '合同' },
    { value: 'inbound', label: '入库单' },
    { value: 'outbound', label: '出库单' },
    { value: 'return', label: '退库单' },
    { value: 'transfer', label: '调拨单' },
  ];

  const typeStyles: Record<string, string> = {
    contract: 'bg-blue-50 text-blue-700 border-blue-200',
    inbound: 'bg-green-50 text-green-700 border-green-200',
    outbound: 'bg-amber-50 text-amber-700 border-amber-200',
    return: 'bg-purple-50 text-purple-700 border-purple-200',
    transfer: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">回收站</h1>
          <p className="page-subtitle">管理已删除的合同、入库单、出库单、退库单、调拨单，可恢复或永久删除</p>
        </div>
      </div>

      {/* 类型筛选 + 搜索 */}
      <div className="card py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {typeTabs.map(tab => (
              <button key={tab.value} onClick={() => { setTypeFilter(tab.value); setPage(1); setSelectedIds(new Set()); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${typeFilter === tab.value ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9 text-sm w-56" placeholder="搜索名称/编号..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <button onClick={handleSearch} className="btn-primary text-sm px-4">搜索</button>
          </div>
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-xl">
          <span className="text-sm text-primary-700 font-medium">已选 {selectedIds.size} 项</span>
          <div className="flex-1" />
          <button onClick={() => handleRestore()} disabled={actionLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RotateCcw size={14} />恢复
          </button>
          <button onClick={() => handlePermanentDelete()} disabled={actionLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 hover:bg-red-100 disabled:opacity-50">
            <Trash2 size={14} />永久删除
          </button>
        </div>
      )}

      {/* 列表 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-th w-10">
                  <input type="checkbox" className="rounded border-gray-300"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll} />
                </th>
                <th className="table-th">类型</th>
                <th className="table-th">名称</th>
                <th className="table-th">编号</th>
                <th className="table-th">供应商/合同方</th>
                <th className="table-th">删除时间</th>
                <th className="table-th">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
              ) : !items.length ? (
                <tr><td colSpan={7} className="table-td text-center py-12">
                  <EmptyState title="回收站为空" description="已删除的项目将显示在这里" />
                </td></tr>
              ) : items.map(item => (
                <tr key={item._type + '-' + item.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-td">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td className="table-td">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${typeStyles[item._type] || ''}`}>
                      {item._typeLabel}
                    </span>
                  </td>
                  <td className="table-td font-medium">{item.name || '—'}</td>
                  <td className="table-td text-xs text-gray-500 font-mono">{item.code || '—'}</td>
                  <td className="table-td text-xs text-gray-500">{item.supplierName || '—'}</td>
                  <td className="table-td text-xs text-gray-400">{item._deletedAt ? formatDate(item._deletedAt, 'YYYY-MM-DD HH:mm') : '—'}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleRestore([item.id])} disabled={actionLoading}
                        className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors rounded hover:bg-primary-50" title="恢复">
                        <RotateCcw size={14} />
                      </button>
                      <button onClick={() => handlePermanentDelete([item.id])} disabled={actionLoading}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50" title="永久删除">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default RecycleBin;
