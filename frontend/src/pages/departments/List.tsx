/**
 * 资料通工程管理系统 - 项目部管理列表页面
 *
 * 功能说明：
 * 项目部的完整管理页面，包括项目部的增删改查、子项目管理、成员管理等功能。
 *
 * 主要功能：
 * 1. 项目部列表展示（表格形式，含斑马纹和分页）
 * 2. 搜索筛选（按名称/编号搜索）
 * 3. 新增项目部（弹窗表单）
 * 4. 编辑项目部（弹窗表单，回填数据）
 * 5. 查看项目部详情（含子项目列表和成员列表）
 * 6. 新增子项目（弹窗表单）
 * 7. 编辑子项目（弹窗表单，回填数据）
 * 8. 添加成员（弹窗，选择用户分配到项目部）
 * 9. 移除成员（二次确认）
 * 10. 启用/停用项目部
 * 11. 分页导航
 *
 * 权限控制：
 * - department:create - 显示新增按钮
 * - department:edit - 显示编辑按钮
 * - department:delete - 显示停用按钮
 * - department:view - 显示查看详情按钮
 */

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Eye,
  Edit2,
  Trash2,
  Power,
  Building2,
  FolderTree,
  Users,
  UserPlus,
  UserMinus,
  Loader2,
} from 'lucide-react';

/* 导入 API 接口 */
import { departmentApi, contractApi, tenantApi } from '@/api';
import type { PaginatedResponse } from '@/api';

/* 导入通用组件 */
import Modal from '@/components/ui/Modal';
import {
  Pagination,
  EmptyState,
  ConfirmDialog,
  StatusBadge,
  SearchInput,
  formatDate,
} from '@/components/ui/Common';

/* 导入认证 Store（权限控制） */
import { useAuthStore } from '@/lib/AuthContext';

/* ========================================
 * 类型定义
 * ======================================== */

/** 项目部信息接口 */
interface Department {
  id: number;                    /* 项目部唯一标识 */
  name: string;                  /* 项目部名称 */
  code: string;                  /* 项目部编号 */
  contractId?: number;           /* 所属合同 ID */
  contractName?: string;         /* 所属合同名称 */
  description?: string;          /* 项目部描述 */
  status: string;                /* 状态：active(启用) / inactive(停用) */
  subProjectCount?: number;      /* 子项目数量 */
  memberCount?: number;          /* 成员数量 */
  createdAt: string;             /* 创建时间 */
  updatedAt?: string;            /* 更新时间 */
}

/** 子项目信息接口 */
interface SubProject {
  id: number;                    /* 子项目唯一标识 */
  departmentId: number;          /* 所属项目部 ID */
  name: string;                  /* 子项目名称 */
  code?: string;                 /* 子项目编号 */
  description?: string;          /* 子项目描述 */
  status?: string;               /* 状态 */
  createdAt: string;             /* 创建时间 */
}

/** 项目成员信息接口 */
interface Member {
  id: number;                    /* 成员记录 ID */
  userId: number;                /* 用户 ID */
  username: string;              /* 用户名 */
  realName?: string;             /* 真实姓名 */
  role?: string;                 /* 系统角色 */
  joinedAt?: string;             /* 加入时间 */
}

/** 合同简要信息接口（用于下拉选择） */
interface ContractOption {
  id: number;                    /* 合同 ID */
  name: string;                  /* 合同名称 */
  code: string;                  /* 合同编号 */
}

/** 用户简要信息接口（用于添加成员选择） */
interface UserOption {
  id: number;                    /* 用户 ID */
  username: string;              /* 用户名 */
  realName?: string;             /* 真实姓名 */
}

/** 项目部表单数据接口 */
interface DepartmentFormData {
  name: string;                  /* 项目部名称 */
  code: string;                  /* 项目部编号 */
  contractId: string;            /* 所属合同 ID（字符串，方便表单处理） */
  description: string;           /* 描述 */
}

/** 子项目表单数据接口 */
interface SubProjectFormData {
  name: string;                  /* 子项目名称 */
  code: string;                  /* 子项目编号 */
  description: string;           /* 描述 */
}

/** 添加成员表单数据接口 */
interface AddMemberFormData {
  userId: string;                /* 用户 ID（字符串，方便表单处理） */
}

/* ========================================
 * 项目部状态映射及样式配置
 * ======================================== */
const DEPARTMENT_STATUS_MAP: Record<string, { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  active: { label: '启用', type: 'success' },         /* 启用 - 绿色 */
  inactive: { label: '停用', type: 'danger' },         /* 停用 - 红色 */
};

