/**
 * 资料通工程管理系统 - 租户管理页面
 *
 * 功能说明：
 * 开发者后台的租户（企业）管理页面，支持租户的增删改查、启用/停用、
 * 查看租户详情（含用户列表）、为租户创建用户、重置用户密码等功能。
 *
 * 页面结构：
 * 1. 页面标题区域 + 新增租户按钮
 * 2. 搜索筛选栏（按企业名称/代码搜索）
 * 3. 租户列表表格（企业名称、企业代码、联系人、电话、订阅状态、用户数、创建时间、操作）
 * 4. 分页功能
 * 5. 新增/编辑租户弹窗
 * 6. 租户详情弹窗（含用户列表、创建用户、重置密码）
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Users,
  KeyRound,
  Loader2,
  Shield,
  LogIn,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi, tenantApi } from '../../api';
import {
  Pagination,
  EmptyState,
  SearchInput,
  StatusBadge,
  formatDate,
  ConfirmDialog,
} from '../../components/ui/Common';
import Modal from '../../components/ui/Modal';

/* ========================================
 * 类型定义
 * ======================================== */

/** 租户信息接口 */
interface Tenant {
  id: number;                     /* 租户 ID */
  name: string;                   /* 企业名称 */
  code: string;                   /* 企业代码 */
  contactName: string;            /* 联系人姓名 */
  contactPhone: string;           /* 联系电话 */
  address?: string;               /* 地址 */
  status: string;                 /* 状态：active / inactive */
  subscriptionStatus?: string;    /* 订阅状态：trial / active / expired */
  userCount: number;              /* 用户数 */
  createdAt: string;              /* 创建时间 */
}

/** 租户用户信息接口 */
interface TenantUser {
  id: number;                     /* 用户 ID */
  username: string;               /* 用户名 */
  realName?: string;              /* 真实姓名 */
  role?: string;                  /* 角色 */
  status: string;                 /* 状态 */
  createdAt: string;              /* 创建时间 */
}

/** 租户表单数据接口 */
interface TenantFormData {
  name: string;                   /* 企业名称 */
  code: string;                   /* 企业代码 */
  contactName: string;            /* 联系人姓名 */
  contactPhone: string;           /* 联系电话 */
  address: string;                /* 地址 */
}

/** 用户创建表单数据接口 */
interface UserFormData {
  username: string;               /* 用户名 */
  realName: string;               /* 真实姓名 */
  password: string;               /* 密码 */
  role: string;                   /* 角色 */
}

/* ========================================
 * Tenants 租户管理组件
 * ======================================== */
