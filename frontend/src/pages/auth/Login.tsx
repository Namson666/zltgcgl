/**
 * 资料通工程管理系统 - 登录页面
 *
 * 功能说明：
 * 1. 支持"开发者登录"和"企业登录"两种模式切换
 * 2. 开发者登录：用户名 + 密码
 * 3. 企业登录：企业代码 + 用户名 + 密码
 * 4. 登录成功后自动跳转到 /dashboard
 * 5. 美观的居中卡片式登录界面，蓝色主题
 *
 * 界面布局：
 * - 全屏渐变背景
 * - 居中白色登录卡片
 * - 顶部系统 Logo 和名称
 * - 登录模式切换 Tab
 * - 表单输入区域
 * - 登录按钮
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Lock, User, Eye, EyeOff, Briefcase } from 'lucide-react';
import { useAuthStore } from '../../lib/AuthContext';
import { LoadingSpinner } from '../../components/ui/Loading';
import { authApi } from '../../api';

/* ========================================
 * 登录模式类型
 * ======================================== */
type LoginMode = 'developer' | 'enterprise';

interface PortalConfig {
  isEnabled: boolean;
  domain?: string;
  logoUrl?: string | null;
  companyName?: string;
  loginTitle?: string;
  themeColor?: string | null;
}

/* ========================================
 * Login 登录页面组件
 * ======================================== */
