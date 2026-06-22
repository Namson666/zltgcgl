/**
 * 资料通工程管理系统 - 订阅计划页面
 *
 * 功能说明：
 * 展示当前订阅信息、可用套餐计划对比、更改订阅和续费功能。
 * 通过 subscriptionApi.getCurrent() 和 subscriptionApi.getPlans() 获取数据。
 *
 * 页面结构：
 * 1. 页面标题区域
 * 2. 当前订阅信息卡片（计划类型、层级、用户数/最大用户数、到期时间、状态）
 * 3. 续费提示（到期前7天显示）
 * 4. 订阅计划对比表格（3列：小型/中型/大型）
 *    - 单板块（物资/劳资）：价格、用户数、每增用户费用
 *    - 全系统会员：价格、用户数、每增用户费用
 * 5. 更改订阅计划按钮
 *
 * API 调用：
 * - subscriptionApi.getCurrent() - 获取当前订阅信息
 * - subscriptionApi.getPlans() - 获取可用套餐列表
 * - subscriptionApi.changePlan() - 变更订阅套餐
 */

import React, { useState, useEffect } from 'react';
import {
  Crown,
  Check,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { subscriptionApi } from '../../api';
import { formatDate, StatusBadge } from '../../components/ui/Common';
import Modal from '../../components/ui/Modal';

/* ========================================
 * 类型定义
 * ======================================== */

/** 当前订阅信息接口 */
interface CurrentSubscription {
  id: number;                     /* 订阅 ID */
  planName: string;               /* 计划名称 */
  planType: string;               /* 计划类型：single / full */
  tier: string;                   /* 层级：small / medium / large */
  userCount: number;              /* 当前用户数 */
  maxUsers: number;               /* 最大用户数 */
  expiresAt: string;              /* 到期时间 */
  status: string;                 /* 状态：active / trial / expired */
  price: number;                  /* 当前价格 */
}

/** 套餐计划接口 */
interface Plan {
  id: number;                     /* 套餐 ID */
  name: string;                   /* 套餐名称 */
  tier: string;                   /* 层级：small / medium / large */
  description: string;            /* 套餐描述 */
  singlePrice: number;            /* 单板块价格（元/年） */
  singleMaxUsers: number;         /* 单板块最大用户数 */
  singleExtraUserPrice: number;   /* 单板块每增用户费用（元/年） */
  fullPrice: number;              /* 全系统价格（元/年） */
  fullMaxUsers: number;           /* 全系统最大用户数 */
  fullExtraUserPrice: number;     /* 全系统每增用户费用（元/年） */
  features: string[];             /* 功能特性列表 */
}

/* ========================================
 * 常量定义
 * ======================================== */

/** 层级中文映射 */
const tierTextMap: Record<string, string> = {
  small: '小型',
  medium: '中型',
  large: '大型',
};

/** 层级对应颜色样式 */
const tierColorMap: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  small: {
    border: 'border-gray-300',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-800',
  },
  medium: {
    border: 'border-blue-400',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
  },
  large: {
    border: 'border-amber-400',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
  },
};

/* ========================================
 * Plans 订阅计划组件
 * ======================================== */
