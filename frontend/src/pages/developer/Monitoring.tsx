/**
 * 资料通工程管理系统 - 系统监控页面
 *
 * 功能说明：
 * 开发者后台的系统运行监控，展示在线用户、API 调用、
 * 错误统计、响应时间等关键指标，以及模块调用分布。
 *
 * 页面结构：
 * 1. 页面标题区域 + 刷新按钮
 * 2. 顶部统计卡片行（在线用户、API 调用、错误数、平均响应时间）
 * 3. 模块调用分布表格 + 服务器运行时间
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Users,
  Server,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';

/* ========================================
 * 类型定义
 * ======================================== */

/** 模块调用统计接口 */
interface ModuleCall {
  module: string;                   /* 模块名称 */
  count: number;                    /* 调用次数 */
}

/** 监控数据接口 */
interface MonitoringData {
  onlineUsers: number;              /* 当前在线用户数 */
  dailyApiCalls: number;            /* 今日 API 调用次数 */
  dailyErrors: number;              /* 今日错误数 */
  avgResponseTime: number;          /* 平均响应时间(ms) */
  apiCallsByModule: ModuleCall[];   /* 按模块的 API 调用分布 */
  uptime: number;                   /* 服务器运行时间(秒) */
}

/* ========================================
 * 工具函数
 * ======================================== */

/**
 * 格式化运行时间
 * 将秒数转换为可读的时长字符串
 * @param seconds - 运行秒数
 * @returns 格式化后的运行时间
 */
const formatUptime = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (parts.length === 0) parts.push('不到1分钟');
  return parts.join('');
};

/* ========================================
 * Monitoring 系统监控组件
 * ======================================== */
const Monitoring: React.FC = () => {
  /* ---------- 状态 ---------- */
  const [data, setData] = useState<MonitoringData | null>(null);  /* 监控数据 */
  const [loading, setLoading] = useState(true);                    /* 加载状态 */
  const [refreshing, setRefreshing] = useState(false);             /* 刷新状态 */

  /* ---------- 数据加载 ---------- */

  /**
   * 加载监控数据
   * 调用 developerApi.getMonitoring() 获取实时监控数据
   */
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const res = await developerApi.getMonitoring();
      const body = res.data || res;
      const result = body.data || body;
      setData(result);
    } catch (error) {
      console.error('加载监控数据失败:', error);
      toast.error('加载监控数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * 手动刷新
   */
  const handleRefresh = () => {
    fetchData(true);
  };

  /* ---------- 统计卡片数据 ---------- */

  const statCards = [
    {
      title: '当前在线',
      value: data?.onlineUsers ?? '--',
      subtitle: '实时在线用户数',
      icon: <Users size={22} />,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: '今日 API 调用',
      value: data?.dailyApiCalls != null ? data.dailyApiCalls.toLocaleString() : '--',
      subtitle: '今日累计 API 调用次数',
      icon: <Activity size={22} />,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      title: '今日错误',
      value: data?.dailyErrors ?? '--',
      subtitle: data?.dailyErrors && data.dailyErrors > 0 ? '存在错误需要关注' : '今日暂无错误',
      icon: <AlertTriangle size={22} />,
      bgColor: data?.dailyErrors && data.dailyErrors > 0 ? 'bg-red-50' : 'bg-green-50',
      iconColor: data?.dailyErrors && data.dailyErrors > 0 ? 'text-red-600' : 'text-green-600',
      danger: data?.dailyErrors && data.dailyErrors > 0,
    },
    {
      title: '平均响应',
      value: data?.avgResponseTime != null ? `${data.avgResponseTime}ms` : '--',
      subtitle: 'API 平均响应时间',
      icon: <Clock size={22} />,
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ];

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">系统监控</h1>
          <p className="page-subtitle">系统运行状态实时监控</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* ==========================================
       * 顶部统计卡片行（4个）
       * ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${
              card.danger ? 'border-red-200' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500 mb-1 truncate">{card.title}</p>
                <p className={`text-2xl font-bold ${
                  card.danger ? 'text-red-600' : 'text-gray-800'
                }`}>
                  {loading ? (
                    <span className="inline-block w-16 h-7 bg-gray-200 rounded animate-pulse" />
                  ) : card.value}
                </p>
                <p className={`text-xs mt-1 truncate ${
                  card.danger ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {card.subtitle}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${card.bgColor} ${card.iconColor} flex items-center justify-center flex-shrink-0 ml-3`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ==========================================
       * 第二行：模块调用分布 + 服务器运行时间
       * ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* ---------- 模块调用分布 ---------- */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: '#1A2B3C' }}>
              <Activity size={16} className="text-purple-500" />
              模块调用分布（今日）
            </h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : data?.apiCallsByModule && data.apiCallsByModule.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">模块名称</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">调用次数</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">占比</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.apiCallsByModule.map((mod, idx) => {
                    const total = data.apiCallsByModule.reduce((sum, m) => sum + m.count, 0);
                    const percentage = total > 0 ? ((mod.count / total) * 100).toFixed(1) : '0';
                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <span className="text-sm font-medium text-gray-800">{mod.module}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-sm text-gray-600 font-mono">
                            {mod.count.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(parseFloat(percentage), 0)}%`,
                                  backgroundColor: idx === 0 ? '#1A3A5C' : '#8899AA',
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-10 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <Activity size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">暂无调用数据</p>
              </div>
            )}
          </div>
        </div>

        {/* ---------- 服务器状态 ---------- */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: '#1A2B3C' }}>
              <Server size={16} className="text-emerald-500" />
              服务器状态
            </h2>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {/* 运行时间 */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Clock size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">运行时间</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">
                      {data?.uptime != null ? formatUptime(data.uptime) : '-'}
                    </p>
                  </div>
                </div>

                {/* 在线用户 */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Users size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">当前在线用户</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">
                      {data?.onlineUsers ?? '-'} 人
                    </p>
                  </div>
                </div>

                {/* 平均响应 */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <Activity size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">平均响应时间</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">
                      {data?.avgResponseTime != null ? `${data.avgResponseTime} ms` : '-'}
                    </p>
                  </div>
                </div>

                {/* 状态指示灯 */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                    <span className="text-sm text-green-700 font-medium">系统运行正常</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
