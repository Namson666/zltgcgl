/**
 * 资料通工程管理系统 - 风控管理
 * 异常检测、合规检查、风险预警
 */

import React, { useEffect, useState } from 'react';
import { laborApi } from '../../api';
import { AlertTriangle, CheckCircle, Search, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { EmptyState, formatDate, formatMoney } from '../../components/ui/Common';

interface AnomalyRecord {
  id: number;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  personnelName?: string;
  isResolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

interface ComplianceItem {
  id: number;
  personnelName: string;
  type: string;
  status: 'pass' | 'fail' | 'pending';
  checkItem: string;
  checkedAt?: string;
}

const severityConfig: Record<string, { label: string; class: string }> = {
  high: { label: '高风险', class: 'badge-red' },
  medium: { label: '中风险', class: 'badge-yellow' },
  low: { label: '低风险', class: 'badge-blue' },
};

const normalizeSeverity = (level?: string): 'low' | 'medium' | 'high' => {
  if (level === 'RED' || level === 'high') return 'high';
  if (level === 'YELLOW' || level === 'medium') return 'medium';
  return 'low';
};

const Risk: React.FC = () => {
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [compliance, setCompliance] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'anomaly' | 'compliance'>('anomaly');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<number>(0);
  const [resolveRemark, setResolveRemark] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'anomaly') {
        const res = await laborApi.getAnomalies({ pageSize: 100 });
        const data = (res.data as any).data;
        setAnomalies((data.anomalies || []).map((item: any) => ({
          ...item,
          type: item.type || (item.level === 'RED' ? '红色异常' : '黄色预警'),
          severity: normalizeSeverity(item.level || item.severity),
          personnelName: item.personnelName || item.personnel?.name,
        })));
      } else {
        const res = await laborApi.getCompliance({ pageSize: 100 });
        const data = (res.data as any).data;
        const items = Array.isArray(data) ? data : (data.items || data.compliance || []);
        setCompliance(items.map((item: any) => {
          const failedItems = [
            item.isUnderAge ? '未成年用工' : '',
            item.isOverAge ? '超龄用工' : '',
            item.isDuplicateId ? '身份证重复' : '',
          ].filter(Boolean);
          return {
            ...item,
            personnelName: item.personnelName || item.name,
            type: item.type === 'STAFF' ? '项目部人员' : item.type === 'WORKER' ? '务工人员' : (item.type || '人员'),
            status: failedItems.length ? 'fail' : (item.status || 'pass'),
            checkItem: item.checkItem || failedItems.join('、') || '实名制合规',
            checkedAt: item.checkedAt || item.updatedAt || item.createdAt,
          };
        }));
      }
    } catch { toast.error('加载数据失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [tab]);

  const handleResolve = async () => {
    try {
      await laborApi.resolveAnomaly(resolveTarget, { remark: resolveRemark, resolveReason: resolveRemark });
      toast.success('异常已处理');
      setShowResolveModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '操作失败');
    }
  };

  const unresolvedCount = anomalies.filter(a => !a.isResolved).length;
  const highCount = anomalies.filter(a => a.severity === 'high' && !a.isResolved).length;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">风控管理</h1>
          <p className="page-subtitle">劳务风险监控与异常处理</p>
        </div>
        <button className="btn-secondary" onClick={fetchData}>
          <RefreshCw size={16} /> 刷新
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`card ${highCount > 0 ? 'bg-gradient-to-br from-red-50 to-white border border-red-100' : 'bg-gradient-to-br from-blue-50 to-white'}`}>
          <div className="text-sm text-gray-500">待处理异常</div>
          <div className="text-2xl font-bold text-red-600">{unresolvedCount}</div>
          {highCount > 0 && <div className="text-xs text-red-500 mt-1">{highCount} 条高风险</div>}
        </div>
        <div className="card bg-gradient-to-br from-emerald-50 to-white">
          <div className="text-sm text-gray-500">已处理</div>
          <div className="text-2xl font-bold text-emerald-600">{anomalies.filter(a => a.isResolved).length}</div>
        </div>
        <div className="card bg-gradient-to-br from-amber-50 to-white">
          <div className="text-sm text-gray-500">异常总数</div>
          <div className="text-2xl font-bold text-amber-600">{anomalies.length}</div>
        </div>
      </div>

      {/* 标签切换 */}
      <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('anomaly')}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${tab === 'anomaly' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
          <AlertTriangle size={15} className="inline mr-1" />异常管理
        </button>
        <button onClick={() => setTab('compliance')}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${tab === 'compliance' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
          <ShieldCheck size={15} className="inline mr-1" />合规检查
        </button>
      </div>

      {tab === 'anomaly' ? (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-th">类型</th>
                <th className="table-th">人员</th>
                <th className="table-th">严重程度</th>
                <th className="table-th">描述</th>
                <th className="table-th">发现时间</th>
                <th className="table-th">状态</th>
                <th className="table-th">操作</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                  : !anomalies.length ? <tr><td colSpan={7} className="table-td text-center py-12"><EmptyState title="暂无异常" description="系统运转正常" icon={<ShieldCheck size={48} className="text-green-300" />} /></td></tr>
                  : anomalies.map(a => {
                    const cfg = severityConfig[a.severity] || severityConfig.low;
                    return (
                      <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!a.isResolved && a.severity === 'high' ? 'bg-red-50/30' : ''}`}>
                        <td className="table-td font-medium">{a.type}</td>
                        <td className="table-td">{a.personnelName || '—'}</td>
                        <td className="table-td"><span className={cfg.class}>{cfg.label}</span></td>
                        <td className="table-td text-xs max-w-[250px] truncate">{a.description}</td>
                        <td className="table-td text-xs text-gray-400">{a.createdAt ? formatDate(a.createdAt) : '—'}</td>
                        <td className="table-td">
                          {a.isResolved
                            ? <span className="badge-green">已处理</span>
                            : <span className="badge-red">待处理</span>}
                        </td>
                        <td className="table-td">
                          {!a.isResolved && (
                            <button className="btn-primary btn-sm"
                              onClick={() => { setResolveTarget(a.id); setResolveRemark(''); setShowResolveModal(true); }}>
                              <CheckCircle size={13} /> 处理
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-th">人员</th>
                <th className="table-th">类型</th>
                <th className="table-th">检查项</th>
                <th className="table-th">状态</th>
                <th className="table-th">检查时间</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                  : !compliance.length ? <tr><td colSpan={5} className="table-td text-center py-12"><EmptyState title="暂无合规数据" /></td></tr>
                  : compliance.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-td font-medium">{c.personnelName}</td>
                      <td className="table-td">{c.type}</td>
                      <td className="table-td">{c.checkItem}</td>
                      <td className="table-td">
                        {c.status === 'pass' ? <span className="badge-green"><CheckCircle size={11} className="inline" />通过</span>
                          : c.status === 'fail' ? <span className="badge-red"><XCircle size={11} className="inline" />未通过</span>
                          : <span className="badge-yellow">待检查</span>}
                      </td>
                      <td className="table-td text-xs text-gray-400">{c.checkedAt ? formatDate(c.checkedAt) : '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)} title="处理异常" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">处理备注（选填）</label>
            <input className="input" placeholder="备注说明" value={resolveRemark}
              onChange={e => setResolveRemark(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setShowResolveModal(false)}>取消</button>
            <button className="btn-primary" onClick={handleResolve}>
              <CheckCircle size={14} /> 确认处理
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Risk;
