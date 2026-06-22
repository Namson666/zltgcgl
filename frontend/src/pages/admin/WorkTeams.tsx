/**
 * 资料通工程管理系统 - 班组管理页面
 *
 * 功能说明：
 * 施工班组信息的完整管理页面，包括班组列表展示、搜索筛选、
 * 新增/编辑班组等功能。
 *
 * 权限控制：
 * - 需要 canManageSystem 权限才能访问
 *
 * API 接口：
 * - wmsApi.getWorkTeams()   获取班组列表（分页）
 * - wmsApi.createWorkTeam() 创建班组
 * - wmsApi.updateWorkTeam() 更新班组
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  HardHat,
  Plus,
  Edit2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { wmsApi } from '@/api';
import { useAuthStore } from '@/lib/AuthContext';
import Modal from '@/components/ui/Modal';
import {
  Pagination,
  EmptyState,
  SearchInput,
} from '@/components/ui/Common';
import Loading from '@/components/ui/Loading';

/* ========================================
 * 类型定义
 * ======================================== */

/** 班组信息接口 */
interface WorkTeamInfo {
  id: number;                    /* 班组唯一标识 */
  name: string;                  /* 班组名称 */
  leader?: string;               /* 班组长姓名 */
  phone?: string;                /* 班组长联系电话 */
  memberCount?: number;          /* 班组人数 */
  remark?: string;               /* 备注 */
}

/** 班组表单数据接口（新增/编辑共用） */
interface WorkTeamFormData {
  name: string;                  /* 班组名称 */
  leader: string;                /* 班组长姓名 */
  phone: string;                 /* 班组长联系电话 */
  memberCount: number | string;  /* 班组人数 */
  remark: string;                /* 备注 */
}

/** 分页响应接口 */
interface PaginatedData {
  items: WorkTeamInfo[];         /* 班组列表 */
  total: number;                 /* 总条数 */
  page: number;                  /* 当前页码 */
  pageSize: number;              /* 每页条数 */
  totalPages: number;            /* 总页数 */
}

/* ========================================
 * 表单初始值
 * ======================================== */

/** 空表单初始值 */
const EMPTY_FORM: WorkTeamFormData = {
  name: '',
  leader: '',
  phone: '',
  memberCount: '',
  remark: '',
};

/* ========================================
 * 班组管理页面主组件
 * ======================================== */
