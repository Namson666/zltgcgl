// ============================================
// 资料通工程管理系统 - 用户注册页面
// ============================================
// 功能：新企业用户自助注册，注册成功后自动登录
// 注册流程：填写企业信息 → 创建租户+管理员+30天试用 → 自动登录跳转看板
// 最后更新：2026-04-24

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '@/api';
import { useAuthStore } from '@/lib/AuthContext';

export default function Register() {
  const navigate = useNavigate();

  // 表单状态
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 表单校验
    if (!companyName.trim()) {
      toast.error('请输入企业名称');
      return;
    }
    if (!contactName.trim()) {
      toast.error('请输入联系人姓名');
      return;
    }
    if (!phone.trim()) {
      toast.error('请输入手机号');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error('请输入正确的手机号');
      return;
    }
    if (password.length < 6) {
      toast.error('密码长度不能少于6位');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        password,
      });

      if (res.data?.success) {
        // 注册成功，直接设置登录状态
        const { token, user, tenant } = res.data.data;
        useAuthStore.setState({
          token,
          user: {
            ...user,
            tenantCode: tenant.code,
            tenantName: tenant.name,
            permissions: [],
          },
          isAuthenticated: true,
          isDeveloper: false,
          isDevView: false,
        });
        toast.success('注册成功，欢迎使用资料通工程管理系统！');
        navigate('/dashboard');
      } else {
        toast.error(res.data?.message || '注册失败');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, var(--background) 0%, var(--card) 50%, var(--muted) 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: 'var(--sidebar)', boxShadow: 'var(--shadow-lg)' }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>资料通工程管理系统</h1>
          <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>注册新企业账号，开启30天全功能免费试用</p>
        </div>

        {/* 注册表单卡片 */}
        <div className="bg-white rounded-xl p-8 border" style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-xl)' }}>
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--foreground)' }}>创建企业账号</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 企业名称 */}
            <div>
              <label className="form-label">企业名称 <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="input"
                placeholder="请输入企业全称"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 联系人姓名 */}
            <div>
              <label className="form-label">联系人姓名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="input"
                placeholder="请输入您的姓名"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 手机号 */}
            <div>
              <label className="form-label">手机号 <span className="text-red-500">*</span></label>
              <input
                type="tel"
                className="input"
                placeholder="请输入手机号（同时作为登录用户名）"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="form-label">密码 <span className="text-red-500">*</span></label>
              <input
                type="password"
                className="input"
                placeholder="请设置登录密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="form-label">确认密码 <span className="text-red-500">*</span></label>
              <input
                type="password"
                className="input"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 注册按钮 */}
            <button
              type="submit"
              className="btn-primary w-full py-3 text-base font-medium"
              disabled={loading}
            >
              {loading ? '注册中...' : '立即注册'}
            </button>
          </form>

          {/* 底部链接 */}
          <div className="mt-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            已有企业账号？
            <Link to="/login" className="hover:underline font-medium ml-1" style={{ color: 'var(--primary)' }}>
              立即登录
            </Link>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-6 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
          注册即表示您同意《资料通工程管理系统服务条款》和《隐私政策》
        </div>
      </div>
    </div>
  );
}
