/**
 * 资料通工程管理系统 - 安全策略配置页面
 *
 * 功能说明：
 * 开发者后台的安全策略配置，包括登录策略、密码策略、
 * 会话管理和 IP 白名单等设置。
 *
 * 页面结构：
 * 1. 页面标题区域
 * 2. 安全设置表单（卡片布局）
 *    - 登录策略：最大尝试次数、锁定时间
 *    - 密码策略：最小长度、是否需要特殊字符
 *    - 会话策略：超时时间
 *    - IP 白名单：开关、白名单列表
 * 3. 保存按钮
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Save,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';

/* ========================================
 * 类型定义
 * ======================================== */

/** 安全设置数据接口 */
interface SecuritySettings {
  login_max_attempts: number;           /* 登录最大尝试次数 */
  login_lockout_minutes: number;        /* 登录锁定时间(分钟) */
  password_min_length: number;          /* 密码最小长度 */
  password_require_special: boolean;    /* 密码需特殊字符 */
  session_timeout_minutes: number;      /* 会话超时时间(分钟) */
  ip_whitelist_enabled: boolean;        /* IP 白名单开关 */
  ip_whitelist: string;                 /* IP 白名单（每行一个） */
}

/* ========================================
 * 默认安全设置
 * ======================================== */
const DEFAULT_SETTINGS: SecuritySettings = {
  login_max_attempts: 5,
  login_lockout_minutes: 15,
  password_min_length: 8,
  password_require_special: true,
  session_timeout_minutes: 60,
  ip_whitelist_enabled: false,
  ip_whitelist: '',
};

/* ========================================
 * Security 安全策略配置组件
 * ======================================== */
