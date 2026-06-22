/**
 * 资料通工程管理系统 - 备用金管理
 * 管理备用金账户、领取记录和开支明细
 */

import React, { useEffect, useState } from 'react';
import { financeApi, contractApi, departmentApi } from '../../api';
import { formatDate, formatMoney, EmptyState } from '../../components/ui/Common';
import Modal from '../../components/ui/Modal';
import { Plus, Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw, User } from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface PettyCashAccount {
  id: string;
  holderName: string;
  holderIdCard?: string;
  contractId?: string;
  departmentId?: string;
  currentBalance?: number;
  totalAdvanced?: number;
  totalSpent?: number;
  contract?: { id: string; name: string };
  department?: { id: string; name: string };
  createdAt?: string;
}

interface AccountBalance {
  accountId: string;
  holderName?: string;
  totalAdvanced: number;
  totalSpent: number;
  currentBalance: number;
}

interface AdvanceRecord {
  id: string;
  amount: number;
  advanceDate: string;
  issuedBy: string;
  remark?: string;
  accountId?: string;
  createdAt?: string;
}

interface ExpenseRecord {
  id: string;
  expenseDate: string;
  handler: string;
  category?: { id: string; name: string };
  categoryName?: string;
  amount: number;
  detail?: string;
  status?: string;
  pettyCashAccountId?: string;
}

interface NewAccountForm {
  holderName: string;
  holderIdCard: string;
  contractId: string;
  departmentId: string;
  initialAdvance: string;
}

interface AdvanceForm {
  amount: string;
  advanceDate: string;
  issuedBy: string;
  remark: string;
}

const initialAccountForm: NewAccountForm = {
  holderName: '',
  holderIdCard: '',
  contractId: '',
  departmentId: '',
  initialAdvance: '',
};

const initialAdvanceForm: AdvanceForm = {
  amount: '',
  advanceDate: new Date().toISOString().slice(0, 10),
  issuedBy: '',
  remark: '',
};

/* ========================================
 * 主组件
 * ======================================== */