const Tenants: React.FC = () => {
  const navigate = useNavigate();

  /* ---------- 列表状态 ---------- */
  const [tenants, setTenants] = useState<Tenant[]>([]);          /* 租户列表数据 */
  const [loading, setLoading] = useState(false);                  /* 列表加载状态 */
  const [total, setTotal] = useState(0);                          /* 总记录数 */
  const [totalPages, setTotalPages] = useState(0);                /* 总页数 */
  const [page, setPage] = useState(1);                            /* 当前页码 */
  const [pageSize] = useState(20);                                /* 每页条数 */
  const [keyword, setKeyword] = useState('');                     /* 搜索关键词 */

  /* ---------- 弹窗状态 ---------- */
  const [showFormModal, setShowFormModal] = useState(false);      /* 新增/编辑租户弹窗 */
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);  /* 当前编辑的租户 */
  const [showDetailModal, setShowDetailModal] = useState(false);  /* 租户详情弹窗 */
  const [detailTenant, setDetailTenant] = useState<Tenant | null>(null);    /* 查看详情的租户 */
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);  /* 确认弹窗 */
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});  /* 确认操作回调 */
  const [confirmMessage, setConfirmMessage] = useState('');  /* 确认弹窗消息 */

  /* ---------- 表单状态 ---------- */
  const [formData, setFormData] = useState<TenantFormData>({      /* 租户表单数据 */
    name: '',
    code: '',
    contactName: '',
    contactPhone: '',
    address: '',
  });
  const [formLoading, setFormLoading] = useState(false);          /* 表单提交加载状态 */

  /* ---------- 租户详情/用户管理状态 ---------- */
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);  /* 租户用户列表 */
  const [usersLoading, setUsersLoading] = useState(false);         /* 用户列表加载状态 */
  const [showCreateUser, setShowCreateUser] = useState(false);     /* 创建用户弹窗 */
  const [userForm, setUserForm] = useState<UserFormData>({         /* 用户创建表单 */
    username: '',
    realName: '',
    password: '',
    role: 'user',
  });
  const [userFormLoading, setUserFormLoading] = useState(false);  /* 用户表单提交状态 */
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);  /* 重置密码的用户 ID */
  const [newPassword, setNewPassword] = useState('');              /* 新密码 */

  /* ---------- 回收站状态 ---------- */
  const [showRecycleBin, setShowRecycleBin] = useState(false);     /* 回收站弹窗 */
  const [recycleTenants, setRecycleTenants] = useState<any[]>([]); /* 回收站中的企业列表 */
  const [recycleLoading, setRecycleLoading] = useState(false);     /* 回收站加载状态 */
  const [recyclePage, setRecyclePage] = useState(1);               /* 回收站页码 */
  const [recycleTotal, setRecycleTotal] = useState(0);             /* 回收站总数 */
  const [recycleTotalPages, setRecycleTotalPages] = useState(0);   /* 回收站总页数 */
  const [recyclePageSize] = useState(10);                          /* 回收站每页条数 */

  /* ---------- 数据加载 ---------- */

  /**
   * 加载租户列表
   * 调用 developerApi.getTenants() 获取分页数据
   */
  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await developerApi.getTenants({
        page,
        pageSize,
        keyword: keyword || undefined,
      });
      const body = res.data || res;
      const list = body.data || [];
      const pagination = body.pagination || {};
      setTenants(list);
      setTotal(pagination.total || 0);
      setTotalPages(pagination.totalPages || 0);
    } catch (error) {
      console.error('加载租户列表失败:', error);
      toast.error('加载租户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  /* 页码或搜索条件变化时重新加载数据 */
  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  /* 回收站打开或换页时加载数据 */
  useEffect(() => {
    if (showRecycleBin) {
      fetchRecycleTenants();
    }
  }, [showRecycleBin, recyclePage]);

  /* ---------- 搜索处理 ---------- */

  /**
   * 处理搜索操作
   * @param value - 搜索关键词
   */
  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1); /* 搜索时重置到第一页 */
  };

  /* ---------- 租户表单操作 ---------- */

  /**
   * 打开新增租户弹窗
   */
  const handleOpenCreate = () => {
    setEditingTenant(null);
    setFormData({ name: '', code: '', contactName: '', contactPhone: '', address: '' });
    setShowFormModal(true);
  };

  /**
   * 打开编辑租户弹窗
   * @param tenant - 要编辑的租户信息
   */
  const handleOpenEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      code: tenant.code,
      contactName: tenant.contactName,
      contactPhone: tenant.contactPhone,
      address: tenant.address || '',
    });
    setShowFormModal(true);
  };

  /**
   * 提交租户表单（新增或编辑）
   */
  const handleSubmitForm = async () => {
    /* 表单验证 */
    if (!formData.name.trim()) {
      toast.error('请输入企业名称');
      return;
    }
    if (!formData.code.trim()) {
      toast.error('请输入企业代码');
      return;
    }
    if (!formData.contactName.trim()) {
      toast.error('请输入联系人姓名');
      return;
    }
    if (!formData.contactPhone.trim()) {
      toast.error('请输入联系电话');
      return;
    }

    try {
      setFormLoading(true);
      if (editingTenant) {
        /* 编辑模式：更新租户 */
        await developerApi.updateTenant(editingTenant.id, formData);
        toast.success('租户信息已更新');
      } else {
        /* 新增模式：创建租户 */
        await developerApi.createTenant(formData);
        toast.success('租户创建成功');
      }
      setShowFormModal(false);
      fetchTenants(); /* 刷新列表 */
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /* ---------- 删除租户 ---------- */

  /**
   * 处理删除租户（软删除）
   * @param tenant - 目标租户
   */
  const handleDeleteTenant = (tenant: Tenant) => {
    setConfirmMessage(`确定要删除企业「${tenant.name}」吗？删除后可在回收站中恢复。`);
    setConfirmAction(async () => {
      try {
        await developerApi.deleteTenant(tenant.id);
        toast.success(`已删除企业「${tenant.name}」`);
        fetchTenants();
      } catch (error: any) {
        toast.error(error.message || '删除失败');
      }
    });
    setShowConfirmDialog(true);
  };

  /* ---------- 租户详情操作 ---------- */

  /**
   * 查看租户详情（含用户列表）
   * @param tenant - 目标租户
   */
  const handleViewDetail = async (tenant: Tenant) => {
    setDetailTenant(tenant);
    setShowDetailModal(true);
    setUsersLoading(true);
    try {
      /* 加载该租户下的用户列表 */
      const res = await tenantApi.getUsers({ page: 1, pageSize: 100 });
      const data = res.data || res;
      setTenantUsers(data.items || []);
    } catch (error) {
      console.error('加载用户列表失败:', error);
      toast.error('加载用户列表失败');
    } finally {
      setUsersLoading(false);
    }
  };

  /* ---------- 用户管理操作 ---------- */

  /**
   * 为租户创建用户
   */
  const handleCreateUser = async () => {
    if (!userForm.username.trim()) {
      toast.error('请输入用户名');
      return;
    }
    if (!userForm.password.trim()) {
      toast.error('请输入密码');
      return;
    }

    try {
      setUserFormLoading(true);
      await tenantApi.createUser(userForm);
      toast.success('用户创建成功');
      setShowCreateUser(false);
      setUserForm({ username: '', realName: '', password: '', role: 'user' });
      /* 刷新用户列表 */
      if (detailTenant) {
        handleViewDetail(detailTenant);
      }
    } catch (error: any) {
      toast.error(error.message || '创建用户失败');
    } finally {
      setUserFormLoading(false);
    }
  };

  /**
   * 重置用户密码
   */
  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      toast.error('请输入新密码');
      return;
    }
    if (resetPasswordUserId === null) return;

    try {
      await tenantApi.resetPassword(resetPasswordUserId, { newPassword });
      toast.success('密码重置成功');
      setResetPasswordUserId(null);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.message || '密码重置失败');
    }
  };

  /* ---------- 回收站操作 ---------- */

  /**
   * 加载回收站列表
   */
  const fetchRecycleTenants = async () => {
    try {
      setRecycleLoading(true);
      const res = await developerApi.getRecycleTenants({ page: recyclePage, pageSize: recyclePageSize });
      const body = res.data || res;
      setRecycleTenants(body.data || []);
      const pagination = body.pagination || {};
      setRecycleTotal(pagination.total || 0);
      setRecycleTotalPages(pagination.totalPages || 0);
    } catch (error) {
      console.error('加载回收站列表失败:', error);
      toast.error('加载回收站列表失败');
    } finally {
      setRecycleLoading(false);
    }
  };

  /**
   * 打开回收站弹窗
   */
  const handleOpenRecycleBin = () => {
    setShowRecycleBin(true);
    setRecyclePage(1);
  };

  /**
   * 恢复企业
   */
  const handleRestoreTenant = async (tenant: any) => {
    try {
      await developerApi.restoreTenant(tenant.id);
      toast.success(`已恢复企业「${tenant.name}」`);
      fetchRecycleTenants();
      fetchTenants();
    } catch (error: any) {
      toast.error(error.message || '恢复失败');
    }
  };

  /**
   * 永久删除企业
   */
  const handlePermanentDelete = (tenant: any) => {
    setConfirmMessage(`确定要永久删除企业「${tenant.name}」吗？此操作不可恢复！`);
    setConfirmAction(async () => {
      try {
        await developerApi.permanentDeleteTenant(tenant.id);
        toast.success(`已永久删除「${tenant.name}」`);
        fetchRecycleTenants();
      } catch (error: any) {
        toast.error(error.message || '删除失败');
      }
    });
    setShowConfirmDialog(true);
  };

  /**
   * 清空回收站
   */
  const handleClearRecycleBin = () => {
    setConfirmMessage('确定要清空回收站吗？所有已删除的企业将被永久删除，此操作不可恢复！');
    setConfirmAction(async () => {
      try {
        await developerApi.clearRecycleBin();
        toast.success('回收站已清空');
        setShowRecycleBin(false);
        fetchTenants();
      } catch (error: any) {
        toast.error(error.message || '清空回收站失败');
      }
    });
    setShowConfirmDialog(true);
  };

  /* ---------- 订阅状态映射 ---------- */

  /**
   * 根据订阅状态返回对应的标签类型
   * @param status - 订阅状态字符串
   */
  const getSubscriptionBadgeType = (status?: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    switch (status) {
      case 'active': return 'success';    /* 已订阅 - 绿色 */
      case 'trial': return 'warning';     /* 试用期 - 黄色 */
      case 'expired': return 'default';    /* 未订阅 - 灰色 */
      default: return 'default';          /* 未知 - 灰色 */
    }
  };

  /**
   * 订阅状态中文映射
   */
  const subscriptionStatusText: Record<string, string> = {
    active: '已订阅',
    trial: '试用期',
    expired: '未订阅',
  };

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">租户管理</h1>
          <p className="page-subtitle">管理所有注册企业（租户）</p>
        </div>
        {/* 新增租户按钮 */}
        <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          新增租户
        </button>
      </div>

      {/* ==========================================
       * 搜索筛选栏
       * ========================================== */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex items-center gap-4">
            {/* 搜索输入框 */}
            <div className="flex-1 max-w-md">
              <SearchInput
                value={keyword}
                onChange={setKeyword}
                onSearch={handleSearch}
                placeholder="搜索企业名称或企业代码..."
              />
            </div>
            {/* 结果统计 */}
            <span className="text-sm text-gray-400">
              共 {total} 条记录
            </span>
          </div>
        </div>
      </div>

      {/* ==========================================
       * 租户列表表格
       * ========================================== */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">企业名称</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">企业代码</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">联系人</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">电话</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">订阅状态</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">用户数</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">创建时间</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            {/* 表体 */}
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                /* 加载中骨架屏 */
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tenants.length === 0 ? (
                /* 无数据 */
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="暂无租户数据" description={'点击「新增租户」按钮创建第一个企业'} />
                  </td>
                </tr>
              ) : (
                /* 租户数据行 */
                tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    {/* 企业名称 */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {tenant.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{tenant.name}</span>
                      </div>
                    </td>
                    {/* 企业代码 */}
                    <td className="px-5 py-3 text-sm text-gray-600">{tenant.code}</td>
                    {/* 联系人 */}
                    <td className="px-5 py-3 text-sm text-gray-600">{tenant.contactName}</td>
                    {/* 电话 */}
                    <td className="px-5 py-3 text-sm text-gray-600">{tenant.contactPhone}</td>
                    {/* 订阅状态 */}
                    <td className="px-5 py-3">
                      <StatusBadge
                        status={subscriptionStatusText[tenant.subscriptionStatus || ''] || tenant.subscriptionStatus || '未知'}
                        type={getSubscriptionBadgeType(tenant.subscriptionStatus)}
                      />
                    </td>
                    {/* 用户数 */}
                    <td className="px-5 py-3 text-center">
                      <span className="text-sm text-gray-600">{tenant.userCount}</span>
                    </td>
                    {/* 创建时间 */}
                    <td className="px-5 py-3 text-sm text-gray-400">{formatDate(tenant.createdAt)}</td>
                    {/* 操作按钮 */}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* 查看详情 */}
                        <button
                          onClick={() => handleViewDetail(tenant)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="查看详情"
                        >
                          <Eye size={16} />
                        </button>
                        {/* 编辑 */}
                        <button
                          onClick={() => handleOpenEdit(tenant)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="编辑"
                        >
                          <Edit2 size={16} />
                        </button>
                        {/* 删除 */}
                        <button
                          onClick={() => handleDeleteTenant(tenant)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="删除企业"
                        >
                          <Trash2 size={16} />
                        </button>
                        {/* 进入企业 */}
                        <button
                          onClick={() => navigate(`/dev/tenants/${tenant.id}/view`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="进入企业视角"
                        >
                          <LogIn size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!loading && tenants.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100">
            <Pagination
              current={page}
              total={totalPages}
              pageSize={pageSize}
              totalRecords={total}
              onChange={setPage}
            />
          </div>
        )}
      </div>

      {/* ==========================================
       * 回收站按钮
       * ========================================== */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleOpenRecycleBin}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: '#8899AA', border: '1px solid #D6E4F0' }}
        >
          <Trash2 size={16} />
          回收站
          {recycleTotal > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full text-white bg-red-400">
              {recycleTotal}
            </span>
          )}
        </button>
      </div>

      {/* ==========================================
       * 新增/编辑租户弹窗
       * ========================================== */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingTenant ? '编辑租户' : '新增租户'}
        size="md"
        footer={
          <>
            <button onClick={() => setShowFormModal(false)} className="btn-secondary" disabled={formLoading}>
              取消
            </button>
            <button onClick={handleSubmitForm} className="btn-primary" disabled={formLoading}>
              {formLoading ? '提交中...' : editingTenant ? '保存修改' : '确认创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 企业名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              企业名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="请输入企业名称"
            />
          </div>
          {/* 企业代码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              企业代码 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="input"
              placeholder="请输入企业代码（唯一标识）"
              disabled={!!editingTenant}
            />
          </div>
          {/* 联系人姓名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              联系人 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              className="input"
              placeholder="请输入联系人姓名"
            />
          </div>
          {/* 联系电话 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              联系电话 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              className="input"
              placeholder="请输入联系电话"
            />
          </div>
          {/* 地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input"
              placeholder="请输入企业地址（选填）"
            />
          </div>
        </div>
      </Modal>

      {/* ==========================================
       * 租户详情弹窗（含用户列表）
       * ========================================== */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailTenant(null);
          setTenantUsers([]);
        }}
        title={detailTenant ? `企业详情 - ${detailTenant.name}` : '企业详情'}
        size="xl"
        footer={
          <>
            <button
              onClick={() => setShowCreateUser(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              创建用户
            </button>
            <button
              onClick={() => {
                setShowDetailModal(false);
                setDetailTenant(null);
                setTenantUsers([]);
              }}
              className="btn-secondary"
            >
              关闭
            </button>
          </>
        }
      >
        {/* 企业基本信息 */}
        {detailTenant && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">基本信息</h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <span className="text-xs text-gray-400">企业名称</span>
                <p className="text-sm font-medium text-gray-800">{detailTenant.name}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">企业代码</span>
                <p className="text-sm font-medium text-gray-800">{detailTenant.code}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">联系人</span>
                <p className="text-sm font-medium text-gray-800">{detailTenant.contactName}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">联系电话</span>
                <p className="text-sm font-medium text-gray-800">{detailTenant.contactPhone}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">订阅状态</span>
                <p className="mt-0.5">
                  <StatusBadge
                    status={subscriptionStatusText[detailTenant.subscriptionStatus || ''] || '未知'}
                    type={getSubscriptionBadgeType(detailTenant.subscriptionStatus)}
                  />
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-400">创建时间</span>
                <p className="text-sm font-medium text-gray-800">{formatDate(detailTenant.createdAt)}</p>
              </div>
            </div>
          </div>
        )}

        {/* 用户列表 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users size={16} />
            用户列表 ({tenantUsers.length})
          </h3>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-500">加载中...</span>
            </div>
          ) : tenantUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">暂无用户数据</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">用户名</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">姓名</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">角色</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">状态</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenantUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-700">{user.username}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{user.realName || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{user.role || '用户'}</td>
                      <td className="px-4 py-2">
                        <StatusBadge
                          status={user.status === 'active' ? '正常' : '停用'}
                          type={user.status === 'active' ? 'success' : 'danger'}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => setResetPasswordUserId(user.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="重置密码"
                        >
                          <KeyRound size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* ==========================================
       * 创建用户弹窗
       * ========================================== */}
      <Modal
        isOpen={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        title="创建用户"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowCreateUser(false)} className="btn-secondary" disabled={userFormLoading}>
              取消
            </button>
            <button onClick={handleCreateUser} className="btn-primary" disabled={userFormLoading}>
              {userFormLoading ? '创建中...' : '确认创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 用户名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={userForm.username}
              onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
              className="input"
              placeholder="请输入用户名"
            />
          </div>
          {/* 真实姓名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">真实姓名</label>
            <input
              type="text"
              value={userForm.realName}
              onChange={(e) => setUserForm({ ...userForm, realName: e.target.value })}
              className="input"
              placeholder="请输入真实姓名（选填）"
            />
          </div>
          {/* 密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="input"
              placeholder="请输入密码"
            />
          </div>
          {/* 角色 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              className="input"
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ==========================================
       * 重置密码弹窗
       * ========================================== */}
      <Modal
        isOpen={resetPasswordUserId !== null}
        onClose={() => {
          setResetPasswordUserId(null);
          setNewPassword('');
        }}
        title="重置密码"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setResetPasswordUserId(null);
                setNewPassword('');
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button onClick={handleResetPassword} className="btn-primary">
              确认重置
            </button>
          </>
        }
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            新密码 <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
            placeholder="请输入新密码"
          />
        </div>
      </Modal>

      {/* ==========================================
       * 回收站弹窗
       * ========================================== */}
      <Modal
        isOpen={showRecycleBin}
        onClose={() => { setShowRecycleBin(false); setRecycleTenants([]); }}
        title="回收站"
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={handleClearRecycleBin}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              disabled={recycleTenants.length === 0}
            >
              <AlertTriangle size={16} />
              清空回收站
            </button>
            <button
              onClick={() => { setShowRecycleBin(false); setRecycleTenants([]); }}
              className="btn-secondary"
            >
              关闭
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">企业名称</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">企业代码</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">联系人</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">删除时间</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recycleLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : recycleTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">回收站为空</td>
                </tr>
              ) : (
                recycleTenants.map((tenant: any) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-800">{tenant.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{tenant.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{tenant.contactName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {tenant.deletedAt ? formatDate(tenant.deletedAt) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleRestoreTenant(tenant)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                        >
                          <RotateCcw size={14} />
                          恢复
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(tenant)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                          永久删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!recycleLoading && recycleTotalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <Pagination
                current={recyclePage}
                total={recycleTotalPages}
                pageSize={recyclePageSize}
                totalRecords={recycleTotal}
                onChange={setRecyclePage}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* ==========================================
       * 确认弹窗
       * ========================================== */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => {
          confirmAction();
          setShowConfirmDialog(false);
        }}
        title="操作确认"
        message={confirmMessage || '确定要执行此操作吗？'}
        confirmText="确认"
        type="primary"
      />
    </div>
  );
};

export default Tenants;
