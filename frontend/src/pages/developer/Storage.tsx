/**
 * 资料通工程管理系统 - 存储管理页面
 *
 * 功能说明：
 * 开发者后台的存储空间管理页面，支持查看存储总览统计、
 * 按企业维度查看存储使用情况、按文件大小排行查看文件详情。
 *
 * 页面结构：
 * 1. 页面标题区域 + 刷新按钮
 * 2. 存储总览统计卡片（总存储空间 / 总文件数）
 * 3. 标签页切换：「按企业」「文件排行」
 * 4. Tab1 - 按企业：企业存储使用表格（名称、存储用量、文件数）
 * 5. Tab2 - 文件排行：文件大小排行表格（文件名、大小、类型、企业、上传时间）
 * 6. 各标签页独立分页
 *
 * API 调用：
 * - developerApi.getStorageStats(params) - 获取存储统计（含按企业明细）
 * - developerApi.getStorageFiles(params) - 获取文件排行列表
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  File,
  Server,
  Search,
  RefreshCw,
  Loader2,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developerApi } from '../../api';
import {
  Pagination,
  EmptyState,
  formatDate,
} from '../../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

/** 存储统计总览接口 */
interface StorageStats {
  totalSize: number;                /* 总存储大小（字节） */
  totalFiles: number;               /* 总文件数 */
  tenantStats: TenantStorage[];     /* 各企业存储统计 */
}

/** 企业存储统计接口 */
interface TenantStorage {
  id: string;                       /* 企业 ID */
  name: string;                     /* 企业名称 */
  totalSize: number;                /* 存储用量（字节） */
  fileCount: number;                /* 文件数量 */
}

/** 文件记录接口 */
interface StorageFile {
  id: string;                       /* 文件 ID */
  fileName: string;                 /* 文件名 */
  fileSize: number;                 /* 文件大小（字节） */
  mimeType: string;                 /* MIME 类型 */
  tenantName: string;               /* 所属企业 */
  createdAt: string;                /* 上传时间 */
}

/* ========================================
 * 辅助函数
 * ======================================== */

/**
 * 文件大小格式化
 * 将字节转换为可读的文件大小字符串
 * @param bytes - 字节数
 * @param decimals - 小数位数，默认 2
 * @returns 格式化后的文件大小字符串
 *
 * @example
 * formatFileSize(1024)        // => '1.00 KB'
 * formatFileSize(1048576)     // => '1.00 MB'
 * formatFileSize(1073741824)  // => '1.00 GB'
 */
const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) +
    ' ' +
    sizes[i]
  );
};

/* ========================================
 * Storage 存储管理组件
 * ======================================== */
