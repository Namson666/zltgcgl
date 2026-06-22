/**
 * 资料通工程管理系统 - API 密钥管理页面
 *
 * 功能说明：
 * 开发者后台的 API 密钥管理，支持生成、启用/停用、删除密钥，
 * 以及创建时展示完整密钥供保存。
 *
 * 页面结构：
 * 1. 页面标题区域 + 生成密钥按钮
 * 2. 生成密钥内联表单（tenantId, name, expiresAt）
 * 3. API 密钥列表表格
 * 4. 创建完成后展示完整密钥的弹窗
 * 5. 分页功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Plus,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
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
import Modal from '../../components/ui/Modal';

/* ========================================
 * 类型定义
 * ======================================== */

/** API 密钥信息接口 */
interface ApiKey {
  id: string;                       /* 密钥 ID */
  name: string;                     /* 密钥名称 */
  keyPrefix: string;                /* 密钥前缀（用于展示） */
  tenantId: string;                 /* 所属租户 ID */
  status: string;                   /* 状态：active / inactive */
  lastUsedAt?: string;              /* 最后使用时间 */
  expiresAt?: string;               /* 过期时间 */
  createdAt: string;                /* 创建时间 */
}

/** 密钥表单数据接口 */
interface ApiKeyFormData {
  tenantId: string;                 /* 租户 ID */
  name: string;                     /* 密钥名称 */
  expiresAt: string;                /* 过期日期 */
}

/* ========================================
 * ApiKeys API密钥管理组件
 * ======================================== */
