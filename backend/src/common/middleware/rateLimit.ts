// ============================================
// 限流中间件
// ============================================
// 使用 express-rate-limit 实现接口请求频率限制，
// 防止恶意请求和暴力攻击。
// 提供全局限流和登录专用限流两种预设配置。
// ============================================

import rateLimit from 'express-rate-limit';

/**
 * 全局 API 限流中间件
 *
 * 适用于所有 API 接口的通用限流规则。
 * 每个 IP 地址在 15 分钟窗口期内最多发起 1000 次请求。
 *
 * 限流规则：
 * - 时间窗口：15 分钟
 * - 最大请求数：1000 次/窗口
 * - 超出限制时返回 429 Too Many Requests
 *
 * 使用方式：
 * 在 app.ts 中将全局限流中间件注册到所有 API 路由之前。
 *
 * @example
 * app.use('/api', globalRateLimit);
 */
export const globalRateLimit = rateLimit({
  /** 时间窗口（毫秒）：15 分钟 */
  windowMs: 15 * 60 * 1000,
  /** 每个 IP 在时间窗口内的最大请求数 */
  max: 1000,
  /** 限流标准：使用客户端 IP 地址 */
  standardHeaders: true,
  /** 是否启用限流头部信息（X-RateLimit-*） */
  legacyHeaders: false,
  /** 超出限制时的处理函数 */
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: '请求过于频繁，请稍后再试。每个 IP 每 15 分钟最多 1000 次请求。',
    });
  },
});

/**
 * 登录接口限流中间件
 *
 * 专门用于登录接口的严格限流规则，防止暴力破解密码。
 * 每个 IP 地址在 15 分钟窗口期内最多发起 10 次登录请求。
 *
 * 限流规则：
 * - 时间窗口：15 分钟
 * - 最大请求数：10 次/窗口
 * - 超出限制时返回 429 Too Many Requests
 *
 * 使用方式：
 * 在登录路由上单独应用此限流中间件。
 *
 * @example
 * app.post('/api/auth/login', loginRateLimit, authController.login);
 */
export const loginRateLimit = rateLimit({
  /** 时间窗口（毫秒）：15 分钟 */
  windowMs: 15 * 60 * 1000,
  /** 每个 IP 在时间窗口内的最大请求数（登录接口限制更严格） */
  max: 10,
  /** 限流标准：使用客户端 IP 地址 */
  standardHeaders: true,
  /** 是否启用限流头部信息 */
  legacyHeaders: false,
  /** 超出限制时的处理函数 */
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: '登录尝试过于频繁，请 15 分钟后再试。如果忘记密码，请联系管理员。',
    });
  },
});

/**
 * 文件下载限流中间件
 *
 * 用于附件、报表等二进制下载接口，降低被盗 token 或异常脚本批量拉取文件的风险。
 */
export const fileDownloadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'TOO_MANY_DOWNLOADS',
      message: '文件下载过于频繁，请稍后再试。',
    });
  },
});
