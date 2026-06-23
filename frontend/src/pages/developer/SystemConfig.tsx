/**
 * 资料通工程管理系统 - 系统配置管理页面
 *
 * 以键值对形式管理开发者后台的系统配置。
 */

import React, { useState, useEffect } from 'react';
import {
  Settings, Plus, Save, Trash2, Shield, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';
import { ConfirmDialog } from '../../components/ui/Common';

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const SystemConfig: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [editingDescs, setEditingDescs] = useState<Record<string, string>>({});
  const [showNewRow, setShowNewRow] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await developerApi.getSystemConfigs();
      const body = res.data || res;
      const data = body.data || body;
      const list = Array.isArray(data) ? data : [];
      setConfigs(list);
      const values: Record<string, string> = {};
      const descs: Record<string, string> = {};
      list.forEach((c: ConfigItem) => {
        values[c.key] = c.value || '';
        descs[c.key] = c.description || '';
      });
      setEditingValues(values);
      setEditingDescs(descs);
    } catch (error) {
      console.error('加载系统配置失败:', error);
      toast.error('加载系统配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await developerApi.saveSystemConfig({
        key,
        value: editingValues[key] || '',
        description: editingDescs[key] || '',
      });
      toast.success('配置已保存');
      await fetchConfigs();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim()) {
      toast.error('配置键不能为空');
      return;
    }
    setSaving('__new__');
    try {
      await developerApi.saveSystemConfig({
        key: newKey.trim(),
        value: newValue,
        description: newDesc,
      });
      toast.success('配置已添加');
      setShowNewRow(false);
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      await fetchConfigs();
    } catch (error: any) {
      toast.error(error.message || '添加失败');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteKey) return;
    try {
      await developerApi.deleteSystemConfig(deleteKey);
      toast.success('配置已删除');
      setDeleteKey(null);
      await fetchConfigs();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    }
  };

  const predefinedKeys = [
    { key: 'trial_days', label: '试用天数', default: '30', desc: '新注册企业的默认试用天数' },
    { key: 'api_price_per_1000', label: 'API单价(元/千次)', default: '0.01', desc: '每千次API调用的计费单价' },
    { key: 'storage_price_per_gb', label: '存储单价(元/GB/月)', default: '0.5', desc: '每GB存储空间的月费' },
    { key: 'smtp_host', label: 'SMTP主机', default: '', desc: '邮件发送服务器地址' },
    { key: 'smtp_port', label: 'SMTP端口', default: '587', desc: '邮件发送服务器端口' },
    { key: 'smtp_user', label: 'SMTP用户名', default: '', desc: '邮件发送账号' },
    { key: 'smtp_pass', label: 'SMTP密码', default: '', desc: '邮件发送密码' },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A2B3C' }}>系统配置</h1>
          <p className="text-sm mt-1" style={{ color: '#8899AA' }}>管理系统运行参数和全局设置</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchConfigs} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#8899AA' }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowNewRow(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> 新增配置
          </button>
        </div>
      </div>

      {/* 预定义配置提示 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-700">
        <p className="font-medium mb-1">💡 常用配置项</p>
        <p className="text-blue-600">
          你可以使用以下预设键名快速配置系统（点击填充）：
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {predefinedKeys.map((pk) => (
            <button
              key={pk.key}
              onClick={() => {
                setNewKey(pk.key);
                setNewDesc(pk.desc);
                setShowNewRow(true);
              }}
              className="px-2.5 py-1 bg-white rounded-lg border border-blue-200 text-xs text-blue-700 hover:bg-blue-50 transition-colors"
            >
              {pk.label} ({pk.key})
            </button>
          ))}
        </div>
      </div>

      {/* 新增配置行 */}
      {showNewRow && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A2B3C' }}>新增配置项</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">键 (Key) *</label>
              <input
                type="text"
                data-testid="system-config-new-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="input w-full text-sm"
                placeholder="配置键名称"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">值 (Value)</label>
              <input
                type="text"
                data-testid="system-config-new-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="input w-full text-sm"
                placeholder="配置值"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">描述</label>
              <input
                type="text"
                data-testid="system-config-new-description"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="input w-full text-sm"
                placeholder="配置说明"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAdd} disabled={saving === '__new__'} className="btn-primary text-sm px-4 py-1.5">
              {saving === '__new__' ? '保存中...' : '添加'}
            </button>
            <button onClick={() => setShowNewRow(false)} className="px-4 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 配置列表 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>
            <Settings size={16} className="inline mr-1.5 text-gray-500" />
            所有配置项 ({configs.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : configs.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {configs.map((config) => (
              <div key={config.id} data-testid={`system-config-row-${config.key}`} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                      {config.key}
                    </code>
                    {config.description && (
                      <span className="text-xs text-gray-400 truncate">{config.description}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    data-testid={`system-config-value-${config.key}`}
                    value={editingValues[config.key] || ''}
                    onChange={(e) => setEditingValues((prev) => ({ ...prev, [config.key]: e.target.value }))}
                    className="input w-full text-sm py-1.5"
                  />
                </div>
                <div className="flex items-center gap-1 pt-5 flex-shrink-0">
                  <button
                    onClick={() => handleSave(config.key)}
                    disabled={saving === config.key}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="保存"
                  >
                    {saving === config.key ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteKey(config.key)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Settings size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">暂无系统配置</p>
            <p className="text-xs text-gray-300 mt-1">点击「新增配置」添加配置项</p>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={!!deleteKey}
        title="删除配置"
        message={`确定要删除配置项 "${deleteKey}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDelete}
        onClose={() => setDeleteKey(null)}
      />
    </div>
  );
};

export default SystemConfig;
