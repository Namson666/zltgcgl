/**
 * 资料通工程管理系统 - AI 模型配置页面
 *
 * 支持多条 AI 配置管理：
 * - 左侧配置列表，点击切换
 * - 右侧表单编辑配置参数
 * - 保存、测试连通性、删除配置
 *
 * API 调用：
 * - developerApi.getAiConfig()    - 获取配置列表
 * - developerApi.updateAiConfig() - 创建/更新配置
 * - developerApi.testAiConfig()   - 测试连通性
 * - developerApi.deleteAiConfig() - 删除配置
 */

import React from 'react';
import {
  Cpu, Save, Zap, CheckCircle, XCircle, Loader2,
  Eye, EyeOff, Plus, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';
import { useConfigList } from '../../hooks/useConfigList';

/* ========================================
 * 类型定义
 * ======================================== */

interface AiConfigData {
  id: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isEnabled?: boolean;
  createdAt?: string;
}

/* ========================================
 * AiConfig 组件
 * ======================================== */

const AiConfig: React.FC = () => {
  const list = useConfigList<AiConfigData>({
    fetchApi: () => developerApi.getAiConfig(),
    saveApi: (data) => developerApi.updateAiConfig(data),
    deleteApi: (id) => developerApi.deleteAiConfig(id),
    testApi: (data) => developerApi.testAiConfig(data),
    toggleApi: (id, enabled) => developerApi.toggleAiConfig(id, enabled),
    defaultForm: { provider: 'minimax', model: '', apiKey: '', baseUrl: '' },
    getDisplayName: (c) => `${c.provider} - ${c.model || '未命名'}`,
    saveLabel: 'AI 配置',
    sensitiveFields: ['apiKey'], // 加载已有配置时清空 apiKey，防止脱敏值被保存
  });

  const [showApiKey, setShowApiKey] = React.useState(false);

  /* ---------- 加载中骨架屏 ---------- */
  if (list.loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">AI 模型配置</h1>
            <p className="page-subtitle">管理 AI 服务提供商和模型参数</p>
          </div>
        </div>
        <div className="card animate-pulse">
          <div className="card-body space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-10 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">AI 模型配置</h1>
          <p className="page-subtitle">管理 AI 服务提供商和模型参数</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
          <Cpu size={16} />
          AI 服务
        </div>
      </div>

      {/* ==========================================
       * 主体：左侧列表 + 右侧表单
       * ========================================== */}
      <div className="flex gap-6 items-stretch">
        {/* ---------- 左侧配置列表 ---------- */}
        <div className="w-72 shrink-0">
          <div className="card h-full">
            <div className="card-header flex items-center justify-between">
              <h2 className="card-title text-sm">配置列表</h2>
              <span className="text-xs text-gray-400">{list.configs.length} 项</span>
            </div>
            <div className="card-body p-0">
              {list.configs.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  暂无配置，点击下方新增
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                  {list.configs.map((item) => (
                    <button
                      key={item.id}
                      data-testid={`ai-config-row-${item.id}`}
                      onClick={() => list.selectConfig(item.id)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 ${
                        list.selectedId === item.id
                          ? 'bg-blue-50 border-l-2 border-blue-500'
                          : 'hover:bg-gray-50 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {item.provider}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {item.model || '未命名'}
                        </p>
                      </div>
                      {/* 列表内启用/停用开关 */}
                      <button
                        data-testid={`ai-config-row-toggle-${item.id}`}
                        onClick={(e) => { e.stopPropagation(); list.toggleConfig(item.id, !item.isEnabled); }}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                          item.isEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                          item.isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </button>
                  ))}
                </div>
              )}

              {/* 新增配置按钮 */}
              <div className="p-3 border-t border-gray-100">
                <button
                  data-testid="ai-config-new"
                  onClick={list.newConfig}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-dashed text-sm font-medium transition-colors ${
                    list.isNew
                      ? 'border-blue-300 bg-blue-50 text-blue-600'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                  }`}
                >
                  <Plus size= {14} />
                  新增配置
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- 右侧表单 ---------- */}
        <div className="flex-1">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="card-title flex items-center gap-2 text-sm">
                <Cpu size={18} className="text-blue-600" />
                {list.isNew ? '新增配置' : '编辑配置'}
              </h2>
              {!list.isNew && (
                <button
                  data-testid="ai-config-enabled-toggle"
                  onClick={() => list.handleToggle(!list.form.isEnabled)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    list.form.isEnabled
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${list.form.isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {list.form.isEnabled ? '已启用' : '未启用'}
                </button>
              )}
            </div>
            <div className="card-body">
              <div className="space-y-5">
                {/* 提供商选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    AI 提供商 <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-testid="ai-provider"
                    value={list.form.provider}
                    onChange={(e) => list.updateField('provider' as any, e.target.value)}
                    className="input"
                  >
                    <option value="minimax">MiniMax</option>
                    <option value="openai">OpenAI</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-400">
                    选择 AI 服务提供商
                  </p>
                </div>

                {/* 模型名称 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    模型名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="ai-model"
                    value={list.form.model || ''}
                    onChange={(e) => list.updateField('model' as any, e.target.value)}
                    className="input"
                    placeholder="例如：abab6.5s-chat / gpt-4o"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    输入要使用的 AI 模型名称
                  </p>
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    API Key <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      data-testid="ai-api-key"
                      value={list.form.apiKey || ''}
                      onChange={(e) => list.updateField('apiKey' as any, e.target.value)}
                      className="input pr-10"
                      placeholder="请输入 API Key"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    AI 服务认证密钥
                  </p>
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Base URL
                  </label>
                    <input
                      type="text"
                      data-testid="ai-base-url"
                      value={list.form.baseUrl || ''}
                    onChange={(e) => list.updateField('baseUrl' as any, e.target.value)}
                    className="input"
                    placeholder="例如：https://api.minimax.chat/v1"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    API 请求基础地址，留空使用提供商默认地址
                  </p>
                </div>
              </div>

              {/* ==========================================
               * 操作按钮
               * ========================================== */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* 保存按钮 */}
                  <button
                    data-testid="ai-save"
                    onClick={list.handleSave}
                    disabled={list.saving}
                    className="btn-primary flex items-center gap-2"
                  >
                    {list.saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {list.saving ? '保存中...' : '保存配置'}
                  </button>

                  {/* 测试连通性按钮 */}
                  <button
                    data-testid="ai-test"
                    onClick={list.handleTest}
                    disabled={list.testStatus === 'testing'}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {list.testStatus === 'testing' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Zap size={16} />
                    )}
                    {list.testStatus === 'testing' ? '测试中...' : '测试连通性'}
                  </button>

                  {/* 删除按钮 */}
                  {!list.isNew && (
                    <button
                      data-testid="ai-delete"
                      onClick={list.handleDelete}
                      className="btn-danger flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      删除配置
                    </button>
                  )}

                  {/* 连通状态显示 */}
                  {list.testStatus === 'success' && (
                    <div className="flex items-center gap-1.5 text-green-600 text-sm">
                      <CheckCircle size={16} />
                      <span>{list.testMessage || '连通正常'}</span>
                    </div>
                  )}
                  {list.testStatus === 'failed' && (
                    <div className="flex items-center gap-1.5 text-red-600 text-sm">
                      <XCircle size={16} />
                      <span>{list.testMessage || '连接失败'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiConfig;