const Login: React.FC = () => {
  const navigate = useNavigate();

  /* 从认证 Store 获取登录方法 */
  const { developerLogin, userLogin, isAuthenticated } = useAuthStore();

  /* ---------- 表单状态 ---------- */
  const [mode, setMode] = useState<LoginMode>('enterprise');  /* 当前登录模式 */
  const [username, setUsername] = useState('');                /* 用户名 */
  const [password, setPassword] = useState('');                /* 密码 */
  const [tenantCode, setTenantCode] = useState('');            /* 企业代码 */
  const [showPassword, setShowPassword] = useState(false);     /* 是否显示密码 */
  const [loading, setLoading] = useState(false);               /* 登录加载状态 */
  const [portalConfig, setPortalConfig] = useState<PortalConfig | null>(null);
  const [error, setError] = useState('');                      /* 错误提示信息 */

  const isPortalLogin = Boolean(portalConfig?.isEnabled);
  const brandName = portalConfig?.companyName || '资料通工程管理系统';
  const loginTitle = portalConfig?.loginTitle || brandName;
  const themeColor = portalConfig?.themeColor || 'var(--primary)';
  const logoSrc = portalConfig?.logoUrl || '/icon.png';

  /* ---------- 副作用 ---------- */

  /**
   * 已登录用户自动跳转到数据看板
   * 避免已登录用户停留在登录页
   */
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  /**
   * 如果当前 hostname 绑定了企业独立登录页，则加载品牌配置。
   * localhost / 未绑定域名会保持原统一登录页逻辑。
   */
  useEffect(() => {
    let mounted = true;
    const loadPortalConfig = async () => {
      try {
        const hostname = window.location.hostname;
        const res = await authApi.getPortalConfig(hostname);
        const body = res.data || res;
        const data = body.data || body;
        if (mounted && data?.isEnabled) {
          setPortalConfig(data);
          setMode('enterprise');
        }
      } catch {
        // 独立登录页配置不可用时回落到统一登录页，不阻断登录。
      }
    };
    loadPortalConfig();
    return () => { mounted = false; };
  }, []);

  /* ---------- 事件处理 ---------- */

  /**
   * 处理表单提交
   * 根据当前登录模式调用不同的登录方法
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();  /* 阻止表单默认提交行为 */
    setError('');        /* 清除之前的错误信息 */

    /* 基本表单验证 */
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }
    if (mode === 'enterprise' && !isPortalLogin && !tenantCode.trim()) {
      setError('请输入企业代码');
      return;
    }

    setLoading(true);  /* 开始加载 */

    try {
      if (mode === 'developer') {
        /* 开发者登录 */
        await developerLogin({ username: username.trim(), password });
      } else {
        /* 企业用户登录 */
        await userLogin({
          tenantCode: isPortalLogin ? undefined : tenantCode.trim(),
          portalHost: isPortalLogin ? window.location.hostname : undefined,
          username: username.trim(),
          password,
        });
      }

      /* 登录成功，跳转到数据看板 */
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      /* 登录失败，显示错误信息 */
      setError(err.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);  /* 结束加载 */
    }
  };

  /**
   * 切换登录模式
   * 切换时清除错误信息和密码
   */
  const handleModeChange = (newMode: LoginMode) => {
    if (isPortalLogin && newMode !== 'enterprise') return;
    setMode(newMode);
    setError('');
    setPassword('');
  };

  /* ---------- 渲染 ---------- */
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, var(--background) 0%, var(--card) 50%, var(--muted) 100%)' }}>
      {/* ==========================================
       * 登录卡片
       * ========================================== */}
      <div className="w-full max-w-md">
        {/* 系统标题区域 */}
        <div className="text-center mb-8">
          {/* Logo 图标 */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}>
            <img src={logoSrc} alt={brandName} className="w-14 h-14 object-contain" />
          </div>
          {/* 系统名称 */}
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{loginTitle}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {isPortalLogin ? `${brandName} · 独立登录入口` : 'Construction Management System'}
          </p>
        </div>

        {/* 登录表单卡片 */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-xl)' }}>
          {/* ==========================================
           * 登录模式切换 Tab
           * ========================================== */}
          {!isPortalLogin && (
          <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
            {/* 企业登录 Tab */}
            <button
              onClick={() => handleModeChange('enterprise')}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors relative ${
                mode === 'enterprise'
                  ? ''
                  : 'hover:opacity-80'
              }`}
              style={{ color: mode === 'enterprise' ? themeColor : 'var(--muted-foreground)' }}
            >
              <span className="flex items-center justify-center gap-2">
                <Briefcase size={16} />
                企业登录
              </span>
              {/* 激活指示条 */}
              {mode === 'enterprise' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: themeColor }} />
              )}
            </button>

            {/* 开发者登录 Tab */}
            <button
              onClick={() => handleModeChange('developer')}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors relative ${
                mode === 'developer'
                  ? ''
                  : 'hover:opacity-80'
              }`}
              style={{ color: mode === 'developer' ? themeColor : 'var(--muted-foreground)' }}
            >
              <span className="flex items-center justify-center gap-2">
                <User size={16} />
                开发者登录
              </span>
              {/* 激活指示条 */}
              {mode === 'developer' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: themeColor }} />
              )}
            </button>
          </div>
          )}

          {/* ==========================================
           * 登录表单
           * ========================================== */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* 错误提示信息 */}
            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--destructive-bg)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
                {error}
              </div>
            )}

            {/* 企业代码输入框（仅企业登录模式显示） */}
            {mode === 'enterprise' && !isPortalLogin && (
              <div>
                <label className="form-label">企业代码</label>
                <div className="relative">
                  <Building2
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value)}
                    placeholder="请输入企业代码"
                    className="input pl-9"
                    autoComplete="organization"
                  />
                </div>
              </div>
            )}

            {/* 用户名输入框 */}
            <div>
              <label className="form-label">用户名</label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="input pl-9"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* 密码输入框 */}
            <div>
              <label className="form-label">密码</label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="input pl-9 pr-10"
                  autoComplete="current-password"
                />
                {/* 显示/隐藏密码切换按钮 */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-base mt-6"
              style={portalConfig?.themeColor ? { backgroundColor: themeColor } : undefined}
            >
              {loading ? (
                /* 加载状态 */
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size={18} className="text-white" />
                  登录中...
                </span>
              ) : (
                '登 录'
              )}
            </button>
          </form>

          {/* 注册入口 */}
          {!isPortalLogin && (
          <div className="mt-4 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            还没有企业账号？
            <Link to="/register" className="hover:underline font-medium ml-1" style={{ color: 'var(--primary)' }}>
              立即注册
            </Link>
          </div>
          )}
        </div>

        {/* 底部版权信息 */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--muted-foreground)' }}>
          &copy; {new Date().getFullYear()} 资料通工程管理系统 - All Rights Reserved
        </p>
      </div>
    </div>
  );
};

export default Login;
