/**
 * 资料通工程管理系统 - 报表导出
 * 劳资报表预览与 Excel 导出
 */

import React, { useEffect, useState } from 'react';
import { laborApi } from '../../api';
import { Download, FileSpreadsheet, Eye, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmptyState, formatMonth, formatMoney } from '../../components/ui/Common';

const REPORT_TYPES = [
  { value: 'salary', label: '月度工资汇总表' },
  { value: 'attendance', label: '月度考勤汇总表' },
  { value: 'payment', label: '工资发放明细表' },
  { value: 'social', label: '社保缴纳明细表' },
];

interface ReportPreview {
  title?: string;
  headers?: string[];
  rows?: any[][];
  summary?: Record<string, any>;
}

const Reports: React.FC = () => {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [reportType, setReportType] = useState('salary');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    laborApi.getReportMonths().then(res => {
      const data = (res.data as any).data;
      setMonths(data?.months || data || []);
      if (data?.months?.[0]) setSelectedMonth(data.months[0]);
    }).catch(() => {});
  }, []);

  const handlePreview = async () => {
    if (!selectedMonth) return toast.error('请选择月份');
    setLoading(true);
    try {
      const res = await laborApi.previewReport(selectedMonth, reportType);
      const data = (res.data as any).data;
      setPreview(data || {});
    } catch { toast.error('预览加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedMonth) handlePreview();
  }, [selectedMonth, reportType]);

  const handleExport = async () => {
    if (!selectedMonth) return toast.error('请选择月份');
    setExporting(true);
    try {
      const res = await laborApi.exportReport(selectedMonth, reportType);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedMonth}-${REPORT_TYPES.find(r => r.value === reportType)?.label || reportType}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('报表导出成功');
    } catch { toast.error('导出失败'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">报表导出</h1>
          <p className="page-subtitle">劳资报表预览与 Excel 导出</p>
        </div>
      </div>

      {/* 查询条件 */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">选择月份</label>
            <select className="select w-44" value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}>
              <option value="">请选择</option>
              {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">报表类型</label>
            <select className="select w-48" value={reportType}
              onChange={e => { setReportType(e.target.value); setPreview(null); }}>
              {REPORT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={handleExport} disabled={exporting || !selectedMonth}>
            {exporting ? <><Loader2 size={14} className="animate-spin" />导出中...</>
              : <><Download size={16} /> 导出 Excel</>}
          </button>
        </div>
      </div>

      {/* 报表预览 */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Eye size={16} className="text-primary-500" />
          <h3 className="font-semibold text-gray-700">报表预览</h3>
          {preview?.title && <span className="text-sm text-gray-400 ml-2">— {preview.title}</span>}
        </div>
        {loading ? (
          <div className="py-16 text-center text-gray-400">加载中...</div>
        ) : preview?.rows?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              {preview.headers && (
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  {preview.headers.map((h, i) => <th key={i} className="table-th">{h}</th>)}
                </tr></thead>
              )}
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    {row.map((cell: any, j: number) => (
                      <td key={j} className="table-td">{typeof cell === 'number' ? formatMoney(cell) : cell ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.summary && Object.keys(preview.summary).length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex gap-6 text-sm">
                {Object.entries(preview.summary).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-gray-500">{k}：</span>
                    <span className="font-semibold text-gray-800">{typeof v === 'number' ? formatMoney(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-10">
            <EmptyState title="选择月份和报表类型" description="选择后自动显示预览" icon={<FileSpreadsheet size={48} />} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
