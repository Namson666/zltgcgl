/**
 * 资料通工程管理系统 - 费用导入
 *
 * Phase 3: 支持手动逐行录入和 CSV/Excel 文件批量导入。
 * 双标签页设计：
 * - 手动录入：内联可编辑表格，逐行添加费用记录
 * - 文件导入：上传 CSV 文件 → 解析预览 → 确认批量导入
 */

import React, { useEffect, useState, useCallback } from 'react';
import { financeApi } from '../../api';
import { EmptyState, formatMoney, formatDate } from '../../components/ui/Common';
import {
  Upload,
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Loader2,
  FileUp,
  Eye,
  LayoutList,
  Keyboard,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

interface Category {
  id: string;
  name: string;
}

interface SubCategory {
  id: string;
  name: string;
}

interface ManualRow {
  id: string;
  expenseDate: string;
  handler: string;
  categoryId: string;
  subCategoryId: string;
  amount: string;
  paymentMethod: string;
  payer: string;
  detail: string;
  errors: Record<string, string>;
}

interface ParsedExcelRow {
  index: number;
  expenseDate: string;
  handler: string;
  categoryName: string;
  subCategoryName: string;
  amount: string;
  paymentMethod: string;
  payer: string;
  detail: string;
  errors: string[];
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}

/* ========================================
 * 常量
 * ======================================== */

const paymentMethodOptions = [
  { value: 'company_direct', label: '公司直付' },
  { value: 'petty_cash', label: '备用金' },
];

const emptyManualRow = (): ManualRow => ({
  id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  expenseDate: new Date().toISOString().slice(0, 10),
  handler: '',
  categoryId: '',
  subCategoryId: '',
  amount: '',
  paymentMethod: 'company_direct',
  payer: '',
  detail: '',
  errors: {},
});

const csvTemplate = `日期,经办人,费用大类,费用子类,金额,支付方式,支付人,详情
2026-05-01,张三,办公费,文具,150.00,公司直付,,
2026-05-03,李四,差旅费,交通费,320.50,备用金,李四,出差交通费`;

/* ========================================
 * 工具函数
 * ======================================== */

/** 解析 CSV 行（处理引号包裹的字段） */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === ',' || ch === '\t') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
};

