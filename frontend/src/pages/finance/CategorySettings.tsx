/**
 * 资料通工程管理系统 - 费用类别设置
 * 管理主类别和子类别，支持增删改
 */

import React, { useEffect, useState } from 'react';
import { financeApi } from '../../api';
import Modal from '../../components/ui/Modal';
import { Plus, Edit3, Trash2, ChevronRight, FolderTree } from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface Category {
  id: string;
  name: string;
  code?: string;
  sortOrder?: number;
}

interface SubCategory {
  id: string;
  name: string;
  categoryId: string;
  sortOrder?: number;
}

/* ========================================
 * 主组件
 * ======================================== */

const CategorySettings: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingSub, setLoadingSub] = useState(false);

  /* 主类别表单弹窗 */
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', sortOrder: '' });
  const [savingCategory, setSavingCategory] = useState(false);

  /* 删除主类别确认 */
  const [showDeleteCategoryConfirm, setShowDeleteCategoryConfirm] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  /* 子类别表单弹窗 */
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<SubCategory | null>(null);
  const [subForm, setSubForm] = useState({ name: '', sortOrder: '' });
  const [savingSub, setSavingSub] = useState(false);

  /* 删除子类别确认 */
  const [showDeleteSubConfirm, setShowDeleteSubConfirm] = useState(false);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);
  const [deletingSub, setDeletingSub] = useState(false);

  /* ---------- 加载主类别 ---------- */

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getCategories();
      const body = res.data as any;
      const data = body?.data || body || [];
      setCategories(data);
      // 如果当前没有选中且列表非空，自动选中第一个
      if (!selectedCategory && data.length > 0) {
        setSelectedCategory(data[0]);
      }
    } catch (err: any) {
      toast.error('加载类别失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- 选择主类别 → 加载子类别 ---------- */

  const selectCategory = (cat: Category) => {
    setSelectedCategory(cat);
    loadSubCategories(cat.id);
  };

  const loadSubCategories = async (categoryId: string) => {
    setLoadingSub(true);
    try {
      const res = await financeApi.getSubCategories(categoryId);
      const body = res.data as any;
      setSubCategories(body?.data || body || []);
    } catch (err: any) {
      console.error(err);
      setSubCategories([]);
    } finally {
      setLoadingSub(false);
    }
  };

  /* ---------- 主类别 CRUD ---------- */

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', sortOrder: '' });
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, sortOrder: String(cat.sortOrder || 0) });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return toast.error('请输入类别名称');

    setSavingCategory(true);
    try {
      if (editingCategory) {
        await financeApi.updateCategory(editingCategory.id, {
          name: categoryForm.name.trim(),
          sortOrder: Number(categoryForm.sortOrder) || 0,
        });
        toast.success('类别更新成功');
      } else {
        await financeApi.createCategory({
          name: categoryForm.name.trim(),
          sortOrder: Number(categoryForm.sortOrder) || 0,
        });
        toast.success('类别创建成功');
      }
      setShowCategoryModal(false);
      loadCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '保存失败');
      console.error(err);
    } finally {
      setSavingCategory(false);
    }
  };

  const openDeleteCategoryConfirm = (catId: string) => {
    setDeletingCategoryId(catId);
    setShowDeleteCategoryConfirm(true);
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategoryId) return;
    setDeletingCategory(true);
    try {
      await financeApi.deleteCategory(deletingCategoryId);
      toast.success('类别已删除');
      setShowDeleteCategoryConfirm(false);
      setDeletingCategoryId(null);
      // 如果删除的是当前选中的类别，清除选中
      if (selectedCategory?.id === deletingCategoryId) {
        setSelectedCategory(null);
        setSubCategories([]);
      }
      loadCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
      console.error(err);
    } finally {
      setDeletingCategory(false);
    }
  };

  /* ---------- 子类别 CRUD ---------- */

  const openCreateSub = () => {
    setEditingSub(null);
    setSubForm({ name: '', sortOrder: '' });
    setShowSubModal(true);
  };

  const openEditSub = (sub: SubCategory) => {
    setEditingSub(sub);
    setSubForm({ name: sub.name, sortOrder: String(sub.sortOrder || 0) });
    setShowSubModal(true);
  };

  const handleSaveSub = async () => {
    if (!subForm.name.trim()) return toast.error('请输入子类别名称');
    if (!selectedCategory) return toast.error('请先选择主类别');

    setSavingSub(true);
    try {
      if (editingSub) {
        await financeApi.updateSubCategory(editingSub.id, {
          name: subForm.name.trim(),
          sortOrder: Number(subForm.sortOrder) || 0,
        });
        toast.success('子类别更新成功');
      } else {
        await financeApi.createSubCategory({
          name: subForm.name.trim(),
          categoryId: selectedCategory.id,
          sortOrder: Number(subForm.sortOrder) || 0,
        });
        toast.success('子类别创建成功');
      }
      setShowSubModal(false);
      loadSubCategories(selectedCategory.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || '保存失败');
      console.error(err);
    } finally {
      setSavingSub(false);
    }
  };

  const openDeleteSubConfirm = (subId: string) => {
    setDeletingSubId(subId);
    setShowDeleteSubConfirm(true);
  };

  const handleDeleteSub = async () => {
    if (!deletingSubId || !selectedCategory) return;
    setDeletingSub(true);
    try {
      await financeApi.deleteSubCategory(deletingSubId);
      toast.success('子类别已删除');
      setShowDeleteSubConfirm(false);
      setDeletingSubId(null);
      loadSubCategories(selectedCategory.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
      console.error(err);
    } finally {
      setDeletingSub(false);
    }
  };

  /* ---------- 渲染 ---------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">费用类别设置</h1>
          <p className="page-subtitle">管理费用主类别和子类别，拖拽排序即将支持</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：主类别列表 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">主类别</h3>
            <button className="btn-primary text-xs px-3 py-1.5" onClick={openCreateCategory}>
              <Plus size={14} /> 新增
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <FolderTree size={40} className="mx-auto mb-2 text-gray-300" />
              暂无费用类别
            </div>
          ) : (
            <div className="space-y-0.5">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors group ${
                    selectedCategory?.id === cat.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  onClick={() => selectCategory(cat)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight size={14} className={`flex-shrink-0 ${
                      selectedCategory?.id === cat.id ? 'text-blue-500' : 'text-gray-400'
                    }`} />
                    <span className="text-sm truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditCategory(cat); }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="编辑"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openDeleteCategoryConfirm(cat.id); }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {categories.length > 0 && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              共 {categories.length} 个主类别
            </p>
          )}
        </div>

        {/* 右侧：子类别列表 */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              {selectedCategory ? (
                <>子类别 - <span className="text-blue-600">{selectedCategory.name}</span></>
              ) : (
                '子类别'
              )}
            </h3>
            {selectedCategory && (
              <button className="btn-primary text-xs px-3 py-1.5" onClick={openCreateSub}>
                <Plus size={14} /> 新增子类别
              </button>
            )}
          </div>

          {!selectedCategory ? (
            <div className="text-center py-16 text-gray-400">
              <FolderTree size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">请从左侧选择一个主类别</p>
            </div>
          ) : loadingSub ? (
            <div className="text-center py-12 text-gray-400">加载中...</div>
          ) : subCategories.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm mb-2">该类别下暂无子类别</p>
              <button
                className="text-xs text-blue-600 hover:underline"
                onClick={openCreateSub}
              >
                点击新增子类别
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {subCategories.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 group transition-colors"
                >
                  <span className="text-sm text-gray-700">{sub.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditSub(sub)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="编辑"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => openDeleteSubConfirm(sub.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedCategory && subCategories.length > 0 && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              共 {subCategories.length} 个子类别
            </p>
          )}
        </div>
      </div>

      {/* 主类别表单弹窗 */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={editingCategory ? '编辑主类别' : '新增主类别'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              类别名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如：办公费、差旅费、车辆费用"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              排序序号
            </label>
            <input
              type="number"
              className="input"
              value={categoryForm.sortOrder}
              onChange={(e) => setCategoryForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
              placeholder="数字越小越靠前"
              min="0"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              className="btn-secondary"
              onClick={() => setShowCategoryModal(false)}
              disabled={savingCategory}
            >
              取消
            </button>
            <button
              className="btn-primary"
              onClick={handleSaveCategory}
              disabled={savingCategory}
            >
              {savingCategory ? '保存中...' : (editingCategory ? '保存修改' : '创建')}
            </button>
          </div>
        </div>
      </Modal>

      {/* 删除主类别确认弹窗 */}
      <Modal
        isOpen={showDeleteCategoryConfirm}
        onClose={() => setShowDeleteCategoryConfirm(false)}
        title="删除主类别"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            确定要删除该主类别吗？删除后其下的所有子类别也将一并删除，此操作不可撤销。
          </p>
          <div className="flex gap-3 justify-end">
            <button
              className="btn-secondary"
              onClick={() => setShowDeleteCategoryConfirm(false)}
              disabled={deletingCategory}
            >
              取消
            </button>
            <button
              className="btn-danger"
              onClick={handleDeleteCategory}
              disabled={deletingCategory}
            >
              {deletingCategory ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 子类别表单弹窗 */}
      <Modal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
        title={editingSub ? '编辑子类别' : '新增子类别'}
        size="sm"
      >
        <div className="space-y-4">
          {!editingSub && selectedCategory && (
            <div className="p-2 bg-gray-50 rounded text-sm text-gray-600">
              所属主类别：<span className="font-medium">{selectedCategory.name}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              子类别名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              value={subForm.name}
              onChange={(e) => setSubForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如：燃油费、过路费、停车费"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              排序序号
            </label>
            <input
              type="number"
              className="input"
              value={subForm.sortOrder}
              onChange={(e) => setSubForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
              placeholder="数字越小越靠前"
              min="0"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              className="btn-secondary"
              onClick={() => setShowSubModal(false)}
              disabled={savingSub}
            >
              取消
            </button>
            <button
              className="btn-primary"
              onClick={handleSaveSub}
              disabled={savingSub}
            >
              {savingSub ? '保存中...' : (editingSub ? '保存修改' : '创建')}
            </button>
          </div>
        </div>
      </Modal>

      {/* 删除子类别确认弹窗 */}
      <Modal
        isOpen={showDeleteSubConfirm}
        onClose={() => setShowDeleteSubConfirm(false)}
        title="删除子类别"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            确定要删除该子类别吗？此操作不可撤销。
          </p>
          <div className="flex gap-3 justify-end">
            <button
              className="btn-secondary"
              onClick={() => setShowDeleteSubConfirm(false)}
              disabled={deletingSub}
            >
              取消
            </button>
            <button
              className="btn-danger"
              onClick={handleDeleteSub}
              disabled={deletingSub}
            >
              {deletingSub ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CategorySettings;
