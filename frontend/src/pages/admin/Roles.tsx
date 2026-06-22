/**
 * 资料通工程管理系统 - 角色权限管理页面
 *
 * 功能说明：
 * 系统角色与权限的配置管理页面，采用卡片式布局展示所有角色。
 * 点击角色卡片可展开权限编辑面板，通过复选框配置该角色的权限。
 *
 * 权限分组：
 * - 通用权限：查看看板、系统管理、操作日志、数据导出
 * - 物资管理：查看库存、入库、出库、退库、调拨、查看记录、班组台账
 * - 劳资管理：人员管理、考勤管理、工资核算、工资发放、风控管理、报表导出
 * - 合同与项目部：合同管理、项目部管理
 *
 * 权限控制：
 * - 需要 canManageSystem 权限才能访问
 *
 * API 接口：
 * - tenantApi.getRoles()              获取所有角色及其权限配置
 * - tenantApi.updateRolePermissions() 更新指定角色的权限列表
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Shield,
  ChevronDown,
  ChevronRight,
  Users,
  Save,
  Loader2,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantApi } from '@/api';
import { useAuthStore } from '@/lib/AuthContext';
import { EmptyState, ConfirmDialog } from '@/components/ui/Common';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';

/* ========================================
 * 类型定义
 * ======================================== */

/** 角色信息接口 */
interface RoleInfo {
  id: number;                    /* 角色 ID */
  name: string;                  /* 角色标识（英文） */
  displayName: string;           /* 角色显示名称（中文） */
  description?: string;          /* 角色描述 */
  permissions?: string[];        /* 当前角色拥有的权限列表 */
  userCount?: number;            /* 关联用户数量 */
}

/** 权限分组接口 */
interface PermissionGroup {
  /** 分组名称 */
  label: string;
  /** 分组图标颜色 */
  color: string;
  /** 分组背景色 */
  bgColor: string;
  /** 该分组下的权限项列表 */
  permissions: PermissionItem[];
}

/** 单个权限项接口 */
interface PermissionItem {
  /** 权限标识符（如 'dashboard:view'） */
  key: string;
  /** 权限显示名称 */
  label: string;
}

/* ========================================
 * 权限分组配置
 * 定义系统中所有可配置的权限项及其分组
 * ======================================== */
const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: '通用权限',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    permissions: [
      { key: 'dashboard:view', label: '查看看板' },
      { key: 'canManageSystem', label: '系统管理' },
      { key: 'logs:view', label: '操作日志' },
      { key: 'data:export', label: '数据导出' },
    ],
  },
  {
    label: '物资管理',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    permissions: [
      { key: 'wms:inventory:view', label: '查看库存' },
      { key: 'wms:inbound', label: '入库' },
      { key: 'wms:outbound', label: '出库' },
      { key: 'wms:return', label: '退库' },
      { key: 'wms:transfer', label: '调拨' },
      { key: 'wms:records:view', label: '查看记录' },
      { key: 'wms:ledger:view', label: '班组台账' },
    ],
  },
  {
    label: '劳资管理',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    permissions: [
      { key: 'labor:personnel', label: '人员管理' },
      { key: 'labor:attendance', label: '考勤管理' },
      { key: 'labor:salary:calculate', label: '工资核算' },
      { key: 'labor:salary:pay', label: '工资发放' },
      { key: 'labor:risk', label: '风控管理' },
      { key: 'labor:report:export', label: '报表导出' },
    ],
  },
  {
    label: '合同与项目部',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    permissions: [
      { key: 'contract:manage', label: '合同管理' },
      { key: 'department:manage', label: '项目部管理' },
    ],
  },
];

/* ========================================
 * 角色权限管理页面主组件
 * ======================================== */
