// ============================================
// 健康检查端点测试
// ============================================
// 测试场景：
// 1. GET /api/health 返回 200 + success: true
// 2. GET /api/v1/health 返回 200 + success: true
// 3. GET /api/nonexistent 返回 404
// 4. 响应格式符合 ApiResponse 规范
//
// 注意：健康检查端点不访问数据库，无需 mock Prisma
// ============================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Health Check API', () => {
  describe('GET /api/health', () => {
    it('returns 200 with success:true and status:ok', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.timestamp).toBeDefined();
      // Timestamp should be a valid ISO string
      expect(new Date(res.body.data.timestamp).getTime()).not.toBeNaN();
    });

    it('response has correct ApiResponse shape', async () => {
      const res = await request(app).get('/api/health');

      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
      expect(typeof res.body.success).toBe('boolean');
      expect(res.body.success).toBe(true);
    });

    it('returns correct content-type header', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /api/v1/health', () => {
    it('returns 200 with success:true (v1)', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
    });
  });

  describe('404 handling', () => {
    it('returns 404 for unknown endpoints', async () => {
      const res = await request(app).get('/api/nonexistent-endpoint-xyz');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });
});