const AdminWorkTeams: React.FC = () => {
  /* ---------- 权限检查 ---------- */
  const can = useAuthStore((s) => s.can);

  /* ---------- 列表状态 ---------- */
  const [workTeams, setWorkTeams] = useState<WorkTeamInfo[]>([]); /* 班组列表数据 */
  const [loading, setLoading] = useState(false);                   /* 列表加载状态 */
  const [page, setPage] = useState(1);                             /* 当前页码 */
  const [totalPages, setTotalPages] = useState(0);                 /* 总页数 */
  const [totalRecords, setTotalRecords] = useState(0);             /* 总记录数 */
  const [keyword, setKeyword] = useState('');                      /* 搜索关键词 */

  /* ---------- 弹窗状态 ---------- */
  const [showFormModal, setShowFormModal] = useState(false);       /* 新增/编辑弹窗 */
  const [editingTeam, setEditingTeam] = useState<WorkTeamInfo | null>(null); /* 当前编辑的班组（null 为新增模式） */
  const [formLoading, setFormLoading] = useState(false);           /* 表单提交加载状态 */
  const [formData, setFormData] = useState<WorkTeamFormData>(EMPTY_FORM); /* 表单数据 */

  /* ========================================
   * 数据加载
   * ======================================== */

  /**
   * 加载班组列表
   * 根据当前页码和搜索关键词请求后端数据
   */
  const fetchWorkTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wmsApi.getWorkTeams({
        page,
        pageSize: 20,
        keyword: keyword || undefined,
      });
      const body: any = res.data;
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      setWorkTeams(items);
      setTotalPages(body.meta?.totalPages || (listData?.totalPages) || 0);
      setTotalRecords(body.meta?.total || (listData?.total) || items.length);
    } catch (error: any) {
      toast.error(error.message || '获取班组列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  /* 页面初始化和依赖变化时重新加载数据 */
  useEffect(() => {
    fetchWorkTeams();
  }, [fetchWorkTeams]);

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
   * 新增班组
   * ======================================== */

  /**
   * 打开新增班组弹窗
   * 重置表单数据到初始值
   */
  const handleAdd = () => {
    setEditingTeam(null);
    setFormData(EMPTY_FORM);
    setShowFormModal(true);
  };

  /* ========================================
   * 编辑班组
   * ======================================== */

  /**
   * 打开编辑班组弹窗
   * 将当前班组数据填充到表单中
   *
   * @param team - 要编辑的班组信息
   */
  const handleEdit = (team: WorkTeamInfo) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      leader: team.leader || '',
      phone: team.phone || '',
      memberCount: team.memberCount || '',
      remark: team.remark || '',
    });
    setShowFormModal(true);
  };

  /* ========================================
   * 表单提交（新增/编辑）
   * ======================================== */

  /**
   * 提交班组表单
   * 根据当前模式（新增/编辑）调用不同的 API
   */
  const handleSubmit = async () => {
    /* 表单校验 */
    if (!formData.name.trim()) {
      toast.error('请输入班组名称');
      return;
    }

    setFormLoading(true);
    try {
      if (editingTeam) {
        /* 编辑模式：更新班组信息 */
        await wmsApi.updateWorkTeam(editingTeam.id, formData);
        toast.success('班组信息已更新');
      } else {
        /* 新增模式：创建班组 */
        await wmsApi.createWorkTeam(formData);
        toast.success('班组创建成功');
      }
      setShowFormModal(false);
      fetchWorkTeams(); /* 刷新列表 */
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
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
  const updateFormField = (field: keyof WorkTeamFormData, value: string | number) => {
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
            <h1 className="page-title">班组管理</h1>
            <p className="page-subtitle">施工班组信息管理</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center py-16">
            <HardHat size={48} className="text-gray-300 mx-auto mb-4" />
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
          <h1 className="page-title">班组管理</h1>
          <p className="page-subtitle">管理施工班组信息，维护班组长联系方式与人员配置</p>
        </div>
        {/* 新增班组按钮 */}
        <button onClick={handleAdd} className="btn-primary">
          <Plus size={16} className="mr-1.5" />
          新增班组
        </button>
      </div>

      {/* ====== 搜索筛选栏 ====== */}
      <div className="filter-bar">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
            placeholder="搜索班组名称..."
          />
        </div>
      </div>

      {/* ====== 班组列表卡片 ====== */}
      <div className="card">
        <div className="table-container">
          {loading ? (
            /* 加载状态 */
            <Loading text="加载班组列表..." />
          ) : workTeams.length === 0 ? (
            /* 空状态 */
            <EmptyState
              title="暂无班组数据"
              description={keyword ? `未找到与"${keyword}"匹配的班组` : '点击"新增班组"按钮添加第一个班组'}
              icon={<HardHat size={48} />}
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
                  <th className="px-4 py-3 font-medium whitespace-nowrap">名称</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">班组长</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">电话</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">人数</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap text-right">操作</th>
                </tr>
              </thead>

              {/* 表体 - 斑马纹 */}
              <tbody className="divide-y divide-gray-100">
                {workTeams.map((team, index) => (
                  <tr
                    key={team.id}
                    className={`hover:bg-gray-50 transition-colors duration-150 ${
                      index % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'
                    }`}
                  >
                    {/* 班组名称 */}
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">
                      {team.name}
                    </td>
                    {/* 班组长 */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {team.leader || '-'}
                    </td>
                    {/* 联系电话 */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {team.phone || '-'}
                    </td>
                    {/* 班组人数 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {/* 人数标签 */}
                      <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {team.memberCount || 0} 人
                      </span>
                    </td>
                    {/* 操作按钮列 */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* 编辑按钮 */}
                        <button
                          onClick={() => handleEdit(team)}
                          className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="编辑班组"
                        >
                          <Edit2 size={15} />
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
        {!loading && workTeams.length > 0 && (
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

      {/* ====== 新增/编辑班组弹窗 ====== */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingTeam ? '编辑班组' : '新增班组'}
        size="md"
        footer={
          <>
            <button onClick={() => setShowFormModal(false)} className="btn-secondary" disabled={formLoading}>
              取消
            </button>
            <button onClick={handleSubmit} className="btn-primary" disabled={formLoading}>
              {formLoading ? '提交中...' : editingTeam ? '保存修改' : '创建班组'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 班组名称 */}
          <div>
            <label className="form-label">
              班组名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="请输入班组名称"
              value={formData.name}
              onChange={(e) => updateFormField('name', e.target.value)}
            />
          </div>

          {/* 班组长和电话 - 并排显示 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 班组长 */}
            <div>
              <label className="form-label">班组长</label>
              <input
                type="text"
                className="input"
                placeholder="请输入班组长姓名"
                value={formData.leader}
                onChange={(e) => updateFormField('leader', e.target.value)}
              />
            </div>

            {/* 联系电话 */}
            <div>
              <label className="form-label">联系电话</label>
              <input
                type="text"
                className="input"
                placeholder="请输入联系电话"
                value={formData.phone}
                onChange={(e) => updateFormField('phone', e.target.value)}
              />
            </div>
          </div>

          {/* 班组人数 */}
          <div>
            <label className="form-label">班组人数</label>
            <input
              type="number"
              className="input"
              placeholder="请输入班组人数"
              value={formData.memberCount}
              onChange={(e) => updateFormField('memberCount', e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          {/* 备注 */}
          <div>
            <label className="form-label">备注</label>
            <textarea
              className="textarea"
              placeholder="请输入备注信息（选填）"
              value={formData.remark}
              onChange={(e) => updateFormField('remark', e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminWorkTeams;
