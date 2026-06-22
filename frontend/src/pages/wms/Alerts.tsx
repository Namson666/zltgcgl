/**
 * 资料通工程管理系统 - 库存预警
 * 全局开关控制 + 批量设置物资预警阈值
 */

import React, { useEffect, useState, useCallback } from 'react';
import { wmsApi } from '../../api';
import { AlertTriangle, RefreshCw, Settings, Search, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmptyState } from '../../components/ui/Common';

interface MaterialAlert {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  alertThreshold: number | null;
}

interface InventoryItem {
  materialId: string;
  material: { name: string; unit: string };
  quantity: number;
}

const Alerts: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialAlert[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showConfig, setShowConfig] = useState(false);

  // 配置弹窗状态
  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({});
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [saving, setSaving] = useState(false);

  const loadToggle = useCallback(async () => {
    try {
      const res = await wmsApi.getAlertToggle();
      const data = (res.data as any)?.data || {};
      setEnabled(!!data.enabled);
    } catch { /* ignore */ }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [matRes, invRes] = await Promise.all([
        wmsApi.getAlerts({ pageSize: 1000 } as any),
        wmsApi.getInventory({ pageSize: 1000 } as any),
      ]);
      setMaterials((matRes.data as any)?.data || []);
      const invData = (invRes.data as any)?.data || {};
      setInventory(invData.items || []);
    } catch { toast.error('加载数据失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadToggle(); }, []);
  useEffect(() => { if (enabled) loadData(); }, [enabled]);

  const handleToggle = async () => {
    const newVal = !enabled;
    try {
      const res = await wmsApi.setAlertToggle(newVal);
      const msg = (res.data as any)?.message || (newVal ? '预警已开启' : '预警已关闭');
      toast.success(msg);
      setEnabled(newVal);
      if (!newVal) { setMaterials([]); setInventory([]); }
    } catch { toast.error('操作失败'); }
  };

  // 待处理预警列表
  const activeAlerts = materials
    .filter(m => m.alertThreshold !== null && m.alertThreshold > 0)
    .map(m => {
      const inv = inventory.find(i => i.materialId === m.id);
      const qty = inv?.quantity || 0;
      return { ...m, currentQuantity: qty, isLow: qty <= m.alertThreshold! };
    })
    .filter(a => a.isLow)
    .sort((a, b) => (a.currentQuantity / (a.alertThreshold || 1)) - (b.currentQuantity / (b.alertThreshold || 1)));

  // 打开配置弹窗
  const openConfig = async () => {
    setShowConfig(true);
    if (!materials.length) {
      try {
        const res = await wmsApi.getAlerts({ pageSize: 1000 } as any);
        setMaterials((res.data as any)?.data || []);
      } catch { /* ignore */ }
    }
    const inputs: Record<string, string> = {};
    const emap: Record<string, boolean> = {};
    materials.forEach(m => {
      inputs[m.id] = m.alertThreshold !== null ? String(m.alertThreshold) : '';
      emap[m.id] = m.alertThreshold !== null && m.alertThreshold > 0;
    });
    setThresholdInputs(inputs);
    setEnabledMap(emap);
    setSearchKeyword('');
  };

  // 切换单个物资的预警开关
  const toggleMaterialAlert = (id: string) => {
    setEnabledMap(prev => {
      const current = !!prev[id];
      // 关闭预警 → 清空阈值
      if (current) {
        setThresholdInputs(t => ({ ...t, [id]: '' }));
        return { ...prev, [id]: false };
      }
      return { ...prev, [id]: true };
    });
  };

  // 修改阈值输入 → 自动开启预警
  const handleThresholdChange = (id: string, value: string) => {
    setThresholdInputs(prev => ({ ...prev, [id]: value }));
    if (value.trim() !== '') {
      setEnabledMap(prev => ({ ...prev, [id]: true }));
    }
  };

  // 批量保存
  const handleBatchSave = async () => {
    setSaving(true);
    const promises = materials.map(m => {
      const enabled = !!enabledMap[m.id];
      if (!enabled) {
        // 关闭状态 → 设为 null
        return wmsApi.setAlertThreshold(m.id, null).then(() => ({ id: m.id, success: true }))
          .catch(() => ({ id: m.id, success: false }));
      }
      const val = thresholdInputs[m.id]?.trim();
      if (val === '') {
        // 开启但未输入 → 设为 null
        return wmsApi.setAlertThreshold(m.id, null).then(() => ({ id: m.id, success: true }))
          .catch(() => ({ id: m.id, success: false }));
      }
      const num = Number(val);
      if (isNaN(num) || num < 0) {
        return Promise.resolve({ id: m.id, success: false });
      }
      return wmsApi.setAlertThreshold(m.id, num).then(() => ({ id: m.id, success: true }))
        .catch(() => ({ id: m.id, success: false }));
    });

    const results = await Promise.all(promises);
    const failed = results.filter(r => !r.success);
    if (failed.length === 0) {
      toast.success('所有预警阈值已保存');
    } else {
      toast.error(`${results.length - failed.length} 个成功，${failed.length} 个失败`);
    }
    // 刷新数据
    const res = await wmsApi.getAlerts({ pageSize: 1000 } as any);
    setMaterials((res.data as any)?.data || []);
    setSaving(false);
  };

  // 搜索过滤
  const filteredMaterials = searchKeyword.trim()
    ? materials.filter(m => m.name.includes(searchKeyword.trim()))
    : materials;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">库存预警</h1>
          <p className="page-subtitle">物资库存不足预警管理与阈值配置</p>
        </div>
        <div className="flex items-center gap-3">
          {enabled && (
            <button className="btn-secondary" onClick={openConfig}>
              <Settings size={15} /> 配置阈值
            </button>
          )}
          <button className="btn-secondary" onClick={loadData} disabled={!enabled}>
            <RefreshCw size={16} /> 刷新
          </button>
        </div>
      </div>

      {/* 预警开关 */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">库存预警功能</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {enabled
                ? '已开启，当物资库存低于预警阈值时将触发预警'
                : '已关闭，开启后可设置各物资的预警阈值'}
            </p>
          </div>
          <button onClick={handleToggle}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-primary-600' : 'bg-gray-300'}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {!enabled ? (
        <div className="card">
          <div className="text-center py-12 text-gray-400">
            <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-500">预警功能已关闭</p>
            <p className="text-sm mt-1">开启后，系统将根据各物资的预警阈值自动检测低库存并发出预警</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-red-50 to-white border border-red-100">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <span className="text-sm text-gray-500">待处理预警</span>
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1">{activeAlerts.length}</div>
            </div>
            <div className="card bg-gradient-to-br from-blue-50 to-white">
              <div className="text-sm text-gray-500">已设阈值物资</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {materials.filter(m => m.alertThreshold !== null).length}
              </div>
            </div>
            <div className="card bg-gradient-to-br from-emerald-50 to-white">
              <div className="text-sm text-gray-500">物资总数</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{materials.length}</div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-red-50 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <h3 className="font-semibold text-red-700">待处理预警（{activeAlerts.length}）</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="table-th">物资名称</th>
                  <th className="table-th">单位</th>
                  <th className="table-th">当前库存</th>
                  <th className="table-th">预警阈值</th>
                  <th className="table-th">缺货量</th>
                </tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className="table-td text-center py-12 text-gray-400">加载中...</td></tr>
                    : !activeAlerts.length ? <tr><td colSpan={5} className="table-td text-center py-12">
                      <EmptyState title="暂无待处理预警" description="所有物资库存正常" />
                    </td></tr>
                    : activeAlerts.map(a => (
                      <tr key={a.id} className="border-b border-gray-50 hover:bg-red-50/50">
                        <td className="table-td font-medium">{a.name}</td>
                        <td className="table-td">{a.unit}</td>
                        <td className={`table-td font-bold ${a.currentQuantity === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                          {a.currentQuantity}
                        </td>
                        <td className="table-td">{a.alertThreshold}</td>
                        <td className="table-td font-bold text-red-600">
                          {Math.max(0, a.alertThreshold! - a.currentQuantity)}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── 阈值批量配置弹窗 ── */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto bg-black/40">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">配置预警阈值</h2>
              <button onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {/* 搜索栏 */}
            <div className="px-6 py-3 border-b border-gray-100">
              <div className="relative max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 text-sm w-full" placeholder="搜索物资名称（如：电缆）..."
                  value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
              </div>
            </div>

            <div className="px-6 py-4 max-h-[55vh] overflow-y-auto">
              {!filteredMaterials.length ? (
                <p className="text-gray-400 text-center py-8">
                  {searchKeyword ? `未找到匹配"${searchKeyword}"的物资` : '暂无物资数据'}
                </p>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="table-th w-10">预警</th>
                    <th className="table-th">物资名称</th>
                    <th className="table-th w-16">单位</th>
                    <th className="table-th w-24">当前阈值</th>
                    <th className="table-th w-32">新阈值</th>
                  </tr></thead>
                  <tbody>
                    {filteredMaterials.map(m => (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="table-td">
                          <button onClick={() => toggleMaterialAlert(m.id)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabledMap[m.id] ? 'bg-primary-500' : 'bg-gray-300'}`}>
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${enabledMap[m.id] ? 'translate-x-4.5' : 'translate-x-1'}`} />
                          </button>
                        </td>
                        <td className="table-td font-medium">{m.name}</td>
                        <td className="table-td text-gray-500">{m.unit}</td>
                        <td className="table-td">
                          {m.alertThreshold !== null
                            ? <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{m.alertThreshold}</span>
                            : <span className="text-gray-400 text-xs">未设置</span>
                          }
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" step="1" className="input w-28 text-sm"
                            placeholder="不预警"
                            disabled={!enabledMap[m.id]}
                            value={thresholdInputs[m.id] ?? ''}
                            onChange={e => handleThresholdChange(m.id, e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 底部按钮：保存在前，关闭在后 */}
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">共 {filteredMaterials.length} 条物资，开启预警 {Object.values(enabledMap).filter(Boolean).length} 项</span>
              <div className="flex items-center gap-3">
                <button onClick={handleBatchSave} disabled={saving}
                  className="btn-primary px-6 flex items-center gap-1.5">
                  <Save size={15} /> {saving ? '保存中...' : '保存全部'}
                </button>
                <button onClick={() => setShowConfig(false)} className="btn-secondary px-6">关闭</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
