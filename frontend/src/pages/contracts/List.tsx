/**
 * 资料通工程管理系统 - 合同管理列表页面
 *
 * 功能说明：
 * 工程合同的完整管理页面，包括合同的增删改查、进度款收款管理等功能。
 *
 * 主要功能：
 * 1. 合同列表展示（表格形式，含斑马纹和分页）
 * 2. 搜索筛选（按名称/编号搜索，按类型筛选）
 * 3. 新增合同（弹窗表单）
 * 4. 编辑合同（弹窗表单，回填数据）
 * 5. 查看合同详情（含进度款收款列表）
 * 6. 新增进度款收款记录
 * 7. 删除合同（软删除，二次确认）
 * 8. 分页导航
 *
 * 权限控制：
 * - contract:create - 显示新增按钮
 * - contract:edit - 显示编辑按钮
 * - contract:delete - 显示删除按钮
 * - contract:view - 显示查看详情按钮
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  FileText,
  DollarSign,
  Loader2,
  Upload,
  Paperclip,
  X,
} from 'lucide-react';

/* 导入 API 接口 */
import { contractApi, wmsApi, downloadBlob } from '@/api';
import type { PaginatedResponse } from '@/api';

/* 导入通用组件 */
import Modal from '@/components/ui/Modal';
import {
  Pagination,
  EmptyState,
  ConfirmDialog,
  StatusBadge,
  SearchInput,
  formatMoney,
  formatDate,
} from '@/components/ui/Common';

/* 导入认证 Store（权限控制） */
import { useAuthStore } from '@/lib/AuthContext';

/* ========================================
 * 类型定义
 * ======================================== */

/** 合同信息接口 */
interface Contract {
  id: number;                    /* 合同唯一标识 */
  name: string;                  /* 合同名称 */
  code: string;                  /* 合同编号 */
  type: string;                  /* 合同类型：purchase(采购合同) / construction(承包合同) */
  totalAmount: number;           /* 合同总金额 */
  status: string;                /* 合同状态：active(生效中) / inactive(已终止) */
  supplierId?: number;           /* 供应商 ID（采购合同时使用） */
  supplierName?: string;         /* 供应商名称 */
  startDate?: string;            /* 合同开始日期 */
  endDate?: string;              /* 合同结束日期 */
  description?: string;          /* 合同描述 */
  createdAt: string;             /* 创建时间 */
  updatedAt?: string;            /* 更新时间 */
}

/** 进度款收款记录接口 */
interface ProgressPayment {
  id: number;                    /* 记录唯一标识 */
  contractId: number;            /* 所属合同 ID */
  installment: number;           /* 期次 */
  amount: number;                /* 收款金额 */
  percentage?: number;           /* 占比（百分比） */
  paymentDate?: string;          /* 收款日期 */
  description?: string;          /* 描述/备注 */
  status?: string;               /* 状态 */
  createdAt: string;             /* 创建时间 */
}

/** 分包合同信息接口 */
interface SubContract {
  id: string;
  name?: string;
  totalAmount?: number;
  isActive?: boolean;
  createdAt?: string;
  contract?: { id: string; name: string; code?: string | null };
  subcontractor?: { companyName?: string | null; contactName?: string | null; type?: string | null };
}

/** 供应商信息接口（简化版） */
interface Supplier {
  id: number;                    /* 供应商 ID */
  name: string;                  /* 供应商名称 */
}

/** 合同表单数据接口 */
interface ContractFormData {
  name: string;                  /* 合同名称 */
  code: string;                  /* 合同编号 */
  type: string;                  /* 合同类型 */
  totalAmount: string;           /* 合同总金额（字符串，方便表单处理） */
  supplierId: string;            /* 供应商 ID（字符串，方便表单处理） */
  awardingParty: string;         /* 发包方（承包合同时使用） */
  startDate: string;             /* 开始日期 */
  endDate: string;               /* 结束日期 */
  description: string;           /* 描述 */
}

/** 进度款表单数据接口 */
interface ProgressPaymentFormData {
  installment: string;           /* 期次 */
  amount: string;                /* 收款金额 */
  percentage: string;            /* 占比 */
  paymentDate: string;           /* 收款日期 */
  description: string;           /* 描述 */
}

/* ========================================
 * 合同类型映射
 * 用于将后端类型标识转换为中文显示
 * ======================================== */
const CONTRACT_TYPE_MAP: Record<string, string> = {
  PROCUREMENT: '采购合同',           /* 采购类合同 */
  CONSTRUCTION: '承包合同',          /* 承包类合同 */
};