const ApiKeys: React.FC = () => {
  /* ---------- 列表状态 ---------- */
  const [keys, setKeys] = useState<ApiKey[]>([]);              /* 密钥列表数据 */
  const [loading, setLoading] = useState(false);                /* 列表加载状态 */
  const [total, setTotal] = useState(0);                        /* 总记录数 */
  const [totalPages, setTotalPages] = useState(0);              /* 总页数 */
  const [page, setPage] = useState(1);                          /* 当前页码 */
  const [pageSize] = useState(20);                              /* 每页条数 */

  /* ---------- 表单状态 ---------- */
  const [showForm, setShowForm] = useState(false);              /* 显示生成密钥表单 */
  const [formData, setFormData] = useState<ApiKeyFormData>({    /* 密钥表单数据 */
    tenantId: '',
    name: '',
    expiresAt: '',
  });
  const [formLoading, setFormLoading] = useState(false);        /* 表单提交加载状态 */

  /* ---------- 密钥展示弹窗 ---------- */
  const [showKeyModal, setShowKeyModal] = useState(false);      /* 展示完整密钥弹窗 */
  const [rawKey, setRawKey] = useState('');                     /* 完整密钥内容 */

  /* ---------- 操作状态 ---------- */
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null); /* 待删除的密钥 ID */
  const [copied, setCopied] = useState(false);                  /* 复制状态 */

  /* ---------- 展开查看 ---------- */
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set()); /* 展开查看前缀的密钥 ID */

  /* ---------- 数据加载 ---------- */

  /**
   * 加载 API 密钥列表
   * 调用 developerApi.getApiKeys() 获取分页数据
   */
  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await developerApi.getApiKeys({ page, pageSize });
      const body = res.data || res;
      setKeys(body.data || []);
      setTotal(body.pagination?.total || 0);
      setTotalPages(body.pagination?.totalPages || 0);
    } catch (error) {
      console.error('加载 API 密钥列表失败:', error);
      toast.error('加载 API 密钥列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  /* 页码变化时重新加载数据 */
  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  /* ---------- 生成密钥 ---------- */

  /**
   * 打开生成密钥表单
   */
  const handleOpenCreate = () => {
    setFormData({ tenantId: '', name: '', expiresAt: '' });
    setShowForm(true);
  };

  /**
   * 取消生成密钥
   */
  const handleCancelForm = () => {
    setShowForm(false);
    setFormData({ tenantId: '', name: '', expiresAt: '' });
  };

  /**
   * 提交生成密钥
   */
  const handleSubmitForm = async () => {
    if (!formData.tenantId.trim()) {
      toast.error('请输入租户 ID');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('请输入密钥名称');
      return;
    }

    try {
      setFormLoading(true);
      const res = await developerApi.createApiKey({
        tenantId: formData.tenantId.trim(),
        name: formData.name.trim(),
        expiresAt: formData.expiresAt || undefined,
      });
      const data = res.data || res;
      /* 展示完整密钥（仅此一次） */
      if (data.rawKey) {
        setRawKey(data.rawKey);
        setShowKeyModal(true);
      }
      toast.success('API 密钥生成成功');
      setShowForm(false);
      setFormData({ tenantId: '', name: '', expiresAt: '' });
      fetchKeys();
    } catch (error: any) {
      toast.error(error.message || '生成密钥失败');
    } finally {
      setFormLoading(false);
    }
  };

  /* ---------- 复制密钥 ---------- */

  /**
   * 复制完整密钥到剪贴板
   */
  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动选择复制');
    }
  };

  /* ---------- 启用/停用操作 ---------- */

  /**
   * 切换密钥状态
   * @param key - 目标密钥
   */
  const handleToggleStatus = async (key: ApiKey) => {
    const newStatus = key.status === 'active' ? 'inactive' : 'active';
    try {
      await developerApi.updateApiKey(key.id, { status: newStatus });
      toast.success(newStatus === 'active' ? '密钥已启用' : '密钥已停用');
      fetchKeys();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  /* ---------- 删除操作 ---------- */

  /**
   * 删除密钥
   */
  const handleDelete = async () => {
    if (!deleteKeyId) return;
    try {
      await developerApi.deleteApiKey(deleteKeyId);
      toast.success('密钥已删除');
      setDeleteKeyId(null);
      fetchKeys();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    }
  };

  /* ---------- 展开/收起密钥前缀 ---------- */

  /**
   * 切换密钥完整前缀的展示
   * @param id - 密钥 ID
   */
  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">API 密钥管理</h1>
          <p className="page-subtitle">管理系统 API 访问密钥</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchKeys}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#8899AA' }}
            title="刷新"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            生成密钥
          </button>
        </div>
      </div>

      {/* ==========================================
       * 生成密钥内联表单
       * ========================================== */}
      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A2B3C' }}>
              <Key size={16} className="inline mr-1.5" />
              生成新密钥
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {/* 租户 ID */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  租户 ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className="input w-full text-sm"
                  placeholder="请输入租户 ID"
                />
              </div>
              {/* 密钥名称 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  密钥名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full text-sm"
                  placeholder="例如：生产环境密钥"
                />
              </div>
              {/* 过期时间 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">过期时间</label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmitForm}
                disabled={formLoading}
                className="btn-primary text-sm px-4 py-1.5"
              >
                {formLoading ? '生成中...' : '确认生成'}
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
      )}

      {/* ==========================================
       * API 密钥列表表格
       * ========================================== */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">名称</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">密钥前缀</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">租户 ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">最后使用</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">过期时间</th>
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
              ) : keys.length === 0 ? (
                /* 无数据 */
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="暂无 API 密钥"
                      description="点击「生成密钥」按钮创建第一个 API 密钥"
                    />
                  </td>
                </tr>
              ) : (
                /* 密钥数据行 */
                keys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                    {/* 名称 */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                          <Key size={14} />
                        </div>
                        <span className="text-sm font-medium text-gray-800">{key.name}</span>
                      </div>
                    </td>
                    {/* 密钥前缀 */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {visibleKeys.has(key.id) ? key.keyPrefix : (key.keyPrefix?.slice(0, 7) || '') + '...'}
                        </code>
                        <button
                          onClick={() => toggleKeyVisibility(key.id)}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors"
                          title={visibleKeys.has(key.id) ? '隐藏' : '显示'}
                        >
                          {visibleKeys.has(key.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </td>
                    {/* 租户 ID */}
                    <td className="px-5 py-3 text-sm text-gray-600">{key.tenantId}</td>
                    {/* 状态 */}
                    <td className="px-5 py-3">
                      <StatusBadge
                        status={key.status === 'active' ? '启用' : '停用'}
                        type={key.status === 'active' ? 'success' : 'default'}
                      />
                    </td>
                    {/* 最后使用 */}
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : '-'}
                    </td>
                    {/* 过期时间 */}
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {key.expiresAt ? formatDate(key.expiresAt) : '-'}
                    </td>
                    {/* 创建时间 */}
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {formatDate(key.createdAt)}
                    </td>
                    {/* 操作按钮 */}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* 启用/停用 */}
                        <button
                          onClick={() => handleToggleStatus(key)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            key.status === 'active'
                              ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={key.status === 'active' ? '停用' : '启用'}
                        >
                          <RefreshCw size={15} />
                        </button>
                        {/* 删除 */}
                        <button
                          onClick={() => setDeleteKeyId(key.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="删除"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
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
        {!loading && keys.length > 0 && (
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
       * 完整密钥展示弹窗
       * ========================================== */}
      <Modal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        title="密钥已生成"
        size="md"
        footer={
          <>
            <button
              onClick={handleCopyKey}
              className="btn-primary flex items-center gap-2"
            >
              <Copy size={16} />
              {copied ? '已复制' : '复制密钥'}
            </button>
            <button
              onClick={() => setShowKeyModal(false)}
              className="btn-secondary"
            >
              我已保存
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 警告提示 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-800 mb-1">
              请立即保存此密钥
            </p>
            <p className="text-xs text-amber-700">
              关闭弹窗后将无法再次查看完整密钥。如果丢失，请重新生成。
            </p>
          </div>

          {/* 密钥展示 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              完整密钥
            </label>
            <div className="relative">
              <textarea
                readOnly
                value={rawKey}
                rows={3}
                className="input w-full text-sm font-mono bg-gray-50 pr-10"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <button
                onClick={handleCopyKey}
                className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="复制"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ==========================================
       * 删除确认弹窗
       * ========================================== */}
      <ConfirmDialog
        isOpen={!!deleteKeyId}
        onClose={() => setDeleteKeyId(null)}
        onConfirm={handleDelete}
        title="删除密钥"
        message="确定要删除此 API 密钥吗？使用该密钥的应用将立即无法访问。此操作不可撤销。"
        confirmText="删除"
        type="danger"
      />
    </div>
  );
};

export default ApiKeys;
