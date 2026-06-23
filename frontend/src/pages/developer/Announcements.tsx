/**
 * 资料通工程管理系统 - 系统公告管理页面
 *
 * 功能说明：
 * 开发者后台的系统公告管理，支持发布、编辑、删除公告，
 * 以及发布/下架切换操作。
 *
 * 页面结构：
 * 1. 页面标题区域 + 发布公告按钮
 * 2. 发布/编辑公告内联表单（title, content, type）
 * 3. 公告列表表格
 * 4. 分页功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Edit3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';
import {
  Pagination,
  EmptyState,
  StatusBadge,
  formatDate,
  ConfirmDialog,
} from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

/** 公告类型枚举 */
type AnnouncementType = 'info' | 'warning' | 'maintenance';

/** 公告信息接口 */
interface Announcement {
  id: string;                       /* 公告 ID */
  title: string;                    /* 公告标题 */
  content: string;                  /* 公告内容 */
  type: AnnouncementType;           /* 公告类型 */
  status?: string;                  /* 兼容旧状态字段：published / draft */
  isPublished?: boolean;            /* 后端真实字段 */
  publishedAt?: string;             /* 发布时间 */
  createdAt: string;                /* 创建时间 */
}

/** 公告表单数据接口 */
interface AnnouncementFormData {
  title: string;                    /* 公告标题 */
  content: string;                  /* 公告内容 */
  type: AnnouncementType;           /* 公告类型 */
}

/* ========================================
 * 常量定义
 * ======================================== */

/** 公告类型选项列表 */
const TYPE_OPTIONS: { value: AnnouncementType; label: string }[] = [
  { value: 'info', label: '信息' },
  { value: 'warning', label: '警告' },
  { value: 'maintenance', label: '维护' },
];

/** 公告类型与标签颜色映射 */
const TYPE_BADGE: Record<AnnouncementType, { label: string; type: 'info' | 'warning' | 'danger' }> = {
  info: { label: '信息', type: 'info' },
  warning: { label: '警告', type: 'warning' },
  maintenance: { label: '维护', type: 'danger' },
};

const getAnnouncementStatus = (announcement: Announcement) =>
  announcement.status || (announcement.isPublished ? 'published' : 'draft');

/* ========================================
 * Announcements 系统公告管理组件
 * ======================================== */