/** 合同类型选项（用于下拉选择，值与后端一致） */
const CONTRACT_TYPE_OPTIONS = [
  { value: 'PROCUREMENT', label: '采购合同' },
  { value: 'CONSTRUCTION', label: '承包合同' },
];

type ContractTab = 'CONSTRUCTION' | 'PROCUREMENT' | 'SUBCONTRACT';

const CONTRACT_TABS: Array<{ key: ContractTab; label: string; description: string }> = [
  { key: 'CONSTRUCTION', label: '承包合同', description: '承包合同、合同附件、收款记录' },
  { key: 'PROCUREMENT', label: '采购合同', description: '采购合同、发票、附件、支付记录' },
  { key: 'SUBCONTRACT', label: '分包合同', description: '分包合同、班组关联、付款/结算凭证' },
];

/** 合同状态映射及样式配置 */
const CONTRACT_STATUS_MAP: Record<string, { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  active: { label: '生效中', type: 'success' },       /* 生效中 - 绿色 */
  inactive: { label: '已终止', type: 'danger' },       /* 已终止 - 红色 */
};

/* ========================================
 * 默认表单值
 * ======================================== */

/** 合同表单默认值 */
const DEFAULT_CONTRACT_FORM: ContractFormData = {
  name: '',
  code: '',
  type: 'PROCUREMENT',
  totalAmount: '',
  supplierId: '',
  awardingParty: '',
  startDate: '',
  endDate: '',
  description: '',
};

/** 进度款表单默认值 */
const DEFAULT_PAYMENT_FORM: ProgressPaymentFormData = {
  installment: '',
  amount: '',
  percentage: '',
  paymentDate: '',
  description: '',
};

/* ========================================
 * 合同管理列表组件
 * ======================================== */
