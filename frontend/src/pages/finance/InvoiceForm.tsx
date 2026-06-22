/**
 * 资料通工程管理系统 - 发票表单（新增/编辑）
 * Phase 4: 发票录入与编辑页面
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { financeApi, contractApi } from '../../api';
import { formatDate } from '../../components/ui/Common';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface ContractOption {
  id: string;
  name: string;
}

interface InvoiceFormData {
  contractId: string;
  invoiceNumber: string;
  invoiceType: string;
  invoiceDate: string;
  amount: string;
  taxRate: string;
  taxAmount: string;
  buyerName: string;
  description: string;
}

const initialForm: InvoiceFormData = {
  contractId: '',
  invoiceNumber: '',
  invoiceType: 'vat_special',
  invoiceDate: new Date().toISOString().slice(0, 10),
  amount: '',
  taxRate: '13',
  taxAmount: '',
  buyerName: '',
  description: '',
};

/* ========================================
 * 发票类型映射
 * ======================================== */

const invoiceTypeOptions = [
  { value: 'vat_special', label: '增值税专票' },
  { value: 'vat_normal', label: '增值税普票' },
  { value: 'normal', label: '普通发票' },
  { value: 'other', label: '其他' },
];

/* ========================================
 * 主组件
 * ======================================== */

const InvoiceForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isEdit = Boolean(editId);

  /* ---------- 表单状态 ---------- */
  const [form, setForm] = useState<InvoiceFormData>(initialForm);

  /* 下拉选项 */
  const [contracts, setContracts] = useState<ContractOption[]>([]);

  /* 页面状态 */
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  /* 税额手动覆盖标记 */
  const [taxManualOverride, setTaxManualOverride] = useState(false);

  /* ---------- 自动计算税额 ---------- */

  useEffect(() => {
    if (taxManualOverride) return;
    const amount = parseFloat(form.amount);
    const rate = parseFloat(form.taxRate);
    if (!isNaN(amount) && amount > 0 && !isNaN(rate) && rate >= 0) {
      const tax = (amount * rate) / 100;
      setForm((prev) => ({
        ...prev,
        taxAmount: tax.toFixed(2),
      }));
    } else if (!form.amount || parseFloat(form.amount) <= 0) {
      setForm((prev) => ({ ...prev, taxAmount: '' }));
    }
  }, [form.amount, form.taxRate, taxManualOverride]);

  /* ---------- 初始加载 ---------- */

  useEffect(() => {
    loadContracts();
    if (isEdit && editId) {
      loadInvoiceDetail(editId);
    }
  }, []);

  const loadContracts = async () => {
    try {
      const res = await contractApi.getList({ pageSize: 500 });
      const body = res.data as any;
      const list = body?.data?.items || body?.data || body || [];
      setContracts(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('加载合同列表失败:', err);
    }
  };

  const loadInvoiceDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await financeApi.getInvoiceDetail(id);
      const body = res.data as any;
      const data = body?.data || body || {};
      setForm({
        contractId: data.contractId || data.contract?.id || '',
        invoiceNumber: data.invoiceNumber || data.invoiceNo || '',
        invoiceType: data.invoiceType || 'vat_special',
        invoiceDate: data.invoiceDate ? data.invoiceDate.slice(0, 10) : '',
        amount: data.amount != null ? String(data.amount) : '',
        taxRate: data.taxRate != null ? String(data.taxRate) : '13',
        taxAmount: data.taxAmount != null ? String(data.taxAmount) : '',
        buyerName: data.buyerName || '',
        description: data.description || '',
      });
      if (data.taxAmount != null) {
        setTaxManualOverride(true);
      }
    } catch (err: any) {
      toast.error('加载发票详情失败');
      console.error(err);
      navigate('/finance/invoices');
    } finally {
      setLoadingDetail(false);
    }
  };

  /* ---------- 表单操作 ---------- */

  const updateField = (field: keyof InvoiceFormData, value: string) => {
    if (field === 'taxAmount') {
      setTaxManualOverride(true);
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    if (!form.contractId) return '请选择合同';
    if (!form.invoiceNumber.trim()) return '请输入发票号码';
    if (!form.invoiceDate) return '请选择开票日期';
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return '请输入有效的发票金额';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        contractId: form.contractId,
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceType: form.invoiceType,
        invoiceDate: form.invoiceDate,
        amount: parseFloat(form.amount),
        taxRate: parseFloat(form.taxRate) || 0,
        taxAmount: parseFloat(form.taxAmount) || 0,
        buyerName: form.buyerName.trim() || undefined,
        description: form.description.trim() || undefined,
      };

      if (isEdit && editId) {
        await financeApi.updateInvoice(editId, payload);
        toast.success('发票更新成功');
      } else {
        await financeApi.createInvoice(payload);
        toast.success('发票录入成功');
      }
      navigate('/finance/invoices');
    } catch (err: any) {
      const msg = err?.response?.data?.message || (isEdit ? '更新失败' : '录入失败');
      toast.error(msg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 渲染 ---------- */

  if (loadingDetail) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span>加载发票信息...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => navigate('/finance/invoices')}
            title="返回列表"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">{isEdit ? '编辑发票' : '新增发票'}</h1>
            <p className="page-subtitle">
              {isEdit ? '修改发票信息，更新后将同步关联数据' : '录入新的开票记录，关联合同和收款信息'}
            </p>
          </div>
        </div>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">发票信息</h2>
          </div>
          <div className="card-body space-y-5">
            {/* 第一行：合同 + 发票号码 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  选择合同 <span className="text-red-500">*</span>
                </label>
                <select
                  className="input w-full"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  发票号码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="请输入发票号码"
                  value={form.invoiceNumber}
                  onChange={(e) => updateField('invoiceNumber', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 第二行：发票类型 + 开票日期 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  发票类型
                </label>
                <select
                  className="input w-full"
                  value={form.invoiceType}
                  onChange={(e) => updateField('invoiceType', e.target.value)}
                >
                  {invoiceTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  开票日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="input w-full"
                  value={form.invoiceDate}
                  onChange={(e) => updateField('invoiceDate', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 第三行：金额 + 税率 + 税额 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  金额 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                  <input
                    type="number"
                    className="input w-full pl-8"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => updateField('amount', e.target.value)}
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  税率 (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="input w-full pr-8"
                    placeholder="13"
                    value={form.taxRate}
                    onChange={(e) => updateField('taxRate', e.target.value)}
                    step="0.01"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  税额
                  <span className="text-xs text-gray-400 ml-1">（自动计算，可手动修改）</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                  <input
                    type="number"
                    className={`input w-full pl-8 ${!taxManualOverride ? 'bg-gray-50 text-gray-500' : ''}`}
                    placeholder="0.00"
                    value={form.taxAmount}
                    onChange={(e) => updateField('taxAmount', e.target.value)}
                    step="0.01"
                    min="0"
                  />
                </div>
                {!taxManualOverride && form.amount && parseFloat(form.amount) > 0 && (
                  <p className="text-xs text-blue-500 mt-1">
                    自动计算：{form.amount ? parseFloat(form.amount).toLocaleString() : '0'} × {form.taxRate || '13'}% = ¥{((parseFloat(form.amount) || 0) * (parseFloat(form.taxRate) || 13) / 100).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* 第四行：购买方名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                购买方名称
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="请输入购买方公司名称"
                value={form.buyerName}
                onChange={(e) => updateField('buyerName', e.target.value)}
              />
            </div>

            {/* 第五行：描述/备注 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                描述/备注
              </label>
              <textarea
                className="input w-full min-h-[100px]"
                placeholder="请输入备注信息（可选）"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
              />
            </div>

            {/* 第六行：上传发票图片 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                上传发票图片
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <p className="text-sm text-gray-500">
                  点击或拖拽上传发票扫描件（可选，支持 JPG/PNG/PDF）
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  上传功能将在后续版本中完善
                </p>
              </div>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl flex items-center justify-end gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/finance/invoices')}
              disabled={saving}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-1.5"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {isEdit ? '更新发票' : '保存发票'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm;
