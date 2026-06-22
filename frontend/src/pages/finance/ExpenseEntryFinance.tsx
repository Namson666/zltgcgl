/**
 * 资料通工程管理系统 - 公司财务凭证
 * 财务部门录入费用凭证，支持合同/项目部关联
 */

import React, { useEffect, useState } from 'react';
import { financeApi, contractApi, departmentApi } from '../../api';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface Category {
  id: string;
  name: string;
  code?: string;
}

interface SubCategory {
  id: string;
  name: string;
  categoryId: string;
}

interface FinanceForm {
  contractId: string;
  departmentId: string;
  handler: string;
  expenseDate: string;
  categoryId: string;
  subCategoryId: string;
  amount: string;
  detail: string;
  paymentMethod: 'company_direct' | 'petty_cash';
  payer: string;
  vehiclePlate: string;
  receiptFile: File | null;
}

const initialForm: FinanceForm = {
  contractId: '',
  departmentId: '',
  handler: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  categoryId: '',
  subCategoryId: '',
  amount: '',
  detail: '',
  paymentMethod: 'company_direct',
  payer: '',
  vehiclePlate: '',
  receiptFile: null,
};

/* ========================================
 * 主组件
 * ======================================== */

const ExpenseEntryFinance: React.FC = () => {
  const [form, setForm] = useState<FinanceForm>(initialForm);

  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; contractId?: string }[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSubCategories, setLoadingSubCategories] = useState(false);

  /* ---------- 加载下拉选项 ---------- */

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const [cRes, dRes, catRes] = await Promise.all([
        contractApi.getList({ pageSize: 500 }),
        departmentApi.getList({ pageSize: 500 }),
        financeApi.getCategories(),
      ]);
      const contractBody = cRes.data as any;
      setContracts(contractBody?.data || contractBody || []);
      const deptBody = dRes.data as any;
      setDepartments(deptBody?.data || deptBody || []);
      const catBody = catRes.data as any;
      setCategories(catBody?.data || catBody || []);
    } catch (err: any) {
      toast.error('加载选项失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- 合同变更时过滤项目部 ---------- */

  const filteredDepartments = form.contractId
    ? departments.filter((d) => d.contractId === form.contractId)
    : departments;

  useEffect(() => {
    if (!form.contractId) return;
    setForm((prev) => ({ ...prev, departmentId: '' }));
  }, [form.contractId]);

  /* ---------- 类别变更时加载子类别 ---------- */

  useEffect(() => {
    if (!form.categoryId) {
      setSubCategories([]);
      return;
    }
    loadSubCategories(form.categoryId);
  }, [form.categoryId]);

  const loadSubCategories = async (categoryId: string) => {
    setLoadingSubCategories(true);
    try {
      const res = await financeApi.getSubCategories(categoryId);
      const body = res.data as any;
      setSubCategories(body?.data || body || []);
    } catch (err: any) {
      console.error(err);
      setSubCategories([]);
    } finally {
      setLoadingSubCategories(false);
    }
  };

  useEffect(() => {
    setForm((prev) => ({ ...prev, subCategoryId: '' }));
  }, [form.categoryId]);

  /* ---------- 表单操作 ---------- */

  const updateField = (field: keyof FinanceForm, value: string | File | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.contractId) return toast.error('请选择合同');
    if (!form.departmentId) return toast.error('请选择项目部');
    if (!form.handler.trim()) return toast.error('请输入经办人');
    if (!form.expenseDate) return toast.error('请选择费用日期');
    if (!form.categoryId) return toast.error('请选择费用类别');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('请输入有效金额');
    if (!form.detail.trim()) return toast.error('请填写费用明细');
    if (!form.payer.trim()) return toast.error('请输入支付人/公司付款方');

    setSaving(true);
    try {
      const payload: any = {
        contractId: form.contractId,
        departmentId: form.departmentId,
        handler: form.handler.trim(),
        expenseDate: form.expenseDate,
        categoryId: form.categoryId,
        subCategoryId: form.subCategoryId || undefined,
        amount: Number(form.amount),
        detail: form.detail.trim(),
        paymentMethod: form.paymentMethod,
        payer: form.payer.trim(),
        vehiclePlate: form.vehiclePlate || undefined,
        source: 'finance',
      };

      if (form.receiptFile) {
        const formData = new FormData();
        formData.append('file', form.receiptFile);
        formData.append('data', JSON.stringify(payload));
        await financeApi.createExpense(formData);
      } else {
        await financeApi.createExpense(payload);
      }

      toast.success('财务凭证录入成功');
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '录入失败');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 判断是否显示车牌输入 ---------- */

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const showVehiclePlate = selectedCategory?.name?.includes('车辆') || selectedCategory?.code === 'vehicle';

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
          <h1 className="page-title">公司财务凭证</h1>
          <p className="page-subtitle">财务部门录入费用凭证，直接关联合同和项目部</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-2xl">
        <div className="space-y-5">
          {/* 合同 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              合同 <span className="text-red-500">*</span>
            </label>
            <select
              className="input"
              value={form.contractId}
              onChange={(e) => updateField('contractId', e.target.value)}
              required
            >
              <option value="">请选择合同</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 项目部 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              项目部 <span className="text-red-500">*</span>
            </label>
            <select
              className="input"
              value={form.departmentId}
              onChange={(e) => updateField('departmentId', e.target.value)}
              required
              disabled={!form.contractId}
            >
              <option value="">请选择项目部</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {!form.contractId && (
              <p className="text-xs text-gray-400 mt-1">请先选择合同</p>
            )}
          </div>

          {/* 经办人 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              经办人 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              value={form.handler}
              onChange={(e) => updateField('handler', e.target.value)}
              placeholder="请输入经办人姓名"
              required
            />
          </div>

          {/* 费用日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              费用日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="input"
              value={form.expenseDate}
              onChange={(e) => updateField('expenseDate', e.target.value)}
              required
            />
          </div>

          {/* 费用类别 → 子类别 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                费用类别 <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={form.categoryId}
                onChange={(e) => updateField('categoryId', e.target.value)}
                required
              >
                <option value="">请选择类别</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                子类别
              </label>
              <select
                className="input"
                value={form.subCategoryId}
                onChange={(e) => updateField('subCategoryId', e.target.value)}
                disabled={!form.categoryId || loadingSubCategories}
              >
                <option value="">
                  {loadingSubCategories ? '加载中...' : '请选择子类别（可选）'}
                </option>
                {subCategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 金额 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              金额 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
              <input
                type="number"
                className="input pl-8"
                value={form.amount}
                onChange={(e) => updateField('amount', e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          {/* 费用明细 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              费用明细 <span className="text-red-500">*</span>
            </label>
            <textarea
              className="input min-h-[100px]"
              value={form.detail}
              onChange={(e) => updateField('detail', e.target.value)}
              placeholder="请详细描述费用用途和内容..."
              required
            />
          </div>

          {/* 支付方式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">支付方式</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  className="accent-blue-600"
                  name="paymentMethod"
                  value="company_direct"
                  checked={form.paymentMethod === 'company_direct'}
                  onChange={() => updateField('paymentMethod', 'company_direct')}
                />
                <span className="text-sm text-gray-700">公司直付</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  className="accent-blue-600"
                  name="paymentMethod"
                  value="petty_cash"
                  checked={form.paymentMethod === 'petty_cash'}
                  onChange={() => updateField('paymentMethod', 'petty_cash')}
                />
                <span className="text-sm text-gray-700">备用金支付</span>
              </label>
            </div>
          </div>

          {/* 支付人 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              支付人/付款方 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              value={form.payer}
              onChange={(e) => updateField('payer', e.target.value)}
              placeholder="公司付款方名称或支付人"
              required
            />
            <p className="text-xs text-gray-400 mt-1">填写实际付款的公司账户名称或支付人</p>
          </div>

          {/* 车辆费用 - 车牌号 */}
          {showVehiclePlate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                车牌号
              </label>
              <input
                type="text"
                className="input"
                value={form.vehiclePlate}
                onChange={(e) => updateField('vehiclePlate', e.target.value)}
                placeholder="请输入车牌号"
              />
            </div>
          )}

          {/* 凭证照片上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              凭证照片（可选）
            </label>
            <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500">
                {form.receiptFile ? form.receiptFile.name : '点击上传凭证照片（发票、收据等）'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => updateField('receiptFile', e.target.files?.[0] || null)}
              />
            </label>
            {form.receiptFile && (
              <button
                type="button"
                className="text-xs text-red-500 mt-1 hover:underline"
                onClick={() => updateField('receiptFile', null)}
              >
                移除文件
              </button>
            )}
          </div>

          {/* 提交按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={saving}
            >
              {saving ? '录入中...' : '录入财务凭证'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={resetForm}
              disabled={saving}
            >
              重置
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ExpenseEntryFinance;
