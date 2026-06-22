// ============================================
// 资料通工程管理系统 - Express 应用配置
// ============================================
// 配置 Express 中间件、路由注册、错误处理
// 最后更新：2026-04-24

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { globalRateLimit } from './common/middleware/rateLimit';
import { errorHandler } from './common/middleware/errorHandler';
import { requireTenantModule } from './common/middleware/module';
import { authenticate, requireUser } from './common/middleware/auth';
import authRoutes from './modules/auth/routes';
import developerRoutes from './modules/developer/routes';
import tenantRoutes from './modules/tenant/routes';
import subscriptionRoutes from './modules/subscription/routes';
import contractRoutes from './modules/contract/routes';
import departmentRoutes from './modules/department/routes';
import wmsRoutes from './modules/wms/routes';
import laborRoutes from './modules/labor/routes';
import financeRoutes from './modules/finance/routes';
import logRoutes from './modules/auth/routes/logs';
import recycleBinRoutes from './modules/recycle-bin/routes';

// 创建 Express 应用
const app = express();

// ============================================
// 中间件配置
// ============================================

// 安全 HTTP 头
app.use(helmet());

// CORS 跨域配置
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : undefined;

app.use(cors({
  origin: allowedOrigins || (process.env.NODE_ENV === 'production' ? false : true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 请求体解析（支持 JSON 和 URL 编码，限制 50MB）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// HTTP 请求日志
app.use(morgan('combined'));

// 全局限流
app.use(globalRateLimit);

// 静态文件服务（上传文件）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// API 路由注册
// ============================================

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 认证路由
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);

// 开发者后台路由
app.use('/api/developer', developerRoutes);
app.use('/api/v1/developer', developerRoutes);

// 租户管理路由
app.use('/api/tenants', tenantRoutes);
app.use('/api/v1/tenants', tenantRoutes);

// 订阅计费路由
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);

// 合同管理路由
app.use('/api/contracts', contractRoutes);
app.use('/api/v1/contracts', contractRoutes);

// 项目部管理路由
app.use('/api/departments', departmentRoutes);
app.use('/api/v1/departments', departmentRoutes);

// 物资管理路由
app.use('/api/wms', authenticate, requireUser, requireTenantModule('wms'), wmsRoutes);
app.use('/api/v1/wms', authenticate, requireUser, requireTenantModule('wms'), wmsRoutes);

// 劳资管理路由
app.use('/api/labor', authenticate, requireUser, requireTenantModule('labor'), laborRoutes);
app.use('/api/v1/labor', authenticate, requireUser, requireTenantModule('labor'), laborRoutes);

// 财务管理路由
app.use('/api/finance', authenticate, requireUser, requireTenantModule('finance'), financeRoutes);
app.use('/api/v1/finance', authenticate, requireUser, requireTenantModule('finance'), financeRoutes);

// 操作日志路由
app.use('/api/logs', logRoutes);
app.use('/api/v1/logs', logRoutes);

// 回收站管理路由
app.use('/api/recycle-bin', recycleBinRoutes);
app.use('/api/v1/recycle-bin', recycleBinRoutes);

// ============================================
// 错误处理（放在所有路由之后）
// ============================================
app.use(errorHandler);

// 404 处理
app.use((_req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

export default app;
