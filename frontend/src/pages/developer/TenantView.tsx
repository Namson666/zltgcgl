/**
 * 资料通工程管理系统 - 企业视角查看页面
 *
 * 开发者进入指定企业视角，查看该企业的完整权限状态和用户概览。
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2, Users, Shield, ArrowLeft, Eye,
  Package, FileText, UserCog, Key, Truck, HardHat,
  CalendarCheck, Calculator, Banknote, ShieldCheck,
  FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi, tenantApi, authApi } from '../../api';
import { useAuthStore } from '../../lib/AuthContext';

/* ========================================
 * 类型定义
 * ======================================== */

interface TenantDetail {
  id: string;
  name: string;
  code: string;
  contactName: string;
  contactPhone: string;
  address: string;
  isActive: boolean;
  subscription?: {
    plan: string;
    tier: string;
    status: string;
    currentPeriodEnd: string;
  };
  userCount: number;
  createdAt: string;
}

interface TenantUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  role: { displayName: string; name: string };
  isActive: boolean;
  dataScope: string;
  department?: { name: string };
}

interface TenantModuleState {
  moduleKey: 'wms' | 'labor' | 'finance';
  isEnabled: boolean;
  remark?: string | null;
}

/* ========================================
 * TenantView 组件
 * ======================================== */
