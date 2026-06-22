// ============================================
// JWT 工具模块
// ============================================
// 提供 JWT Token 的签发和验证功能。
// 系统使用 JWT 进行用户身份认证，Token 中携带用户基本信息。
// 密钥从环境变量 JWT_SECRET 读取，确保安全性。
// ============================================

import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

/**
 * 从环境变量获取 JWT 密钥
 *
 * 生产环境中必须设置强密钥，开发环境使用默认值。
 */
const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 环境变量未设置。请在 .env 文件中配置强密钥后重启服务。');
  }
  return secret;
})();

/**
 * 默认 Token 有效期：24 小时
 *
 * 普通用户和开发者的登录 Token 有效期为 24 小时，
 * 过期后需要重新登录获取新 Token。
 */
const DEFAULT_EXPIRES_IN = '24h';

/**
 * 开发者视角 Token 有效期：4 小时
 *
 * 开发者以租户身份查看数据时使用的 Token，
 * 有效期较短以确保安全性。
 */
const DEV_VIEW_EXPIRES_IN = '4h';

/**
 * 签发 JWT Token
 *
 * 根据用户信息生成 JWT Token。Token 中包含用户 ID、类型、
 * 租户ID、角色等关键信息，用于后续请求的身份验证。
 *
 * @param payload - JWT 载荷数据，包含用户身份信息
 * @param expiresIn - Token 有效期，默认为 24 小时（如 '7d', '1h', '30m'）
 * @returns 签发后的 JWT Token 字符串
 *
 * @example
 * // 为普通用户签发 Token
 * const token = signToken({
 *   id: 'user-uuid',
 *   type: 'user',
 *   tenantId: 'tenant-uuid',
 *   role: 'admin',
 *   dataScope: 'ALL'
 * });
 *
 * // 为开发者签发 Token
 * const devToken = signToken({
 *   id: 'dev-uuid',
 *   type: 'developer'
 * });
 */
export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresIn?: string): string {
  const options = {
    expiresIn: expiresIn || DEFAULT_EXPIRES_IN,
  } as jwt.SignOptions;
  return jwt.sign({ ...payload }, JWT_SECRET, options);
}

/**
 * 验证 JWT Token
 *
 * 解析并验证 JWT Token 的有效性。如果 Token 有效，
 * 返回解析后的载荷数据；如果 Token 无效或已过期，抛出错误。
 *
 * @param token - 待验证的 JWT Token 字符串
 * @returns 解析后的 JWT 载荷数据
 * @throws {JsonWebTokenError} Token 无效时抛出错误
 * @throws {TokenExpiredError} Token 已过期时抛出错误
 *
 * @example
 * try {
 *   const payload = verifyToken('eyJhbGciOiJIUzI1NiIs...');
 *   console.log(payload.id); // 用户ID
 *   console.log(payload.type); // 用户类型
 * } catch (error) {
 *   console.error('Token 验证失败:', error.message);
 * }
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
}

/**
 * 签发开发者视角 Token
 *
 * 当平台开发者需要以某个租户的身份查看和管理数据时，
 * 使用此方法签发特殊的 Token。
 *
 * 该 Token 的特点：
 * - type 仍为 'developer'，表示身份是开发者
 * - 包含 tenantId，表示正在查看的目标租户
 * - isDevView 标记为 true，表示这是开发者视角
 * - 有效期为 4 小时（比普通 Token 短）
 *
 * @param developerId - 开发者的唯一标识（UUID）
 * @param tenantId - 目标租户的唯一标识（UUID）
 * @returns 签发后的开发者视角 JWT Token 字符串
 *
 * @example
 * // 开发者切换到某个租户视角
 * const token = signDevViewToken('dev-uuid-123', 'tenant-uuid-456');
 * // Token 载荷: { id: 'dev-uuid-123', type: 'developer', tenantId: 'tenant-uuid-456', isDevView: true }
 */
export function signDevViewToken(developerId: string, tenantId: string): string {
  const payload: JwtPayload = {
    id: developerId,
    type: 'developer',
    tenantId: tenantId,
    isDevView: true,
  };

  return jwt.sign({ ...payload }, JWT_SECRET, {
    expiresIn: DEV_VIEW_EXPIRES_IN,
  });
}

// ============================================
// 长期登录凭证（Refresh Token）
// ============================================
import crypto from 'crypto';
import { prisma } from './prisma';

export const REFRESH_TOKEN_DAYS = 30;

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function storeRefreshToken(params: {
  userId: string;
  userType: 'developer' | 'user';
  tenantId?: string;
}): Promise<string> {
  const rawToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: params.userId,
      tokenHash: hashToken(rawToken),
      userType: params.userType,
      tenantId: params.tenantId || null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return rawToken;
}

export async function verifyAndConsumeRefreshToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    return null;
  }

  // 用完即销毁，换新钥匙
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  return record;
}

export async function revokeUserRefreshTokens(userId: string, userType: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, userType, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