const Storage: React.FC = () => {
  /* ---------- 标签页状态 ---------- */
  const [activeTab, setActiveTab] = useState<'tenants' | 'files'>('tenants');

  /* ---------- 存储统计状态 ---------- */
  const [stats, setStats] = useState<StorageStats | null>(null);   /* 存储统计数据 */
  const [statsLoading, setStatsLoading] = useState(true);          /* 统计加载状态 */

  /* ---------- 企业存储列表状态 ---------- */
  const [tenantData, setTenantData] = useState<TenantStorage[]>([]); /* 企业存储列表 */
  const [tenantTotal, setTenantTotal] = useState(0);               /* 企业总数 */
  const [tenantTotalPages, setTenantTotalPages] = useState(0);     /* 企业列表总页数 */
  const [tenantPage, setTenantPage] = useState(1);                 /* 企业列表当前页码 */
  const [tenantLoading, setTenantLoading] = useState(false);       /* 企业列表加载状态 */

  /* ---------- 文件排行列表状态 ---------- */
  const [files, setFiles] = useState<StorageFile[]>([]);           /* 文件排行列表 */
  const [fileTotal, setFileTotal] = useState(0);                   /* 文件总数 */
  const [fileTotalPages, setFileTotalPages] = useState(0);         /* 文件列表总页数 */
  const [filePage, setFilePage] = useState(1);                     /* 文件列表当前页码 */
  const [fileLoading, setFileLoading] = useState(false);           /* 文件列表加载状态 */

  const [pageSize] = useState(20);                                 /* 每页条数 */

  /* ---------- 数据加载 ---------- */

  /**
   * 加载存储统计数据
   * 调用 developerApi.getStorageStats() 获取总览和各企业明细
   */
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await developerApi.getStorageStats({
        page: tenantPage,
        pageSize,
      });
      const body = res.data || res;
      const items = body.data || [];
      const pagination = body.pagination || {};
      const summary = body.summary || {};
      const totalSize = summary.totalSize ?? items.reduce((sum: number, t: TenantStorage) => sum + (t.totalSize || 0), 0);
      const totalFiles = summary.totalFiles ?? items.reduce((sum: number, t: TenantStorage) => sum + (t.fileCount || 0), 0);
      setStats({ totalSize, totalFiles, tenantStats: items });
      setTenantData(items);
      setTenantTotal(pagination.total || 0);
      setTenantTotalPages(pagination.totalPages || 0);
    } catch (error) {
      console.error('加载存储统计失败:', error);
      toast.error('加载存储统计失败');
    } finally {
      setStatsLoading(false);
    }
  }, [tenantPage, pageSize]);

  /**
   * 加载文件排行列表
   * 调用 developerApi.getStorageFiles() 获取按大小倒序的文件列表
   */
  const fetchFiles = useCallback(async () => {
    try {
      setFileLoading(true);
      const res = await developerApi.getStorageFiles({
        page: filePage,
        pageSize,
        sortBy: 'fileSize',
        sortOrder: 'desc',
      });
      const body = res.data || res;
      setFiles(body.data || []);
      setFileTotal(body.pagination?.total || 0);
      setFileTotalPages(body.pagination?.totalPages || 0);
    } catch (error) {
      console.error('加载文件排行失败:', error);
      toast.error('加载文件排行失败');
    } finally {
      setFileLoading(false);
    }
  }, [filePage, pageSize]);

  /* 初始加载统计 */
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  /* 切换到文件排行时自动加载 */
  useEffect(() => {
    if (activeTab === 'files') {
      fetchFiles();
    }
  }, [activeTab, fetchFiles]);

  /* 标签页切换时重置页码 */
  const handleTabChange = (tab: 'tenants' | 'files') => {
    setActiveTab(tab);
    if (tab === 'tenants' && tenantPage !== 1) {
      setTenantPage(1);
    }
    if (tab === 'files' && filePage !== 1) {
      setFilePage(1);
    }
  };

  /**
   * 刷新当前标签页数据
   */
  const handleRefresh = () => {
    if (activeTab === 'tenants') {
      fetchStats();
    } else {
      fetchFiles();
    }
  };

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">存储管理</h1>
          <p className="page-subtitle">查看系统存储使用情况和文件排行</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            data-testid="developer-storage-refresh"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#8899AA' }}
            title="刷新数据"
          >
            <RefreshCw size={18} className={statsLoading || fileLoading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-medium">
            <HardDrive size={16} />
            存储中心
          </div>
        </div>
      </div>

      {/* ==========================================
       * 存储总览统计卡片
       * ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* 总存储空间 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" data-testid="developer-storage-total-size">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 mb-1">总存储空间</p>
              <p className="text-2xl font-bold text-gray-800">
                {statsLoading ? (
                  <span className="inline-block w-24 h-7 bg-gray-200 rounded animate-pulse" />
                ) : (
                  formatFileSize(stats?.totalSize || 0)
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">所有企业已用存储总量</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center flex-shrink-0 ml-3">
              <Server size={22} />
            </div>
          </div>
        </div>

        {/* 总文件数 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" data-testid="developer-storage-total-files">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 mb-1">总文件数</p>
              <p className="text-2xl font-bold text-gray-800">
                {statsLoading ? (
                  <span className="inline-block w-16 h-7 bg-gray-200 rounded animate-pulse" />
                ) : (
                  (stats?.totalFiles || 0).toLocaleString()
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">所有企业上传文件总数</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 ml-3">
              <File size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
       * 标签页切换 + 列表内容
       * ========================================== */}
      <div className="card">
        {/* 标签页头部 */}
        <div className="flex items-center border-b border-gray-200">
          <button
            onClick={() => handleTabChange('tenants')}
            data-testid="developer-storage-tab-tenants"
            className={`px-6 py-3.5 text-sm font-medium transition-colors relative ${
              activeTab === 'tenants'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 size={16} className="inline mr-1.5" />
            按企业
            {activeTab === 'tenants' && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
              />
            )}
          </button>
          <button
            onClick={() => handleTabChange('files')}
            data-testid="developer-storage-tab-files"
            className={`px-6 py-3.5 text-sm font-medium transition-colors relative ${
              activeTab === 'files'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <File size={16} className="inline mr-1.5" />
            文件排行
            {activeTab === 'files' && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
              />
            )}
          </button>

          {/* 右侧信息 */}
          <div className="ml-auto px-6">
            {activeTab === 'tenants' && (
              <span className="text-xs text-gray-400">
                共 {tenantTotal} 家企业
              </span>
            )}
            {activeTab === 'files' && (
              <span className="text-xs text-gray-400">
                共 {fileTotal} 个文件
              </span>
            )}
          </div>
        </div>

        {/* Tab1 - 按企业 */}
        {activeTab === 'tenants' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* 表头 */}
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">企业名称</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">存储用量</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">文件数量</th>
                </tr>
              </thead>
              {/* 表体 */}
              <tbody className="divide-y divide-gray-100">
                {tenantLoading || statsLoading ? (
                  /* 加载中骨架屏 */
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 3 }).map((_, j) => (
                        <td key={j} className="px-5 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : tenantData.length === 0 ? (
                  /* 无数据 */
                  <tr>
                    <td colSpan={3}>
                      <EmptyState
                        title="暂无企业存储数据"
                        description="尚未有企业上传文件"
                      />
                    </td>
                  </tr>
                ) : (
                  /* 企业存储数据行 */
                  tenantData.map((tenant) => (
                    <tr key={tenant.id} data-testid={`developer-storage-tenant-row-${tenant.id}`} className="hover:bg-gray-50 transition-colors">
                      {/* 企业名称 */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {tenant.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{tenant.name}</span>
                        </div>
                      </td>
                      {/* 存储用量 */}
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm font-medium text-gray-800">
                          {formatFileSize(tenant.totalSize)}
                        </span>
                      </td>
                      {/* 文件数量 */}
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm text-gray-600">
                          {tenant.fileCount.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* 分页 */}
            {!tenantLoading && !statsLoading && tenantData.length > 0 && (
              <div className="px-5 py-4 border-t border-gray-100">
                <Pagination
                  current={tenantPage}
                  total={tenantTotalPages}
                  pageSize={pageSize}
                  totalRecords={tenantTotal}
                  onChange={setTenantPage}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab2 - 文件排行 */}
        {activeTab === 'files' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* 表头 */}
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">文件名</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">文件大小</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">文件类型</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">所属企业</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">上传时间</th>
                </tr>
              </thead>
              {/* 表体 */}
              <tbody className="divide-y divide-gray-100">
                {fileLoading ? (
                  /* 加载中骨架屏 */
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : files.length === 0 ? (
                  /* 无数据 */
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        title="暂无文件数据"
                        description="尚未有企业上传文件"
                      />
                    </td>
                  </tr>
                ) : (
                  /* 文件排行数据行 */
                  files.map((file) => (
                    <tr key={file.id} data-testid={`developer-storage-file-row-${file.id}`} className="hover:bg-gray-50 transition-colors">
                      {/* 文件名 */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 max-w-[300px]">
                          <File size={14} className="text-gray-400 flex-shrink-0" />
                          <span
                            className="text-sm text-gray-800 truncate"
                            title={file.fileName}
                          >
                            {file.fileName}
                          </span>
                        </div>
                      </td>
                      {/* 文件大小 */}
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm font-medium text-gray-800">
                          {formatFileSize(file.fileSize)}
                        </span>
                      </td>
                      {/* 文件类型 */}
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {file.mimeType || '未知'}
                        </span>
                      </td>
                      {/* 所属企业 */}
                      <td className="px-5 py-3 text-sm text-gray-600">{file.tenantName}</td>
                      {/* 上传时间 */}
                      <td className="px-5 py-3 text-sm text-gray-400">{formatDate(file.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* 分页 */}
            {!fileLoading && files.length > 0 && (
              <div className="px-5 py-4 border-t border-gray-100">
                <Pagination
                  current={filePage}
                  total={fileTotalPages}
                  pageSize={pageSize}
                  totalRecords={fileTotal}
                  onChange={setFilePage}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Storage;
