/**
 * 资料通工程管理系统 - 数据看板页面
 *
 * 功能说明：
 * 数据看板首页，展示系统核心统计数据和快捷入口。
 * 通过 contractApi、departmentApi、laborApi、wmsApi 获取真实数据，
 * 如果 API 调用失败则显示"暂无数据"。
 *
 * 页面结构：
 * 1. 页面标题区域（含欢迎信息）
 * 2. 顶部统计卡片（4个）：合同数、项目部数、人员数、本月工资发放额
 * 3. 物资管理概览：总入库量、总出库量、当前库存量、低库存预警数
 * 4. 劳资管理概览：在册人员数、本月出勤天数、本月工资总额、异常数
 * 5. 快捷入口：入库管理、出库管理、考勤管理、工资核算
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  FolderKanban,
  Users,
  DollarSign,
  Package,
  PackagePlus,
  PackageMinus,
  PackageCheck,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  CalendarCheck,
  ClipboardList,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/AuthContext';
import { contractApi, departmentApi, laborApi, wmsApi } from '../api';
import { formatMoney } from '../components/ui/Common';

/* ========================================
 * 类型定义
 * ======================================== */

/** 顶部统计数据接口 */
interface TopStats {
  contractCount: number;           /* 合同数 */
  departmentCount: number;         /* 项目部数 */
  personnelCount: number;          /* 人员数 */
  monthlyPayment: number;          /* 本月工资发放额 */
}

/** 物资管理统计接口 */
interface WmsStats {
  totalInbound: number;            /* 总入库量 */
  totalOutbound: number;           /* 总出库量 */
  currentStock: number;            /* 当前库存量 */
  lowStockAlerts: number;          /* 低库存预警数 */
}

/** 劳资管理统计接口 */
interface LaborStats {
  activePersonnel: number;         /* 在册人员数 */
  monthlyAttendance?: number;      /* 本月出勤天数 */
  monthlySalary: number;           /* 本月工资总额 */
  anomalyCount: number;            /* 异常数 */
}

