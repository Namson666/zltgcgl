// ============================================
// 认证流程集成测试
// ============================================
// 测试策略：使用真实 SQLite test.db + 数据种子/清理模式
// 每个测试前后确保数据库处于干净状态
// ============================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../app';
import prisma from '../common/utils/prisma';

// ---------------------------------------------------------------------------
// 测试数据常量
// ---------------------------------------------------------------------------

const TEST_DEV = {
  username: 'test_admin',
  name: '测试管理员',
  password: 'TestPass123',
};

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 在测试数据库中创建一个开发者
 */
async function seedDeveloper(): Promise<string> {
  const passwordHash = await bcrypt.hash(TEST_DEV.password, 10);
  const dev = await prisma.developer.upsert({
    where: { username: TEST_DEV.username },
    update: { passwordHash, name: TEST_DEV.name, isActive: true },
    create: {
      username: TEST_DEV.username,
      passwordHash,
      name: TEST_DEV.name,
      isActive: true,
    },
  });
  return dev.id;
}

/**
 * 从数据库中删除测试开发者
 */
async function cleanupDeveloper() {
  await prisma.developer.deleteMany({ where: { username: TEST_DEV.username } });
  // 清理可能残留的 refresh tokens
  await prisma.refreshToken.deleteMany({});
}

/**
 * 签发一个测试 JWT
 */
function signTestToken(devId: string): string {
  return jwt.sign({ id: devId, type: 'developer' }, JWT_SECRET, { expiresIn: '1h' });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Auth API (real DB)', () => {
  let testDevId: string;

  beforeAll(async () => {
    // 确保测试数据库中有开发者
    testDevId = await seedDeveloper();
  });

  afterAll(async () => {
    // 清理测试数据
    await cleanupDeveloper();
    await prisma.$disconnect();
  });

  describe('POST /api/auth/developer/login', () => {
    afterEach(async () => {
      // 每次测试后清理 refresh tokens，避免积累
      await prisma.refreshToken.deleteMany({});
    });

    it('logs in successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/developer/login')
        .send({ username: TEST_DEV.username, password: TEST_DEV.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('登录成功');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.username).toBe(TEST_DEV.username);
      expect(res.body.data.user.name).toBe(TEST_DEV.name);
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // Verify the JWT is valid
      const decoded = jwt.verify(res.body.data.token, JWT_SECRET) as any;
      expect(decoded.id).toBe(testDevId);
      expect(decoded.type).toBe('developer');
    });

    it('returns 400 when username is missing', async () => {
      const res = await request(app)
        .post('/api/auth/developer/login')
        .send({ password: 'somepassword' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('MISSING_PARAMS');
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/developer/login')
        .send({ username: TEST_DEV.username });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when body is empty', async () => {
      const res = await request(app)
        .post('/api/auth/developer/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/developer/login')
        .send({ username: TEST_DEV.username, password: 'WrongPassword999' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 for non-existent developer', async () => {
      const res = await request(app)
        .post('/api/auth/developer/login')
        .send({ username: 'no_such_user_xyz', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns 403 when developer account is disabled', async () => {
      // Temporarily disable the test developer
      await prisma.developer.update({
        where: { username: TEST_DEV.username },
        data: { isActive: false },
      });

      const res = await request(app)
        .post('/api/auth/developer/login')
        .send({ username: TEST_DEV.username, password: TEST_DEV.password });

      // Re-enable
      await prisma.developer.update({
        where: { username: TEST_DEV.username },
        data: { isActive: true },
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('GET /api/auth/me (protected endpoint)', () => {
    it('returns developer info with valid token', async () => {
      const token = signTestToken(testDevId);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testDevId);
      expect(res.body.data.username).toBe(TEST_DEV.username);
      expect(res.body.data.type).toBe('developer');
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 with malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 with malformed JWT', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer this-is-not-a-valid-jwt');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for deleted developer (stale token)', async () => {
      // Create a temporary developer, get token, then delete
      const tempPassHash = await bcrypt.hash('temppass', 10);
      const tempDev = await prisma.developer.create({
        data: {
          username: 'temp_dev_for_test',
          passwordHash: tempPassHash,
          name: 'temp',
        },
      });
      const token = signTestToken(tempDev.id);

      // Delete the developer
      await prisma.developer.delete({ where: { id: tempDev.id } });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/developer/readiness', () => {
    it('returns developer-only production readiness diagnostics without leaking secrets', async () => {
      const oldEndpoint = process.env.FACE_RECOGNITION_HTTP_ENDPOINT;
      const oldApiKey = process.env.FACE_RECOGNITION_HTTP_API_KEY;
      delete process.env.FACE_RECOGNITION_HTTP_ENDPOINT;
      process.env.FACE_RECOGNITION_HTTP_API_KEY = 'unit-secret-readiness-key';
      const token = signTestToken(testDevId);

      try {
        const res = await request(app)
          .get('/api/developer/readiness')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.overallStatus).toMatch(/ready|needs_attention/);
        expect(Array.isArray(res.body.data.checks)).toBe(true);
        const faceGateway = res.body.data.checks.find((check: any) => check.key === 'face_gateway');
        expect(faceGateway).toBeTruthy();
        expect(faceGateway.status).toBe('warning');
        expect(faceGateway.detail.apiKeyConfigured).toBe(true);
        expect(JSON.stringify(res.body)).not.toContain('unit-secret-readiness-key');
      } finally {
        if (oldEndpoint === undefined) delete process.env.FACE_RECOGNITION_HTTP_ENDPOINT;
        else process.env.FACE_RECOGNITION_HTTP_ENDPOINT = oldEndpoint;
        if (oldApiKey === undefined) delete process.env.FACE_RECOGNITION_HTTP_API_KEY;
        else process.env.FACE_RECOGNITION_HTTP_API_KEY = oldApiKey;
      }
    });
  });
});