const Security: React.FC = () => {
  /* ---------- 状态 ---------- */
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS); /* 安全设置 */
  const [loading, setLoading] = useState(true);                                 /* 加载状态 */
  const [saving, setSaving] = useState(false);                                  /* 保存状态 */
  const [changed, setChanged] = useState(false);                                /* 是否有未保存的修改 */

  /* ---------- 数据加载 ---------- */

  /**
   * 加载安全设置
   * 调用 developerApi.getSecuritySettings() 获取当前配置
   */
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await developerApi.getSecuritySettings();
      const body = res.data || res;
      const data = body.data || body;
      if (data && typeof data === 'object') {
        setSettings({
          login_max_attempts: Number(data.login_max_attempts ?? DEFAULT_SETTINGS.login_max_attempts),
          login_lockout_minutes: Number(data.login_lockout_minutes ?? DEFAULT_SETTINGS.login_lockout_minutes),
          password_min_length: Number(data.password_min_length ?? DEFAULT_SETTINGS.password_min_length),
          password_require_special: String(data.password_require_special ?? DEFAULT_SETTINGS.password_require_special) === 'true',
          session_timeout_minutes: Number(data.session_timeout_minutes ?? DEFAULT_SETTINGS.session_timeout_minutes),
          ip_whitelist_enabled: String(data.ip_whitelist_enabled ?? DEFAULT_SETTINGS.ip_whitelist_enabled) === 'true',
          ip_whitelist: data.ip_whitelist ?? '',
        });
      }
      setChanged(false);
    } catch (error) {
      console.error('加载安全设置失败:', error);
      toast.error('加载安全设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  /* ---------- 表单处理 ---------- */

  /**
   * 更新数字字段
   * @param field - 字段名
   * @param value - 新值
   */
  const handleNumberChange = (field: keyof SecuritySettings, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setSettings((prev) => ({ ...prev, [field]: num }));
      setChanged(true);
    }
  };

  /**
   * 更新布尔字段
   * @param field - 字段名
   * @param value - 新值
   */
  const handleBooleanChange = (field: keyof SecuritySettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setChanged(true);
  };

  /**
   * 更新文本字段
   * @param field - 字段名
   * @param value - 新值
   */
  const handleTextChange = (field: keyof SecuritySettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setChanged(true);
  };

  /* ---------- 保存操作 ---------- */

  /**
   * 保存安全设置
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      await developerApi.updateSecuritySettings(settings);
      toast.success('安全设置已保存');
      setChanged(false);
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 加载状态 ---------- */

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">安全策略</h1>
            <p className="page-subtitle">配置系统安全策略和访问控制</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-3" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-10 bg-gray-100 rounded animate-pulse" />
                    <div className="h-10 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
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
          <h1 className="page-title">安全策略</h1>
          <p className="page-subtitle">配置系统安全策略和访问控制</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSettings}
            data-testid="security-refresh"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#8899AA' }}
            title="刷新"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleSave}
            data-testid="security-save-top"
            disabled={saving || !changed}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save size={18} />
                保存设置
              </>
            )}
          </button>
        </div>
      </div>

      {/* ==========================================
       * 安全设置表单 - 卡片布局
       * ========================================== */}
      <div className="space-y-6">
        {/* ---------- 登录策略 ---------- */}
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#1A2B3C' }}>
              <Shield size={16} className="text-blue-500" />
              登录策略
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* 登录最大尝试次数 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  登录最大尝试次数
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  超过此次数后账号将被临时锁定
                </p>
                <input
                  type="number"
                  data-testid="security-login-max-attempts"
                  value={settings.login_max_attempts}
                  onChange={(e) => handleNumberChange('login_max_attempts', e.target.value)}
                  className="input w-full text-sm"
                  min={1}
                  max={100}
                />
              </div>
              {/* 登录锁定时间 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  登录锁定时间（分钟）
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  锁定后自动解锁等待时间
                </p>
                <input
                  type="number"
                  data-testid="security-login-lockout-minutes"
                  value={settings.login_lockout_minutes}
                  onChange={(e) => handleNumberChange('login_lockout_minutes', e.target.value)}
                  className="input w-full text-sm"
                  min={1}
                  max={1440}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ---------- 密码策略 ---------- */}
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#1A2B3C' }}>
              <Shield size={16} className="text-emerald-500" />
              密码策略
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* 密码最小长度 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码最小长度
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  用户密码允许的最小字符数
                </p>
                <input
                  type="number"
                  data-testid="security-password-min-length"
                  value={settings.password_min_length}
                  onChange={(e) => handleNumberChange('password_min_length', e.target.value)}
                  className="input w-full text-sm"
                  min={4}
                  max={64}
                />
              </div>
              {/* 密码需特殊字符 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码需包含特殊字符
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  要求密码必须包含至少一个特殊字符（如 @, #, $ 等）
                </p>
                <div className="flex items-center h-10">
                  <button
                    type="button"
                    data-testid="security-password-special-toggle"
                    onClick={() => handleBooleanChange('password_require_special', !settings.password_require_special)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      settings.password_require_special ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={settings.password_require_special}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.password_require_special ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="ml-3 text-sm text-gray-600">
                    {settings.password_require_special ? '已开启' : '已关闭'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- 会话策略 ---------- */}
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#1A2B3C' }}>
              <Shield size={16} className="text-purple-500" />
              会话策略
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* 会话超时时间 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会话超时时间（分钟）
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  用户无操作后自动登出等待时间
                </p>
                <input
                  type="number"
                  data-testid="security-session-timeout-minutes"
                  value={settings.session_timeout_minutes}
                  onChange={(e) => handleNumberChange('session_timeout_minutes', e.target.value)}
                  className="input w-full text-sm"
                  min={5}
                  max={1440}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ---------- IP 白名单 ---------- */}
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#1A2B3C' }}>
              <Shield size={16} className="text-amber-500" />
              IP 白名单
            </h3>
            <div className="space-y-4">
              {/* IP 白名单开关 */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    IP 白名单开关
                  </label>
                  <p className="text-xs text-gray-400">
                    启用后仅白名单中的 IP 地址可以访问系统
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="security-ip-whitelist-toggle"
                  onClick={() => handleBooleanChange('ip_whitelist_enabled', !settings.ip_whitelist_enabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    settings.ip_whitelist_enabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={settings.ip_whitelist_enabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.ip_whitelist_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* IP 白名单列表 */}
              {settings.ip_whitelist_enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IP 白名单
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    每行输入一个 IP 地址或 CIDR 网段
                  </p>
                  <textarea
                    data-testid="security-ip-whitelist"
                    value={settings.ip_whitelist}
                    onChange={(e) => handleTextChange('ip_whitelist', e.target.value)}
                    className="input w-full text-sm font-mono"
                    rows={5}
                    placeholder={'192.168.1.1\n10.0.0.0/24\n203.0.113.0'}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---------- 底部保存按钮 ---------- */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={fetchSettings}
            data-testid="security-reset"
            className="btn-secondary"
            disabled={saving}
          >
            重置
          </button>
          <button
            onClick={handleSave}
            data-testid="security-save-bottom"
            disabled={saving || !changed}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save size={16} />
                保存设置
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Security;
