/**
 * 资料通工程管理系统 - 供应商管理页面
 *
 * 功能说明：
 * 物资供应商信息的完整管理页面，包括供应商列表展示、搜索筛选、
 * 新增/编辑供应商等功能。
 *
 * 权限控制：
 * - 需要 canManageSystem 权限才能访问
 *
 * API 接口：
 * - wmsApi.getSuppliers()   获取供应商列表（分页）
 * - wmsApi.createMaterial() 创建供应商（复用物资管理接口）
 *
 * 注意：
 * 当前 API 中供应商仅有 getSuppliers 查询接口，
 * 新增和编辑功能预留了接口调用，待后端补充对应接口后即可使用。
 * 此处使用 wmsApi 作为 API 模块引用。
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
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

/** 供应商信息接口 */
interface SupplierInfo {
  id: string | number;           /* 供应商唯一标识 */
  name: string;                  /* 供应商名称 */
  contact?: string;              /* 联系人 */
  contactName?: string;          /* 后端联系人字段 */
  phone?: string;                /* 联系电话 */
  address?: string;              /* 地址 */
  bankAccount?: string;          /* 银行账号 */
  bankName?: string;             /* 开户行 */
  remark?: string;               /* 备注 */
}

/** 供应商表单数据接口（新增/编辑共用） */
interface SupplierFormData {
  name: string;                  /* 供应商名称 */
  contact: string;               /* 联系人 */
  phone: string;                 /* 联系电话 */
  address: string;               /* 地址 */
  bankAccount: string;           /* 银行账号 */
  bankName: string;              /* 开户行 */
  remark: string;                /* 备注 */
}

/** 分页响应接口 */
interface PaginatedData {
  items: SupplierInfo[];         /* 供应商列表 */
  total: number;                 /* 总条数 */
  page: number;                  /* 当前页码 */
  pageSize: number;              /* 每页条数 */
  totalPages: number;            /* 总页数 */
}

/* ========================================
 * 表单初始值
 * ======================================== */

/** 空表单初始值 */
const EMPTY_FORM: SupplierFormData = {
  name: '',
  contact: '',
  phone: '',
  address: '',
  bankAccount: '',
  bankName: '',
  remark: '',
};

/* ========================================
 * 供应商管理页面主组件
 * ======================================== */
