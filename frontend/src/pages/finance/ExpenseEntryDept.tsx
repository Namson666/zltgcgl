/**
 * 资料通工程管理系统 - 项目部报账
 * 项目部人员提交费用报账申请
 */

import React, { useEffect, useState } from 'react';
import { financeApi, contractApi, departmentApi } from '../../api';
import { useAuthStore } from '../../lib/AuthContext';
import { formatMoney } from '../../components/ui/Common';
import { ArrowLeft, Upload } from 'lucide-react';
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

interface PettyCashAccount {
  id: string;
  accountName: string;
  balance: number;
}

interface ExpenseForm {
  contractId: string;
  departmentId: string;
  handler: string;
  expenseDate: string;
  categoryId: string;
  subCategoryId: string;
  amount: string;
  detail: string;
  paymentMethod: 'petty_cash' | 'company_direct';
  pettyCashAccountId: string;
  vehiclePlate: string;
  receiptFile: File | null;
}

const initialForm: ExpenseForm = {
  contractId: '',
  departmentId: '',
  handler: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  categoryId: '',
  subCategoryId: '',
  amount: '',
  detail: '',
  paymentMethod: 'company_direct',
  pettyCashAccountId: '',
  vehiclePlate: '',
  receiptFile: null,
};

/* ========================================
 * 主组件
 * ======================================== */

const ExpenseEntryDept: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState<ExpenseForm>({
    ...initialForm,
    handler: user?.realName || user?.username || '',
  });

  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; contractId?: string }[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [pettyCashAccounts, setPettyCashAccounts] = useState<PettyCashAccount[]>([]);
  const [selectedAccountBalance, setSelectedAccountBalance] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSubCategories, setLoadingSubCategories] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

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

  /* ---------- 合同变更时加载下级选项 ---------- */

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

  /* ---------- 支付方式变更时加载备用金账户 ---------- */

  useEffect(() => {
    if (form.paymentMethod === 'petty_cash' && !pettyCashAccounts.length) {
      loadPettyCashAccounts();
    }
  }, [form.paymentMethod]);

  const loadPettyCashAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await financeApi.getPettyCashAccounts();
      const body = res.data as any;
      setPettyCashAccounts(body?.data || body || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  /** 选择备用金账户时查询余额 */
  const handleAccountChange = async (accountId: string) => {
    setForm((prev) => ({ ...prev, pettyCashAccountId: accountId }));
    if (!accountId) {
      setSelectedAccountBalance(null);
      return;
    }
    try {
      const res = await financeApi.getPettyCashBalance(accountId);
      const body = res.data as any;
      setSelectedAccountBalance(body?.data?.balance ?? body?.balance ?? 0);
    } catch {
      setSelectedAccountBalance(null);
    }
  };

  /* ---------- 表单操作 ---------- */

  const updateField = (field: keyof ExpenseForm, value: string | File | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      ...initialForm,
      handler: user?.realName || user?.username || '',
    });
    setSelectedAccountBalance(null);
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
    if (form.paymentMethod === 'petty_cash' && !form.pettyCashAccountId) {
      return toast.error('请选择备用金账户');
    }

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
        vehiclePlate: form.vehiclePlate || undefined,
      };

      if (form.paymentMethod === 'petty_cash') {
        payload.pettyCashAccountId = form.pettyCashAccountId;
      }

      if (form.receiptFile) {
        const formData = new FormData();
        formData.append('file', form.receiptFile);
        formData.append('data', JSON.stringify(payload));
        await financeApi.createExpense(formData);
      } else {
        await financeApi.createExpense(payload);
      }

      toast.success('费用报账提交成功');
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '提交失败');
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
          <h1 className="page-title">项目部报账</h1>
          <p className="page-subtitle">提交项目部费用报账申请，支持备用金和公司直付两种方式</p>
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

          {/* 费用类别 → 子类别 两级联动 */}
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

          {/* 支付方式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">支付方式</label>
            <div className="flex gap-6">
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
            </div>

            {/* 备用金：选账户 + 查余额 */}
            {form.paymentMethod === 'petty_cash' && (
              <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <p className="text-sm text-amber-700 font-medium">备用金支付</p>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">选择备用金账户</label>
                  <select
                    className="input"
                    value={form.pettyCashAccountId}
                    onChange={(e) => handleAccountChange(e.target.value)}
                  >
                    <option value="">请选择账户</option>
                    {pettyCashAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedAccountBalance !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">当前余额：</span>
                    <span className={`font-semibold ${selectedAccountBalance >= Number(form.amount || 0) ? 'text-green-600' : 'text-red-600'}`}>
                      {formatMoney(selectedAccountBalance)}
                    </span>
                    {Number(form.amount) > 0 && selectedAccountBalance < Number(form.amount) && (
                      <span className="text-xs text-red-500">（余额不足）</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 公司直付：提示 */}
            {form.paymentMethod === 'company_direct' && (
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  公司直付：费用由公司财务直接支付，无需使用备用金。
                </p>
              </div>
            )}
          </div>

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
              {saving ? '提交中...' : '提交报账申请'}
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

export default ExpenseEntryDept;