const AdminRoles: React.FC = () => {
  /* ---------- 权限检查 ---------- */
  const can = useAuthStore((s) => s.can);

  /* ---------- 数据状态 ---------- */
  const [roles, setRoles] = useState<RoleInfo[]>([]);         /* 角色列表 */
  const [loading, setLoading] = useState(false);               /* 列表加载状态 */

  /* ---------- 展开状态 ---------- */
  const [expandedRoleId, setExpandedRoleId] = useState<number | null>(null); /* 当前展开的角色 ID */

  /* ---------- 权限编辑状态 ---------- */
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]); /* 当前编辑中的权限列表 */
  const [saving, setSaving] = useState(false);               /* 保存加载状态 */

  /* ---------- 角色 CRUD 状态 ---------- */
  const [showRoleModal, setShowRoleModal] = useState(false);   /* 新增/编辑角色弹窗 */
  const [editingRole, setEditingRole] = useState<RoleInfo | null>(null); /* 当前编辑的角色（null 为新增） */
  const [roleForm, setRoleForm] = useState({ name: '', displayName: '', description: '' }); /* 角色表单 */
  const [roleFormLoading, setRoleFormLoading] = useState(false); /* 角色表单提交状态 */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); /* 删除确认弹窗 */
  const [deletingRole, setDeletingRole] = useState<RoleInfo | null>(null); /* 待删除角色 */
  const [deleteLoading, setDeleteLoading] = useState(false);   /* 删除提交状态 */

  /* ========================================
   * 数据加载
   * ======================================== */

  /**
   * 加载角色列表
   * 从后端获取所有角色及其权限配置
   */
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantApi.getRoles();
      const data = (res.data as any)?.data || [];
      const list = Array.isArray(data) ? data : [];
      setRoles(list.map((r: any) => ({ ...r, userCount: r._count?.users ?? r.userCount ?? 0 })));
    } catch (error: any) {
      toast.error(error.message || '获取角色列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  /* 页面初始化时加载数据 */
  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  /* ========================================
   * 展开/收起角色卡片
   * ======================================== */

  /**
   * 切换角色卡片的展开/收起状态
   * 展开时加载该角色的当前权限配置
   *
   * @param role - 要展开/收起的角色
   */
  const handleToggleExpand = (role: RoleInfo) => {
    if (expandedRoleId === role.id) {
      /* 收起当前展开的角色 */
      setExpandedRoleId(null);
      setEditingPermissions([]);
    } else {
      /* 展开新角色，初始化权限编辑状态 */
      setExpandedRoleId(role.id);
      setEditingPermissions(role.permissions || []);
    }
  };

  /* ========================================
   * 权限复选框操作
   * ======================================== */

  /**
   * 切换单个权限的选中状态
   *
   * @param permissionKey - 权限标识符
   */
  const handleTogglePermission = (permissionKey: string) => {
    setEditingPermissions((prev) => {
      if (prev.includes(permissionKey)) {
        /* 取消选中：从列表中移除 */
        return prev.filter((p) => p !== permissionKey);
      } else {
        /* 选中：添加到列表 */
        return [...prev, permissionKey];
      }
    });
  };

  /**
   * 切换整个权限分组的全选/取消全选
   *
   * @param group - 权限分组
   */
  const handleToggleGroup = (group: PermissionGroup) => {
    const groupKeys = group.permissions.map((p) => p.key);
    const allSelected = groupKeys.every((key) => editingPermissions.includes(key));

    if (allSelected) {
      /* 当前分组已全选，取消全选 */
      setEditingPermissions((prev) => prev.filter((p) => !groupKeys.includes(p)));
    } else {
      /* 当前分组未全选，全选该分组 */
      const newPermissions = new Set([...editingPermissions, ...groupKeys]);
      setEditingPermissions(Array.from(newPermissions));
    }
  };

  /**
   * 检查权限分组是否全选
   *
   * @param group - 权限分组
   * @returns 是否全选
   */
  const isGroupAllSelected = (group: PermissionGroup): boolean => {
    return group.permissions.every((p) => editingPermissions.includes(p.key));
  };

  /**
   * 检查权限分组是否部分选中
   *
   * @param group - 权限分组
   * @returns 是否部分选中（非全选且至少选中一个）
   */
  const isGroupPartialSelected = (group: PermissionGroup): boolean => {
    const selectedCount = group.permissions.filter((p) => editingPermissions.includes(p.key)).length;
    return selectedCount > 0 && selectedCount < group.permissions.length;
  };

  /* ========================================
   * 保存权限
   * ======================================== */

  /**
   * 保存当前编辑的权限配置
   * 调用 API 更新指定角色的权限列表
   */
  const handleSavePermissions = async () => {
    if (!expandedRoleId) return;

    setSaving(true);
    try {
      await tenantApi.updateRolePermissions(expandedRoleId, {
        permissions: editingPermissions,
      });

      /* 更新本地角色数据 */
      setRoles((prev) =>
        prev.map((role) =>
          role.id === expandedRoleId
            ? { ...role, permissions: [...editingPermissions] }
            : role
        )
      );

      toast.success('权限配置已保存');
    } catch (error: any) {
      toast.error(error.message || '保存权限失败');
    } finally {
      setSaving(false);
    }
  };

  /* ========================================
   * 角色 CRUD 操作
   * ======================================== */

  const handleOpenCreate = () => {
    setEditingRole(null);
    setRoleForm({ name: '', displayName: '', description: '' });
    setShowRoleModal(true);
  };

  const handleOpenEdit = (role: RoleInfo, e: React.MouseEvent) => {
    e.stopPropagation(); /* 阻止触发展开 */
    setEditingRole(role);
    setRoleForm({ name: role.name, displayName: role.displayName, description: role.description || '' });
    setShowRoleModal(true);
  };

  const handleRoleSubmit = async () => {
    if (!roleForm.name.trim()) { toast.error('请输入角色标识'); return; }
    if (!roleForm.displayName.trim()) { toast.error('请输入角色显示名称'); return; }
    setRoleFormLoading(true);
    try {
      if (editingRole) {
        const res = await tenantApi.updateRole(editingRole.id, {
          name: roleForm.name.trim(),
          displayName: roleForm.displayName.trim(),
          description: roleForm.description.trim() || undefined,
        });
        const updated = (res.data as any)?.data;
        setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, ...updated } : r));
        toast.success('角色已更新');
      } else {
        const res = await tenantApi.createRole({
          name: roleForm.name.trim(),
          displayName: roleForm.displayName.trim(),
          description: roleForm.description.trim() || undefined,
        });
        const created = (res.data as any)?.data;
        setRoles(prev => [...prev, created]);
        toast.success('角色已创建');
      }
      setShowRoleModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || '操作失败');
    } finally { setRoleFormLoading(false); }
  };

  const handleOpenDelete = (role: RoleInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingRole(role);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteRole = async () => {
    if (!deletingRole) return;
    setDeleteLoading(true);
    try {
      await tenantApi.deleteRole(deletingRole.id);
      setRoles(prev => prev.filter(r => r.id !== deletingRole.id));
      if (expandedRoleId === deletingRole.id) { setExpandedRoleId(null); setEditingPermissions([]); }
      toast.success(`已删除角色「${deletingRole.displayName || deletingRole.name}」`);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
    } finally { setDeleteLoading(false); }
  };

  /* ========================================
   * 权限检查 - 无权限时显示提示
   * ======================================== */
  if (!can('canManageSystem')) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">角色权限</h1>
            <p className="page-subtitle">系统角色与权限配置</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center py-16">
            <Key size={48} className="text-gray-300 mx-auto mb-4" />
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
          <h1 className="page-title">角色权限</h1>
          <p className="page-subtitle">管理系统角色与权限配置，控制各角色的功能访问范围</p>
        </div>
        <button onClick={handleOpenCreate} className="btn-primary">
          <Plus size={16} className="mr-1.5" />新增角色
        </button>
      </div>

      {/* ====== 角色列表区域 ====== */}
      {loading ? (
        /* 加载状态 */
        <Loading text="加载角色列表..." />
      ) : roles.length === 0 ? (
        /* 空状态 */
        <div className="card">
          <EmptyState
            title="暂无角色数据"
            description="系统尚未配置任何角色，请联系管理员创建角色"
            icon={<Key size={48} />}
          />
        </div>
      ) : (
        /* 角色卡片列表 */
        <div className="space-y-4">
          {roles.map((role) => {
            /* 判断当前角色是否展开 */
            const isExpanded = expandedRoleId === role.id;

            return (
              <div key={role.id} className="card overflow-hidden">
                {/* ====== 角色卡片头部（可点击展开） ====== */}
                <div
                  onClick={() => handleToggleExpand(role)}
                  className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                >
                  {/* 左侧：角色信息 */}
                  <div className="flex items-center gap-4">
                    {/* 角色图标 */}
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-lg"
                      style={{ backgroundColor: '#0066CC' }}
                    >
                      <Shield size={20} className="text-white" />
                    </div>

                    {/* 角色名称和描述 */}
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">
                        {role.displayName || role.name}
                      </h3>
                      {role.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{role.description}</p>
                      )}
                    </div>
                  </div>

                  {/* 右侧：关联用户数、操作按钮和展开箭头 */}
                  <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    {/* 关联用户数标签 */}
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Users size={14} />
                      <span>{role.userCount ?? 0} 个用户</span>
                    </div>

                    {/* 已选权限数量 */}
                    <div className="text-xs text-gray-400">
                      {role.permissions?.length || 0} 项权限
                    </div>

                    {/* 编辑按钮 */}
                    <button onClick={(e) => handleOpenEdit(role, e)}
                      className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="编辑角色">
                      <Edit2 size={14} />
                    </button>

                    {/* 删除按钮 */}
                    <button onClick={(e) => handleOpenDelete(role, e)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="删除角色">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* 展开/收起箭头（独立点击区域） */}
                  <div className="ml-3">
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={18} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* ====== 权限编辑面板（展开时显示） ====== */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50/50">
                    {/* 权限编辑区域 */}
                    <div className="px-6 py-5">
                      {/* 权限分组列表 */}
                      <div className="space-y-5">
                        {PERMISSION_GROUPS.map((group) => (
                          <div key={group.label} className="bg-white rounded-lg border border-gray-200 p-4">
                            {/* 分组标题行（含全选复选框） */}
                            <div className="flex items-center justify-between mb-3">
                              {/* 分组名称 */}
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${group.color}`}>
                                  {group.label}
                                </span>
                                <span className="text-xs text-gray-400">
                                  ({group.permissions.filter((p) => editingPermissions.includes(p.key)).length}/{group.permissions.length})
                                </span>
                              </div>

                              {/* 全选/取消全选复选框 */}
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isGroupAllSelected(group)}
                                  /* 部分选中时显示为 indeterminate 状态 */
                                  ref={(el) => {
                                    if (el) el.indeterminate = isGroupPartialSelected(group);
                                  }}
                                  onChange={() => handleToggleGroup(group)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-xs text-gray-500">全选</span>
                              </label>
                            </div>

                            {/* 权限复选框列表 */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {group.permissions.map((perm) => {
                                /* 判断当前权限是否选中 */
                                const isChecked = editingPermissions.includes(perm.key);

                                return (
                                  <label
                                    key={perm.key}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-colors duration-150 ${
                                      isChecked
                                        ? 'border-blue-300 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    {/* 权限复选框 */}
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleTogglePermission(perm.key)}
                                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    {/* 权限名称 */}
                                    <span className={`text-sm ${isChecked ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                                      {perm.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 保存按钮区域 */}
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-200">
                        {/* 左侧：已选权限总数统计 */}
                        <p className="text-sm text-gray-500">
                          已选择 <strong className="text-gray-700">{editingPermissions.length}</strong> 项权限
                        </p>

                        {/* 右侧：保存按钮 */}
                        <button
                          onClick={handleSavePermissions}
                          className="btn-primary"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader2 size={16} className="mr-1.5 animate-spin" />
                              保存中...
                            </>
                          ) : (
                            <>
                              <Save size={16} className="mr-1.5" />
                              保存权限
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ====== 新增/编辑角色弹窗 ====== */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={editingRole ? '编辑角色' : '新增角色'}
        size="md"
        footer={
          <>
            <button onClick={() => setShowRoleModal(false)} className="btn-secondary" disabled={roleFormLoading}>取消</button>
            <button onClick={handleRoleSubmit} className="btn-primary" disabled={roleFormLoading}>
              {roleFormLoading ? '提交中...' : editingRole ? '保存修改' : '创建角色'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">角色标识 <span className="text-red-500">*</span></label>
            <input className="input" placeholder="英文标识，如 admin、operator"
              value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
              disabled={!!editingRole} />
            {editingRole && <p className="text-xs text-gray-400 mt-1">角色标识创建后不可修改</p>}
            {!editingRole && <p className="text-xs text-gray-400 mt-1">仅支持字母、数字和下划线</p>}
          </div>
          <div>
            <label className="form-label">显示名称 <span className="text-red-500">*</span></label>
            <input className="input" placeholder="中文显示名称，如 系统管理员"
              value={roleForm.displayName} onChange={e => setRoleForm(f => ({ ...f, displayName: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">角色描述</label>
            <textarea className="textarea" placeholder="可选的角色描述" rows={3}
              value={roleForm.description} onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* ====== 删除角色确认弹窗 ====== */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteRole}
        title="删除角色"
        message={`确定要删除角色「${deletingRole?.displayName || deletingRole?.name}」吗？如果该角色下有关联用户，将无法删除。`}
        confirmText="确认删除"
        type="danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default AdminRoles;