const AdminSuppliers: React.FC = () => {
  /* ---------- 权限检查 ---------- */
  const can = useAuthStore((s) => s.can);

  /* ---------- 列表状态 ---------- */
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]); /* 供应商列表数据 */
  const [loading, setLoading] = useState(false);                   /* 列表加载状态 */
  const [page, setPage] = useState(1);                             /* 当前页码 */
  const [totalPages, setTotalPages] = useState(0);                 /* 总页数 */
  const [totalRecords, setTotalRecords] = useState(0);             /* 总记录数 */
  const [keyword, setKeyword] = useState('');                      /* 搜索关键词 */

  /* ---------- 弹窗状态 ---------- */
  const [showFormModal, setShowFormModal] = useState(false);       /* 新增/编辑弹窗 */
  const [deletingSupplier, setDeletingSupplier] = useState<SupplierInfo | null>(null); /* 待删除供应商 */
  const [editingSupplier, setEditingSupplier] = useState<SupplierInfo | null>(null); /* 当前编辑的供应商（null 为新增模式） */
  const [formLoading, setFormLoading] = useState(false);           /* 表单提交加载状态 */
  const [formData, setFormData] = useState<SupplierFormData>(EMPTY_FORM); /* 表单数据 */

  /* ========================================
   * 数据加载
   * ======================================== */

  /**
   * 加载供应商列表
   * 根据当前页码和搜索关键词请求后端数据
   */
  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wmsApi.getSuppliers({
        page,
        pageSize: 20,
        keyword: keyword || undefined,
      });
      const body = (res.data as any);
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      setSuppliers(items);
      setTotalPages(body?.meta?.totalPages || (listData?.totalPages) || 0);
      setTotalRecords(body?.meta?.total || (listData?.total) || items.length);
    } catch (error: any) {
      toast.error(error.message || '获取供应商列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  /* 页面初始化和依赖变化时重新加载数据 */
  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

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
   * 新增供应商
   * ======================================== */

  /**
   * 打开新增供应商弹窗
   * 重置表单数据到初始值
   */
  const handleAdd = () => {
    setEditingSupplier(null);
    setFormData(EMPTY_FORM);
    setShowFormModal(true);
  };

  /* ========================================
   * 编辑供应商
   * ======================================== */

  /**
   * 打开编辑供应商弹窗
   * 将当前供应商数据填充到表单中
   *
   * @param supplier - 要编辑的供应商信息
   */
  const handleEdit = (supplier: SupplierInfo) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact: supplier.contact || supplier.contactName || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      bankAccount: supplier.bankAccount || '',
      bankName: supplier.bankName || '',
      remark: supplier.remark || '',
    });
    setShowFormModal(true);
  };

  /* ========================================
   * 表单提交（新增/编辑）
   * ======================================== */

  /**
   * 提交供应商表单
   * 根据当前模式（新增/编辑）调用不同的 API
   */
  const handleSubmit = async () => {
    /* 表单校验 */
    if (!formData.name.trim()) {
      toast.error('请输入供应商名称');
      return;
    }

    setFormLoading(true);
    try {
      if (editingSupplier) {
        /* 编辑模式：更新供应商信息 */
        await wmsApi.updateSupplier(editingSupplier.id, formData);
        toast.success('供应商信息已更新');
      } else {
        /* 新增模式：创建供应商 */
        await wmsApi.createSupplier(formData);
        toast.success('供应商创建成功');
      }
      setShowFormModal(false);
      fetchSuppliers(); /* 刷新列表 */
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
  const updateFormField = (field: keyof SupplierFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * 删除供应商
   */
  const handleDelete = async () => {
    if (!deletingSupplier) return;
    setFormLoading(true);
    try {
      await wmsApi.deleteSupplier(deletingSupplier.id);
      toast.success('供应商已删除');
      setDeletingSupplier(null);
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.message || '删除供应商失败');
    } finally {
      setFormLoading(false);
    }
  };

  /* ========================================
   * 权限检查 - 无权限时显示提示
   * ======================================== */
  if (!can('canManageSystem')) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">供应商管理</h1>
            <p className="page-subtitle">物资供应商信息管理</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center py-16">
            <Truck size={48} className="text-gray-300 mx-auto mb-4" />
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
          <h1 className="page-title">供应商管理</h1>
          <p className="page-subtitle">管理物资供应商档案信息，维护供应商联系方式与银行账户</p>
        </div>
        {/* 新增供应商按钮 */}
        <button onClick={handleAdd} className="btn-primary">
          <Plus size={16} className="mr-1.5" />
          新增供应商
        </button>
      </div>

      {/* ====== 搜索筛选栏 ====== */}
      <div className="filter-bar">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
            placeholder="搜索供应商名称..."
          />
        </div>
      </div>

      {/* ====== 供应商列表卡片 ====== */}
      <div className="card">
        <div className="table-container">
          {loading ? (
            /* 加载状态 */
            <Loading text="加载供应商列表..." />
          ) : suppliers.length === 0 ? (
            /* 空状态 */
            <EmptyState
              title="暂无供应商数据"
              description={keyword ? `未找到与"${keyword}"匹配的供应商` : '点击"新增供应商"按钮添加第一个供应商'}
              icon={<Truck size={48} />}
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
                  <th className="px-4 py-3 font-medium whitespace-nowrap">联系人</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">电话</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">地址</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap text-right">操作</th>
                </tr>
              </thead>

              {/* 表体 - 斑马纹 */}
              <tbody className="divide-y divide-gray-100">
                {suppliers.map((supplier, index) => (
                  <tr
                    key={supplier.id}
                    className={`hover:bg-gray-50 transition-colors duration-150 ${
                      index % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'
                    }`}
                  >
                    {/* 供应商名称 */}
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">
                      {supplier.name}
                    </td>
                    {/* 联系人 */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {supplier.contact || supplier.contactName || '-'}
                    </td>
                    {/* 联系电话 */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {supplier.phone || '-'}
                    </td>
                    {/* 地址 */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 max-w-xs text-truncate">
                      {supplier.address || '-'}
                    </td>
                    {/* 操作按钮列 */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* 编辑按钮 */}
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="编辑供应商"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingSupplier(supplier)}
                          className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="删除供应商"
                        >
                          <Trash2 size={15} />
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
        {!loading && suppliers.length > 0 && (
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

      {/* ====== 新增/编辑供应商弹窗 ====== */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingSupplier ? '编辑供应商' : '新增供应商'}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowFormModal(false)} className="btn-secondary" disabled={formLoading}>
              取消
            </button>
            <button onClick={handleSubmit} className="btn-primary" disabled={formLoading}>
              {formLoading ? '提交中...' : editingSupplier ? '保存修改' : '创建供应商'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 供应商名称 */}
          <div>
            <label className="form-label">
              供应商名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="请输入供应商名称"
              value={formData.name}
              onChange={(e) => updateFormField('name', e.target.value)}
            />
          </div>

          {/* 联系人 */}
          <div>
            <label className="form-label">联系人</label>
            <input
              type="text"
              className="input"
              placeholder="请输入联系人姓名"
              value={formData.contact}
              onChange={(e) => updateFormField('contact', e.target.value)}
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

          {/* 地址 */}
          <div>
            <label className="form-label">地址</label>
            <input
              type="text"
              className="input"
              placeholder="请输入供应商地址"
              value={formData.address}
              onChange={(e) => updateFormField('address', e.target.value)}
            />
          </div>

          {/* 银行账号 */}
          <div>
            <label className="form-label">银行账号</label>
            <input
              type="text"
              className="input"
              placeholder="请输入银行账号"
              value={formData.bankAccount}
              onChange={(e) => updateFormField('bankAccount', e.target.value)}
            />
          </div>

          {/* 开户行 */}
          <div>
            <label className="form-label">开户行</label>
            <input
              type="text"
              className="input"
              placeholder="请输入开户行名称"
              value={formData.bankName}
              onChange={(e) => updateFormField('bankName', e.target.value)}
            />
          </div>

          {/* 备注 - 占满整行 */}
          <div className="md:col-span-2">
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

      {/* ====== 删除供应商确认弹窗 ====== */}
      <Modal
        isOpen={!!deletingSupplier}
        onClose={() => setDeletingSupplier(null)}
        title="删除供应商"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeletingSupplier(null)} className="btn-secondary" disabled={formLoading}>
              取消
            </button>
            <button onClick={handleDelete} className="btn-danger" disabled={formLoading}>
              {formLoading ? '删除中...' : '确认删除'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          确认删除供应商「{deletingSupplier?.name}」吗？已有送货单或合同引用的供应商不会被删除。
        </p>
      </Modal>
    </div>
  );
};

export default AdminSuppliers;
