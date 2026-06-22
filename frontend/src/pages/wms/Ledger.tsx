/**
 * 资料通工程管理系统 - 班组台账
 * 班组物资领用台账查询、借调记录查看
 */

import React, { useEffect, useState } from 'react';
import { wmsApi } from '../../api';
import { Search, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination, EmptyState, formatDate, formatMoney } from '../../components/ui/Common';

interface LedgerRecord {
  id: number;
  workTeamName?: string;
  materialName?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  totalAmount?: number;
  outboundDate?: string;
  projectName?: string;
  type?: 'outbound' | 'borrow';
}

const Ledger: React.FC = () => {
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await wmsApi.getWorkTeamLedger({ page, pageSize, keyword });
      const body = (res.data as any);
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      setRecords(items);
      setTotal(body?.meta?.total || (listData?.total) || items.length);
    } catch { toast.error('加载台账数据失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [page, keyword]);

  const totalPages = Math.ceil(total / pageSize);
  const totalQty = records.reduce((s, r) => s + Number(r.quantity || 0), 0);
  const totalAmt = records.reduce((s, r) => s + Number(r.totalAmount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">班组台账</h1>
          <p className="page-subtitle">班组物资领用记录与统计汇总</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-white">
          <div className="text-sm text-gray-500">总领用次数</div>
          <div className="text-2xl font-bold text-primary-600">{total}</div>
        </div>
        <div className="card bg-gradient-to-br from-emerald-50 to-white">
          <div className="text-sm text-gray-500">总领用数量</div>
          <div className="text-2xl font-bold text-emerald-600">{totalQty}</div>
        </div>
        <div className="card bg-gradient-to-br from-amber-50 to-white">
          <div className="text-sm text-gray-500">总金额</div>
          <div className="text-2xl font-bold text-amber-600">{formatMoney(totalAmt)}</div>
        </div>
      </div>

      <div className="card py-3">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm w-full" placeholder="搜索班组/物资名称..."
            value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="table-th">班组名称</th>
              <th className="table-th">项目名称</th>
              <th className="table-th">物资名称</th>
              <th className="table-th">单位</th>
              <th className="table-th">数量</th>
              <th className="table-th">单价</th>
              <th className="table-th">金额</th>
              <th className="table-th">领用日期</th>
              <th className="table-th">类型</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                : !records.length ? <tr><td colSpan={9} className="table-td text-center py-12"><EmptyState title="暂无台账记录" /></td></tr>
                : records.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-td font-medium"><span className="badge-blue">{r.workTeamName || '—'}</span></td>
                    <td className="table-td">{r.projectName || '—'}</td>
                    <td className="table-td font-medium">{r.materialName || '—'}</td>
                    <td className="table-td">{r.unit || '—'}</td>
                    <td className="table-td font-semibold">{r.quantity || 0}</td>
                    <td className="table-td">{r.unitPrice ? formatMoney(r.unitPrice) : '—'}</td>
                    <td className="table-td font-semibold text-primary-600">{r.totalAmount ? formatMoney(r.totalAmount) : '—'}</td>
                    <td className="table-td text-xs text-gray-400">{r.outboundDate ? formatDate(r.outboundDate) : '—'}</td>
                    <td className="table-td">
                      <span className={r.type === 'borrow' ? 'badge-yellow' : 'badge-green'}>
                        {r.type === 'borrow' ? '借调' : '领用'}
                      </span>
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
    </div>
  );
};

export default Ledger;
