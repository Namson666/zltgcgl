/**
 * 资料通工程管理系统 - 第三方集成配置页面
 *
 * 功能说明：
 * 开发者后台的第三方消息平台集成配置页面，支持配置钉钉、企业微信、
 * 飞书三个平台的 Webhook 和认证信息，并提供连通性测试功能。
 *
 * 页面结构：
 * 1. 页面标题区域
 * 2. 平台配置卡片网格（钉钉、企业微信、飞书）
 *    每张卡片包含：平台图标 + 名称、启用状态、配置表单、操作按钮
 * 3. 每个卡片支持保存配置和测试连通性
 *
 * API 调用：
 * - developerApi.getIntegrations() - 获取所有集成配置
 * - developerApi.saveIntegration({platform, config}) - 保存平台配置
 * - developerApi.testIntegration(platform) - 测试连通性
 */

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  MessageCircle,
  Globe,
  Save,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';

/* ========================================
 * 类型定义
 * ======================================== */

/** 平台配置数据接口 */
interface IntegrationConfig {
  botWebhookUrl: string;            /* 机器人 Webhook URL */
  appId: string;                    /* 应用 ID */
  appSecret: string;                /* 应用密钥 */
}

/** 平台信息接口 */
interface PlatformInfo {
  key: string;                      /* 平台标识 */
  label: string;                    /* 显示名称 */
  icon: React.ReactNode;            /* 图标组件 */
  accentColor: string;              /* 主题色 */
  lightBg: string;                  /* 浅色背景 */
}

/** 平台配置状态接口 */
interface PlatformState {
  config: IntegrationConfig;        /* 配置数据 */
  enabled: boolean;                 /* 是否已启用 */
  saving: boolean;                  /* 保存中状态 */
  testStatus: 'idle' | 'testing' | 'success' | 'failed';  /* 测试状态 */
  testMessage: string;              /* 测试结果消息 */
}

/* ========================================
 * 常量定义
 * ======================================== */

/** 平台列表 */
const PLATFORMS: PlatformInfo[] = [
  {
    key: 'dingtalk',
    label: '钉钉',
    icon: <MessageSquare size={24} />,
    accentColor: '#0089FF',
    lightBg: '#E8F4FF',
  },
  {
    key: 'wechat_work',
    label: '企业微信',
    icon: <MessageCircle size={24} />,
    accentColor: '#07C160',
    lightBg: '#E8F8EE',
  },
  {
    key: 'feishu',
    label: '飞书',
    icon: <Globe size={24} />,
    accentColor: '#3370FF',
    lightBg: '#EBF0FF',
  },
];

/** 默认空配置 */
const DEFAULT_CONFIG: IntegrationConfig = {
  botWebhookUrl: '',
  appId: '',
  appSecret: '',
};

/* ========================================
 * Integrations 第三方集成配置组件
 * ======================================== */