/** 生成唯一 ID */
const genId = (): string =>
  `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** 校验手动录入行 */
const validateManualRow = (row: ManualRow): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!row.handler.trim()) errors.handler = '请输入经办人';
  if (!row.expenseDate) errors.expenseDate = '请选择日期';
  if (!row.categoryId) errors.categoryId = '请选择费用类别';
  if (!row.amount || isNaN(Number(row.amount)) || Number(row.amount) <= 0) {
    errors.amount = '请输入有效金额';
  }
  return errors;
};

/* ========================================
 * 子组件 - 导入结果弹窗
 * ======================================== */

interface ImportResultModalProps {
  result: ImportResult;
  onClose: () => void;
}

const ImportResultModal: React.FC<ImportResultModalProps> = ({ result, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">导入结果</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XCircle size={20} />
        </button>
      </div>

      {/* 统计 */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl bg-green-50 border border-green-100">
            <div className="text-2xl font-bold text-green-700">{result.success}</div>
            <div className="text-xs text-green-600 mt-1">成功导入</div>
          </div>
          <div className="p-4 rounded-xl bg-red-50 border border-red-100">
            <div className="text-2xl font-bold text-red-700">{result.failed}</div>
            <div className="text-xs text-red-600 mt-1">导入失败</div>
          </div>
        </div>

        {/* 错误详情 */}
        {result.errors.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">错误详情</h4>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {result.errors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 rounded-md bg-red-50 text-xs text-red-700"
                >
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    第 {err.row} 行: {err.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部 */}
      <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
        <button onClick={onClose} className="btn-primary">
          确定
        </button>
      </div>
    </div>
  </div>
);

/* ========================================
 * 主组件 - ImportExcel
 * ======================================== */

const ImportExcel: React.FC = () => {
  /* ---------- 标签页 ---------- */
  const [activeTab, setActiveTab] = useState<'manual' | 'file'>('manual');

  /* ---------- 类别/子类别数据 ---------- */
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategoriesMap, setSubCategoriesMap] = useState<Record<string, SubCategory[]>>({});
  const [loadingCategories, setLoadingCategories] = useState(true);

  /* ---------- 手动录入状态 ---------- */
  const [manualRows, setManualRows] = useState<ManualRow[]>([emptyManualRow()]);
  const [importing, setImporting] = useState(false);

  /* ---------- 文件导入状态 ---------- */
  const [parsedData, setParsedData] = useState<ParsedExcelRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult>({
    success: 0,
    failed: 0,
    errors: [],
  });

  /* ---------- 加载类别数据 ---------- */

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await financeApi.getCategories();
      const body = res.data as any;
      const list: Category[] = body?.data || body || [];
      setCategories(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('加载费用类别失败:', err);
      toast.error('加载费用类别失败');
    } finally {
      setLoadingCategories(false);
    }
  };

  /** 加载某个类别下的子类别 */
  const loadSubCategories = useCallback(
    async (categoryId: string) => {
      if (!categoryId) return;
      if (subCategoriesMap[categoryId]) return; /* 已缓存 */

      try {
        const res = await financeApi.getSubCategories(categoryId);
        const body = res.data as any;
        const list: SubCategory[] = body?.data || body || [];
        setSubCategoriesMap((prev) => ({
          ...prev,
          [categoryId]: Array.isArray(list) ? list : [],
        }));
      } catch (err: any) {
        console.error('加载子类别失败:', err);
      }
    },
    [subCategoriesMap],
  );

  /* ========================================
   * 手动录入 - 操作
   * ======================================== */

  /** 更新手动行 */
  const updateManualRow = (id: string, field: keyof ManualRow, value: string) => {
    setManualRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        const updated = { ...row, [field]: value };
        /* 如果切换类别，清空子类别 */
        if (field === 'categoryId') {
          updated.subCategoryId = '';
          loadSubCategories(value);
        }
        /* 实时校验 */
        updated.errors = validateManualRow(updated);
        return updated;
      }),
    );
  };

  /** 添加新行 */
  const addManualRow = () => {
    setManualRows((prev) => [...prev, emptyManualRow()]);
  };

  /** 删除行 */
  const removeManualRow = (id: string) => {
    setManualRows((prev) => {
      if (prev.length <= 1) return prev; /* 至少保留一行 */
      return prev.filter((row) => row.id !== id);
    });
  };

  /** 批量导入手动行 */
  const handleManualImport = async () => {
    /* 校验所有行 */
    let hasError = false;
    const validated = manualRows.map((row) => {
      const errors = validateManualRow(row);
      if (Object.keys(errors).length > 0) hasError = true;
      return { ...row, errors };
    });
    setManualRows(validated);

    if (hasError) {
      toast.error('请修正表格中的错误后再导入');
      return;
    }

    /* 过滤有效行 */
    const toImport = manualRows
      .filter((row) => row.handler.trim() && row.amount)
      .map((row) => ({
        expenseDate: row.expenseDate,
        handler: row.handler.trim(),
        categoryId: row.categoryId,
        subCategoryId: row.subCategoryId || undefined,
        amount: parseFloat(row.amount),
        paymentMethod: row.paymentMethod,
        payer: row.payer.trim() || undefined,
        detail: row.detail.trim() || undefined,
      }));

    if (!toImport.length) {
      toast.error('没有可导入的有效数据');
      return;
    }

    setImporting(true);
    try {
      const res = await financeApi.importExcel(
        jsonToFormData(toImport),
      );
      const body = res.data as any;
      const result: ImportResult = body?.data || body || {};
      setImportResult({
        success: result.success || toImport.length,
        failed: result.failed || 0,
        errors: result.errors || [],
      });
      setShowResult(true);

      if ((result.success || 0) > 0) {
        toast.success(`成功导入 ${result.success} 条记录`);
        setManualRows([emptyManualRow()]);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '导入失败';
      toast.error(msg);
      setImportResult({
        success: 0,
        failed: toImport.length,
        errors: [{ row: 0, message: msg }],
      });
      setShowResult(true);
    } finally {
      setImporting(false);
    }
  };

  /* ========================================
   * 文件导入 - 操作
   * ======================================== */

  /** 将 JSON 数据转为 FormData */
  const jsonToFormData = (data: any[]): FormData => {
    const formData = new FormData();
    const jsonBlob = new Blob([JSON.stringify(data)], {
      type: 'application/json',
    });
    formData.append('file', jsonBlob, 'import.json');
    return formData;
  };

  /** 解析 CSV 文件内容 */
  const parseCSV = (text: string): ParsedExcelRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l);

    if (lines.length < 2) {
      throw new Error('CSV 文件至少需要包含表头和一行数据');
    }

    const rows: ParsedExcelRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const row: ParsedExcelRow = {
        index: i + 1,
        expenseDate: cols[0] || '',
        handler: cols[1] || '',
        categoryName: cols[2] || '',
        subCategoryName: cols[3] || '',
        amount: cols[4] || '0',
        paymentMethod: cols[5] || 'company_direct',
        payer: cols[6] || '',
        detail: cols[7] || '',
        errors: [],
      };

      /* 校验 */
      if (!row.expenseDate) row.errors.push('日期不能为空');
      if (!row.handler) row.errors.push('经办人不能为空');
      if (!row.categoryName) row.errors.push('费用类别不能为空');
      const amt = parseFloat(row.amount);
      if (!row.amount || isNaN(amt) || amt <= 0) {
        row.errors.push('金额无效');
      }

      rows.push(row);
    }

    return rows;
  };

  /** 处理文件上传 */
  const handleFileUpload = (file: File) => {
    if (!file) return;

    /* 验证文件类型 */
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('仅支持 .csv、.xlsx、.xls 格式的文件');
      return;
    }

    /* xlsx/xls 提示使用手动录入 */
    if (ext === 'xlsx' || ext === 'xls') {
      toast('Excel 文件请先另存为 CSV 格式后再导入', { icon: '📋' });
      /* 仍然尝试读取，如果后端支持的话可以通过 FormData 直接发送 */
    }

    setFileName(file.name);
    setParseError('');
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseCSV(text);
        setParsedData(parsed);

        if (parsed.length === 0) {
          setParseError('文件中未解析到有效数据行');
        }
      } catch (err: any) {
        setParseError(err.message || '文件解析失败');
        setParsedData([]);
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParseError('文件读取失败，请重试');
      setParsing(false);
    };
    reader.readAsText(file);
  };

  /** 拖放区域事件处理 */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  /** 文件导入确认提交 */
  const handleFileImport = async () => {
    const validRows = parsedData.filter((row) => row.errors.length === 0);
    if (!validRows.length) {
      toast.error('没有可导入的有效数据，请修正错误行');
      return;
    }

    const payload = validRows.map((row) => ({
      expenseDate: row.expenseDate,
      handler: row.handler,
      categoryName: row.categoryName,
      subCategoryName: row.subCategoryName || undefined,
      amount: parseFloat(row.amount),
      paymentMethod:
        row.paymentMethod === '备用金'
          ? 'petty_cash'
          : 'company_direct',
      payer: row.payer || undefined,
      detail: row.detail || undefined,
    }));

    setImporting(true);
    try {
      const res = await financeApi.importExcel(jsonToFormData(payload));
      const body = res.data as any;
      const result: ImportResult = body?.data || body || {};
      setImportResult({
        success: result.success || validRows.length,
        failed: result.failed || 0,
        errors: result.errors || [],
      });
      setShowResult(true);

      if ((result.success || 0) > 0) {
        toast.success(`成功导入 ${result.success} 条记录`);
        /* 清空，准备下一次导入 */
        setParsedData([]);
        setFileName('');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '导入失败';
      toast.error(msg);
      setImportResult({
        success: 0,
        failed: validRows.length,
        errors: [{ row: 0, message: msg }],
      });
      setShowResult(true);
    } finally {
      setImporting(false);
    }
  };

  /** 清除已解析的数据 */
  const clearParsedData = () => {
    setParsedData([]);
    setFileName('');
    setParseError('');
  };

  /* ========================================
   * 渲染 - 手动录入标签页
   * ======================================== */

  const renderManualTab = () => (
    <div className="space-y-4">
      {/* 操作提示 */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
        <Keyboard size={16} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          逐行填写费用信息，点击"添加行"增加记录。填写完毕后点击"批量导入"一次性提交。
        </p>
      </div>

      {loadingCategories ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          <span className="text-sm">加载费用类别...</span>
        </div>
      ) : (
        <>
          {/* 可编辑表格 */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-8">
                      #
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                      日期 *
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                      经办人 *
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                      费用类别 *
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                      子类别
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[110px]">
                      金额 *
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                      支付方式
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[90px]">
                      支付人
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[140px]">
                      详情
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-16">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-50 transition-colors ${
                        Object.keys(row.errors).length > 0
                          ? 'bg-red-50/50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* 序号 */}
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {index + 1}
                      </td>

                      {/* 日期 */}
                      <td className="px-1 py-2">
                        <input
                          type="date"
                          className={`input text-xs py-1.5 ${
                            row.errors.expenseDate ? 'border-red-400 bg-red-50' : ''
                          }`}
                          value={row.expenseDate}
                          onChange={(e) =>
                            updateManualRow(row.id, 'expenseDate', e.target.value)
                          }
                        />
                        {row.errors.expenseDate && (
                          <p className="text-red-500 text-[10px] mt-0.5">
                            {row.errors.expenseDate}
                          </p>
                        )}
                      </td>

                      {/* 经办人 */}
                      <td className="px-1 py-2">
                        <input
                          type="text"
                          className={`input text-xs py-1.5 ${
                            row.errors.handler ? 'border-red-400 bg-red-50' : ''
                          }`}
                          placeholder="张三"
                          value={row.handler}
                          onChange={(e) =>
                            updateManualRow(row.id, 'handler', e.target.value)
                          }
                        />
                        {row.errors.handler && (
                          <p className="text-red-500 text-[10px] mt-0.5">
                            {row.errors.handler}
                          </p>
                        )}
                      </td>

                      {/* 费用类别 */}
                      <td className="px-1 py-2">
                        <select
                          className={`input text-xs py-1.5 ${
                            row.errors.categoryId ? 'border-red-400 bg-red-50' : ''
                          }`}
                          value={row.categoryId}
                          onChange={(e) =>
                            updateManualRow(row.id, 'categoryId', e.target.value)
                          }
                        >
                          <option value="">请选择</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {row.errors.categoryId && (
                          <p className="text-red-500 text-[10px] mt-0.5">
                            {row.errors.categoryId}
                          </p>
                        )}
                      </td>

                      {/* 子类别 */}
                      <td className="px-1 py-2">
                        <select
                          className="input text-xs py-1.5"
                          value={row.subCategoryId}
                          onChange={(e) =>
                            updateManualRow(row.id, 'subCategoryId', e.target.value)
                          }
                          disabled={!row.categoryId}
                        >
                          <option value="">请选择</option>
                          {(subCategoriesMap[row.categoryId] || []).map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 金额 */}
                      <td className="px-1 py-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                            ¥
                          </span>
                          <input
                            type="number"
                            className={`input text-xs py-1.5 pl-5 ${
                              row.errors.amount ? 'border-red-400 bg-red-50' : ''
                            }`}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            value={row.amount}
                            onChange={(e) =>
                              updateManualRow(row.id, 'amount', e.target.value)
                            }
                          />
                        </div>
                        {row.errors.amount && (
                          <p className="text-red-500 text-[10px] mt-0.5">
                            {row.errors.amount}
                          </p>
                        )}
                      </td>

                      {/* 支付方式 */}
                      <td className="px-1 py-2">
                        <select
                          className="input text-xs py-1.5"
                          value={row.paymentMethod}
                          onChange={(e) =>
                            updateManualRow(row.id, 'paymentMethod', e.target.value)
                          }
                        >
                          {paymentMethodOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 支付人 */}
                      <td className="px-1 py-2">
                        <input
                          type="text"
                          className="input text-xs py-1.5"
                          placeholder="选填"
                          value={row.payer}
                          onChange={(e) =>
                            updateManualRow(row.id, 'payer', e.target.value)
                          }
                        />
                      </td>

                      {/* 详情 */}
                      <td className="px-1 py-2">
                        <input
                          type="text"
                          className="input text-xs py-1.5"
                          placeholder="费用明细..."
                          value={row.detail}
                          onChange={(e) =>
                            updateManualRow(row.id, 'detail', e.target.value)
                          }
                        />
                      </td>

                      {/* 删除 */}
                      <td className="px-1 py-2 text-center">
                        <button
                          onClick={() => removeManualRow(row.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="删除行"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {manualRows.length === 0 && (
                <div className="py-16">
                  <EmptyState
                    title="暂无录入行"
                    description='点击下方"添加行"开始录入费用'
                  />
                </div>
              )}
            </div>

            {/* 添加行按钮 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={addManualRow}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <Plus size={16} />
                添加行
              </button>
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              共 {manualRows.filter((r) => r.handler.trim()).length} 条有效记录
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setManualRows([emptyManualRow()])}
                className="btn-outline btn-sm"
                disabled={importing}
              >
                清空重置
              </button>
              <button
                onClick={handleManualImport}
                className="btn-primary flex items-center gap-2"
                disabled={importing}
              >
                {importing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <FileUp size={16} />
                    批量导入 ({manualRows.filter((r) => r.handler.trim()).length} 条)
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  /* ========================================
   * 渲染 - 文件导入标签页
   * ======================================== */

  const renderFileTab = () => (
    <div className="space-y-5">
      {/* 上传区域 */}
      {!parsedData.length ? (
        <>
          {/* CSV 模板下载 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2">
              <Download size={16} className="text-gray-500" />
              <span className="text-sm text-gray-600">下载 CSV 模板，按格式填写后上传</span>
            </div>
            <button
              onClick={() => {
                const blob = new Blob(['﻿' + csvTemplate], {
                  type: 'text/csv;charset=utf-8',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '费用导入模板.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              下载模板
            </button>
          </div>

          {/* 拖放上传区 */}
          <div
            className="relative border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer bg-gray-50/50"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                /* 重置 input 以允许重复上传同一文件 */
                e.target.value = '';
              }}
            />

            {parsing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={36} className="animate-spin text-blue-500" />
                <p className="text-sm text-gray-500">正在解析文件...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                  <Upload size={28} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    点击上传或拖拽文件到此处
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    支持 .csv、.xlsx、.xls 格式
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 格式说明 */}
          <div className="card p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">CSV 格式说明</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { col: '日期', desc: 'YYYY-MM-DD 格式' },
                { col: '经办人', desc: '必填' },
                { col: '费用大类', desc: '必填，如"办公费"' },
                { col: '费用子类', desc: '选填' },
                { col: '金额', desc: '数字，必填' },
                { col: '支付方式', desc: '公司直付 或 备用金' },
                { col: '支付人', desc: '选填' },
                { col: '详情', desc: '选填' },
              ].map((item) => (
                <div
                  key={item.col}
                  className="flex items-start gap-2 p-2 rounded-lg bg-gray-50"
                >
                  <span className="text-xs font-mono font-medium text-blue-600 whitespace-nowrap">
                    {item.col}
                  </span>
                  <span className="text-xs text-gray-500">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 预览区域 */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-500" />
                <h3 className="card-title">数据预览</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{fileName}</span>
                <span className="text-xs text-gray-500">
                  共 {parsedData.length} 行，
                  <span className="text-green-600 font-medium">
                    {parsedData.filter((r) => r.errors.length === 0).length} 条有效
                  </span>
                  {parsedData.filter((r) => r.errors.length > 0).length > 0 && (
                    <span className="text-red-500 font-medium">
                      ，{parsedData.filter((r) => r.errors.length > 0).length} 条有误
                    </span>
                  )}
                </span>
                <button
                  onClick={clearParsedData}
                  className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                >
                  清除
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-12">
                      行号
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      日期
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      经办人
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      费用类别
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      子类别
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      金额
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      支付方式
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      支付人
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      详情
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-20">
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((row) => (
                    <tr
                      key={row.index}
                      className={`border-b border-gray-50 ${
                        row.errors.length > 0
                          ? 'bg-red-50/60'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {row.index}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono">
                        {row.expenseDate || '-'}
                      </td>
                      <td className="px-3 py-2 text-xs">{row.handler || '-'}</td>
                      <td className="px-3 py-2 text-xs">{row.categoryName || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {row.subCategoryName || '-'}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-right">
                        {row.amount ? formatMoney(row.amount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-xs">{row.paymentMethod}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {row.payer || '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[160px] truncate">
                        {row.detail || '-'}
                      </td>
                      <td className="px-3 py-2">
                        {row.errors.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle
                              size={14}
                              className="text-red-500 flex-shrink-0"
                            />
                            <span className="text-[10px] text-red-600">
                              {row.errors.join('; ')}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle size={12} />
                            有效
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 底部统计和操作 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">
                  共解析 {parsedData.length} 条
                </span>
                {parsedData.filter((r) => r.errors.length > 0).length > 0 && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {parsedData.filter((r) => r.errors.length > 0).length} 条存在错误，将跳过这些行
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearParsedData}
                  className="btn-outline btn-sm"
                  disabled={importing}
                >
                  重新选择
                </button>
                <button
                  onClick={handleFileImport}
                  className="btn-primary flex items-center gap-2 btn-sm"
                  disabled={
                    importing ||
                    parsedData.filter((r) => r.errors.length === 0).length === 0
                  }
                >
                  {importing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      确认导入 ({parsedData.filter((r) => r.errors.length === 0).length} 条)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 解析错误 */}
      {parseError && (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-red-200 bg-red-50">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{parseError}</span>
        </div>
      )}
    </div>
  );

  /* ========================================
   * 主渲染
   * ======================================== */

  return (
    <div className="space-y-5">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">费用导入</h1>
          <p className="page-subtitle">手动录入或批量导入费用报账数据</p>
        </div>
      </div>

      {/* 标签页切换 */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'manual'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <LayoutList size={16} />
          手动录入
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'file'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileUp size={16} />
          文件导入
        </button>
      </div>

      {/* 标签页内容 */}
      {activeTab === 'manual' ? renderManualTab() : renderFileTab()}

      {/* 导入结果弹窗 */}
      {showResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  );
};

export default ImportExcel;
