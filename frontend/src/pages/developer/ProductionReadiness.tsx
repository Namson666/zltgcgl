/**
 * 开发者后台 - 生产就绪自检
 *
 * 聚合上线前必须关注的外部条件：企业模块、独立登录域名、
 * 小程序分流、人脸识别 HTTP 网关。这里只读展示，不修改配置。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Rocket, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';

interface ReadinessCheck {
  key: string;
  label: string;
  status: 'ready' | 'warning';
  message: string;
  detail?: Record<string, unknown>;
}

interface ReadinessData {
  overallStatus: 'ready' | 'needs_attention';
  generatedAt: string;
  environment: string;
  checks: ReadinessCheck[];
}

const ProductionReadiness: React.FC = () => {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReadiness = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await developerApi.getReadiness();
      const body = res.data || res;
      setData(body.data || body);
      if (isRefresh) toast.success('生产就绪自检已刷新');
    } catch (error) {
      console.error('加载生产就绪自检失败:', error);
      toast.error('加载生产就绪自检失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  const readyCount = data?.checks.filter((check) => check.status === 'ready').length || 0;
  const warningCount = data?.checks.filter((check) => check.status === 'warning').length || 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">生产就绪自检</h1>
          <p className="page-subtitle">上线前核对独立域名、小程序分流、人脸网关与模块开通状态</p>
        </div>
        <button
          onClick={() => fetchReadiness(true)}
          disabled={refreshing}
          className="btn-primary flex items-center gap-2"
          data-testid="readiness-refresh"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? '刷新中...' : '刷新自检'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" data-testid="readiness-overall">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">总体状态</p>
              <p className={`text-2xl font-bold ${data?.overallStatus === 'ready' ? 'text-green-600' : 'text-amber-600'}`}>
                {loading ? '加载中...' : data?.overallStatus === 'ready' ? '可上线' : '需关注'}
              </p>
              <p className="text-xs text-gray-400 mt-1">环境：{data?.environment || '-'}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${data?.overallStatus === 'ready' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
              <Rocket size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" data-testid="readiness-ready-count">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">已就绪</p>
              <p className="text-2xl font-bold text-green-600">{loading ? '--' : readyCount}</p>
              <p className="text-xs text-gray-400 mt-1">通过的上线检查项</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" data-testid="readiness-warning-count">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">需关注</p>
              <p className="text-2xl font-bold text-amber-600">{loading ? '--' : warningCount}</p>
              <p className="text-xs text-gray-400 mt-1">外部配置或上线验收缺项</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: '#1A2B3C' }}>
            <ShieldCheck size={18} className="text-primary-500" />
            检查项
          </h2>
          <span className="text-xs text-gray-400">
            生成时间：{data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '-'}
          </span>
        </div>

        <div className="divide-y divide-gray-100" data-testid="readiness-check-list">
          {loading && (
            <div className="p-6 text-sm text-gray-500">正在加载自检结果...</div>
          )}
          {!loading && data?.checks.map((check) => (
            <div key={check.key} className="p-5" data-testid={`readiness-check-${check.key}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {check.status === 'ready'
                      ? <CheckCircle2 size={18} className="text-green-500" />
                      : <AlertTriangle size={18} className="text-amber-500" />}
                    <h3 className="font-medium text-gray-800">{check.label}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{check.message}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${check.status === 'ready' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {check.status === 'ready' ? '已就绪' : '需关注'}
                </span>
              </div>
              {check.detail && (
                <pre className="mt-3 text-xs bg-gray-50 border border-gray-100 rounded-lg p-3 overflow-x-auto text-gray-500">
                  {JSON.stringify(check.detail, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductionReadiness;