const Integrations: React.FC = () => {
  /* ---------- 状态管理 ---------- */

  /** 各平台配置状态，以 platform key 为索引 */
  const [platformStates, setPlatformStates] = useState<
    Record<string, PlatformState>
  >({});

	  const [loading, setLoading] = useState(true);                  /* 初始加载状态 */
	  const [defaultMiniProgram, setDefaultMiniProgram] = useState({
	    name: '开发者默认打卡小程序',
	    appId: '',
	    appSecret: '',
	    isEnabled: true,
	    remark: '',
	  });
	  const [savingDefaultMiniProgram, setSavingDefaultMiniProgram] = useState(false);
	  const [phoneBindingForm, setPhoneBindingForm] = useState({
	    phone: '',
	    tenantId: '',
	    personnelId: '',
	    remark: '',
	  });
	  const [phoneBindings, setPhoneBindings] = useState<any[]>([]);
	  const [savingPhoneBinding, setSavingPhoneBinding] = useState(false);

  /* ---------- 数据加载 ---------- */

  /**
   * 加载所有平台集成配置
   * 调用 developerApi.getIntegrations() 获取已有配置
   */
  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        setLoading(true);
	        const [res, miniProgramRes, bindingRes] = await Promise.all([
	          developerApi.getIntegrations(),
	          developerApi.getDefaultMiniProgram(),
	          developerApi.getDefaultMiniProgramBindings(),
	        ]);
	        const body = res.data || res;
	        const rows = body.data || body;
	        const integrationsByPlatform: Record<string, any> = Array.isArray(rows)
	          ? rows.reduce((acc: Record<string, any>, item: any) => {
	              acc[item.platform] = { ...(item.config || {}), enabled: item.isEnabled };
	              return acc;
	            }, {})
	          : rows || {};
	        const miniProgramBody = miniProgramRes.data || miniProgramRes;
	        const miniProgramData = miniProgramBody.data || {};
	        if (miniProgramData) {
	          setDefaultMiniProgram({
	            name: miniProgramData.name || '开发者默认打卡小程序',
	            appId: miniProgramData.appId || '',
	            appSecret: miniProgramData.appSecret || '',
	            isEnabled: miniProgramData.isEnabled !== false,
	            remark: miniProgramData.remark || '',
	          });
	        }
	        const bindingBody = bindingRes.data || bindingRes;
	        setPhoneBindings(Array.isArray(bindingBody.data) ? bindingBody.data : []);

        /* 初始化各平台状态 */
        const initialStates: Record<string, PlatformState> = {};
        PLATFORMS.forEach((platform) => {
          const platformData = integrationsByPlatform?.[platform.key];
          initialStates[platform.key] = {
            config: {
              botWebhookUrl: platformData?.botWebhookUrl || '',
              appId: platformData?.appId || '',
              appSecret: platformData?.appSecret || '',
            },
            enabled: !!platformData?.enabled,
            saving: false,
            testStatus: 'idle',
            testMessage: '',
          };
        });
        setPlatformStates(initialStates);
      } catch (error) {
        console.error('加载集成配置失败:', error);
        /* 配置可能尚未设置，使用默认值初始化 */
        const fallbackStates: Record<string, PlatformState> = {};
        PLATFORMS.forEach((platform) => {
          fallbackStates[platform.key] = {
            config: { ...DEFAULT_CONFIG },
            enabled: false,
            saving: false,
            testStatus: 'idle',
            testMessage: '',
          };
        });
        setPlatformStates(fallbackStates);
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, []);

  /* ---------- 状态更新辅助 ---------- */

  /**
   * 更新指定平台的配置字段
   * @param platformKey - 平台标识
   * @param field - 配置字段名
   * @param value - 新值
   */
  const updateConfigField = (
    platformKey: string,
    field: keyof IntegrationConfig,
    value: string
  ) => {
    setPlatformStates((prev) => ({
      ...prev,
      [platformKey]: {
        ...prev[platformKey],
        config: { ...prev[platformKey].config, [field]: value },
        testStatus: 'idle' as const,
        testMessage: '',
      },
    }));
  };

  /* ---------- 保存配置 ---------- */

  /**
   * 保存指定平台的配置
   * 调用 developerApi.saveIntegration() 提交配置
   * @param platformKey - 平台标识
   */
  const handleSave = async (platformKey: string) => {
    const state = platformStates[platformKey];
    if (!state) return;

    try {
      setPlatformStates((prev) => ({
        ...prev,
        [platformKey]: { ...prev[platformKey], saving: true },
      }));

      await developerApi.saveIntegration({
        platform: platformKey,
        config: state.config,
      });

      toast.success(`${PLATFORMS.find((p) => p.key === platformKey)?.label} 配置保存成功`);
      setPlatformStates((prev) => ({
        ...prev,
        [platformKey]: { ...prev[platformKey], enabled: false },
      }));
    } catch (error: any) {
      toast.error(error.message || '保存配置失败');
    } finally {
      setPlatformStates((prev) => ({
        ...prev,
        [platformKey]: { ...prev[platformKey], saving: false },
      }));
    }
  };

  /* ---------- 测试连通性 ---------- */

  /**
   * 测试指定平台的连通性
   * 调用 developerApi.testIntegration() 验证配置是否可用
   * @param platformKey - 平台标识
   */
	  const handleTest = async (platformKey: string) => {
    const state = platformStates[platformKey];
    if (!state) return;

    if (!state.config.botWebhookUrl.trim()) {
      toast.error('请先填写 Webhook URL');
      return;
    }

    try {
      setPlatformStates((prev) => ({
        ...prev,
        [platformKey]: {
          ...prev[platformKey],
          testStatus: 'testing' as const,
          testMessage: '',
        },
      }));

      const res = await developerApi.testIntegration(platformKey);
      const data = res.data || res;
      setPlatformStates((prev) => ({
        ...prev,
        [platformKey]: {
          ...prev[platformKey],
          enabled: true,
          testStatus: 'success' as const,
          testMessage: data.message || '连通性测试通过',
        },
      }));
      toast.success(`${PLATFORMS.find((p) => p.key === platformKey)?.label} 连通性测试通过`);
    } catch (error: any) {
      setPlatformStates((prev) => ({
        ...prev,
        [platformKey]: {
          ...prev[platformKey],
          testStatus: 'failed' as const,
          testMessage: error.message || '连通性测试失败',
        },
      }));
      toast.error(`${PLATFORMS.find((p) => p.key === platformKey)?.label} 连通性测试失败`);
    }
	  };

	  const updateDefaultMiniProgram = (field: string, value: string | boolean) => {
	    setDefaultMiniProgram((prev) => ({ ...prev, [field]: value }));
	  };

	  const handleSaveDefaultMiniProgram = async () => {
	    if (!defaultMiniProgram.name.trim() || !defaultMiniProgram.appId.trim()) {
	      toast.error('默认小程序名称和 App ID 不能为空');
	      return;
	    }
	    setSavingDefaultMiniProgram(true);
	    try {
	      const res = await developerApi.updateDefaultMiniProgram(defaultMiniProgram);
	      const body = res.data || res;
	      const updated = body.data || body;
	      setDefaultMiniProgram({
	        name: updated.name || '',
	        appId: updated.appId || '',
	        appSecret: updated.appSecret || '',
	        isEnabled: updated.isEnabled !== false,
	        remark: updated.remark || '',
	      });
	      toast.success('开发者默认小程序配置已保存');
	    } catch (error: any) {
	      toast.error(error.message || '保存默认小程序失败');
	    } finally {
	      setSavingDefaultMiniProgram(false);
	    }
	  };

	  const updatePhoneBindingForm = (field: string, value: string) => {
	    setPhoneBindingForm((prev) => ({ ...prev, [field]: value }));
	  };

	  const loadPhoneBindings = async () => {
	    const res = await developerApi.getDefaultMiniProgramBindings();
	    const body = res.data || res;
	    setPhoneBindings(Array.isArray(body.data) ? body.data : []);
	  };

	  const handleSavePhoneBinding = async () => {
	    if (!phoneBindingForm.phone.trim() || !phoneBindingForm.tenantId.trim()) {
	      toast.error('手机号和企业 ID 不能为空');
	      return;
	    }
	    setSavingPhoneBinding(true);
	    try {
	      await developerApi.saveDefaultMiniProgramBinding({
	        phone: phoneBindingForm.phone.trim(),
	        tenantId: phoneBindingForm.tenantId.trim(),
	        personnelId: phoneBindingForm.personnelId.trim() || undefined,
	        remark: phoneBindingForm.remark.trim() || undefined,
	        isEnabled: true,
	      });
	      toast.success('默认小程序手机号预绑定已保存');
	      setPhoneBindingForm({ phone: '', tenantId: '', personnelId: '', remark: '' });
	      await loadPhoneBindings();
	    } catch (error: any) {
	      toast.error(error.message || '保存手机号预绑定失败');
	    } finally {
	      setSavingPhoneBinding(false);
	    }
	  };

	  const handleDeletePhoneBinding = async (id: string) => {
	    if (!window.confirm('确定删除这个手机号预绑定吗？')) return;
	    try {
	      await developerApi.deleteDefaultMiniProgramBinding(id);
	      toast.success('手机号预绑定已删除');
	      await loadPhoneBindings();
	    } catch (error: any) {
	      toast.error(error.message || '删除手机号预绑定失败');
	    }
	  };

	  const handleTogglePhoneBinding = async (binding: any) => {
	    try {
	      const nextEnabled = !binding.isEnabled;
	      await developerApi.updateDefaultMiniProgramBinding(binding.id, { isEnabled: nextEnabled });
	      toast.success(`手机号预绑定已${nextEnabled ? '启用' : '停用'}`);
	      await loadPhoneBindings();
	    } catch (error: any) {
	      toast.error(error.message || '更新手机号预绑定状态失败');
	    }
	  };

  /* ---------- 加载中骨架屏 ---------- */
  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">第三方集成</h1>
            <p className="page-subtitle">配置钉钉、企业微信、飞书等消息平台集成</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-pulse">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gray-200" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-20 mb-1" />
                  <div className="h-4 bg-gray-100 rounded w-14" />
                </div>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j}>
                    <div className="h-3 bg-gray-100 rounded w-24 mb-1" />
                    <div className="h-9 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
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
          <h1 className="page-title">第三方集成</h1>
          <p className="page-subtitle">配置钉钉、企业微信、飞书等消息平台集成</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
          <Globe size={16} />
          集成中心
        </div>
	      </div>

	      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden" data-testid="default-mini-program-config">
	        <div className="px-6 py-5 flex items-center justify-between border-b border-green-50 bg-gradient-to-r from-green-50 to-white">
	          <div className="flex items-center gap-3">
	            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
	              <MessageCircle size={24} />
	            </div>
	            <div>
	              <h3 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>开发者默认打卡小程序</h3>
	              <p className="text-xs text-gray-400 mt-1">企业未接入自有小程序时，默认用此 appId 接收打卡，再按手机号匹配企业/人员。</p>
	            </div>
	          </div>
	          <label className="flex items-center gap-2 text-sm text-gray-600">
	            <input type="checkbox" checked={defaultMiniProgram.isEnabled}
	              onChange={(e) => updateDefaultMiniProgram('isEnabled', e.target.checked)} />
	            启用
	          </label>
	        </div>
	        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
	          <div>
	            <label className="block text-xs font-medium text-gray-500 mb-1">小程序名称</label>
	            <input className="input w-full text-sm" value={defaultMiniProgram.name}
	              onChange={(e) => updateDefaultMiniProgram('name', e.target.value)} />
	          </div>
	          <div>
	            <label className="block text-xs font-medium text-gray-500 mb-1">App ID</label>
		            <input data-testid="default-mini-program-app-id" className="input w-full text-sm" value={defaultMiniProgram.appId}
	              onChange={(e) => updateDefaultMiniProgram('appId', e.target.value)} placeholder="wx_default_appid" />
	          </div>
	          <div>
	            <label className="block text-xs font-medium text-gray-500 mb-1">App Secret（可选）</label>
	            <input type="password" className="input w-full text-sm" value={defaultMiniProgram.appSecret}
	              onChange={(e) => updateDefaultMiniProgram('appSecret', e.target.value)} />
	          </div>
	          <div>
	            <label className="block text-xs font-medium text-gray-500 mb-1">备注</label>
	            <input className="input w-full text-sm" value={defaultMiniProgram.remark}
	              onChange={(e) => updateDefaultMiniProgram('remark', e.target.value)} />
	          </div>
	        </div>
	        <div className="px-6 py-4 flex justify-end" style={{ backgroundColor: '#FAFBFC', borderTop: '1px solid #EDEDED' }}>
	          <button className="btn-primary text-sm" onClick={handleSaveDefaultMiniProgram} disabled={savingDefaultMiniProgram}>
	            {savingDefaultMiniProgram ? '保存中...' : '保存默认小程序配置'}
	          </button>
	        </div>
	        <div className="px-6 py-5 border-t border-green-50" data-testid="default-mini-program-phone-bindings">
	          <div className="flex items-start justify-between gap-4 mb-4">
	            <div>
	              <h4 className="text-sm font-semibold text-gray-700">手机号预绑定</h4>
	              <p className="text-xs text-gray-400 mt-1">当默认小程序里同一手机号命中多个企业时，可预先指定企业和人员，避免员工每次选择。</p>
	            </div>
	            <button className="btn-secondary btn-sm" onClick={loadPhoneBindings} type="button">刷新</button>
	          </div>
	          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
	            <input data-testid="mini-program-binding-phone" className="input w-full text-sm" value={phoneBindingForm.phone}
	              onChange={(e) => updatePhoneBindingForm('phone', e.target.value)} placeholder="手机号" />
	            <input data-testid="mini-program-binding-tenant-id" className="input w-full text-sm" value={phoneBindingForm.tenantId}
	              onChange={(e) => updatePhoneBindingForm('tenantId', e.target.value)} placeholder="企业 ID" />
	            <input data-testid="mini-program-binding-personnel-id" className="input w-full text-sm" value={phoneBindingForm.personnelId}
	              onChange={(e) => updatePhoneBindingForm('personnelId', e.target.value)} placeholder="人员 ID（可选）" />
	            <input data-testid="mini-program-binding-remark" className="input w-full text-sm" value={phoneBindingForm.remark}
	              onChange={(e) => updatePhoneBindingForm('remark', e.target.value)} placeholder="备注" />
	          </div>
	          <div className="flex justify-end mb-4">
	            <button data-testid="mini-program-binding-save" className="btn-primary text-sm" onClick={handleSavePhoneBinding} disabled={savingPhoneBinding}>
	              {savingPhoneBinding ? '保存中...' : '保存手机号预绑定'}
	            </button>
	          </div>
	          <div className="overflow-x-auto">
	            <table className="w-full text-sm">
	              <thead>
	                <tr className="text-left text-gray-500 border-b">
	                  <th className="py-2">手机号</th>
	                  <th className="py-2">企业</th>
	                  <th className="py-2">人员</th>
	                  <th className="py-2">状态</th>
	                  <th className="py-2 text-right">操作</th>
	                </tr>
	              </thead>
	              <tbody>
	                {phoneBindings.length === 0 ? (
	                  <tr><td className="py-3 text-gray-400" colSpan={5}>暂无手机号预绑定</td></tr>
	                ) : phoneBindings.map((binding) => (
	                  <tr key={binding.id} className="border-b last:border-b-0" data-testid="mini-program-binding-row">
	                    <td className="py-2">{binding.phone}</td>
	                    <td className="py-2">{binding.tenant?.name || binding.tenantId}</td>
	                    <td className="py-2">{binding.personnel?.name || binding.personnelId}</td>
	                    <td className="py-2">{binding.isEnabled ? <span className="badge-green">启用</span> : <span className="badge-gray">停用</span>}</td>
	                    <td className="py-2 text-right space-x-3">
	                      <button
	                        type="button"
	                        className="text-indigo-600 hover:text-indigo-700"
	                        onClick={() => handleTogglePhoneBinding(binding)}
	                      >
	                        {binding.isEnabled ? '停用' : '启用'}
	                      </button>
	                      <button className="text-red-600 hover:text-red-700" onClick={() => handleDeletePhoneBinding(binding.id)}>删除</button>
	                    </td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	          </div>
	        </div>
	      </div>

	      {/* ==========================================
       * 平台配置卡片网格
       * ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {PLATFORMS.map((platform) => {
          const state = platformStates[platform.key];
          if (!state) return null;

          return (
            <div
              key={platform.key}
              data-testid={`integration-card-${platform.key}`}
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {/* -------- 卡片头部：平台信息 + 状态 -------- */}
              <div
                className="px-6 py-5 flex items-center gap-3"
                style={{
                  borderBottom: `1px solid ${platform.lightBg}`,
                  background: `linear-gradient(135deg, ${platform.lightBg} 0%, white 100%)`,
                }}
              >
                {/* 平台图标 */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: platform.lightBg, color: platform.accentColor }}
                >
                  {platform.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>
                    {platform.label}
                  </h3>
                  {/* 启用状态 */}
                  <span
                    data-testid={`integration-status-${platform.key}`}
                    className={`inline-flex items-center gap-1 text-xs font-medium mt-0.5 ${
                      state.enabled ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        state.enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    {state.enabled ? '已启用' : '未启用'}
                  </span>
                </div>
              </div>

              {/* -------- 卡片内容：配置表单 -------- */}
              <div className="px-6 py-5 space-y-4">
                {/* 机器人 Webhook URL */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Webhook URL
                  </label>
                  <input
                    type="text"
                    data-testid={`integration-webhook-${platform.key}`}
                    value={state.config.botWebhookUrl}
                    onChange={(e) =>
                      updateConfigField(platform.key, 'botWebhookUrl', e.target.value)
                    }
                    className="input w-full text-sm"
                    placeholder="请输入机器人 Webhook 地址"
                  />
                </div>

                {/* 应用 ID */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    App ID
                  </label>
                  <input
                    type="text"
                    data-testid={`integration-app-id-${platform.key}`}
                    value={state.config.appId}
                    onChange={(e) =>
                      updateConfigField(platform.key, 'appId', e.target.value)
                    }
                    className="input w-full text-sm"
                    placeholder="请输入应用 ID"
                  />
                </div>

                {/* 应用密钥 */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    App Secret
                  </label>
                  <input
                    type="password"
                    data-testid={`integration-app-secret-${platform.key}`}
                    value={state.config.appSecret}
                    onChange={(e) =>
                      updateConfigField(platform.key, 'appSecret', e.target.value)
                    }
                    className="input w-full text-sm"
                    placeholder="请输入应用密钥"
                  />
                </div>

                {/* 测试结果状态显示 */}
                {state.testStatus === 'success' && (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs bg-green-50 px-3 py-2 rounded-lg">
                    <CheckCircle size={14} />
                    <span>{state.testMessage || '连通正常'}</span>
                  </div>
                )}
                {state.testStatus === 'failed' && (
                  <div className="flex items-center gap-1.5 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
                    <XCircle size={14} />
                    <span>{state.testMessage || '连接失败'}</span>
                  </div>
                )}
              </div>

              {/* -------- 卡片底部：操作按钮 -------- */}
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ backgroundColor: '#FAFBFC', borderTop: '1px solid #EDEDED' }}
              >
                {/* 保存配置按钮 */}
                <button
                  data-testid={`integration-save-${platform.key}`}
                  onClick={() => handleSave(platform.key)}
                  disabled={state.saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: platform.accentColor,
                    color: '#FFFFFF',
                    opacity: state.saving ? 0.7 : 1,
                  }}
                >
                  {state.saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {state.saving ? '保存中...' : '保存配置'}
                </button>

                {/* 测试连通性按钮 */}
                <button
                  data-testid={`integration-test-${platform.key}`}
                  onClick={() => handleTest(platform.key)}
                  disabled={state.testStatus === 'testing'}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                  style={{
                    borderColor: platform.accentColor,
                    color: platform.accentColor,
                    opacity: state.testStatus === 'testing' ? 0.7 : 1,
                  }}
                >
                  {state.testStatus === 'testing' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Zap size={14} />
                  )}
                  {state.testStatus === 'testing' ? '测试中...' : '测试连通性'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Integrations;
