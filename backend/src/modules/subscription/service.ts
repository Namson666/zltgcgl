// ============================================
// 订阅计费 - 业务逻辑层
// ============================================
// 从 routes.ts 中抽取，所有业务逻辑集中管理
// routes.ts 只负责 HTTP 请求/响应

import { prisma } from '../../common/utils/prisma';

// ============================================
// 订阅计划配置
// ============================================

export const PLAN_CONFIG: Record<string, {
  name: string;
  description: string;
  tiers: Record<string, { maxUsers: number; pricePerMonth: number; pricePerExtraUser: number }>;
}> = {
  SINGLE_WMS: {
    name: '物资管理版',
    description: '仅包含物资管理模块',
    tiers: {
      SMALL: { maxUsers: 5, pricePerMonth: 388, pricePerExtraUser: 50 },
      MEDIUM: { maxUsers: 20, pricePerMonth: 888, pricePerExtraUser: 50 },
      LARGE: { maxUsers: 100, pricePerMonth: 1888, pricePerExtraUser: 50 },
    },
  },
  SINGLE_LABOR: {
    name: '劳资管理版',
    description: '仅包含劳资管理模块',
    tiers: {
      SMALL: { maxUsers: 5, pricePerMonth: 388, pricePerExtraUser: 50 },
      MEDIUM: { maxUsers: 20, pricePerMonth: 888, pricePerExtraUser: 50 },
      LARGE: { maxUsers: 100, pricePerMonth: 1888, pricePerExtraUser: 50 },
    },
  },
  FULL: {
    name: '全系统会员',
    description: '包含物资管理和劳资管理全部功能',
    tiers: {
      SMALL: { maxUsers: 5, pricePerMonth: 588, pricePerExtraUser: 80 },
      MEDIUM: { maxUsers: 20, pricePerMonth: 1288, pricePerExtraUser: 80 },
      LARGE: { maxUsers: 100, pricePerMonth: 2888, pricePerExtraUser: 80 },
    },
  },
};

// ============================================
// 当前订阅
// ============================================

export async function getCurrentSubscription(tenantId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: {
      payments: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (!subscription) throw { status: 404, code: 'NOT_FOUND', message: '未找到订阅信息' };

  const now = new Date();
  const remainingDays = Math.max(0, Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const extraUsers = Math.max(0, subscription.currentUsers - subscription.maxUsers);
  const extraUserCost = extraUsers * Number(subscription.pricePerExtraUser);
  const totalMonthlyCost = Number(subscription.pricePerMonth) + extraUserCost;

  return { ...subscription, remainingDays, extraUsers, extraUserCost, totalMonthlyCost };
}

// ============================================
// 订阅计划
// ============================================

export function listPlans() {
  return Object.entries(PLAN_CONFIG).map(([planKey, planInfo]) => ({
    key: planKey,
    name: planInfo.name,
    description: planInfo.description,
    tiers: Object.entries(planInfo.tiers).map(([tierKey, tierInfo]) => ({
      key: tierKey,
      ...tierInfo,
    })),
  }));
}

// ============================================
// 更改订阅计划
// ============================================

export async function changeSubscriptionPlan(tenantId: string, plan: string, tier: string) {
  const validPlans = ['SINGLE_WMS', 'SINGLE_LABOR', 'FULL'];
  if (!validPlans.includes(plan)) throw { status: 400, code: 'INVALID_PLAN', message: `无效的订阅计划，可选值：${validPlans.join(', ')}` };

  const validTiers = ['SMALL', 'MEDIUM', 'LARGE'];
  if (!validTiers.includes(tier)) throw { status: 400, code: 'INVALID_TIER', message: `无效的订阅层级，可选值：${validTiers.join(', ')}` };

  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!subscription) throw { status: 404, code: 'NOT_FOUND', message: '未找到订阅信息' };

  const planConfig = PLAN_CONFIG[plan]?.tiers[tier];
  if (!planConfig) throw { status: 400, code: 'INVALID_CONFIG', message: '无效的计划配置' };

  const now = new Date();
  const newPeriodEnd = new Date(now);
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

  const updatedSubscription = await prisma.subscription.update({
    where: { tenantId },
    data: {
      plan, tier,
      maxUsers: planConfig.maxUsers,
      pricePerMonth: planConfig.pricePerMonth,
      pricePerExtraUser: planConfig.pricePerExtraUser,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: newPeriodEnd,
    },
  });

  return { subscription: updatedSubscription, oldPlan: subscription.plan, oldTier: subscription.tier };
}

// ============================================
// 支付记录
// ============================================

export interface PaymentListParams {
  tenantId: string;
  page: number;
  pageSize: number;
  status?: string;
}

export async function listPayments(params: PaymentListParams) {
  const { tenantId, page, pageSize, status: statusFilter } = params;

  const subscription = await prisma.subscription.findUnique({ where: { tenantId }, select: { id: true } });
  if (!subscription) throw { status: 404, code: 'NOT_FOUND', message: '未找到订阅信息' };

  const where: any = { subscriptionId: subscription.id };
  if (statusFilter) where.status = statusFilter;

  const [total, payments] = await Promise.all([
    prisma.subscriptionPayment.count({ where }),
    prisma.subscriptionPayment.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
  ]);

  return { payments, total, totalPages: Math.ceil(total / pageSize) };
}