/* ========================================
 * 默认表单值
 * ======================================== */

/** 项目部表单默认值 */
const DEFAULT_DEPARTMENT_FORM: DepartmentFormData = {
  name: '',
  code: '',
  contractId: '',
  description: '',
};

/** 子项目表单默认值 */
const DEFAULT_SUB_PROJECT_FORM: SubProjectFormData = {
  name: '',
  code: '',
  description: '',
};

/** 添加成员表单默认值 */
const DEFAULT_ADD_MEMBER_FORM: AddMemberFormData = {
  userId: '',
};

const normalizeDepartment = (dept: any): Department => ({
  ...dept,
  status: dept.status || (dept.isActive === false ? 'inactive' : 'active'),
  contractName: dept.contractName || dept.contract?.name,
  subProjectCount: dept.subProjectCount ?? dept._count?.subProjects ?? dept.subProjects?.length ?? 0,
  memberCount: dept.memberCount ?? dept._count?.users ?? dept.users?.length ?? 0,
});

/* ========================================
 * 项目部管理列表组件
 * ======================================== */
const DepartmentList: React.FC = () => {
  /* ---------- 权限检查 ---------- */
  const { can } = useAuthStore();

  /* ---------- 列表数据状态 ---------- */
  const [departments, setDepartments] = useState<Department[]>([]); /* 项目部列表数据 */
  const [loading, setLoading] = useState<boolean>(false);           /* 加载状态 */
  const [totalRecords, setTotalRecords] = useState<number>(0);     /* 总记录数 */
  const [totalPages, setTotalPages] = useState<number>(1);         /* 总页数 */

  /* ---------- 搜索筛选状态 ---------- */
  const [keyword, setKeyword] = useState<string>('');              /* 搜索关键词 */
  const [currentPage, setCurrentPage] = useState<number>(1);       /* 当前页码 */
  const pageSize = 20;                                              /* 每页条数 */

  /* ---------- 弹窗状态 ---------- */
  const [showFormModal, setShowFormModal] = useState(false);       /* 新增/编辑项目部弹窗 */
  const [showDetailModal, setShowDetailModal] = useState(false);   /* 查看详情弹窗 */
  const [showSubProjectModal, setShowSubProjectModal] = useState(false); /* 新增/编辑子项目弹窗 */
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);   /* 添加成员弹窗 */
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState(false); /* 移除成员确认弹窗 */
  const [showToggleConfirm, setShowToggleConfirm] = useState(false); /* 启用/停用确认弹窗 */

  /* ---------- 表单状态 ---------- */
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null); /* 当前编辑的项目部（null 为新增模式） */
  const [formData, setFormData] = useState<DepartmentFormData>(DEFAULT_DEPARTMENT_FORM); /* 项目部表单数据 */
  const [formLoading, setFormLoading] = useState(false);           /* 表单提交加载状态 */

  /* ---------- 详情状态 ---------- */
  const [detailDepartment, setDetailDepartment] = useState<Department | null>(null); /* 查看的项目部详情 */
  const [subProjects, setSubProjects] = useState<SubProject[]>([]); /* 子项目列表 */
  const [members, setMembers] = useState<Member[]>([]);             /* 成员列表 */
  const [detailLoading, setDetailLoading] = useState(false);       /* 详情加载状态 */

  /* ---------- 子项目表单状态 ---------- */
  const [editingSubProject, setEditingSubProject] = useState<SubProject | null>(null); /* 当前编辑的子项目（null 为新增模式） */
  const [subProjectForm, setSubProjectForm] = useState<SubProjectFormData>(DEFAULT_SUB_PROJECT_FORM); /* 子项目表单数据 */
  const [subProjectLoading, setSubProjectLoading] = useState(false); /* 子项目提交加载状态 */

  /* ---------- 成员操作状态 ---------- */
  const [addMemberForm, setAddMemberForm] = useState<AddMemberFormData>(DEFAULT_ADD_MEMBER_FORM); /* 添加成员表单 */
  const [addMemberLoading, setAddMemberLoading] = useState(false); /* 添加成员提交加载状态 */
  const [removingMember, setRemovingMember] = useState<Member | null>(null); /* 待移除的成员 */
  const [removeMemberLoading, setRemoveMemberLoading] = useState(false); /* 移除成员加载状态 */

  /* ---------- 启用/停用操作状态 ---------- */
  const [togglingDepartment, setTogglingDepartment] = useState<Department | null>(null); /* 待切换状态的项目部 */
  const [toggleLoading, setToggleLoading] = useState(false);       /* 切换状态加载中 */

  /* ---------- 下拉选项数据 ---------- */
  const [contracts, setContracts] = useState<ContractOption[]>([]); /* 合同列表（用于下拉选择） */
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]); /* 可添加的用户列表 */

  /* ========================================
   * 数据加载方法
   * ======================================== */

  /**
   * 加载项目部列表
   * 根据当前搜索条件和分页参数请求后端数据
   */
  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      /* 构建请求参数 */
      const params: any = {
        page: currentPage,
        pageSize,
      };
      /* 搜索关键词（非空时添加） */
      if (keyword.trim()) {
        params.search = keyword.trim();
      }

      const res = await departmentApi.getList(params);
      const body: any = res.data;
      const deptsData = body.data || body.pagination || body;
      const deptList = Array.isArray(deptsData) ? deptsData : body.data || [];
      setDepartments(deptList.map(normalizeDepartment));
      setTotalRecords(body.pagination?.total || 0);
      setTotalPages(body.pagination?.totalPages || 1);
    } catch (error: any) {
      toast.error(error.message || '加载项目部列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, keyword, pageSize]);

  /**
   * 加载合同列表
   * 用于项目部表单中的所属合同下拉选择
   */
  const fetchContracts = useCallback(async () => {
    try {
      const res = await contractApi.getList({ pageSize: 100 });
      const body: any = res.data;
      const list = body.data || body || [];
      setContracts((Array.isArray(list) ? list : []).map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })));
    } catch (error: any) {
      console.error('加载合同列表失败:', error);
    }
  }, []);

  /**
   * 加载可添加的用户列表
   * 用于添加成员弹窗中的用户下拉选择
   */
  const fetchAvailableUsers = useCallback(async () => {
    try {
      const res = await tenantApi.getUsers({ pageSize: 100 });
      const body: any = res.data || res;
      const users = body?.data ?? body?.items ?? body;
      setAvailableUsers((Array.isArray(users) ? users : []).map((u: any) => ({
        id: u.id,
        username: u.username,
        realName: u.realName || u.name,
      })));
    } catch (error: any) {
      console.error('加载用户列表失败:', error);
    }
  }, []);

  /**
   * 加载项目部详情（含子项目和成员）
   * @param departmentId - 项目部 ID
   */
  const fetchDepartmentDetail = useCallback(async (departmentId: number) => {
    try {
      setDetailLoading(true);
      /* 并行加载子项目和成员列表 */
      const [subRes, memberRes] = await Promise.all([
        departmentApi.getSubProjects(departmentId),
        departmentApi.getDetail(departmentId),
      ]);

      /* 解析子项目数据 */
      const subBody = (subRes.data || subRes) as any;
      const subData = subBody?.data ?? subBody;
      setSubProjects(Array.isArray(subData) ? subData : subData.subProjects || subData.items || []);

      /* 解析成员数据（从详情中提取） */
      const detailBody = (memberRes.data || memberRes) as any;
      const detailSource: any = detailBody?.data ?? detailBody;
      const detailData = normalizeDepartment(detailSource);
      setDetailDepartment(detailData);
      const rawMembers = Array.isArray(detailSource.members)
        ? detailSource.members
        : Array.isArray(detailSource.users)
          ? detailSource.users
          : [];
      setMembers(rawMembers.map((member: any) => ({
        id: member.id,
        userId: member.userId || member.id,
        username: member.username,
        realName: member.realName || member.name,
        role: typeof member.role === 'string' ? member.role : member.role?.displayName || member.role?.name,
        joinedAt: member.joinedAt || member.updatedAt || member.createdAt,
      })));
    } catch (error: any) {
      toast.error(error.message || '加载项目部详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /* ---------- 页面初始化时加载数据 ---------- */
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  /* ========================================
   * 搜索与筛选方法
   * ======================================== */

  /**
   * 执行搜索
   * 重置页码到第 1 页后重新加载数据
   */
  const handleSearch = useCallback((value: string) => {
    setKeyword(value);
    setCurrentPage(1);
  }, []);

  /**
   * 页码变化
   */
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  /* ========================================
   * 项目部表单操作方法
   * ======================================== */

  /**
   * 打开新增项目部弹窗
   * 重置表单为默认值，同时加载合同列表
   */
  const handleOpenCreate = useCallback(async () => {
    setEditingDepartment(null);
    setFormData(DEFAULT_DEPARTMENT_FORM);
    /* 加载合同选项 */
    await fetchContracts();
    setShowFormModal(true);
  }, [fetchContracts]);

  /**
   * 打开编辑项目部弹窗
   * 将项目部数据回填到表单中
   * @param department - 要编辑的项目部对象
   */
  const handleOpenEdit = useCallback(async (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name || '',
      code: department.code || '',
      contractId: department.contractId ? String(department.contractId) : '',
      description: department.description || '',
    });
    /* 加载合同选项 */
    await fetchContracts();
    setShowFormModal(true);
  }, [fetchContracts]);

  /**
   * 处理项目部表单提交
   * 根据当前是新增还是编辑模式调用不同 API
   */
  const handleFormSubmit = useCallback(async () => {
    /* 表单校验 */
    if (!formData.name.trim()) {
      toast.error('请输入项目部名称');
      return;
    }
    if (!formData.code.trim()) {
      toast.error('请输入项目部编号');
      return;
    }

    try {
      setFormLoading(true);
      /* 构建提交数据 */
      const submitData: any = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        description: formData.description.trim() || undefined,
      };
      /* 所属合同（可选） */
      if (formData.contractId) {
        submitData.contractId = Number(formData.contractId);
      }

      if (editingDepartment) {
        /* 编辑模式：调用更新接口 */
        await departmentApi.update(editingDepartment.id, submitData);
        toast.success('项目部更新成功');
      } else {
        /* 新增模式：调用创建接口 */
        await departmentApi.create(submitData);
        toast.success('项目部创建成功');
      }

      /* 关闭弹窗并刷新列表 */
      setShowFormModal(false);
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.message || '操作失败，请重试');
    } finally {
      setFormLoading(false);
    }
  }, [formData, editingDepartment, fetchDepartments]);

  /* ========================================
   * 项目部详情方法
   * ======================================== */

  /**
   * 打开项目部详情弹窗
   * 同时加载子项目列表和成员列表
   * @param department - 要查看的项目部对象
   */
  const handleOpenDetail = useCallback(async (department: Department) => {
    setDetailDepartment(department);
    setShowDetailModal(true);
    /* 加载子项目和成员数据 */
    await fetchDepartmentDetail(department.id);
  }, [fetchDepartmentDetail]);

  /* ========================================
   * 子项目操作方法
   * ======================================== */

  /**
   * 打开新增子项目弹窗
   * 重置子项目表单
   */
  const handleOpenCreateSubProject = useCallback(() => {
    setEditingSubProject(null);
    setSubProjectForm(DEFAULT_SUB_PROJECT_FORM);
    setShowSubProjectModal(true);
  }, []);

  /**
   * 打开编辑子项目弹窗
   * 将子项目数据回填到表单中
   * @param subProject - 要编辑的子项目对象
   */
  const handleOpenEditSubProject = useCallback((subProject: SubProject) => {
    setEditingSubProject(subProject);
    setSubProjectForm({
      name: subProject.name || '',
      code: subProject.code || '',
      description: subProject.description || '',
    });
    setShowSubProjectModal(true);
  }, []);

  /**
   * 处理子项目表单提交
   * 根据当前是新增还是编辑模式调用不同 API
   */
  const handleSubProjectSubmit = useCallback(async () => {
    /* 表单校验 */
    if (!subProjectForm.name.trim()) {
      toast.error('请输入子项目名称');
      return;
    }

    if (!detailDepartment) return;

    try {
      setSubProjectLoading(true);
      /* 构建提交数据 */
      const submitData: any = {
        name: subProjectForm.name.trim(),
        code: subProjectForm.code.trim() || undefined,
        description: subProjectForm.description.trim() || undefined,
      };

      if (editingSubProject) {
        /* 编辑模式：调用更新接口 */
        await departmentApi.updateSubProject(
          detailDepartment.id,
          editingSubProject.id,
          submitData
        );
        toast.success('子项目更新成功');
      } else {
        /* 新增模式：调用创建接口 */
        await departmentApi.createSubProject(detailDepartment.id, submitData);
        toast.success('子项目创建成功');
      }

      /* 关闭弹窗并刷新详情 */
      setShowSubProjectModal(false);
      await fetchDepartmentDetail(detailDepartment.id);
      /* 同时刷新列表（更新子项目数量） */
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.message || '操作失败，请重试');
    } finally {
      setSubProjectLoading(false);
    }
  }, [subProjectForm, editingSubProject, detailDepartment, fetchDepartmentDetail, fetchDepartments]);

  /* ========================================
   * 成员操作方法
   * ======================================== */

  /**
   * 打开添加成员弹窗
   * 重置成员表单，同时加载可添加的用户列表
   */
  const handleOpenAddMember = useCallback(async () => {
    setAddMemberForm(DEFAULT_ADD_MEMBER_FORM);
    /* 加载可选用户列表 */
    await fetchAvailableUsers();
    setShowAddMemberModal(true);
  }, [fetchAvailableUsers]);

  /**
   * 处理添加成员表单提交
   */
  const handleAddMemberSubmit = useCallback(async () => {
    /* 表单校验 */
    if (!addMemberForm.userId) {
      toast.error('请选择要添加的用户');
      return;
    }

    if (!detailDepartment) return;

    try {
      setAddMemberLoading(true);
      /* 构建提交数据 */
      const submitData: any = {
        userId: addMemberForm.userId,
      };
      await departmentApi.addMember(detailDepartment.id, submitData);
      toast.success('成员添加成功');
      /* 关闭弹窗并刷新详情 */
      setShowAddMemberModal(false);
      await fetchDepartmentDetail(detailDepartment.id);
      /* 同时刷新列表（更新成员数量） */
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.message || '添加成员失败');
    } finally {
      setAddMemberLoading(false);
    }
  }, [addMemberForm, detailDepartment, fetchDepartmentDetail, fetchDepartments]);

  /**
   * 打开移除成员确认弹窗
   * @param member - 要移除的成员对象
   */
  const handleOpenRemoveMember = useCallback((member: Member) => {
    setRemovingMember(member);
    setShowRemoveMemberConfirm(true);
  }, []);

  /**
   * 确认移除成员
   */
  const handleConfirmRemoveMember = useCallback(async () => {
    if (!removingMember || !detailDepartment) return;

    try {
      setRemoveMemberLoading(true);
      await departmentApi.removeMember(detailDepartment.id, removingMember.userId);
      toast.success('成员已移除');
      /* 关闭确认弹窗并刷新详情 */
      setShowRemoveMemberConfirm(false);
      setRemovingMember(null);
      await fetchDepartmentDetail(detailDepartment.id);
      /* 同时刷新列表 */
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.message || '移除成员失败');
    } finally {
      setRemoveMemberLoading(false);
    }
  }, [removingMember, detailDepartment, fetchDepartmentDetail, fetchDepartments]);

  /* ========================================
   * 启用/停用操作方法
   * ======================================== */

  /**
   * 打开启用/停用确认弹窗
   * @param department - 要切换状态的项目部对象
   */
  const handleOpenToggle = useCallback((department: Department) => {
    setTogglingDepartment(department);
    setShowToggleConfirm(true);
  }, []);

  /**
   * 确认启用/停用项目部
   */
  const handleConfirmToggle = useCallback(async () => {
    if (!togglingDepartment) return;

    try {
      setToggleLoading(true);
      await departmentApi.toggle(togglingDepartment.id);
      const actionText = togglingDepartment.status === 'active' ? '停用' : '启用';
      toast.success(`项目部已${actionText}`);
      /* 关闭确认弹窗并刷新列表 */
      setShowToggleConfirm(false);
      setTogglingDepartment(null);
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.message || '操作失败，请重试');
    } finally {
      setToggleLoading(false);
    }
  }, [togglingDepartment, fetchDepartments]);

  /* ========================================
   * 渲染：加载状态
   * ======================================== */
  if (loading && departments.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        {/* 加载旋转图标 */}
        <Loader2 size={40} className="animate-spin text-[#0066CC]" />
      </div>
    );
  }

  /* ========================================
   * 渲染：主页面
   * ======================================== */
  return (
    <div>
      {/* ========== 页面标题区域 ========== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">项目部管理</h1>
          <p className="page-subtitle">项目部信息与子项目管理</p>
        </div>
        {/* 新增按钮（需要 department:create 权限） */}
        {can('department:create') && (
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus size={16} className="mr-1.5" />
            新增项目部
          </button>
        )}
      </div>

      {/* ========== 搜索筛选栏 ========== */}
      <div className="filter-bar">
        {/* 搜索输入框：按名称或编号搜索 */}
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
            placeholder="搜索项目部名称或编号..."
          />
        </div>
      </div>

      {/* ========== 项目部列表表格 ========== */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            {/* 表头：深色背景 */}
            <thead>
              <tr className="table-thead" style={{ backgroundColor: '#0066CC', color: '#fff' }}>
                <th>项目部名称</th>
                <th>编号</th>
                <th>所属合同</th>
                <th>子项目数</th>
                <th>成员数</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody className="table-tbody">
              {departments.length === 0 ? (
                /* 空状态：跨列显示 */
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="暂无项目部数据"
                      description={'点击"新增项目部"按钮创建第一个项目部'}
                      icon={<Building2 size={48} />}
                    />
                  </td>
                </tr>
              ) : (
                /* 项目部数据行（斑马纹） */
                departments.map((dept, index) => {
                  const statusConfig = DEPARTMENT_STATUS_MAP[dept.status] || DEPARTMENT_STATUS_MAP.active;
                  return (
                    <tr
                      key={dept.id}
                      className={index % 2 === 1 ? 'bg-gray-50' : ''}
                    >
                      {/* 项目部名称 */}
                      <td className="font-medium text-gray-800">
                        {dept.name}
                      </td>
                      {/* 编号 */}
                      <td className="text-gray-600">{dept.code}</td>
                      {/* 所属合同 */}
                      <td className="text-gray-600">
                        {dept.contractName || '-'}
                      </td>
                      {/* 子项目数 */}
                      <td>
                        <span className="badge badge-blue">
                          {dept.subProjectCount ?? 0}
                        </span>
                      </td>
                      {/* 成员数 */}
                      <td>
                        <span className="badge badge-green">
                          {dept.memberCount ?? 0}
                        </span>
                      </td>
                      {/* 状态标签 */}
                      <td>
                        <StatusBadge
                          status={statusConfig.label}
                          type={statusConfig.type}
                        />
                      </td>
                      {/* 操作按钮列 */}
                      <td>
                        <div className="flex items-center gap-1">
                          {/* 查看详情按钮 */}
                          {can('department:view') && (
                            <button
                              onClick={() => handleOpenDetail(dept)}
                              className="btn-secondary btn-sm"
                              title="查看详情"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          {/* 编辑按钮 */}
                          {can('department:edit') && (
                            <button
                              onClick={() => handleOpenEdit(dept)}
                              className="btn-secondary btn-sm"
                              title="编辑"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {/* 启用/停用按钮 */}
                          {can('department:delete') && (
                            <button
                              onClick={() => handleOpenToggle(dept)}
                              className={`btn-sm ${
                                dept.status === 'active'
                                  ? 'btn-secondary'
                                  : 'btn-primary'
                              }`}
                              title={dept.status === 'active' ? '停用' : '启用'}
                            >
                              <Power size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页区域 */}
        {departments.length > 0 && (
          <div className="table-footer">
            <Pagination
              current={currentPage}
              total={totalPages}
              pageSize={pageSize}
              totalRecords={totalRecords}
              onChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* ========== 新增/编辑项目部弹窗 ========== */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingDepartment ? '编辑项目部' : '新增项目部'}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setShowFormModal(false)}
              className="btn-secondary"
              disabled={formLoading}
            >
              取消
            </button>
            <button
              onClick={handleFormSubmit}
              className="btn-primary"
              disabled={formLoading}
            >
              {formLoading ? '提交中...' : editingDepartment ? '保存修改' : '确认创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 第一行：项目部名称和编号 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 项目部名称 */}
            <div>
              <label className="form-label">
                项目部名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="请输入项目部名称"
              />
            </div>
            {/* 项目部编号 */}
            <div>
              <label className="form-label">
                项目部编号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="input"
                placeholder="请输入项目部编号"
              />
            </div>
          </div>

          {/* 第二行：所属合同选择 */}
          <div>
            <label className="form-label">所属合同</label>
            <select
              value={formData.contractId}
              onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
              className="select"
            >
              <option value="">请选择所属合同（选填）</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.name}（{contract.code}）
                </option>
              ))}
            </select>
          </div>

          {/* 第三行：描述 */}
          <div>
            <label className="form-label">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="textarea"
              placeholder="请输入项目部描述（选填）"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* ========== 项目部详情弹窗 ========== */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="项目部详情"
        size="xl"
      >
        {detailDepartment && (
          <div className="space-y-6">
            {/* ---- 基本信息 ---- */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">
                基本信息
              </h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {/* 项目部名称 */}
                <div>
                  <span className="text-gray-500">项目部名称：</span>
                  <span className="text-gray-800 font-medium">{detailDepartment.name}</span>
                </div>
                {/* 项目部编号 */}
                <div>
                  <span className="text-gray-500">项目部编号：</span>
                  <span className="text-gray-800">{detailDepartment.code}</span>
                </div>
                {/* 所属合同 */}
                <div>
                  <span className="text-gray-500">所属合同：</span>
                  <span className="text-gray-800">
                    {detailDepartment.contractName || '未关联'}
                  </span>
                </div>
                {/* 状态 */}
                <div>
                  <span className="text-gray-500">状态：</span>
                  <StatusBadge
                    status={
                      (DEPARTMENT_STATUS_MAP[detailDepartment.status] || DEPARTMENT_STATUS_MAP.active).label
                    }
                    type={
                      (DEPARTMENT_STATUS_MAP[detailDepartment.status] || DEPARTMENT_STATUS_MAP.active).type
                    }
                    className="ml-1"
                  />
                </div>
                {/* 创建时间 */}
                <div>
                  <span className="text-gray-500">创建时间：</span>
                  <span className="text-gray-800">
                    {formatDate(detailDepartment.createdAt, 'YYYY-MM-DD HH:mm')}
                  </span>
                </div>
              </div>
              {/* 描述 */}
              {detailDepartment.description && (
                <div className="mt-3 text-sm">
                  <span className="text-gray-500">描述：</span>
                  <span className="text-gray-700">{detailDepartment.description}</span>
                </div>
              )}
            </div>

            {/* ---- 子项目列表 ---- */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <FolderTree size={18} className="text-[#0066CC]" />
                  子项目列表
                  <span className="badge badge-blue ml-1">{subProjects.length}</span>
                </h3>
                {/* 新增子项目按钮 */}
                {can('department:create') && (
                  <button
                    onClick={handleOpenCreateSubProject}
                    className="btn-primary btn-sm"
                  >
                    <Plus size={14} className="mr-1" />
                    新增子项目
                  </button>
                )}
              </div>

              {detailLoading ? (
                /* 加载中 */
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#0066CC]" />
                  <span className="ml-2 text-sm text-gray-500">加载中...</span>
                </div>
              ) : subProjects.length === 0 ? (
                /* 空状态 */
                <EmptyState
                  title="暂无子项目"
                  description={'点击"新增子项目"按钮添加子项目'}
                  icon={<FolderTree size={40} />}
                />
              ) : (
                /* 子项目数据表格 */
                <div className="table-container">
                  <table className="table text-sm">
                    <thead>
                      <tr className="table-thead" style={{ backgroundColor: '#0066CC', color: '#fff' }}>
                        <th>子项目名称</th>
                        <th>编号</th>
                        <th>描述</th>
                        <th>创建时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody className="table-tbody">
                      {subProjects.map((sp, index) => (
                        <tr
                          key={sp.id}
                          className={index % 2 === 1 ? 'bg-gray-50' : ''}
                        >
                          {/* 子项目名称 */}
                          <td className="font-medium text-gray-800">{sp.name}</td>
                          {/* 编号 */}
                          <td className="text-gray-600">{sp.code || '-'}</td>
                          {/* 描述 */}
                          <td className="text-gray-500 max-w-[200px] truncate">
                            {sp.description || '-'}
                          </td>
                          {/* 创建时间 */}
                          <td>{formatDate(sp.createdAt)}</td>
                          {/* 操作 */}
                          <td>
                            {can('department:edit') && (
                              <button
                                onClick={() => handleOpenEditSubProject(sp)}
                                className="btn-secondary btn-sm"
                                title="编辑子项目"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ---- 成员列表 ---- */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Users size={18} className="text-[#0066CC]" />
                  成员列表
                  <span className="badge badge-green ml-1">{members.length}</span>
                </h3>
                {/* 添加成员按钮 */}
                {can('department:create') && (
                  <button
                    onClick={handleOpenAddMember}
                    className="btn-primary btn-sm"
                  >
                    <UserPlus size={14} className="mr-1" />
                    添加成员
                  </button>
                )}
              </div>

              {detailLoading ? (
                /* 加载中 */
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#0066CC]" />
                  <span className="ml-2 text-sm text-gray-500">加载中...</span>
                </div>
              ) : members.length === 0 ? (
                /* 空状态 */
                <EmptyState
                  title="暂无成员"
                  description={'点击"添加成员"按钮分配用户到项目部'}
                  icon={<Users size={40} />}
                />
              ) : (
                /* 成员数据表格 */
                <div className="table-container">
                  <table className="table text-sm">
                    <thead>
                      <tr className="table-thead" style={{ backgroundColor: '#0066CC', color: '#fff' }}>
                        <th>用户名</th>
                        <th>真实姓名</th>
                        <th>系统角色</th>
                        <th>加入时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody className="table-tbody">
                      {members.map((member, index) => (
                        <tr
                          key={member.id || member.userId}
                          className={index % 2 === 1 ? 'bg-gray-50' : ''}
                        >
                          {/* 用户名 */}
                          <td className="font-medium text-gray-800">
                            {member.username}
                          </td>
                          {/* 真实姓名 */}
                          <td className="text-gray-600">
                            {member.realName || '-'}
                          </td>
                          {/* 系统角色 */}
                          <td>
                            {member.role ? (
                              <span className="badge badge-blue">{member.role}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          {/* 加入时间 */}
                          <td>{formatDate(member.joinedAt)}</td>
                          {/* 移除按钮 */}
                          <td>
                            {can('department:delete') && (
                              <button
                                onClick={() => handleOpenRemoveMember(member)}
                                className="btn-danger btn-sm"
                                title="移除成员"
                              >
                                <UserMinus size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ========== 新增/编辑子项目弹窗 ========== */}
      <Modal
        isOpen={showSubProjectModal}
        onClose={() => setShowSubProjectModal(false)}
        title={editingSubProject ? '编辑子项目' : '新增子项目'}
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowSubProjectModal(false)}
              className="btn-secondary"
              disabled={subProjectLoading}
            >
              取消
            </button>
            <button
              onClick={handleSubProjectSubmit}
              className="btn-primary"
              disabled={subProjectLoading}
            >
              {subProjectLoading ? '提交中...' : editingSubProject ? '保存修改' : '确认创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 子项目名称 */}
          <div>
            <label className="form-label">
              子项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subProjectForm.name}
              onChange={(e) => setSubProjectForm({ ...subProjectForm, name: e.target.value })}
              className="input"
              placeholder="请输入子项目名称"
            />
          </div>

          {/* 子项目编号 */}
          <div>
            <label className="form-label">子项目编号</label>
            <input
              type="text"
              value={subProjectForm.code}
              onChange={(e) => setSubProjectForm({ ...subProjectForm, code: e.target.value })}
              className="input"
              placeholder="请输入子项目编号（选填）"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="form-label">描述</label>
            <textarea
              value={subProjectForm.description}
              onChange={(e) => setSubProjectForm({ ...subProjectForm, description: e.target.value })}
              className="textarea"
              placeholder="请输入子项目描述（选填）"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* ========== 添加成员弹窗 ========== */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title="添加项目成员"
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="btn-secondary"
              disabled={addMemberLoading}
            >
              取消
            </button>
            <button
              onClick={handleAddMemberSubmit}
              className="btn-primary"
              disabled={addMemberLoading}
            >
              {addMemberLoading ? '提交中...' : '确认添加'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 选择用户 */}
          <div>
            <label className="form-label">
              选择用户 <span className="text-red-500">*</span>
            </label>
            <select
              value={addMemberForm.userId}
              onChange={(e) => setAddMemberForm({ ...addMemberForm, userId: e.target.value })}
              className="select"
            >
              <option value="">请选择要添加的用户</option>
              {/* 过滤掉已在成员列表中的用户 */}
              {availableUsers
                .filter((u) => !members.some((m) => m.userId === u.id))
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.realName
                      ? `${user.realName}（${user.username}）`
                      : user.username}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* ========== 移除成员确认弹窗 ========== */}
      <ConfirmDialog
        isOpen={showRemoveMemberConfirm}
        onClose={() => {
          setShowRemoveMemberConfirm(false);
          setRemovingMember(null);
        }}
        onConfirm={handleConfirmRemoveMember}
        title="移除成员"
        message={`确定要将成员"${removingMember?.realName || removingMember?.username}"从当前项目部中移除吗？`}
        confirmText="确认移除"
        type="danger"
        loading={removeMemberLoading}
      />

      {/* ========== 启用/停用确认弹窗 ========== */}
      <ConfirmDialog
        isOpen={showToggleConfirm}
        onClose={() => {
          setShowToggleConfirm(false);
          setTogglingDepartment(null);
        }}
        onConfirm={handleConfirmToggle}
        title={togglingDepartment?.status === 'active' ? '停用项目部' : '启用项目部'}
        message={
          togglingDepartment?.status === 'active'
            ? `确定要停用项目部"${togglingDepartment?.name}"吗？停用后将无法进行相关操作。`
            : `确定要启用项目部"${togglingDepartment?.name}"吗？`
        }
        confirmText={
          togglingDepartment?.status === 'active' ? '确认停用' : '确认启用'
        }
        type={togglingDepartment?.status === 'active' ? 'danger' : 'primary'}
        loading={toggleLoading}
      />
    </div>
  );
};

export default DepartmentList;
