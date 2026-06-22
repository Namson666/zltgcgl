/**
 * 资料通工程管理系统 - 套餐订阅管理页面
 *
 * 功能说明：
 * 开发者后台的套餐管理页面，支持套餐的增删改查。
 * 顶部区域为新增/编辑套餐的表单，下方为套餐列表。
 *
 * 页面结构：
 * 1. 页面标题区域 + 新增套餐按钮
 * 2. 新增/编辑套餐表单（可折叠）
 * 3. 套餐列表表格
 */

import React, { useState, useEffect } from 'react';
import {
  Package, Plus, Save, Trash2, Edit3, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';
import { ConfirmDialog } from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

/** 套餐信息接口 */
interface Plan {
  id: string;
  name: string;
  tier: 'SMALL' | 'MEDIUM' | 'LARGE';
  type: 'FULL' | 'MODULE';
  pricePerMonth: number;
  maxUsers: number;
  pricePerExtraUser: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** 套餐表单数据接口 */
interface PlanFormData {
  name: string;
  tier: 'SMALL' | 'MEDIUM' | 'LARGE';
  type: 'FULL' | 'MODULE';
  pricePerMonth: number;
  maxUsers: number;
  pricePerExtraUser: number;
  description: string;
}

/* ========================================
 * 常量定义
 * ======================================== */

/** 套餐等级选项 */
const TIER_OPTIONS: { value: Plan['tier']; label: string }[] = [
  { value: 'SMALL', label: '小型' },
  { value: 'MEDIUM', label: '中型' },
  { value: 'LARGE', label: '大型' },
];

/** 套餐类型选项 */
const TYPE_OPTIONS: { value: Plan['type']; label: string }[] = [
  { value: 'FULL', label: '全功能' },
  { value: 'MODULE', label: '模块化' },
];

/** 套餐等级中文映射 */
const TIER_LABELS: Record<string, string> = {
  SMALL: '小型',
  MEDIUM: '中型',
  LARGE: '大型',
};

/** 套餐类型中文映射 */
const TYPE_LABELS: Record<string, string> = {
  FULL: '全功能',
  MODULE: '模块化',
};

/** 空表单初始值 */
const EMPTY_FORM: PlanFormData = {
  name: '',
  tier: 'SMALL',
  type: 'FULL',
  pricePerMonth: 0,
  maxUsers: 10,
  pricePerExtraUser: 0,
  description: '',
};

/* ========================================
 * Plans 套餐管理组件
 * ======================================== */

const Plans: React.FC = () => {
  /* ---------- 列表状态 ---------- */
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ---------- 表单状态 ---------- */
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(EMPTY_FORM);

  /* ---------- 删除确认状态 ---------- */
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  /* ---------- 数据加载 ---------- */

  /**
   * 加载套餐列表
   */
  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await developerApi.getPlans();
      const body = res.data || res;
      const list = body.data || [];
      setPlans(list);
    } catch (error) {
      console.error('加载套餐列表失败:', error);
      toast.error('加载套餐列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  /* ---------- 表单操作 ---------- */

  /**
   * 打开新增套餐表单
   */
  const handleOpenCreate = () => {
    setEditingPlan(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  /**
   * 打开编辑套餐表单
   * @param plan - 要编辑的套餐
   */
  const handleOpenEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      tier: plan.tier,
      type: plan.type,
      pricePerMonth: plan.pricePerMonth,
      maxUsers: plan.maxUsers,
      pricePerExtraUser: plan.pricePerExtraUser,
      description: plan.description || '',
    });
    setShowForm(true);
    /* 滚动到表单区域 */
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * 取消编辑/新增
   */
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingPlan(null);
    setFormData(EMPTY_FORM);
  };

  /**
   * 提交套餐表单（新增或更新）
   */
  const handleSubmitForm = async () => {
    /* 表单验证 */
    if (!formData.name.trim()) {
      toast.error('请输入套餐名称');
      return;
    }
    if (formData.pricePerMonth < 0) {
      toast.error('月费不能为负数');
      return;
    }
    if (formData.maxUsers < 1) {
      toast.error('最大用户数至少为 1');
      return;
    }
    if (formData.pricePerExtraUser < 0) {
      toast.error('额外用户费用不能为负数');
      return;
    }

    try {
      setSaving(true);
      if (editingPlan) {
        /* 编辑模式：更新套餐 */
        await developerApi.updatePlan(editingPlan.id, formData);
        toast.success('套餐已更新');
      } else {
        /* 新增模式：创建套餐 */
        await developerApi.createPlan(formData);
        toast.success('套餐已创建');
      }
      setShowForm(false);
      setEditingPlan(null);
      setFormData(EMPTY_FORM);
      await fetchPlans();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 删除操作 ---------- */

  /**
   * 确认删除套餐
   */
  const handleDelete = async () => {
    if (!deletePlanId) return;
    try {
      await developerApi.deletePlan(deletePlanId);
      toast.success('套餐已删除');
      setDeletePlanId(null);
      await fetchPlans();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    }
  };

  /* ==========================================
   * 页面渲染
   * ========================================== */

  return (
    <div>
      {/* ========================================
       * 页面标题区域
       * ======================================== */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A2B3C' }}>套餐管理</h1>
          <p className="text-sm mt-1" style={{ color: '#8899AA' }}>管理 A 套餐订阅方案和定价</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPlans}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#8899AA' }}
            title="刷新"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> 新增套餐
          </button>
        </div>
      </div>

      {/* ========================================
       * 新增/编辑套餐表单
       * ======================================== */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h3 className="text-base font-semibold mb-4" style={{ color: '#1A2B3C' }}>
            <Package size={16} className="inline mr-1.5" />
            {editingPlan ? '编辑套餐' : '新增套餐'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* 套餐名称 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                套餐名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full text-sm"
                placeholder="例如：基础版"
              />
            </div>

            {/* 套餐等级 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                套餐等级 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as Plan['tier'] })}
                className="input w-full text-sm"
              >
                {TIER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 套餐类型 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                套餐类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Plan['type'] })}
                className="input w-full text-sm"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 月费 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">月费（元）</label>
              <input
                type="number"
                value={formData.pricePerMonth}
                onChange={(e) => setFormData({ ...formData, pricePerMonth: parseFloat(e.target.value) || 0 })}
                className="input w-full text-sm"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            {/* 最大用户数 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">最大用户数</label>
              <input
                type="number"
                value={formData.maxUsers}
                onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 0 })}
                className="input w-full text-sm"
                placeholder="10"
                min="1"
              />
            </div>

            {/* 额外用户费用 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">额外用户费用（元/人）</label>
              <input
                type="number"
                value={formData.pricePerExtraUser}
                onChange={(e) => setFormData({ ...formData, pricePerExtraUser: parseFloat(e.target.value) || 0 })}
                className="input w-full text-sm"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            {/* 描述（占满一行） */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input w-full text-sm resize-none"
                placeholder="套餐功能描述..."
                rows={2}
              />
            </div>
          </div>

          {/* 表单操作按钮 */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={handleSubmitForm}
              disabled={saving}
              className="btn-primary flex items-center gap-1.5 text-sm px-4 py-1.5"
            >
              {saving ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              {saving ? '保存中...' : editingPlan ? '保存修改' : '创建套餐'}
            </button>
            <button
              onClick={handleCancelForm}
              className="px-4 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* ========================================
       * 套餐列表
       * ======================================== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>
            <Package size={16} className="inline mr-1.5 text-gray-500" />
            所有套餐方案 ({plans.length})
          </h2>
        </div>

        {loading ? (
          /* 加载中骨架屏 */
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-5 bg-gray-100 rounded animate-pulse w-1/3" />
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : plans.length > 0 ? (
          /* 套餐列表 */
          <div className="divide-y divide-gray-50">
            {plans.map((plan) => (
              <div key={plan.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                {/* 套餐信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800">{plan.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                      {TIER_LABELS[plan.tier] || plan.tier}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                      {TYPE_LABELS[plan.type] || plan.type}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: '#8899AA' }}>
                    <span>月费：<strong className="text-gray-700">¥{plan.pricePerMonth}</strong></span>
                    <span>最大用户：<strong className="text-gray-700">{plan.maxUsers} 人</strong></span>
                    {plan.pricePerExtraUser > 0 && (
                      <span>额外用户：<strong className="text-gray-700">¥{plan.pricePerExtraUser}/人</strong></span>
                    )}
                    {plan.description && (
                      <span className="text-gray-400 truncate max-w-[300px]">{plan.description}</span>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  <button
                    onClick={() => handleOpenEdit(plan)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="编辑"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => setDeletePlanId(plan.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 空状态 */
          <div className="text-center py-12">
            <Package size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">暂无套餐方案</p>
            <p className="text-xs text-gray-300 mt-1">点击「新增套餐」创建第一个套餐方案</p>
          </div>
        )}
      </div>

      {/* ========================================
       * 删除确认对话框
       * ======================================== */}
      <ConfirmDialog
        isOpen={!!deletePlanId}
        title="删除套餐"
        message="确定要删除此套餐吗？删除后不可恢复，且已订阅此套餐的企业将受到影响。"
        confirmText="删除"
        cancelText="取消"
        type="danger"
        onConfirm={handleDelete}
        onClose={() => setDeletePlanId(null)}
      />
    </div>
  );
};

export default Plans;
