/**
 * 资料通工程管理系统 - 用户管理页面
 *
 * 功能说明：
 * 系统用户账号的完整管理页面，包括用户列表展示、搜索筛选、
 * 新增/编辑用户、重置密码、启用/停用用户等功能。
 *
 * 权限控制：
 * - 需要 canManageSystem 权限才能访问
 *
 * API 接口：
 * - tenantApi.getUsers()      获取用户列表（分页）
 * - tenantApi.createUser()    创建新用户
 * - tenantApi.updateUser()    更新用户信息
 * - tenantApi.toggleUser()    启用/禁用用户
 * - tenantApi.resetPassword() 重置用户密码
 * - tenantApi.getRoles()      获取角色列表（用于角色选择）
 * - tenantApi.getDepartments() 获取部门列表（用于项目部选择）
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCog,
  Plus,
  Edit2,
  Key,
  Power,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantApi } from '@/api';
import { useAuthStore } from '@/lib/AuthContext';
import Modal from '@/components/ui/Modal';
import {
  Pagination,
  EmptyState,
  ConfirmDialog,
  StatusBadge,
  SearchInput,
  formatDate,
} from '@/components/ui/Common';
import Loading from '@/components/ui/Loading';

/* ========================================
 * 类型定义
 * ======================================== */

/** 用户信息接口 */
interface UserInfo {
  id: number;                    /* 用户唯一标识 */
  username: string;              /* 用户名 */
  realName: string;              /* 真实姓名 */
  phone?: string;                /* 手机号码 */
  role: string;                  /* 角色名称 */
  roleName?: string;             /* 角色显示名称 */
  departmentId?: number;         /* 所属项目部 ID */
  departmentName?: string;       /* 所属项目部名称 */
  dataScope?: string;            /* 数据范围 */
  isActive: boolean;             /* 是否启用 */
  lastLoginAt?: string;          /* 最后登录时间 */
}

/** 角色信息接口 */
interface RoleInfo {
  id: number;                    /* 角色 ID */
  name: string;                  /* 角色标识 */
  displayName: string;           /* 角色显示名称 */
}

/** 部门信息接口 */
interface DepartmentInfo {
  id: number;                    /* 部门 ID */
  name: string;                  /* 部门名称 */
}

/** 用户表单数据接口（新增/编辑共用） */
interface UserFormData {
  username: string;              /* 用户名 */
  password: string;              /* 密码（仅新增时必填） */
  realName: string;              /* 真实姓名 */
  phone: string;                 /* 手机号码 */
  roleId: number | string;       /* 角色 ID */
  departmentId: number | string; /* 所属项目部 ID */
  dataScope: string;             /* 数据范围 */
}

/** 分页响应接口 */
interface PaginatedData {
  items: UserInfo[];             /* 用户列表 */
  total: number;                 /* 总条数 */
  page: number;                  /* 当前页码 */
  pageSize: number;              /* 每页条数 */
  totalPages: number;            /* 总页数 */
}

/* ========================================
 * 数据范围选项配置
 * ======================================== */
const DATA_SCOPE_OPTIONS = [
  { value: 'all', label: '全部数据' },       /* 可查看所有数据 */
  { value: 'department', label: '本部门数据' }, /* 仅可查看本部门数据 */
  { value: 'self', label: '仅本人数据' },     /* 仅可查看自己的数据 */
];

/* ========================================
 * 表单初始值
 * ======================================== */

/** 新增用户表单初始值 */
const EMPTY_FORM: UserFormData = {
  username: '',
  password: '',
  realName: '',
  phone: '',
  roleId: '',
  departmentId: '',
  dataScope: 'department',
};

/* ========================================
 * 用户管理页面主组件
 * ======================================== */