/* ========================================
 * Dashboard 数据看板组件
 * ======================================== */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  /* ---------- 状态管理 ---------- */
  const [topStats, setTopStats] = useState<TopStats | null>(null);       /* 顶部统计数据 */
  const [wmsStats, setWmsStats] = useState<WmsStats | null>(null);       /* 物资管理统计 */
  const [laborStats, setLaborStats] = useState<LaborStats | null>(null);  /* 劳资管理统计 */
  const [loading, setLoading] = useState(true);                           /* 加载状态 */

  /* ---------- 数据加载 ---------- */

  /**
   * 并行加载所有统计数据
   * 各模块独立调用，单个失败不影响其他模块数据显示
   */
  useEffect(() => {
    const fetchAllStats = async () => {
      setLoading(true);

      /* 并行请求所有统计数据 */
      const results = await Promise.allSettled([
        /* 合同和项目部统计 */
        (async () => {
          const [contracts, departments] = await Promise.all([
            contractApi.getList({ page: 1, pageSize: 1 }),
            departmentApi.getList({ page: 1, pageSize: 1 }),
          ]);
          const contractData = contracts.data || contracts;
          const deptData = departments.data || departments;
          return {
            contractCount: contractData.total || 0,
            departmentCount: deptData.total || 0,
          };
        })(),

        /* 人员统计 */
        (async () => {
          const res = await laborApi.getPersonnel({ page: 1, pageSize: 1 });
          const data = res.data || res;
          return { personnelCount: data.total || 0 };
        })(),

        /* 本月工资发放额 */
        (async () => {
          const now = new Date();
          const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const res = await laborApi.getSalarySummary(month);
          const data = res.data || res;
          return { monthlyPayment: data.totalPaid || 0 };
        })(),

        /* 物资管理统计 */
        (async () => {
          const [inbound, outbound, alerts] = await Promise.all([
            wmsApi.getInbound({ page: 1, pageSize: 1 }),
            wmsApi.getOutbound({ page: 1, pageSize: 1 }),
            wmsApi.getAlerts({ page: 1, pageSize: 1 }),
          ]);
          const inData = inbound.data || inbound;
          const outData = outbound.data || outbound;
          const alertData = alerts.data || alerts;
          return {
            totalInbound: inData.total || 0,
            totalOutbound: outData.total || 0,
            lowStockAlerts: alertData.total || 0,
          };
        })(),

        /* 库存统计 */
        (async () => {
          const res = await wmsApi.getInventory({ page: 1, pageSize: 1 });
          const data = res.data || res;
          return { currentStock: data.total || 0 };
        })(),

        /* 劳资管理统计 */
        (async () => {
          const now = new Date();
          const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const [personnel, salarySummary, anomalies] = await Promise.all([
            laborApi.getPersonnel({ page: 1, pageSize: 1 }),
            laborApi.getSalarySummary(month),
            laborApi.getAnomalyStats(),
          ]);
          const pData = personnel.data || personnel;
          const sData = salarySummary.data || salarySummary;
          const aData = anomalies.data || anomalies;
          return {
            activePersonnel: pData.total || 0,
            monthlySalary: sData.totalAmount || 0,
            anomalyCount: aData.unresolved || 0,
          };
        })(),
      ]);

      /* 处理结果：成功则更新对应状态，失败则保持 null（显示"暂无数据"） */
      if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled') {
        const contractDept = results[0].value;
        const personnel = results[1].value;
        setTopStats({
          contractCount: contractDept.contractCount,
          departmentCount: contractDept.departmentCount,
          personnelCount: personnel.personnelCount,
          monthlyPayment: results[2].status === 'fulfilled' ? results[2].value.monthlyPayment : 0,
        });
      } else {
        setTopStats(null);
      }

      if (results[3].status === 'fulfilled' && results[4].status === 'fulfilled') {
        setWmsStats({
          ...results[3].value,
          currentStock: results[4].value.currentStock,
        });
      } else {
        setWmsStats(null);
      }

      if (results[5].status === 'fulfilled') {
        setLaborStats(results[5].value);
      } else {
        setLaborStats(null);
      }

      setLoading(false);
    };

    fetchAllStats();
  }, []);

  /* ---------- 渲染辅助函数 ---------- */

  /**
   * 渲染统计数值
   * 加载中显示骨架屏，无数据显示"暂无数据"
   * @param value - 数值
   * @param isMoney - 是否为金额（需要格式化）
   */
  const renderValue = (value: number | undefined | null, isMoney = false) => {
    if (loading) {
      return <span className="inline-block w-16 h-7 bg-gray-200 rounded animate-pulse" />;
    }
    if (value === undefined || value === null) {
      return <span className="text-lg text-gray-400">暂无数据</span>;
    }
    return isMoney ? formatMoney(value) : String(value);
  };

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">数据看板</h1>
          <p className="page-subtitle">
            {user?.tenantName ? `${user.tenantName} - ` : ''}系统数据概览
          </p>
        </div>
        {/* 欢迎信息 */}
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          欢迎回来，{user?.realName || user?.username || '用户'}
        </div>
      </div>

      {/* ==========================================
       * 顶部统计卡片（4个）
       * 合同数、项目部数、人员数、本月工资发放额
       * ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* 合同数 */}
        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => navigate('/contracts')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>合同数</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                {renderValue(topStats?.contractCount)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-bg)', color: 'var(--primary)' }}>
              <FileText size={24} />
            </div>
          </div>
          <div className="mt-3 flex items-center text-xs transition-colors" style={{ color: 'var(--muted-foreground)' }}>
            <span>查看详情</span>
            <ArrowRight size={12} className="ml-1" />
          </div>
        </div>

        {/* 项目部数 */}
        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => navigate('/departments')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>项目部数</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                {renderValue(topStats?.departmentCount)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <FolderKanban size={24} />
            </div>
          </div>
          <div className="mt-3 flex items-center text-xs transition-colors" style={{ color: 'var(--muted-foreground)' }}>
            <span>查看详情</span>
            <ArrowRight size={12} className="ml-1" />
          </div>
        </div>

        {/* 人员数 */}
        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => navigate('/labor/personnel')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>人员数</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                {renderValue(topStats?.personnelCount)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-bg)', color: 'var(--primary)' }}>
              <Users size={24} />
            </div>
          </div>
          <div className="mt-3 flex items-center text-xs transition-colors" style={{ color: 'var(--muted-foreground)' }}>
            <span>查看详情</span>
            <ArrowRight size={12} className="ml-1" />
          </div>
        </div>

        {/* 本月工资发放额 */}
        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => navigate('/labor/payment')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>本月工资发放额</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                {renderValue(topStats?.monthlyPayment, true)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
              <DollarSign size={24} />
            </div>
          </div>
          <div className="mt-3 flex items-center text-xs transition-colors" style={{ color: 'var(--muted-foreground)' }}>
            <span>查看详情</span>
            <ArrowRight size={12} className="ml-1" />
          </div>
        </div>
      </div>

      {/* ==========================================
       * 下方两栏布局
       * 左侧：物资管理概览
       * 右侧：劳资管理概览
       * ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ---------- 物资管理概览 ---------- */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <Package size={20} style={{ color: 'var(--primary)' }} />
              物资管理概览
            </h2>
            <button
              onClick={() => navigate('/wms/materials')}
              className="text-sm flex items-center gap-1" style={{ color: 'var(--primary)' }}
            >
              查看全部 <ArrowRight size={14} />
            </button>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              {/* 总入库量 */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--primary-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <PackagePlus size={16} style={{ color: 'var(--primary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>总入库量</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--primary-dark)' }}>
                  {renderValue(wmsStats?.totalInbound)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--primary-light)' }}>笔入库记录</p>
              </div>
              {/* 总出库量 */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--success-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <PackageMinus size={16} style={{ color: 'var(--success)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>总出库量</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'oklch(0.50 0.16 145)' }}>
                  {renderValue(wmsStats?.totalOutbound)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'oklch(0.60 0.12 145)' }}>笔出库记录</p>
              </div>
              {/* 当前库存量 */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--accent)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <PackageCheck size={16} style={{ color: 'var(--primary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>当前库存量</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--primary-dark)' }}>
                  {renderValue(wmsStats?.currentStock)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--primary-light)' }}>种物资</p>
              </div>
              {/* 低库存预警数 */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--warning-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>低库存预警</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--warning-foreground)' }}>
                  {renderValue(wmsStats?.lowStockAlerts)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'oklch(0.60 0.12 85)' }}>条预警</p>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- 劳资管理概览 ---------- */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <Users size={20} style={{ color: 'var(--primary)' }} />
              劳资管理概览
            </h2>
            <button
              onClick={() => navigate('/labor/personnel')}
              className="text-sm flex items-center gap-1" style={{ color: 'var(--primary)' }}
            >
              查看全部 <ArrowRight size={14} />
            </button>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              {/* 在册人员数 */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--primary-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} style={{ color: 'var(--primary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>在册人员</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--primary-dark)' }}>
                  {renderValue(laborStats?.activePersonnel)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--primary-light)' }}>人</p>
              </div>
              {/* 本月出勤天数 */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--success-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarCheck size={16} style={{ color: 'var(--success)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>本月出勤</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'oklch(0.50 0.16 145)' }}>
                  {loading ? (
                    <span className="inline-block w-12 h-7 rounded animate-pulse" style={{ backgroundColor: 'var(--muted)' }} />
                  ) : (
                    new Date().getDate()
                  )}
                </p>
                <p className="text-xs mt-1" style={{ color: 'oklch(0.60 0.12 145)' }}>天</p>
              </div>
              {/* 本月工资总额 */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--accent)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={16} style={{ color: 'var(--primary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>本月工资总额</span>
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--primary-dark)' }}>
                  {renderValue(laborStats?.monthlySalary, true)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--primary-light)' }}>应发合计</p>
              </div>
              {/* 异常数 */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--destructive-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} style={{ color: 'var(--destructive)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--destructive)' }}>异常记录</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--destructive)' }}>
                  {renderValue(laborStats?.anomalyCount)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'oklch(0.48 0.18 25)' }}>条未处理</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
       * 快捷入口区域
       * ========================================== */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2">
            <TrendingUp size={20} style={{ color: 'var(--primary)' }} />
            快捷入口
          </h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* 快捷入口按钮列表 */}
            {[
              { name: '入库管理', path: '/wms/inbound', icon: <PackagePlus size={20} />, color: '' },
              { name: '出库管理', path: '/wms/outbound', icon: <PackageMinus size={20} />, color: '' },
              { name: '考勤管理', path: '/labor/attendance', icon: <ClipboardList size={20} />, color: '' },
              { name: '工资核算', path: '/labor/salary', icon: <DollarSign size={20} />, color: '' },
            ].map((item) => (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary-bg)', color: 'var(--primary)' }}>
                  {item.icon}
                </div>
                <span className="text-sm">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