const TenantView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDeveloper } = useAuthStore();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [modules, setModules] = useState<TenantModuleState[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);
  const [savingModules, setSavingModules] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // 获取企业详情和用户列表
        const [tenantsRes] = await Promise.all([
          developerApi.getTenants({ page: 1, pageSize: 100 }),
        ]);
        const body = tenantsRes.data || tenantsRes;
        const tenantsList = body.data || [];
        const found = tenantsList.find((t: any) => t.id === id || String(t.id) === id);
        if (found) setTenant(found);

        // 获取该企业的用户列表和模块开通状态
        try {
          const [usersRes, modulesRes] = await Promise.all([
            developerApi.getTenantUsers(id),
            developerApi.getTenantModules(id),
          ]);
          const body = usersRes.data || usersRes;
          const usersData = body.data || body;
          setUsers(Array.isArray(usersData) ? usersData : []);
          const modulesBody = modulesRes.data || modulesRes;
          const modulesData = modulesBody.data || modulesBody;
          setModules(Array.isArray(modulesData) ? modulesData : []);
        } catch {
          // 用户列表或模块状态可能不可用
        }
      } catch (error) {
        console.error('加载企业数据失败:', error);
        toast.error('加载企业数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleEnterTenant = async () => {
    if (!id || !tenant) return;
    setEntering(true);
    try {
      const res = await authApi.enterTenant(id);
      // Axios 返回的 response.data 是后端 JSON 体，需再取 .data 才是实际数据
      const data = res.data?.data || res.data;
      const { token, user, refreshToken } = data;
      useAuthStore.getState().enterEnterpriseView(token, user, refreshToken);
      toast.success(`已进入 ${tenant.name} 视角`);
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      toast.error(error.message || '进入企业视角失败');
    } finally {
      setEntering(false);
    }
  };

  const handleExitView = () => {
    navigate('/dev/tenants');
  };

  const handleToggleModule = (moduleKey: TenantModuleState['moduleKey']) => {
    setModules((prev) => prev.map((item) => (
      item.moduleKey === moduleKey ? { ...item, isEnabled: !item.isEnabled } : item
    )));
  };

  const handleSaveModules = async () => {
    if (!id) return;
    setSavingModules(true);
    try {
      const res = await developerApi.updateTenantModules(id, modules.map(({ moduleKey, isEnabled, remark }) => ({ moduleKey, isEnabled, remark })));
      const body = res.data || res;
      const updated = body.data || body;
      if (Array.isArray(updated)) setModules(updated);
      toast.success('模块开通状态已保存');
    } catch (error: any) {
      toast.error(error.message || '保存模块开通状态失败');
    } finally {
      setSavingModules(false);
    }
  };

  if (!isDeveloper) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">无权限访问</h2>
        <p className="text-gray-400">该页面仅开发者账号可访问</p>
      </div>
    );
  }

  /* ---------- 权限模块列表 ---------- */
  const permissionModules = [
    { key: 'dashboard', label: '数据看板', icon: <Eye size={18} />, enabled: true },
    { key: 'wms', label: '物资管理', icon: <Package size={18} />, enabled: modules.find((item) => item.moduleKey === 'wms')?.isEnabled ?? true, configurable: true },
    { key: 'labor', label: '劳资管理', icon: <Users size={18} />, enabled: modules.find((item) => item.moduleKey === 'labor')?.isEnabled ?? true, configurable: true },
    { key: 'finance', label: '财务管理', icon: <Banknote size={18} />, enabled: modules.find((item) => item.moduleKey === 'finance')?.isEnabled ?? true, configurable: true },
    { key: 'contract', label: '合同管理', icon: <FileText size={18} />, enabled: true },
    { key: 'department', label: '项目部管理', icon: <Building2 size={18} />, enabled: true },
    { key: 'admin', label: '系统管理', icon: <UserCog size={18} />, enabled: true },
  ];

  /* ---------- 订阅状态映射 ---------- */
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    TRIAL: { label: '试用期', color: '#D97706', bg: '#FFFBEB' },
    ACTIVE: { label: '已订阅', color: '#059669', bg: '#ECFDF5' },
    EXPIRED: { label: '未订阅', color: '#6B7280', bg: '#F9FAFB' },
  };

  const subStatus = tenant?.subscription?.status || '';
  const statusInfo = statusMap[subStatus] || { label: '未知', color: '#6B7280', bg: '#F9FAFB' };

  return (
    <div>
      {/* ==========================================
       * 页面标题 + 导航
       * ========================================== */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleExitView}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#8899AA' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1A2B3C' }}>{tenant?.name || '企业视角'}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#8899AA' }}>
              企业代码: {tenant?.code} · 联系人: {tenant?.contactName || '未设置'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
            {statusInfo.label}
          </span>
          <button
            onClick={handleEnterTenant}
            disabled={entering}
            className="btn-primary flex items-center gap-2"
          >
            <Eye size={16} />
            {entering ? '进入中...' : '进入该企业视角'}
          </button>
        </div>
      </div>

      {loading ? (
        /* 加载状态 */
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="h-6 bg-gray-200 rounded animate-pulse w-1/3 mb-4" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !tenant ? (
        <div className="text-center py-20 text-gray-400">未找到该企业信息</div>
      ) : (
        <>
          {/* ==========================================
           * 企业基本信息
           * ========================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* 基础信息 */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-base font-semibold mb-4" style={{ color: '#1A2B3C' }}>
                <Building2 size={16} className="inline mr-1.5 text-blue-500" />
                企业信息
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">企业名称</span>
                  <p className="font-medium text-gray-800 mt-0.5">{tenant.name}</p>
                </div>
                <div>
                  <span className="text-gray-400">企业代码</span>
                  <p className="font-medium text-gray-800 mt-0.5">{tenant.code}</p>
                </div>
                <div>
                  <span className="text-gray-400">联系人</span>
                  <p className="font-medium text-gray-800 mt-0.5">{tenant.contactName || '未设置'}</p>
                </div>
                <div>
                  <span className="text-gray-400">联系电话</span>
                  <p className="font-medium text-gray-800 mt-0.5">{tenant.contactPhone || '未设置'}</p>
                </div>
                <div>
                  <span className="text-gray-400">用户数量</span>
                  <p className="font-medium text-gray-800 mt-0.5">{tenant.userCount} 人</p>
                </div>
                <div>
                  <span className="text-gray-400">状态</span>
                  <p className="font-medium mt-0.5">
                    <span className={`inline-flex items-center gap-1 ${tenant.isActive ? 'text-green-600' : 'text-red-500'}`}>
                      {tenant.isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {tenant.isActive ? '启用' : '停用'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* 订阅信息 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-base font-semibold mb-4" style={{ color: '#1A2B3C' }}>
                <Shield size={16} className="inline mr-1.5 text-purple-500" />
                订阅信息
              </h2>
              {tenant.subscription ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">套餐计划</span>
                    <span className="font-medium text-gray-800">{tenant.subscription.plan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">套餐层级</span>
                    <span className="font-medium text-gray-800">{tenant.subscription.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">状态</span>
                    <span className="font-medium" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">到期时间</span>
                    <span className="font-medium text-gray-800">
                      {tenant.subscription.currentPeriodEnd
                        ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString('zh-CN')
                        : '永久'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">暂无订阅信息</p>
              )}
            </div>
          </div>

          {/* ==========================================
           * 模块权限状态
           * ========================================== */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
            <h2 className="text-base font-semibold mb-4" style={{ color: '#1A2B3C' }}>
              <ShieldCheck size={16} className="inline mr-1.5 text-emerald-500" />
              模块开通状态
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {permissionModules.map((mod) => (
                <button
                  key={mod.key}
                  type="button"
                  disabled={!mod.configurable}
                  onClick={() => mod.configurable && handleToggleModule(mod.key as TenantModuleState['moduleKey'])}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors disabled:cursor-default"
                  style={{
                    borderColor: mod.enabled ? '#D1FAE5' : '#FEE2E2',
                    backgroundColor: mod.enabled ? '#F0FDF4' : '#FEF2F2',
                  }}
                >
                  <div style={{ color: mod.enabled ? '#059669' : '#DC2626' }}>{mod.icon}</div>
                  <span className="text-xs font-medium" style={{ color: mod.enabled ? '#065F46' : '#991B1B' }}>
                    {mod.label}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                    backgroundColor: mod.enabled ? '#D1FAE5' : '#FEE2E2',
                    color: mod.enabled ? '#059669' : '#DC2626',
                  }}>
                    {mod.enabled ? '已启用' : '未启用'}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">合同、用户、角色、项目部为默认基础功能；物资、劳资、财务可单独开通。</p>
              <button
                onClick={handleSaveModules}
                disabled={savingModules}
                className="btn-primary text-sm"
              >
                {savingModules ? '保存中...' : '保存模块设置'}
              </button>
            </div>
          </div>

          {/* ==========================================
           * 用户列表
           * ========================================== */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>
                <Users size={16} className="inline mr-1.5 text-blue-500" />
                企业用户列表 ({users.length})
              </h2>
            </div>
            {users.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="px-2 py-0.5 rounded bg-gray-50">
                        {user.role?.displayName || user.role?.name || '未知角色'}
                      </span>
                      {user.department && (
                        <span>{user.department.name}</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        user.isActive ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'
                      }`}>
                        {user.isActive ? '正常' : '停用'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">暂无用户数据</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TenantView;