const PettyCashManage: React.FC = () => {
  /* ---------- 账户列表 ---------- */
  const [accounts, setAccounts] = useState<PettyCashAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  /* ---------- 选中账户详情 ---------- */
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  /* ---------- 明细数据 ---------- */
  const [detailTab, setDetailTab] = useState<'advances' | 'expenses'>('advances');
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  /* ---------- 弹窗状态 ---------- */
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  /* ---------- 表单数据 ---------- */
  const [accountForm, setAccountForm] = useState<NewAccountForm>(initialAccountForm);
  const [advanceForm, setAdvanceForm] = useState<AdvanceForm>(initialAdvanceForm);

  /* ---------- 下拉选项 ---------- */
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; contractId?: string }[]>([]);

  /* ---------- 保存状态 ---------- */
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingAdvance, setSavingAdvance] = useState(false);

  /* ---------- 初始加载 ---------- */

  useEffect(() => {
    loadAccounts();
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const [cRes, dRes] = await Promise.all([
        contractApi.getList({ pageSize: 500 }),
        departmentApi.getList({ pageSize: 500 }),
      ]);
      const contractBody = cRes.data as any;
      setContracts(contractBody?.data || contractBody || []);
      const deptBody = dRes.data as any;
      setDepartments(deptBody?.data || deptBody || []);
    } catch (err: any) {
      console.error('加载下拉选项失败', err);
    }
  };

  /* ---------- 加载账户列表 ---------- */

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await financeApi.getPettyCashAccounts();
      const body = res.data as any;
      const list = body?.data || body || [];
      setAccounts(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '加载备用金账户失败');
      console.error(err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  /* ---------- 选择账户 ---------- */

  const selectAccount = async (accountId: string) => {
    setSelectedAccountId(accountId);
    setBalance(null);
    setAdvances([]);
    setExpenses([]);
    await loadAccountBalance(accountId);
    await loadAdvances(accountId);
    setDetailTab('advances');
  };

  const loadAccountBalance = async (accountId: string) => {
    setLoadingBalance(true);
    try {
      const res = await financeApi.getPettyCashBalance(accountId);
      const body = res.data as any;
      const data = body?.data || body;
      setBalance({
        accountId,
        holderName: data?.holderName || '',
        totalAdvanced: data?.totalAdvanced || data?.total_advanced || 0,
        totalSpent: data?.totalSpent || data?.total_spent || 0,
        currentBalance: data?.currentBalance || data?.balance || 0,
      });
    } catch (err: any) {
      toast.error('加载账户余额失败');
      console.error(err);
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  /* ---------- 加载领取记录 ---------- */

  const loadAdvances = async (accountId: string) => {
    setLoadingAdvances(true);
    try {
      const res = await financeApi.getPettyCashAdvances({ accountId });
      const body = res.data as any;
      const list = body?.data || body || [];
      setAdvances(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('加载领取记录失败', err);
      setAdvances([]);
    } finally {
      setLoadingAdvances(false);
    }
  };

  /* ---------- 加载开支明细 ---------- */

  const loadExpenses = async (accountId: string) => {
    setLoadingExpenses(true);
    try {
      const res = await financeApi.getExpenses({ pettyCashAccountId: accountId, pageSize: 500 });
      const body = res.data as any;
      const listData = body?.data;
      const list = Array.isArray(listData) ? listData : (listData?.items || []);
      setExpenses(list);
    } catch (err: any) {
      console.error('加载开支明细失败', err);
      setExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  };

  /* ---------- Tab 切换 ---------- */

  const switchTab = (tab: 'advances' | 'expenses') => {
    setDetailTab(tab);
    if (!selectedAccountId) return;
    if (tab === 'advances') {
      loadAdvances(selectedAccountId);
    } else {
      loadExpenses(selectedAccountId);
    }
  };

  /* ---------- 新建账户 ---------- */

  const openAccountModal = () => {
    setAccountForm(initialAccountForm);
    setShowAccountModal(true);
  };

  const filteredDepartments = accountForm.contractId
    ? departments.filter((d) => d.contractId === accountForm.contractId)
    : departments;

  const updateAccountField = (field: keyof NewAccountForm, value: string) => {
    setAccountForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'contractId') {
        next.departmentId = '';
      }
      return next;
    });
  };

  const handleCreateAccount = async () => {
    if (!accountForm.holderName.trim()) return toast.error('请输入持卡人姓名');
    if (!accountForm.holderIdCard.trim()) return toast.error('请输入身份证号');
    if (!accountForm.contractId) return toast.error('请选择合同');
    if (!accountForm.departmentId) return toast.error('请选择项目部');
    if (!accountForm.initialAdvance || Number(accountForm.initialAdvance) <= 0) {
      return toast.error('请输入有效的初始预支金额');
    }

    setSavingAccount(true);
    try {
      await financeApi.createPettyCashAccount({
        holderName: accountForm.holderName.trim(),
        holderIdCard: accountForm.holderIdCard.trim(),
        contractId: accountForm.contractId,
        departmentId: accountForm.departmentId,
        initialAdvance: Number(accountForm.initialAdvance),
      });
      toast.success('备用金账户创建成功');
      setShowAccountModal(false);
      await loadAccounts();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '创建备用金账户失败');
      console.error(err);
    } finally {
      setSavingAccount(false);
    }
  };

  /* ---------- 记录领取 ---------- */

  const openAdvanceModal = () => {
    setAdvanceForm(initialAdvanceForm);
    setShowAdvanceModal(true);
  };

  const updateAdvanceField = (field: keyof AdvanceForm, value: string) => {
    setAdvanceForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateAdvance = async () => {
    if (!selectedAccountId) return;
    if (!advanceForm.amount || Number(advanceForm.amount) <= 0) {
      return toast.error('请输入有效的领取金额');
    }
    if (!advanceForm.advanceDate) return toast.error('请选择领取日期');
    if (!advanceForm.issuedBy.trim()) return toast.error('请输入发放人');

    setSavingAdvance(true);
    try {
      await financeApi.createPettyCashAdvance({
        accountId: selectedAccountId,
        amount: Number(advanceForm.amount),
        advanceDate: advanceForm.advanceDate,
        issuedBy: advanceForm.issuedBy.trim(),
        remark: advanceForm.remark.trim() || undefined,
      });
      toast.success('领取记录已保存');
      setShowAdvanceModal(false);
      await loadAccountBalance(selectedAccountId);
      await loadAdvances(selectedAccountId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '记录领取失败');
      console.error(err);
    } finally {
      setSavingAdvance(false);
    }
  };

  /* ---------- 获取选中账户信息 ---------- */

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  /* ---------- 渲染 ---------- */

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">备用金管理</h1>
          <p className="page-subtitle">管理备用金账户、领取记录和开支明细</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openAccountModal}>
          <Plus size={16} />
          新建账户
        </button>
      </div>

      {/* 主体：左面板 + 右面板 */}
      <div className="flex gap-4 min-h-[600px]">
        {/* ========== 左面板：账户列表 ========== */}
        <div className="w-72 flex-shrink-0">
          <div className="card p-0 overflow-hidden h-full flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">备用金账户列表</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingAccounts ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  加载中...
                </div>
              ) : accounts.length === 0 ? (
                <div className="py-12">
                  <EmptyState title="暂无备用金账户" />
                </div>
              ) : (
                <div className="py-1">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => selectAccount(account.id)}
                      className={`w-full text-left px-4 py-3 transition-colors border-l-[3px] ${
                        selectedAccountId === account.id
                          ? 'bg-blue-50 border-blue-500 text-blue-800'
                          : 'border-transparent hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          selectedAccountId === account.id
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <User size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{account.holderName || '未命名'}</p>
                          {account.department?.name && (
                            <p className="text-xs text-gray-400">{account.department.name}</p>
                          )}
                        </div>
                      </div>
                      <div className={`text-right text-sm font-mono font-semibold ${
                        (account.currentBalance ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatMoney(account.currentBalance ?? 0)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-100">
              <button
                className="w-full btn-secondary flex items-center justify-center gap-1.5 text-sm"
                onClick={openAccountModal}
              >
                <Plus size={14} />
                新建账户
              </button>
            </div>
          </div>
        </div>

        {/* ========== 右面板：账户详情 ========== */}
        <div className="flex-1 min-w-0">
          {!selectedAccountId ? (
            /* 未选择账户时的空状态 */
            <div className="card h-full flex items-center justify-center">
              <div className="text-center py-16">
                <Wallet size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 text-sm mb-1">请选择一个备用金账户</p>
                <p className="text-gray-400 text-xs">从左侧列表中选择账户以查看详情</p>
              </div>
            </div>
          ) : balance === null && loadingBalance ? (
            /* 加载余额中 */
            <div className="card h-full flex items-center justify-center">
              <div className="flex items-center gap-2 text-gray-400">
                <RefreshCw size={18} className="animate-spin" />
                <span>加载账户信息...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 账户头部信息 */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
                      <User size={28} className="text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">
                        {selectedAccount?.holderName || balance?.holderName || '-'}
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {selectedAccount?.department?.name
                          ? `${selectedAccount.contract?.name || ''} / ${selectedAccount.department.name}`
                          : '--'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-1">当前余额</p>
                    <p className={`text-3xl font-bold font-mono ${
                      (balance?.currentBalance ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatMoney(balance?.currentBalance ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card text-center">
                  <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-lg bg-blue-50">
                    <ArrowDownCircle size={20} className="text-blue-600" />
                  </div>
                  <p className="text-xs text-gray-400 mb-1">累计领取</p>
                  <p className="text-lg font-bold font-mono text-blue-700">
                    {formatMoney(balance?.totalAdvanced ?? 0)}
                  </p>
                </div>
                <div className="card text-center">
                  <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-lg bg-orange-50">
                    <ArrowUpCircle size={20} className="text-orange-600" />
                  </div>
                  <p className="text-xs text-gray-400 mb-1">累计开支</p>
                  <p className="text-lg font-bold font-mono text-orange-700">
                    {formatMoney(balance?.totalSpent ?? 0)}
                  </p>
                </div>
                <div className="card text-center">
                  <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-lg bg-green-50">
                    <Wallet size={20} className="text-green-600" />
                  </div>
                  <p className="text-xs text-gray-400 mb-1">当前余额</p>
                  <p className="text-lg font-bold font-mono text-green-700">
                    {formatMoney(balance?.currentBalance ?? 0)}
                  </p>
                </div>
              </div>

              {/* Tab 切换 + 内容 */}
              <div className="card p-0 overflow-hidden">
                {/* Tab 头部 */}
                <div className="flex items-center border-b border-gray-100">
                  <button
                    onClick={() => switchTab('advances')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                      detailTab === 'advances'
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    领取记录
                    {detailTab === 'advances' && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-full" />
                    )}
                  </button>
                  <button
                    onClick={() => switchTab('expenses')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                      detailTab === 'expenses'
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    开支明细
                    {detailTab === 'expenses' && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-full" />
                    )}
                  </button>
                </div>

                {/* Tab 内容 */}
                {detailTab === 'advances' ? (
                  <div>
                    {/* 领取记录工具栏 */}
                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        共 {advances.length} 条记录
                      </span>
                      <button
                        className="btn-primary flex items-center gap-1.5 text-sm"
                        onClick={openAdvanceModal}
                      >
                        <Plus size={14} />
                        记录领取
                      </button>
                    </div>

                    {/* 领取记录表格 */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="table-th">日期</th>
                            <th className="table-th text-right">金额</th>
                            <th className="table-th">发放人</th>
                            <th className="table-th">备注</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingAdvances ? (
                            <tr>
                              <td colSpan={4} className="table-td text-center py-12 text-gray-400">
                                加载中...
                              </td>
                            </tr>
                          ) : advances.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="table-td text-center py-12">
                                <EmptyState title="暂无领取记录" />
                              </td>
                            </tr>
                          ) : (
                            advances.map((record) => (
                              <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="table-td text-sm">
                                  {formatDate(record.advanceDate)}
                                </td>
                                <td className="table-td text-right font-mono text-sm font-semibold text-blue-600">
                                  {formatMoney(record.amount)}
                                </td>
                                <td className="table-td text-sm">{record.issuedBy || '-'}</td>
                                <td className="table-td text-sm text-gray-500 max-w-[200px] truncate">
                                  {record.remark || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* 开支明细工具栏 */}
                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        共 {expenses.length} 条记录
                      </span>
                      <button
                        className="btn-secondary flex items-center gap-1.5 text-sm"
                        onClick={() => {
                          if (selectedAccountId) loadExpenses(selectedAccountId);
                        }}
                      >
                        <RefreshCw size={14} />
                        刷新
                      </button>
                    </div>

                    {/* 开支明细表格 */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="table-th">日期</th>
                            <th className="table-th">经办人</th>
                            <th className="table-th">类别</th>
                            <th className="table-th text-right">金额</th>
                            <th className="table-th">详情</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingExpenses ? (
                            <tr>
                              <td colSpan={5} className="table-td text-center py-12 text-gray-400">
                                加载中...
                              </td>
                            </tr>
                          ) : expenses.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="table-td text-center py-12">
                                <EmptyState title="暂无开支明细" />
                              </td>
                            </tr>
                          ) : (
                            expenses.map((record) => (
                              <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="table-td text-sm">
                                  {formatDate(record.expenseDate)}
                                </td>
                                <td className="table-td text-sm font-medium">{record.handler || '-'}</td>
                                <td className="table-td text-sm">
                                  {record.category?.name || record.categoryName || '-'}
                                </td>
                                <td className="table-td text-right font-mono text-sm font-semibold text-orange-600">
                                  {formatMoney(record.amount)}
                                </td>
                                <td className="table-td text-sm text-gray-500 max-w-[250px] truncate">
                                  {record.detail || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== 模态框：新建账户 ========== */}
      <Modal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title="新建备用金账户"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                持卡人姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input"
                placeholder="请输入持卡人姓名"
                value={accountForm.holderName}
                onChange={(e) => updateAccountField('holderName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                身份证号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input"
                placeholder="请输入身份证号"
                value={accountForm.holderIdCard}
                onChange={(e) => updateAccountField('holderIdCard', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                所属合同 <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={accountForm.contractId}
                onChange={(e) => updateAccountField('contractId', e.target.value)}
              >
                <option value="">请选择合同</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                所属项目部 <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={accountForm.departmentId}
                onChange={(e) => updateAccountField('departmentId', e.target.value)}
              >
                <option value="">请选择项目部</option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              初始预支金额 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
              <input
                type="number"
                className="input pl-8"
                placeholder="请输入初始预支金额"
                value={accountForm.initialAdvance}
                onChange={(e) => updateAccountField('initialAdvance', e.target.value)}
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              className="btn-secondary"
              onClick={() => setShowAccountModal(false)}
              disabled={savingAccount}
            >
              取消
            </button>
            <button
              className="btn-primary"
              onClick={handleCreateAccount}
              disabled={savingAccount}
            >
              {savingAccount ? '创建中...' : '确认创建'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========== 模态框：记录领取 ========== */}
      <Modal
        isOpen={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
        title="记录备用金领取"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                领取金额 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                <input
                  type="number"
                  className="input pl-8"
                  placeholder="请输入领取金额"
                  value={advanceForm.amount}
                  onChange={(e) => updateAdvanceField('amount', e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                领取日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="input"
                value={advanceForm.advanceDate}
                onChange={(e) => updateAdvanceField('advanceDate', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              发放人 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="请输入发放人姓名"
              value={advanceForm.issuedBy}
              onChange={(e) => updateAdvanceField('issuedBy', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              备注
            </label>
            <textarea
              className="input min-h-[80px]"
              placeholder="请输入备注信息（选填）"
              value={advanceForm.remark}
              onChange={(e) => updateAdvanceField('remark', e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              className="btn-secondary"
              onClick={() => setShowAdvanceModal(false)}
              disabled={savingAdvance}
            >
              取消
            </button>
            <button
              className="btn-primary"
              onClick={handleCreateAdvance}
              disabled={savingAdvance}
            >
              {savingAdvance ? '保存中...' : '确认领取'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PettyCashManage;