const Plans: React.FC = () => {
  /* ---------- 状态管理 ---------- */
  const [currentSub, setCurrentSub] = useState<CurrentSubscription | null>(null);  /* 当前订阅 */
  const [plans, setPlans] = useState<Plan[]>([]);          /* 可用套餐列表 */
  const [loading, setLoading] = useState(true);            /* 加载状态 */
  const [changingPlan, setChangingPlan] = useState(false); /* 变更套餐中状态 */
  const [showChangeModal, setShowChangeModal] = useState(false);  /* 变更确认弹窗 */
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);  /* 选中的套餐 */

  /* ---------- 数据加载 ---------- */

  /**
   * 并行加载当前订阅和可用套餐
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [subRes, plansRes] = await Promise.allSettled([
          subscriptionApi.getCurrent(),
          subscriptionApi.getPlans(),
        ]);

        /* 处理当前订阅数据 */
        if (subRes.status === 'fulfilled') {
          const data = subRes.value.data || subRes.value;
          setCurrentSub(data);
        }

        /* 处理套餐列表数据 */
        if (plansRes.status === 'fulfilled') {
          const data = plansRes.value.data || plansRes.value;
          setPlans(Array.isArray(data) ? data : data.items || []);
        }
      } catch (error) {
        console.error('加载订阅数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /* ---------- 续费提醒计算 ---------- */

  /**
   * 判断是否需要显示续费提醒
   * 到期前7天内显示
   */
  const shouldShowRenewalReminder = (): boolean => {
    if (!currentSub?.expiresAt) return false;
    const expiresAt = new Date(currentSub.expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  /**
   * 计算距离到期天数
   */
  const getDaysUntilExpiry = (): number => {
    if (!currentSub?.expiresAt) return 0;
    const expiresAt = new Date(currentSub.expiresAt);
    const now = new Date();
    return Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  /* ---------- 变更套餐操作 ---------- */

  /**
   * 打开变更套餐确认弹窗
   * @param plan - 目标套餐
   */
  const handleChangePlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowChangeModal(true);
  };

  /**
   * 确认变更套餐
   */
  const confirmChangePlan = async () => {
    if (!selectedPlan) return;
    try {
      setChangingPlan(true);
      await subscriptionApi.changePlan(selectedPlan.id);
      toast.success(`已切换到「${selectedPlan.name}」套餐`);
      setShowChangeModal(false);
      /* 刷新当前订阅信息 */
      const res = await subscriptionApi.getCurrent();
      const data = res.data || res;
      setCurrentSub(data);
    } catch (error: any) {
      toast.error(error.message || '变更套餐失败');
    } finally {
      setChangingPlan(false);
    }
  };

  /* ---------- 订阅状态映射 ---------- */

  /**
   * 根据订阅状态返回对应的标签类型
   */
  const getStatusBadgeType = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    switch (status) {
      case 'active': return 'success';
      case 'trial': return 'warning';
      case 'expired': return 'danger';
      default: return 'default';
    }
  };

  /**
   * 订阅状态中文映射
   */
  const statusTextMap: Record<string, string> = {
    active: '已激活',
    trial: '试用中',
    expired: '已过期',
  };

  /* ---------- 加载中骨架屏 ---------- */
  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">订阅计划</h1>
            <p className="page-subtitle">查看和管理您的订阅套餐</p>
          </div>
        </div>
        <div className="card animate-pulse mb-8">
          <div className="card-body space-y-4">
            <div className="h-6 bg-gray-200 rounded w-48" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="card-body space-y-3">
                <div className="h-6 bg-gray-200 rounded w-24 mx-auto" />
                <div className="h-8 bg-gray-100 rounded" />
                <div className="h-4 bg-gray-100 rounded" />
                <div className="h-4 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ==========================================
       * 页面标题区域
       * ========================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">订阅计划</h1>
          <p className="page-subtitle">查看和管理您的订阅套餐</p>
        </div>
        {/* 订阅图标 */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
          <Crown size={16} />
          订阅管理
        </div>
      </div>

      {/* ==========================================
       * 续费提醒（到期前7天显示）
       * ========================================== */}
      {shouldShowRenewalReminder() && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              您的订阅即将到期
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              距离到期还有 {getDaysUntilExpiry()} 天，到期时间：{formatDate(currentSub?.expiresAt)}
            </p>
          </div>
          <button className="btn-primary btn-sm flex items-center gap-1.5">
            <RefreshCw size={14} />
            立即续费
          </button>
        </div>
      )}

      {/* ==========================================
       * 当前订阅信息卡片
       * ========================================== */}
      {currentSub && (
        <div className="card mb-8">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <Crown size={20} className="text-blue-600" />
              当前订阅
            </h2>
            <StatusBadge
              status={statusTextMap[currentSub.status] || currentSub.status}
              type={getStatusBadgeType(currentSub.status)}
            />
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* 计划名称 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">计划名称</p>
                <p className="text-sm font-semibold text-gray-800">{currentSub.planName}</p>
              </div>
              {/* 计划类型 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">计划类型</p>
                <p className="text-sm font-semibold text-gray-800">
                  {currentSub.planType === 'full' ? '全系统会员' : '单板块'}
                </p>
              </div>
              {/* 层级 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">层级</p>
                <p className="text-sm font-semibold text-gray-800">
                  {tierTextMap[currentSub.tier] || currentSub.tier}
                </p>
              </div>
              {/* 用户数 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">用户数</p>
                <p className="text-sm font-semibold text-gray-800">
                  {currentSub.userCount} / {currentSub.maxUsers}
                </p>
              </div>
              {/* 到期时间 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">到期时间</p>
                <p className="text-sm font-semibold text-gray-800">
                  {formatDate(currentSub.expiresAt)}
                </p>
              </div>
              {/* 年费 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">年费</p>
                <p className="text-sm font-semibold text-blue-600">
                  {currentSub.price > 0 ? `${currentSub.price} 元/年` : '免费'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
       * 订阅计划对比表格
       * 3列：小型 / 中型 / 大型
       * ========================================== */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">可用套餐</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const colors = tierColorMap[plan.tier] || tierColorMap.small;
            const isCurrentPlan = currentSub?.tier === plan.tier;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border-2 ${colors.border} overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                  isCurrentPlan ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                }`}
              >
                {/* 套餐头部 */}
                <div className={`px-6 py-4 ${colors.bg} text-center`}>
                  <h3 className={`text-lg font-bold ${colors.text}`}>
                    {plan.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                  {/* 当前套餐标识 */}
                  {isCurrentPlan && (
                    <span className="inline-block mt-2 px-3 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">
                      当前套餐
                    </span>
                  )}
                </div>

                {/* 套餐内容 */}
                <div className="px-6 py-5">
                  {/* 单板块价格 */}
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      单板块（物资/劳资）
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">年费价格</span>
                        <span className="text-sm font-bold text-gray-800">
                          {plan.singlePrice > 0 ? `${plan.singlePrice} 元/年` : '免费'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">最大用户数</span>
                        <span className="text-sm font-medium text-gray-700">{plan.singleMaxUsers} 人</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">每增用户</span>
                        <span className="text-sm font-medium text-gray-700">
                          {plan.singleExtraUserPrice > 0 ? `${plan.singleExtraUserPrice} 元/年` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 分割线 */}
                  <div className="border-t border-gray-200 my-4" />

                  {/* 全系统会员价格 */}
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      全系统会员
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">年费价格</span>
                        <span className="text-sm font-bold text-gray-800">
                          {plan.fullPrice > 0 ? `${plan.fullPrice} 元/年` : '免费'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">最大用户数</span>
                        <span className="text-sm font-medium text-gray-700">{plan.fullMaxUsers} 人</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">每增用户</span>
                        <span className="text-sm font-medium text-gray-700">
                          {plan.fullExtraUserPrice > 0 ? `${plan.fullExtraUserPrice} 元/年` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 分割线 */}
                  <div className="border-t border-gray-200 my-4" />

                  {/* 功能特性列表 */}
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      包含功能
                    </h4>
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                          <Check size={14} className="text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 操作按钮 */}
                  {isCurrentPlan ? (
                    <button className="w-full btn-secondary" disabled>
                      当前套餐
                    </button>
                  ) : (
                    <button
                      onClick={() => handleChangePlan(plan)}
                      className="w-full btn-primary"
                    >
                      切换到此套餐
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==========================================
       * 变更套餐确认弹窗
       * ========================================== */}
      <Modal
        isOpen={showChangeModal}
        onClose={() => setShowChangeModal(false)}
        title="确认变更套餐"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowChangeModal(false)} className="btn-secondary" disabled={changingPlan}>
              取消
            </button>
            <button onClick={confirmChangePlan} className="btn-primary" disabled={changingPlan}>
              {changingPlan ? '变更中...' : '确认变更'}
            </button>
          </>
        }
      >
        {selectedPlan && (
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Crown size={24} />
            </div>
            <p className="text-sm text-gray-600">
              确定要将订阅套餐变更为
            </p>
            <p className="text-lg font-bold text-gray-800 mt-1">
              {selectedPlan.name}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              变更后将按新套餐的规则生效
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Plans;
