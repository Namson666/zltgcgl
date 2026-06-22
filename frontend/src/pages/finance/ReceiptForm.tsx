/**
 * 资料通工程管理系统 - 收款表单（新增/编辑）
 * Phase 4: 收款录入与编辑页面，支持智能发票关联和金额校验
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { financeApi, contractApi } from '../../api';
import { formatMoney } from '../../components/ui/Common';
import { ArrowLeft, Save, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface ContractOption {
  id: string;
  name: string;
}

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  amount: number;
  totalReceived: number;
  status: string;
}

interface ReceiptFormData {
  contractId: string;
  invoiceId: string;
  amount: string;
  receiptDate: string;
  paymentMethod: string;
  payerName: string;
  accountName: string;
  transactionNo: string;
  description: string;
}

const initialForm: ReceiptFormData = {
  contractId: '',
  invoiceId: '',
  amount: '',
  receiptDate: new Date().toISOString().slice(0, 10),
  paymentMethod: 'bank_transfer',
  payerName: '',
  accountName: '',
  transactionNo: '',
  description: '',
};

/* ========================================
 * 常量映射
 * ======================================== */

const paymentMethodOptions = [
  { value: 'bank_transfer', label: '银行转账' },
  { value: 'cash', label: '现金' },
  { value: 'check', label: '支票' },
  { value: 'other', label: '其他' },
];

/* ========================================
 * 子组件 - 发票选项
 * ======================================== */

const InvoiceOptionLabel: React.FC<{ invoice: InvoiceOption }> = ({ invoice }) => {
  const received = invoice.totalReceived ?? 0;
  const total = invoice.amount ?? 0;
  const outstanding = Math.max(total - received, 0);
  const isFullyReceived = total > 0 && received >= total;

  return (
    <div className="flex items-center justify-between w-full gap-3">
      <span className="font-mono text-sm font-medium">
        {invoice.invoiceNumber || '(无号)'}
      </span>
      <span className="text-sm text-gray-500">
        {formatMoney(total)}
      </span>
      <span className="text-xs text-gray-400">
        已收 {formatMoney(received)} / 共 {formatMoney(total)}
      </span>
      {isFullyReceived ? (
        <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
          <CheckCircle size={10} />
          已收完
        </span>
      ) : outstanding > 0 && received > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-xs text-orange-500">
          <AlertTriangle size={10} />
          未收 {formatMoney(outstanding)}
        </span>
      ) : (
        <span className="text-xs text-red-400">
          未收 {formatMoney(total)}
        </span>
      )}
    </div>
  );
};

/* ========================================
 * 主组件
 * ======================================== */

const ReceiptForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isEdit = Boolean(editId);

  /* ---------- 表单状态 ---------- */
  const [form, setForm] = useState<ReceiptFormData>(initialForm);

  /* 下拉选项 */
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);

  /* 页面状态 */
  const [loading, setLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  /* ---------- 选中发票的未收金额 ---------- */

  const selectedInvoice = useMemo(() => {
    if (!form.invoiceId) return null;
    return invoices.find((inv) => inv.id === form.invoiceId) || null;
  }, [form.invoiceId, invoices]);

  const invoiceOutstanding = useMemo(() => {
    if (!selectedInvoice) return null;
    const total = selectedInvoice.amount ?? 0;
    const received = selectedInvoice.totalReceived ?? 0;
    return Math.max(total - received, 0);
  }, [selectedInvoice]);

  /* ---------- 初始加载 ---------- */

  useEffect(() => {
    loadContracts();
    if (isEdit && editId) {
      loadReceiptDetail(editId);
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

  const loadReceiptDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res: any = await financeApi.getReceipts({ pageSize: 1 });
      /* 尝试通过详情 API 获取，若无则使用列表 API */
      let data: any = null;
      try {
        const detailRes = await financeApi.getReceipts({ id });
        const detailBody = detailRes.data as any;
        const listData = detailBody?.data;
        const items = Array.isArray(listData) ? listData : (listData?.items || []);
        data = items.length > 0 ? items[0] : null;
      } catch {
        /* 回退方案：从列表筛选 */
        const listRes = await financeApi.getReceipts({ pageSize: 100 });
        const listBody = listRes.data as any;
        const listData = listBody?.data;
        const items = Array.isArray(listData) ? listData : (listData?.items || []);
        data = items.find((item: any) => item.id === id) || null;
      }

      if (!data) {
        toast.error('未找到该收款记录');
        navigate('/finance/receipts');
        return;
      }

      const contractId = data.contractId || data.contract?.id || '';
      setForm({
        contractId,
        invoiceId: data.invoiceId || data.invoice?.id || '',
        amount: data.amount != null ? String(data.amount) : '',
        receiptDate: data.receiptDate ? data.receiptDate.slice(0, 10) : '',
        paymentMethod: data.paymentMethod || 'bank_transfer',
        payerName: data.payerName || '',
        accountName: data.accountName || '',
        transactionNo: data.transactionNo || '',
        description: data.description || '',
      });

      /* 加载该合同下的发票列表 */
      if (contractId) {
        loadInvoicesByContract(contractId);
      }
    } catch (err: any) {
      toast.error('加载收款详情失败');
      console.error(err);
      navigate('/finance/receipts');
    } finally {
      setLoadingDetail(false);
    }
  };

  /* ---------- 合同变更时加载发票列表 ---------- */

  useEffect(() => {
    if (!form.contractId) {
      setInvoices([]);
      return;
    }
    /* 编辑模式在 loadReceiptDetail 中已加载 */
    if (isEdit && loadingDetail) return;
    loadInvoicesByContract(form.contractId);
  }, [form.contractId]);

  /* 合同变更时清空发票选择 */
  useEffect(() => {
    setForm((prev) => ({ ...prev, invoiceId: '' }));
  }, [form.contractId]);

  const loadInvoicesByContract = async (contractId: string) => {
    setLoadingInvoices(true);
    try {
      const res = await financeApi.getInvoices({
        contractId,
        status: 'issued',
        pageSize: 100,
      });
      const body = res.data as any;
      const listData = body?.data;
      const items = Array.isArray(listData) ? listData : (listData?.items || []);
      setInvoices(items.map((item: any) => ({
        id: item.id,
        invoiceNumber: item.invoiceNumber || '',
        amount: item.amount || 0,
        totalReceived: item.totalReceived || item.total_received || 0,
        status: item.status || 'issued',
      })));
    } catch (err: any) {
      console.error('加载发票列表失败:', err);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  /* ---------- 表单操作 ---------- */

  const updateField = (field: keyof ReceiptFormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      /* 切换发票时不清空金额（编辑模式保留原值） */
      return next;
    });
  };

  const validate = (): string | null => {
    if (!form.contractId) return '请选择合同';
    if (!form.receiptDate) return '请选择收款日期';
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return '请输入有效的进款金额';

    /* 校验金额不超过发票未收金额 */
    if (form.invoiceId && invoiceOutstanding !== null) {
      if (amount > invoiceOutstanding) {
        return `进款金额不能超过发票未收金额 ${formatMoney(invoiceOutstanding)}`;
      }
    }

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
        invoiceId: form.invoiceId || undefined,
        amount: parseFloat(form.amount),
        receiptDate: form.receiptDate,
        paymentMethod: form.paymentMethod,
        payerName: form.payerName.trim() || undefined,
        accountName: form.accountName.trim() || undefined,
        transactionNo: form.transactionNo.trim() || undefined,
        description: form.description.trim() || undefined,
      };

      if (isEdit && editId) {
        await financeApi.updateReceipt(editId, payload);
        toast.success('收款记录更新成功');
      } else {
        await financeApi.createReceipt(payload);
        toast.success('收款记录录入成功');
      }
      navigate('/finance/receipts');
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
        <span>加载收款信息...</span>
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
            onClick={() => navigate('/finance/receipts')}
            title="返回列表"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">{isEdit ? '编辑收款' : '新增收款'}</h1>
            <p className="page-subtitle">
              {isEdit ? '修改收款记录，更新后将同步调整关联发票的已收金额' : '录入新的收款记录，可关联对应发票'}
            </p>
          </div>
        </div>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">收款信息</h2>
          </div>
          <div className="card-body space-y-5">
            {/* 第一行：选择合同 */}
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

              {/* 选择关联发票 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  选择关联发票
                  <span className="text-xs text-gray-400 ml-1">（可选）</span>
                </label>
                {!form.contractId ? (
                  <select className="input w-full text-gray-400" disabled>
                    <option>请先选择合同</option>
                  </select>
                ) : loadingInvoices ? (
                  <div className="input w-full flex items-center gap-2 text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    加载发票列表...
                  </div>
                ) : (
                  <select
                    className="input w-full"
                    value={form.invoiceId}
                    onChange={(e) => updateField('invoiceId', e.target.value)}
                  >
                    <option value="">不关联发票</option>
                    {invoices.map((inv) => {
                      const fullyReceived = (inv.totalReceived ?? 0) >= (inv.amount ?? 0) && inv.amount > 0;
                      return (
                        <option
                          key={inv.id}
                          value={inv.id}
                          disabled={fullyReceived && !isEdit}
                          className={fullyReceived ? 'text-gray-400' : ''}
                        >
                          {inv.invoiceNumber} | {formatMoney(inv.amount)} | 已收 {formatMoney(inv.totalReceived)} / 共 {formatMoney(inv.amount)}
                          {fullyReceived ? ' [已收完]' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
                {invoices.length === 0 && form.contractId && !loadingInvoices && (
                  <p className="text-xs text-gray-400 mt-1">
                    该合同下暂无已开票的发票，可先不关联
                  </p>
                )}
              </div>
            </div>

            {/* 发票金额提示 */}
            {selectedInvoice && invoiceOutstanding !== null && (
              <div className={`p-3 rounded-lg border text-sm ${
                invoiceOutstanding <= 0
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                {invoiceOutstanding <= 0 ? (
                  <span>该发票已收完，进款金额应关联其他发票</span>
                ) : (
                  <span>
                    发票 <strong>{selectedInvoice.invoiceNumber}</strong> 未收金额：<strong>{formatMoney(invoiceOutstanding)}</strong>
                    ，进款金额不能超过此数值
                  </span>
                )}
              </div>
            )}

            {/* 第二行：进款金额 + 收款日期 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  进款金额 <span className="text-red-500">*</span>
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
                {invoiceOutstanding !== null && invoiceOutstanding > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    最大可填：{formatMoney(invoiceOutstanding)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  收款日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="input w-full"
                  value={form.receiptDate}
                  onChange={(e) => updateField('receiptDate', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 第三行：收款方式 + 付款方名称 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  收款方式
                </label>
                <select
                  className="input w-full"
                  value={form.paymentMethod}
                  onChange={(e) => updateField('paymentMethod', e.target.value)}
                >
                  {paymentMethodOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  付款方名称
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="请输入付款方公司或人员名称"
                  value={form.payerName}
                  onChange={(e) => updateField('payerName', e.target.value)}
                />
              </div>
            </div>

            {/* 第四行：收款账户 + 银行流水号 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  收款账户
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="请输入收款账户名称或账号"
                  value={form.accountName}
                  onChange={(e) => updateField('accountName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  银行流水号
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="请输入银行流水号或交易凭证号"
                  value={form.transactionNo}
                  onChange={(e) => updateField('transactionNo', e.target.value)}
                />
              </div>
            </div>

            {/* 第五行：备注 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                备注
              </label>
              <textarea
                className="input w-full min-h-[80px]"
                placeholder="请输入备注信息（可选）"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl flex items-center justify-end gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/finance/receipts')}
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
                  {isEdit ? '更新收款' : '保存收款'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ReceiptForm;