const AdminUsers: React.FC = () => {
  /* ---------- 权限检查 ---------- */
  const can = useAuthStore((s) => s.can);

  /* ---------- 列表状态 ---------- */
  const [users, setUsers] = useState<UserInfo[]>([]);       /* 用户列表数据 */
  const [loading, setLoading] = useState(false);             /* 列表加载状态 */
  const [page, setPage] = useState(1);                       /* 当前页码 */
  const [totalPages, setTotalPages] = useState(0);           /* 总页数 */
  const [totalRecords, setTotalRecords] = useState(0);       /* 总记录数 */
  const [keyword, setKeyword] = useState('');                /* 搜索关键词 */

  /* ---------- 弹窗状态 ---------- */
  const [showFormModal, setShowFormModal] = useState(false); /* 新增/编辑弹窗 */
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null); /* 当前编辑的用户（null 为新增模式） */
  const [formLoading, setFormLoading] = useState(false);     /* 表单提交加载状态 */
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM); /* 表单数据 */

  /* ---------- 重置密码弹窗状态 ---------- */
  const [showResetPwd, setShowResetPwd] = useState(false);   /* 重置密码确认弹窗 */
  const [resetTarget, setResetTarget] = useState<UserInfo | null>(null); /* 重置密码目标用户 */
  const [newPassword, setNewPassword] = useState('');         /* 新密码输入 */
  const [resetLoading, setResetLoading] = useState(false);   /* 重置密码加载状态 */

  /* ---------- 启用/停用确认弹窗状态 ---------- */
  const [showToggle, setShowToggle] = useState(false);       /* 启用/停用确认弹窗 */
  const [toggleTarget, setToggleTarget] = useState<UserInfo | null>(null); /* 目标用户 */
  const [toggleLoading, setToggleLoading] = useState(false); /* 启用/停用加载状态 */

  /* ---------- 下拉选项数据 ---------- */
  const [roles, setRoles] = useState<RoleInfo[]>([]);         /* 角色列表 */
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]); /* 部门列表 */

  /* ========================================
   * 数据加载
   * ======================================== */

  /**
   * 加载用户列表
   * 根据当前页码和搜索关键词请求后端数据
   */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantApi.getUsers({
        page,
        pageSize: 20,
        search: keyword || undefined,
      });
      const body: any = res.data;
      const rawUsers = body.data || [];
      // 后端返回的 role 是完整对象 { id, name, displayName }，需展平为字符串
      const mapped = rawUsers.map((u: any) => ({
        ...u,
        realName: u.name || u.realName || '',
        role: u.role?.id || u.role || '',
        roleName: u.role?.displayName || u.roleName || '',
        departmentName: u.department?.name || u.departmentName || '',
      }));
      setUsers(mapped);
      setTotalPages(body.pagination?.totalPages || 0);
      setTotalRecords(body.pagination?.total || 0);
    } catch (error: any) {
      toast.error(error.message || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  /**
   * 加载角色列表和部门列表
   * 用于表单中的下拉选择
   */
  const fetchOptions = useCallback(async () => {
    try {
      /* 并行请求角色列表和部门列表 */
      const [rolesRes, deptsRes] = await Promise.all([
        tenantApi.getRoles(),
        tenantApi.getDepartments(),
      ]);
      setRoles((rolesRes.data as any)?.data || []);
      setDepartments((deptsRes.data as any)?.data || []);
    } catch (error: any) {
      console.error('加载选项数据失败:', error);
    }
  }, []);

  /* 页面初始化和依赖变化时重新加载数据 */
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  /* ========================================
   * 搜索处理
   * ======================================== */

  /**
   * 执行搜索
   * 重置页码到第一页，然后触发数据加载
   */
  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1); /* 搜索时重置到第一页 */
  };

  /* ========================================
   * 新增用户
   * ======================================== */

  /**
   * 打开新增用户弹窗
   * 重置表单数据到初始值
   */
  const handleAdd = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setShowFormModal(true);
  };

  /* ========================================
   * 编辑用户
   * ======================================== */

  /**
   * 打开编辑用户弹窗
   * 将当前用户数据填充到表单中
   * 注意：编辑模式下用户名字段不可修改
   *
   * @param user - 要编辑的用户信息
   */
  const handleEdit = (user: UserInfo) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',              /* 编辑时不显示原密码 */
      realName: user.realName,
      phone: user.phone || '',
      roleId: user.role || '',
      departmentId: user.departmentId || '',
      dataScope: user.dataScope || 'department',
    });
    setShowFormModal(true);
  };

  /* ========================================
   * 表单提交（新增/编辑）
   * ======================================== */

  /**
   * 提交用户表单
   * 根据当前模式（新增/编辑）调用不同的 API
   */
  const handleSubmit = async () => {
    /* 表单校验 */
    if (!formData.username.trim()) {
      toast.error('请输入用户名');
      return;
    }
    if (!editingUser && !formData.password.trim()) {
      toast.error('请输入密码');
      return;
    }
    if (!formData.realName.trim()) {
      toast.error('请输入姓名');
      return;
    }

    setFormLoading(true);
    try {
      if (editingUser) {
        /* 编辑模式：更新用户信息（不传密码字段表示不修改密码） */
        const updateData: any = {
          realName: formData.realName,
          phone: formData.phone || undefined,
          roleId: formData.roleId || undefined,
          departmentId: formData.departmentId || undefined,
          dataScope: formData.dataScope,
        };
        await tenantApi.updateUser(editingUser.id, updateData);
        toast.success('用户信息已更新');
      } else {
        /* 新增模式：创建新用户 */
        await tenantApi.createUser({
          username: formData.username,
          password: formData.password,
          realName: formData.realName,
          phone: formData.phone || undefined,
          roleId: formData.roleId || undefined,
          departmentId: formData.departmentId || undefined,
          dataScope: formData.dataScope,
        });
        toast.success('用户创建成功');
      }
      setShowFormModal(false);
      fetchUsers(); /* 刷新列表 */
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /* ========================================
   * 重置密码
   * ======================================== */

  /**
   * 打开重置密码确认弹窗
   *
   * @param user - 目标用户
   */
  const handleResetPwd = (user: UserInfo) => {
    setResetTarget(user);
    setNewPassword('');
    setShowResetPwd(true);
  };

  /**
   * 确认重置密码
   * 调用 API 将用户密码重置为指定的新密码
   */
  const confirmResetPwd = async () => {
    if (!newPassword.trim()) {
      toast.error('请输入新密码');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('密码长度不能少于6位');
      return;
    }
    if (!resetTarget) return;

    setResetLoading(true);
    try {
      await tenantApi.resetPassword(resetTarget.id, { newPassword });
      toast.success(`已重置用户 "${resetTarget.realName || resetTarget.username}" 的密码`);
      setShowResetPwd(false);
    } catch (error: any) {
      toast.error(error.message || '重置密码失败');
    } finally {
      setResetLoading(false);
    }
  };

  /* ========================================
   * 启用/停用用户
   * ======================================== */

  /**
   * 打启用/停用确认弹窗
   *
   * @param user - 目标用户
   */
  const handleToggle = (user: UserInfo) => {
    setToggleTarget(user);
    setShowToggle(true);
  };

  /**
   * 确认启用/停用用户
   */
  const confirmToggle = async () => {
    if (!toggleTarget) return;

    setToggleLoading(true);
    try {
      await tenantApi.toggleUser(toggleTarget.id);
      const action = toggleTarget.isActive ? '停用' : '启用';
      toast.success(`已${action}用户 "${toggleTarget.realName || toggleTarget.username}"`);
      setShowToggle(false);
      fetchUsers(); /* 刷新列表 */
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setToggleLoading(false);
    }
  };

  /* ========================================
   * 表单字段变更处理
   * ======================================== */

  /**
   * 通用表单字段更新
   *
   * @param field - 字段名称
   * @param value - 字段值
   */
  const updateFormField = (field: keyof UserFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /* ========================================
   * 权限检查 - 无权限时显示提示
   * ======================================== */
  if (!can('canManageSystem')) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">用户管理</h1>
            <p className="page-subtitle">系统用户账号管理</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center py-16">
            <UserCog size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">无访问权限</h3>
            <p className="text-sm text-gray-400">您没有系统管理权限，无法访问此页面</p>
          </div>
        </div>
      </div>
    );
  }

  /* ========================================
   * 页面渲染
   * ======================================== */
  return (
    <div>
      {/* ====== 页面标题区域 ====== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">用户管理</h1>
          <p className="page-subtitle">管理系统用户账号、角色分配与权限控制</p>
        </div>
        {/* 新增用户按钮 */}
        <button onClick={handleAdd} className="btn-primary">
          <Plus size={16} className="mr-1.5" />
          新增用户
        </button>
      </div>

      {/* ====== 搜索筛选栏 ====== */}
      <div className="filter-bar">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
            placeholder="搜索用户名或姓名..."
          />
        </div>
      </div>

      {/* ====== 用户列表卡片 ====== */}
      <div className="card">
        <div className="table-container">
          {loading ? (
            /* 加载状态 */
            <Loading text="加载用户列表..." />
          ) : users.length === 0 ? (
            /* 空状态 */
            <EmptyState
              title="暂无用户数据"
              description={keyword ? `未找到与"${keyword}"匹配的用户` : '点击"新增用户"按钮创建第一个用户'}
              icon={<UserCog size={48} />}
            />
          ) : (
            /* 数据表格 */
            <table className="table">
              {/* 表头 - 蓝色主题背景 */}
              <thead
                className="text-xs uppercase text-white border-b border-blue-700"
                style={{ backgroundColor: '#0066CC' }}
              >
                <tr>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">用户名</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">姓名</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">角色</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">所属项目部</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">数据范围</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">状态</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">最后登录</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap text-right">操作</th>
                </tr>
              </thead>

              {/* 表体 - 斑马纹 */}
              <tbody className="divide-y divide-gray-100">
                {users.map((user, index) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-gray-50 transition-colors duration-150 ${
                      index % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'
                    }`}
                  >
                    {/* 用户名 */}
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">
                      {user.username}
                    </td>
                    {/* 姓名 */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {user.realName || '-'}
                    </td>
                    {/* 角色 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge
                        status={user.roleName || user.role || '-'}
                        type="info"
                      />
                    </td>
                    {/* 所属项目部 */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {user.departmentName || '-'}
                    </td>
                    {/* 数据范围 */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {DATA_SCOPE_OPTIONS.find((s) => s.value === user.dataScope)?.label || user.dataScope || '-'}
                    </td>
                    {/* 状态标签 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge
                        status={user.isActive ? '启用' : '停用'}
                        type={user.isActive ? 'success' : 'danger'}
                      />
                    </td>
                    {/* 最后登录时间 */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt, 'YYYY-MM-DD HH:mm') : '-'}
                    </td>
                    {/* 操作按钮列 */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* 编辑按钮 */}
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="编辑用户"
                        >
                          <Edit2 size={15} />
                        </button>
                        {/* 重置密码按钮 */}
                        <button
                          onClick={() => handleResetPwd(user)}
                          className="p-1.5 rounded text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                          title="重置密码"
                        >
                          <Key size={15} />
                        </button>
                        {/* 启用/停用按钮 */}
                        <button
                          onClick={() => handleToggle(user)}
                          className={`p-1.5 rounded transition-colors ${
                            user.isActive
                              ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={user.isActive ? '停用用户' : '启用用户'}
                        >
                          <Power size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 分页区域 */}
        {!loading && users.length > 0 && (
          <div className="table-footer">
            <Pagination
              current={page}
              total={totalPages}
              pageSize={20}
              totalRecords={totalRecords}
              onChange={setPage}
            />
          </div>
        )}
      </div>

      {/* ====== 新增/编辑用户弹窗 ====== */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingUser ? '编辑用户' : '新增用户'}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowFormModal(false)} className="btn-secondary" disabled={formLoading}>
              取消
            </button>
            <button onClick={handleSubmit} className="btn-primary" disabled={formLoading}>
              {formLoading ? '提交中...' : editingUser ? '保存修改' : '创建用户'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 用户名 - 编辑模式下禁用 */}
          <div>
            <label className="form-label">
              用户名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="请输入用户名"
              value={formData.username}
              onChange={(e) => updateFormField('username', e.target.value)}
              disabled={!!editingUser} /* 编辑模式下不可修改用户名 */
            />
            {editingUser && (
              <p className="text-xs text-gray-400 mt-1">用户名创建后不可修改</p>
            )}
          </div>

          {/* 密码 - 仅新增时显示 */}
          {!editingUser && (
            <div>
              <label className="form-label">
                密码 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                className="input"
                placeholder="请输入密码（至少6位）"
                value={formData.password}
                onChange={(e) => updateFormField('password', e.target.value)}
              />
            </div>
          )}

          {/* 姓名 */}
          <div>
            <label className="form-label">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="请输入真实姓名"
              value={formData.realName}
              onChange={(e) => updateFormField('realName', e.target.value)}
            />
          </div>

          {/* 手机号 */}
          <div>
            <label className="form-label">手机号</label>
            <input
              type="text"
              className="input"
              placeholder="请输入手机号码"
              value={formData.phone}
              onChange={(e) => updateFormField('phone', e.target.value)}
            />
          </div>

          {/* 角色选择 */}
          <div>
            <label className="form-label">角色</label>
            <select
              className="select"
              value={formData.roleId}
              onChange={(e) => updateFormField('roleId', e.target.value)}
            >
              <option value="">请选择角色</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.displayName || role.name}
                </option>
              ))}
            </select>
          </div>

          {/* 所属项目部选择 */}
          <div>
            <label className="form-label">所属项目部</label>
            <select
              className="select"
              value={formData.departmentId}
              onChange={(e) => updateFormField('departmentId', e.target.value)}
            >
              <option value="">请选择项目部</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* 数据范围选择 */}
          <div>
            <label className="form-label">数据范围</label>
            <select
              className="select"
              value={formData.dataScope}
              onChange={(e) => updateFormField('dataScope', e.target.value)}
            >
              {DATA_SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* ====== 重置密码弹窗 ====== */}
      <Modal
        isOpen={showResetPwd}
        onClose={() => setShowResetPwd(false)}
        title="重置密码"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowResetPwd(false)} className="btn-secondary" disabled={resetLoading}>
              取消
            </button>
            <button onClick={confirmResetPwd} className="btn-primary" disabled={resetLoading}>
              {resetLoading ? '重置中...' : '确认重置'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 提示信息 */}
          <p className="text-sm text-gray-600">
            确定要重置用户 <strong className="text-gray-800">{resetTarget?.realName || resetTarget?.username}</strong> 的密码吗？
          </p>
          {/* 新密码输入 */}
          <div>
            <label className="form-label">
              新密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              className="input"
              placeholder="请输入新密码（至少6位）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ====== 启用/停用确认弹窗 ====== */}
      <ConfirmDialog
        isOpen={showToggle}
        onClose={() => setShowToggle(false)}
        onConfirm={confirmToggle}
        title={toggleTarget?.isActive ? '停用用户' : '启用用户'}
        message={
          toggleTarget?.isActive
            ? `确定要停用用户 "${toggleTarget?.realName || toggleTarget?.username}" 吗？停用后该用户将无法登录系统。`
            : `确定要启用用户 "${toggleTarget?.realName || toggleTarget?.username}" 吗？`
        }
        confirmText={toggleTarget?.isActive ? '确认停用' : '确认启用'}
        type={toggleTarget?.isActive ? 'danger' : 'primary'}
        loading={toggleLoading}
      />
    </div>
  );
};

export default AdminUsers;