const Announcements: React.FC = () => {
  /* ---------- 列表状态 ---------- */
  const [announcements, setAnnouncements] = useState<Announcement[]>([]); /* 公告列表数据 */
  const [loading, setLoading] = useState(false);                          /* 列表加载状态 */
  const [total, setTotal] = useState(0);                                  /* 总记录数 */
  const [totalPages, setTotalPages] = useState(0);                        /* 总页数 */
  const [page, setPage] = useState(1);                                    /* 当前页码 */
  const [pageSize] = useState(20);                                        /* 每页条数 */

  /* ---------- 表单状态 ---------- */
  const [showForm, setShowForm] = useState(false);                        /* 显示公告表单 */
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null); /* 当前编辑的公告 */
  const [formData, setFormData] = useState<AnnouncementFormData>({         /* 公告表单数据 */
    title: '',
    content: '',
    type: 'info',
  });
  const [formLoading, setFormLoading] = useState(false);                  /* 表单提交加载状态 */

  /* ---------- 操作状态 ---------- */
  const [deleteId, setDeleteId] = useState<string | null>(null);          /* 待删除的公告 ID */

  /* ---------- 数据加载 ---------- */

  /**
   * 加载公告列表
   * 调用 developerApi.getAnnouncements() 获取分页数据
   */
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await developerApi.getAnnouncements({ page, pageSize });
      const body = res.data || res;
      setAnnouncements(body.data || []);
      setTotal(body.pagination?.total || 0);
      setTotalPages(body.pagination?.totalPages || 0);
    } catch (error) {
      console.error('加载公告列表失败:', error);
      toast.error('加载公告列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  /* 页码变化时重新加载数据 */
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  /* ---------- 表单操作 ---------- */

  /**
   * 打开发布公告表单
   */
  const handleOpenCreate = () => {
    setEditingAnnouncement(null);
    setFormData({ title: '', content: '', type: 'info' });
    setShowForm(true);
  };

  /**
   * 打开编辑公告表单
   * @param announcement - 要编辑的公告
   */
  const handleOpenEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
    });
    setShowForm(true);
  };

  /**
   * 取消表单
   */
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAnnouncement(null);
    setFormData({ title: '', content: '', type: 'info' });
  };

  /**
   * 提交公告表单（新建或编辑）
   */
  const handleSubmitForm = async () => {
    if (!formData.title.trim()) {
      toast.error('请输入公告标题');
      return;
    }
    if (!formData.content.trim()) {
      toast.error('请输入公告内容');
      return;
    }

    try {
      setFormLoading(true);
      if (editingAnnouncement) {
        /* 编辑模式 */
        await developerApi.updateAnnouncement(editingAnnouncement.id, formData);
        toast.success('公告已更新');
      } else {
        /* 新建模式 */
        await developerApi.createAnnouncement(formData);
        toast.success('公告已发布');
      }
      setShowForm(false);
      setEditingAnnouncement(null);
      setFormData({ title: '', content: '', type: 'info' });
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /* ---------- 发布/下架操作 ---------- */

  /**
   * 切换公告发布状态
   * @param announcement - 目标公告
   */
  const handleToggleStatus = async (announcement: Announcement) => {
    try {
      await developerApi.toggleAnnouncement(announcement.id);
      const actionText = getAnnouncementStatus(announcement) === 'published' ? '已下架' : '已发布';
      toast.success(`公告${actionText}`);
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  /* ---------- 删除操作 ---------- */

  /**
   * 删除公告
   */
  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await developerApi.deleteAnnouncement(deleteId);
      toast.success('公告已删除');
      setDeleteId(null);
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    }
  };

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">系统公告</h1>
          <p className="page-subtitle">管理系统公告信息</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAnnouncements}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#8899AA' }}
            title="刷新"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            发布公告
          </button>
        </div>
      </div>

      {/* ==========================================
       * 发布/编辑公告内联表单
       * ========================================== */}
      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A2B3C' }}>
              <Bell size={16} className="inline mr-1.5" />
              {editingAnnouncement ? '编辑公告' : '发布新公告'}
            </h3>
            <div className="space-y-4">
              {/* 标题 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  公告标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  data-testid="announcement-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full text-sm"
                  placeholder="请输入公告标题"
                />
              </div>
              {/* 类型 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">公告类型</label>
                <select
                  data-testid="announcement-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as AnnouncementType })}
                  className="input w-full text-sm"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {/* 内容 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  公告内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  data-testid="announcement-content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="input w-full text-sm"
                  rows={5}
                  placeholder="请输入公告内容"
                />
              </div>
              {/* 操作按钮 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmitForm}
                  disabled={formLoading}
                  className="btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5"
                >
                  {formLoading ? (
                    '保存中...'
                  ) : (
                    <>
                      <Send size={14} />
                      {editingAnnouncement ? '保存修改' : '确认发布'}
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelForm}
                  className="px-4 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
       * 公告列表表格
       * ========================================== */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">标题</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">发布时间</th>
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
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : announcements.length === 0 ? (
                /* 无数据 */
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="暂无公告"
                      description="点击「发布公告」按钮创建第一条公告"
                    />
                  </td>
                </tr>
              ) : (
                /* 公告数据行 */
                announcements.map((announcement) => {
                  const badgeInfo = TYPE_BADGE[announcement.type] || { label: announcement.type, type: 'default' as const };
                  const status = getAnnouncementStatus(announcement);
                  return (
                    <tr key={announcement.id} className="hover:bg-gray-50 transition-colors">
                      {/* 标题 */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                            <Bell size={14} />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{announcement.title}</span>
                            {announcement.content && (
                              <p className="text-xs text-gray-400 truncate max-w-[240px] mt-0.5">
                                {announcement.content}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* 类型 */}
                      <td className="px-5 py-3">
                        <StatusBadge
                          status={badgeInfo.label}
                          type={badgeInfo.type}
                        />
                      </td>
                      {/* 状态 */}
                      <td className="px-5 py-3">
                        <StatusBadge
                          status={status === 'published' ? '已发布' : '草稿'}
                          type={status === 'published' ? 'success' : 'default'}
                        />
                      </td>
                      {/* 发布时间 */}
                      <td className="px-5 py-3 text-sm text-gray-400">
                        {announcement.publishedAt ? formatDate(announcement.publishedAt) : '-'}
                      </td>
                      {/* 创建时间 */}
                      <td className="px-5 py-3 text-sm text-gray-400">
                        {formatDate(announcement.createdAt)}
                      </td>
                      {/* 操作按钮 */}
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {/* 编辑 */}
                          <button
                            onClick={() => handleOpenEdit(announcement)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="编辑"
                          >
                            <Edit3 size={15} />
                          </button>
                          {/* 发布/下架 */}
                          <button
                            onClick={() => handleToggleStatus(announcement)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              status === 'published'
                                ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={status === 'published' ? '下架' : '发布'}
                          >
                            <Send size={15} />
                          </button>
                          {/* 删除 */}
                          <button
                            onClick={() => setDeleteId(announcement.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!loading && announcements.length > 0 && (
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
       * 删除确认弹窗
       * ========================================== */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="删除公告"
        message="确定要删除此公告吗？此操作不可撤销。"
        confirmText="删除"
        type="danger"
      />
    </div>
  );
};

export default Announcements;