const ContractList: React.FC = () => {
  /* ---------- 权限检查 ---------- */
  const { can } = useAuthStore();

  /* ---------- 列表数据状态 ---------- */
  const [contracts, setContracts] = useState<Contract[]>([]);   /* 合同列表数据 */
  const [subContracts, setSubContracts] = useState<SubContract[]>([]); /* 分包合同列表 */
  const [loading, setLoading] = useState<boolean>(false);        /* 加载状态 */
  const [totalRecords, setTotalRecords] = useState<number>(0);   /* 总记录数 */
  const [totalPages, setTotalPages] = useState<number>(1);       /* 总页数 */

  /* ---------- 搜索筛选状态 ---------- */
  const [keyword, setKeyword] = useState<string>('');            /* 搜索关键词 */
  const [activeTab, setActiveTab] = useState<ContractTab>('CONSTRUCTION'); /* 当前合同 tab */
  const [currentPage, setCurrentPage] = useState<number>(1);     /* 当前页码 */
  const pageSize = 20;                                            /* 每页条数 */

  /* ---------- 弹窗状态 ---------- */
  const [showFormModal, setShowFormModal] = useState(false);     /* 新增/编辑合同弹窗 */
  const [showDetailModal, setShowDetailModal] = useState(false); /* 查看详情弹窗 */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); /* 删除确认弹窗 */
  const [showPaymentModal, setShowPaymentModal] = useState(false);   /* 新增进度款弹窗 */

  /* ---------- 表单状态 ---------- */
  const [editingContract, setEditingContract] = useState<Contract | null>(null); /* 当前编辑的合同（null 为新增模式） */
  const [formData, setFormData] = useState<ContractFormData>(DEFAULT_CONTRACT_FORM); /* 合同表单数据 */
  const [formLoading, setFormLoading] = useState(false);         /* 表单提交加载状态 */

  /* ---------- 详情与进度款状态 ---------- */
  const [detailContract, setDetailContract] = useState<Contract | null>(null); /* 查看的合同详情 */
  const [progressPayments, setProgressPayments] = useState<ProgressPayment[]>([]); /* 进度款列表 */
  const [paymentsLoading, setPaymentsLoading] = useState(false); /* 进度款加载状态 */
  const [paymentForm, setPaymentForm] = useState<ProgressPaymentFormData>(DEFAULT_PAYMENT_FORM); /* 进度款表单 */
  const [paymentLoading, setPaymentLoading] = useState(false);   /* 进度款提交加载状态 */

  /* ---------- 删除操作状态 ---------- */
  const [deletingContract, setDeletingContract] = useState<Contract | null>(null); /* 待删除的合同 */
  const [deleteLoading, setDeleteLoading] = useState(false);     /* 删除操作加载状态 */

  /* ---------- 附件状态 ---------- */
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  /* ---------- 供应商列表（采购合同选择供应商用） ---------- */
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);    /* 供应商列表 */

  /* ========================================
   * 数据加载方法
   * ======================================== */

  /**
   * 加载合同列表
   * 根据当前搜索条件、筛选条件和分页参数请求后端数据
   */
  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      /* 构建请求参数 */
      const params: any = {
        page: currentPage,
        pageSize,
      };
      if (activeTab === 'SUBCONTRACT') {
        const subRes = await contractApi.getSubContracts({ page: currentPage, pageSize, search: keyword.trim() || undefined } as any);
        const subBody: any = subRes.data || {};
        const list = subBody.data || [];
        setSubContracts(Array.isArray(list) ? list : []);
        setContracts([]);
        setTotalRecords(subBody.pagination?.total || list.length || 0);
        setTotalPages(subBody.pagination?.totalPages || Math.max(1, Math.ceil((subBody.pagination?.total || list.length || 0) / pageSize)));
        return;
      }
      /* 搜索关键词（非空时添加） */
      if (keyword.trim()) {
        params.search = keyword.trim();
      }
      params.type = activeTab;
      /* 默认只显示生效中的合同（isActive=true），不显示已删除的 */
      params.isActive = 'true';

      const res = await contractApi.getList(params);
      const body: any = res.data;
      /* 将后端返回的 isActive 布尔值转换为前端 status 字符串 */
      const contractsData = (body.data || []).map((c: any) => ({
        ...c,
        status: c.isActive ? 'active' : 'inactive',
      }));
      setContracts(Array.isArray(contractsData) ? contractsData : []);
      setSubContracts([]);
      setTotalRecords(body.pagination?.total || 0);
      setTotalPages(body.pagination?.totalPages || 1);
    } catch (error: any) {
      toast.error(error.message || '加载合同列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, keyword, activeTab, pageSize]);

  /**
   * 加载供应商列表
   * 用于采购合同表单中的供应商下拉选择
   */
  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await wmsApi.getSuppliers({ pageSize: 100 });
      const data: any = res.data || res;
      setSuppliers(data.items || data || []);
    } catch (error: any) {
      console.error('加载供应商列表失败:', error);
    }
  }, []);

  /**
   * 加载合同进度款列表
   * @param contractId - 合同 ID
   */
  const fetchProgressPayments = useCallback(async (contractId: number) => {
    try {
      setPaymentsLoading(true);
      const res = await contractApi.getProgressPayments(contractId);
      const body: any = res.data;
      const payments = body?.data?.payments || body?.payments || [];
      setProgressPayments(Array.isArray(payments) ? payments : []);
    } catch (error: any) {
      toast.error(error.message || '加载进度款列表失败');
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  /**
   * 加载合同附件列表
   */
  const fetchAttachments = useCallback(async (contractId: number) => {
    try {
      setAttachmentsLoading(true);
      const res = await contractApi.getAttachments(contractId);
      const body: any = res.data;
      setAttachments(body?.data || body || []);
    } catch { setAttachments([]); }
    finally { setAttachmentsLoading(false); }
  }, []);

  /**
   * 打开文件选择器
   */
  const handleUploadClick = useCallback(() => {
    uploadRef.current?.click();
  }, []);

  /**
   * 处理文件选择并上传
   */
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !detailContract) return;

    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    formData.append('contractId', String(detailContract.id));
    formData.append('category', 'contract');

    try {
      setUploading(true);
      await contractApi.uploadAttachment(formData);
      toast.success('附件上传成功');
      if (detailContract) fetchAttachments(detailContract.id);
    } catch { toast.error('附件上传失败'); }
    finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  }, [detailContract, fetchAttachments]);

  /**
   * 删除附件
   */
  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    try {
      await contractApi.deleteAttachment(attachmentId);
      toast.success('附件已删除');
      setAttachments(prev => prev.filter((a: any) => a.id !== attachmentId));
      if (detailContract) fetchAttachments(detailContract.id);
    } catch { toast.error('删除附件失败'); }
  }, [detailContract, fetchAttachments]);

  /**
   * 下载附件
   */
  const handleDownloadAttachment = useCallback(async (attachment: any) => {
    try {
      const res = await contractApi.downloadAttachment(attachment.id);
      downloadBlob(res.data as Blob, attachment.fileName || '合同附件');
    } catch {
      toast.error('附件下载失败');
    }
  }, []);

  /* ---------- 页面初始化时加载数据 ---------- */
  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  /* ========================================
   * 搜索与筛选方法
   * ======================================== */

  /**
   * 执行搜索
   * 重置页码到第 1 页后重新加载数据
   */
  const handleSearch = useCallback((value: string) => {
    setKeyword(value);
    setCurrentPage(1);
  }, []);

  /**
   * 类型筛选变化
   * 重置页码到第 1 页后重新加载数据
   */
  const handleTabChange = useCallback((value: ContractTab) => {
    setActiveTab(value);
    setCurrentPage(1);
  }, []);

  /**
   * 页码变化
   */
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  /* ========================================
   * 合同表单操作方法
   * ======================================== */

  /**
   * 打开新增合同弹窗
   * 重置表单为默认值
   */
  const handleOpenCreate = useCallback(() => {
    if (activeTab === 'SUBCONTRACT') {
      toast('分包合同新建将在下一切片接入班组/付款/结算凭证流程');
      return;
    }
    setEditingContract(null);
    setFormData({ ...DEFAULT_CONTRACT_FORM, type: activeTab });
    setShowFormModal(true);
  }, [activeTab]);

  /**
   * 打开编辑合同弹窗
   * 将合同数据回填到表单中
   * @param contract - 要编辑的合同对象
   */
  const handleOpenEdit = useCallback((contract: Contract) => {
    setEditingContract(contract);
    setFormData({
      name: contract.name || '',
      code: contract.code || '',
      type: contract.type || 'PROCUREMENT',
      totalAmount: contract.totalAmount ? String(contract.totalAmount) : '',
      supplierId: contract.supplierId ? String(contract.supplierId) : '',
      awardingParty: (contract as any).awardingParty || '',
      startDate: contract.startDate ? contract.startDate.split('T')[0] : '',
      endDate: contract.endDate ? contract.endDate.split('T')[0] : '',
      description: contract.description || '',
    });
    setShowFormModal(true);
  }, []);

  /**
   * 处理合同表单提交
   * 根据当前是新增还是编辑模式调用不同 API
   */
  const handleFormSubmit = useCallback(async () => {
    /* 表单校验 */
    if (!formData.name.trim()) {
      toast.error('请输入合同名称');
      return;
    }

    try {
      setFormLoading(true);
      /* 构建提交数据 */
      const submitData: any = {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        type: formData.type,
        totalAmount: formData.totalAmount ? Number(formData.totalAmount) : undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        description: formData.description.trim() || undefined,
      };
      /* 采购合同时添加供应商 ID（直接传字符串，后端 Prisma 字段为 String?） */
      if (formData.type === 'PROCUREMENT' && formData.supplierId) {
        submitData.supplierId = formData.supplierId;
      }
      /* 承包合同时添加发包方 */
      if (formData.type === 'CONSTRUCTION' && formData.awardingParty.trim()) {
        submitData.awardingParty = formData.awardingParty.trim();
      }

      if (editingContract) {
        /* 编辑模式：调用更新接口 */
        await contractApi.update(editingContract.id, submitData);
        toast.success('合同更新成功');
      } else {
        /* 新增模式：调用创建接口 */
        await contractApi.create(submitData);
        toast.success('合同创建成功');
      }

      /* 关闭弹窗并刷新列表 */
      setShowFormModal(false);
      fetchContracts();
    } catch (error: any) {
      toast.error(error.message || '操作失败，请重试');
    } finally {
      setFormLoading(false);
    }
  }, [formData, editingContract, fetchContracts]);

  /* ========================================
   * 合同详情与进度款方法
   * ======================================== */

  /**
   * 打开合同详情弹窗
   * 同时加载该合同的进度款列表
   * @param contract - 要查看的合同对象
   */
  const handleOpenDetail = useCallback(async (contract: Contract) => {
    setDetailContract(contract);
    setShowDetailModal(true);
    /* 加载进度款数据 */
    await fetchProgressPayments(contract.id);
    /* 加载附件 */
    await fetchAttachments(contract.id);
  }, [fetchProgressPayments, fetchAttachments]);

  /**
   * 打开新增进度款弹窗
   * 重置进度款表单
   */
  const handleOpenPaymentModal = useCallback(() => {
    setPaymentForm(DEFAULT_PAYMENT_FORM);
    setShowPaymentModal(true);
  }, []);

  /**
   * 处理进度款表单提交
   */
  const handlePaymentSubmit = useCallback(async () => {
    /* 表单校验 */
    if (!paymentForm.installment || isNaN(Number(paymentForm.installment))) {
      toast.error('请输入有效的期次');
      return;
    }
    if (!paymentForm.amount || isNaN(Number(paymentForm.amount))) {
      toast.error('请输入有效的收款金额');
      return;
    }

    if (!detailContract) return;

    try {
      setPaymentLoading(true);
      /* 构建提交数据 */
      const submitData: any = {
        installment: Number(paymentForm.installment),
        amount: Number(paymentForm.amount),
        paymentDate: paymentForm.paymentDate || undefined,
        description: paymentForm.description.trim() || undefined,
      };
      /* 占比（可选） */
      if (paymentForm.percentage) {
        submitData.percentage = Number(paymentForm.percentage);
      }

      await contractApi.createProgressPayment(detailContract.id, submitData);
      toast.success('进度款记录创建成功');
      /* 关闭弹窗并刷新进度款列表 */
      setShowPaymentModal(false);
      await fetchProgressPayments(detailContract.id);
    } catch (error: any) {
      toast.error(error.message || '创建进度款记录失败');
    } finally {
      setPaymentLoading(false);
    }
  }, [paymentForm, detailContract, fetchProgressPayments]);

  /* ========================================
   * 删除操作方法
   * ======================================== */

  /**
   * 打开删除确认弹窗
   * @param contract - 要删除的合同对象
   */
  const handleOpenDelete = useCallback((contract: Contract) => {
    setDeletingContract(contract);
    setShowDeleteConfirm(true);
  }, []);

  /**
   * 确认删除合同
   * 调用软删除接口
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!deletingContract) return;

    try {
      setDeleteLoading(true);
      await contractApi.delete(deletingContract.id);
      toast.success('合同已删除');
      /* 关闭确认弹窗并刷新列表 */
      setShowDeleteConfirm(false);
      setDeletingContract(null);
      fetchContracts();
    } catch (error: any) {
      toast.error(error.message || '删除失败，请重试');
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingContract, fetchContracts]);

  /* ========================================
   * 计算进度款汇总数据
   * ======================================== */

  /** 已收款总额 */
  const totalPaymentAmount = progressPayments.reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  /** 收款进度百分比 */
  const paymentProgress = detailContract?.totalAmount
    ? Math.min(100, (totalPaymentAmount / detailContract.totalAmount) * 100)
    : 0;

  /* ========================================
   * 渲染：加载状态
   * ======================================== */
  if (loading && (activeTab === 'SUBCONTRACT' ? subContracts.length === 0 : contracts.length === 0)) {
    return (
      <div className="flex items-center justify-center py-32">
        {/* 加载旋转图标 */}
        <Loader2 size={40} className="animate-spin text-[#0066CC]" />
      </div>
    );
  }

  /* ========================================
   * 渲染：主页面
   * ======================================== */
  return (
    <div>
      {/* ========== 页面标题区域 ========== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">合同管理</h1>
          <p className="page-subtitle">承包合同、采购合同、分包合同统一管理</p>
        </div>
        {/* 新增按钮（需要 contract:create 权限） */}
        {can('contract:create') && (
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus size={16} className="mr-1.5" />
            {activeTab === 'SUBCONTRACT' ? '新增分包合同' : `新增${CONTRACT_TABS.find(t => t.key === activeTab)?.label || '合同'}`}
          </button>
        )}
      </div>

      {/* ========== 合同类型 Tab ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {CONTRACT_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className="text-left rounded-xl border p-4 transition-colors"
              style={{
                borderColor: active ? '#0066CC' : 'var(--border)',
                backgroundColor: active ? '#EFF6FF' : '#fff',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: active ? '#0066CC' : '#1A2B3C' }}>{tab.label}</span>
                {active && <span className="badge badge-blue">当前</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">{tab.description}</p>
            </button>
          );
        })}
      </div>

      {/* ========== 搜索筛选栏 ========== */}
      <div className="filter-bar">
        {/* 搜索输入框：按名称或编号搜索 */}
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
            placeholder="搜索合同名称或编号..."
          />
        </div>

        <div className="text-sm text-gray-500 px-3">
          当前：{CONTRACT_TABS.find(t => t.key === activeTab)?.label}
        </div>
      </div>

      {/* ========== 合同列表表格 ========== */}
      <div className="card">
        <div className="table-container">
          {activeTab === 'SUBCONTRACT' ? (
          <table className="table">
            <thead>
              <tr className="table-thead" style={{ backgroundColor: '#0066CC', color: '#fff' }}>
                <th>分包合同名称</th>
                <th>关联承包合同</th>
                <th>关联班组/分包商</th>
                <th>总金额</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody className="table-tbody">
              {subContracts.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="暂无分包合同数据"
                      description="分包合同新建、付款凭证、结算凭证将在后续切片接入"
                      icon={<FileText size={48} />}
                    />
                  </td>
                </tr>
              ) : (
                subContracts.map((contract, index) => (
                  <tr key={contract.id} className={index % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="font-medium text-gray-800">{contract.name || '-'}</td>
                    <td className="text-gray-600">{contract.contract?.name || '-'}</td>
                    <td className="text-gray-600">{contract.subcontractor?.companyName || contract.subcontractor?.contactName || '-'}</td>
                    <td className="font-medium text-gray-800">{formatMoney(contract.totalAmount || 0)}</td>
                    <td>
                      <StatusBadge status={contract.isActive === false ? '已终止' : '生效中'} type={contract.isActive === false ? 'danger' : 'success'} />
                    </td>
                    <td className="text-gray-500">{contract.createdAt ? formatDate(contract.createdAt) : '-'}</td>
                    <td className="text-xs text-gray-400">付款/结算凭证待接入</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          ) : (
          <table className="table">
            {/* 表头：深色背景 */}
            <thead>
              <tr className="table-thead" style={{ backgroundColor: '#0066CC', color: '#fff' }}>
                <th>合同名称</th>
                <th>合同编号</th>
                <th>类型</th>
                <th>总金额</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody className="table-tbody">
              {contracts.length === 0 ? (
                /* 空状态：跨列显示 */
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="暂无合同数据"
                      description={'点击"新增合同"按钮创建第一个合同'}
                      icon={<FileText size={48} />}
                    />
                  </td>
                </tr>
              ) : (
                /* 合同数据行（斑马纹） */
                contracts.map((contract, index) => {
                  const statusConfig = CONTRACT_STATUS_MAP[contract.status] || CONTRACT_STATUS_MAP.active;
                  return (
                    <tr
                      key={contract.id}
                      className={index % 2 === 1 ? 'bg-gray-50' : ''}
                    >
                      {/* 合同名称 */}
                      <td className="font-medium text-gray-800">
                        {contract.name}
                      </td>
                      {/* 合同编号 */}
                      <td className="text-gray-600">{contract.code}</td>
                      {/* 合同类型标签 */}
                      <td>
                        <span className="badge badge-blue">
                          {CONTRACT_TYPE_MAP[contract.type] || contract.type}
                        </span>
                      </td>
                      {/* 合同总金额 */}
                      <td className="font-medium text-gray-800">
                        {formatMoney(contract.totalAmount)}
                      </td>
                      {/* 合同状态标签 */}
                      <td>
                        <StatusBadge
                          status={statusConfig.label}
                          type={statusConfig.type}
                        />
                      </td>
                      {/* 创建时间 */}
                      <td className="text-gray-500">
                        {formatDate(contract.createdAt)}
                      </td>
                      {/* 操作按钮列 */}
                      <td>
                        <div className="flex items-center gap-1">
                          {/* 查看详情按钮 */}
                          {can('contract:view') && (
                            <button
                              onClick={() => handleOpenDetail(contract)}
                              className="btn-secondary btn-sm"
                              title="查看详情"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          {/* 编辑按钮 */}
                          {can('contract:edit') && (
                            <button
                              onClick={() => handleOpenEdit(contract)}
                              className="btn-secondary btn-sm"
                              title="编辑"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {/* 删除按钮 */}
                          {can('contract:delete') && (
                            <button
                              onClick={() => handleOpenDelete(contract)}
                              className="btn-danger btn-sm"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          )}
        </div>

        {/* 分页区域 */}
        {(activeTab === 'SUBCONTRACT' ? subContracts.length > 0 : contracts.length > 0) && (
          <div className="table-footer">
            <Pagination
              current={currentPage}
              total={totalPages}
              pageSize={pageSize}
              totalRecords={totalRecords}
              onChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* ========== 新增/编辑合同弹窗 ========== */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingContract ? '编辑合同' : '新增合同'}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setShowFormModal(false)}
              className="btn-secondary"
              disabled={formLoading}
            >
              取消
            </button>
            <button
              onClick={handleFormSubmit}
              className="btn-primary"
              disabled={formLoading}
            >
              {formLoading ? '提交中...' : editingContract ? '保存修改' : '确认创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 第一行：合同名称和编号 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 合同名称 */}
            <div>
              <label className="form-label">
                合同名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="请输入合同名称"
              />
            </div>
            {/* 合同编号 */}
            <div>
              <label className="form-label">合同编号</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="input"
                placeholder="请输入合同编号"
              />
            </div>
          </div>

          {/* 第二行：合同类型和总金额 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 合同类型 */}
            <div>
              <label className="form-label">合同类型</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="select"
              >
                {CONTRACT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* 合同总金额 */}
            <div>
              <label className="form-label">总金额（元）</label>
              <input
                type="number"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                className="input"
                placeholder="请输入合同总金额"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* 第三行：供应商选择（仅采购合同显示） */}
          {formData.type === 'PROCUREMENT' && (
            <div>
              <label className="form-label">供应商 <span className="text-gray-400 text-xs font-normal">(选填)</span></label>
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="select"
              >
                <option value="">请选择供应商</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 发包方（仅承包合同显示） */}
          {formData.type === 'CONSTRUCTION' && (
            <div>
              <label className="form-label">发包方 <span className="text-gray-400 text-xs font-normal">(选填)</span></label>
              <input
                type="text"
                value={formData.awardingParty}
                onChange={(e) => setFormData({ ...formData, awardingParty: e.target.value })}
                className="input"
                placeholder="请输入发包方名称"
              />
            </div>
          )}

          {/* 第四行：开始日期和结束日期 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 开始日期 */}
            <div>
              <label className="form-label">开始日期</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input"
              />
            </div>
            {/* 结束日期 */}
            <div>
              <label className="form-label">结束日期</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {/* 第五行：描述 */}
          <div>
            <label className="form-label">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="textarea"
              placeholder="请输入合同描述（选填）"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* ========== 合同详情弹窗 ========== */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="合同详情"
        size="xl"
      >
        {detailContract && (
          <div className="space-y-6">
            {/* ---- 基本信息 ---- */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">
                基本信息
              </h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {/* 合同名称 */}
                <div>
                  <span className="text-gray-500">合同名称：</span>
                  <span className="text-gray-800 font-medium">{detailContract.name}</span>
                </div>
                {/* 合同编号 */}
                <div>
                  <span className="text-gray-500">合同编号：</span>
                  <span className="text-gray-800">{detailContract.code}</span>
                </div>
                {/* 合同类型 */}
                <div>
                  <span className="text-gray-500">合同类型：</span>
                  <span className="badge badge-blue ml-1">
                    {CONTRACT_TYPE_MAP[detailContract.type] || detailContract.type}
                  </span>
                </div>
                {/* 合同状态 */}
                <div>
                  <span className="text-gray-500">合同状态：</span>
                  <StatusBadge
                    status={
                      (CONTRACT_STATUS_MAP[detailContract.status] || CONTRACT_STATUS_MAP.active).label
                    }
                    type={
                      (CONTRACT_STATUS_MAP[detailContract.status] || CONTRACT_STATUS_MAP.active).type
                    }
                    className="ml-1"
                  />
                </div>
                {/* 合同总金额 */}
                <div>
                  <span className="text-gray-500">合同总金额：</span>
                  <span className="text-gray-800 font-semibold text-[#0066CC]">
                    {formatMoney(detailContract.totalAmount)}
                  </span>
                </div>
                {/* 供应商（采购合同显示） */}
                {detailContract.type === 'PROCUREMENT' && detailContract.supplierName && (
                  <div>
                    <span className="text-gray-500">供应商：</span>
                    <span className="text-gray-800">{detailContract.supplierName}</span>
                  </div>
                )}
                {/* 合同期限 */}
                {(detailContract.startDate || detailContract.endDate) && (
                  <div>
                    <span className="text-gray-500">合同期限：</span>
                    <span className="text-gray-800">
                      {formatDate(detailContract.startDate)} ~ {formatDate(detailContract.endDate)}
                    </span>
                  </div>
                )}
                {/* 创建时间 */}
                <div>
                  <span className="text-gray-500">创建时间：</span>
                  <span className="text-gray-800">
                    {formatDate(detailContract.createdAt, 'YYYY-MM-DD HH:mm')}
                  </span>
                </div>
              </div>
              {/* 描述 */}
              {detailContract.description && (
                <div className="mt-3 text-sm">
                  <span className="text-gray-500">描述：</span>
                  <span className="text-gray-700">{detailContract.description}</span>
                </div>
              )}
            </div>

            {/* ---- 进度款收款列表 ---- */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                <h3 className="text-base font-semibold text-gray-800">
                  进度款收款记录
                </h3>
                {/* 新增进度款按钮 */}
                {can('contract:create') && (
                  <button
                    onClick={handleOpenPaymentModal}
                    className="btn-primary btn-sm"
                  >
                    <Plus size={14} className="mr-1" />
                    新增进度款
                  </button>
                )}
              </div>

              {/* 收款进度条 */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-gray-600">
                    收款进度：{formatMoney(totalPaymentAmount)} / {formatMoney(detailContract.totalAmount)}
                  </span>
                  <span className="font-medium text-[#0066CC]">
                    {paymentProgress.toFixed(1)}%
                  </span>
                </div>
                {/* 进度条 */}
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${paymentProgress}%`,
                      backgroundColor: '#0066CC',
                    }}
                  />
                </div>
              </div>

              {/* 进度款列表表格 */}
              {paymentsLoading ? (
                /* 加载中 */
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#0066CC]" />
                  <span className="ml-2 text-sm text-gray-500">加载中...</span>
                </div>
              ) : progressPayments.length === 0 ? (
                /* 空状态 */
                <EmptyState
                  title="暂无进度款记录"
                  description={'点击"新增进度款"按钮添加收款记录'}
                  icon={<DollarSign size={40} />}
                />
              ) : (
                /* 进度款数据表格 */
                <div className="table-container">
                  <table className="table text-sm">
                    <thead>
                      <tr className="table-thead" style={{ backgroundColor: '#0066CC', color: '#fff' }}>
                        <th>期次</th>
                        <th>收款金额</th>
                        <th>占比</th>
                        <th>收款日期</th>
                        <th>描述</th>
                      </tr>
                    </thead>
                    <tbody className="table-tbody">
                      {progressPayments.map((payment, index) => (
                        <tr
                          key={payment.id}
                          className={index % 2 === 1 ? 'bg-gray-50' : ''}
                        >
                          <td className="font-medium">第 {payment.installment} 期</td>
                          <td className="font-medium text-[#0066CC]">
                            {formatMoney(payment.amount)}
                          </td>
                          <td>
                            {payment.percentage ? `${payment.percentage}%` : '-'}
                          </td>
                          <td>{formatDate(payment.paymentDate)}</td>
                          <td className="text-gray-500">{payment.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ---- 合同附件 ---- */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                <h3 className="text-base font-semibold text-gray-800">合同附件</h3>
                <button onClick={handleUploadClick} className="btn-primary btn-sm" disabled={uploading}>
                  <Upload size={14} className="mr-1" />
                  {uploading ? '上传中...' : '上传附件'}
                </button>
              </div>
              <input ref={uploadRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
              {attachmentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#0066CC]" />
                </div>
              ) : attachments.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无附件</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {attachments.map((att: any) => (
                    <div key={att.id} className="relative group border border-gray-200 rounded-lg p-3 flex items-center gap-2 hover:border-[#0066CC] transition-colors">
                      <FileText size={24} className={att.mimeType?.startsWith('image/') ? 'text-blue-500 shrink-0' : 'text-red-500 shrink-0'} />
                      <button type="button" onClick={() => handleDownloadAttachment(att)}
                        className="text-sm text-gray-700 truncate flex-1 text-left hover:text-[#0066CC]">
                        {att.fileName}
                      </button>
                      <button onClick={() => handleDeleteAttachment(att.id)}
                        title="删除附件"
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ========== 新增进度款弹窗 ========== */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="新增进度款收款"
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowPaymentModal(false)}
              className="btn-secondary"
              disabled={paymentLoading}
            >
              取消
            </button>
            <button
              onClick={handlePaymentSubmit}
              className="btn-primary"
              disabled={paymentLoading}
            >
              {paymentLoading ? '提交中...' : '确认创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 期次和金额 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 期次 */}
            <div>
              <label className="form-label">
                期次 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={paymentForm.installment}
                onChange={(e) => setPaymentForm({ ...paymentForm, installment: e.target.value })}
                className="input"
                placeholder="如：1"
                min="1"
              />
            </div>
            {/* 收款金额 */}
            <div>
              <label className="form-label">
                收款金额（元） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="input"
                placeholder="请输入收款金额"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* 占比和收款日期 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 占比 */}
            <div>
              <label className="form-label">占比（%）</label>
              <input
                type="number"
                value={paymentForm.percentage}
                onChange={(e) => setPaymentForm({ ...paymentForm, percentage: e.target.value })}
                className="input"
                placeholder="如：30"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            {/* 收款日期 */}
            <div>
              <label className="form-label">收款日期</label>
              <input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {/* 描述 */}
          <div>
            <label className="form-label">描述</label>
            <textarea
              value={paymentForm.description}
              onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
              className="textarea"
              placeholder="请输入描述（选填）"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* ========== 删除确认弹窗 ========== */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingContract(null);
        }}
        onConfirm={handleConfirmDelete}
        title="删除合同"
        message={`确定要删除合同"${deletingContract?.name}"吗？删除后数据将无法恢复。`}
        confirmText="确认删除"
        type="danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default ContractList;
