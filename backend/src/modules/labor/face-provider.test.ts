import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFaceRecognitionProvider } from './face-provider';

const originalEnv = { ...process.env };

async function createPhotoFile(dir: string, name: string) {
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, Buffer.from(`fake-image-${name}`));
  return filePath;
}

describe('face-provider', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zlt-face-provider-'));
    process.env = { ...originalEnv, UPLOAD_DIR: tempDir };
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('keeps stub provider available for local smoke tests', async () => {
    const result = await getFaceRecognitionProvider('stub').verify({
      provider: 'stub',
      personnelId: 'person-1',
      referencePhotoUrl: '/uploads/reference.jpg',
      checkInPhotoUrl: '/uploads/checkin.jpg',
    });

    expect(result.status).toBe('verified');
    expect(result.score).toBe(1);
  });

  it('returns not_configured when production http endpoint is missing', async () => {
    delete process.env.FACE_RECOGNITION_HTTP_ENDPOINT;

    const result = await getFaceRecognitionProvider('http').verify({
      provider: 'http',
      personnelId: 'person-1',
      referencePhotoUrl: '/uploads/reference.jpg',
      checkInPhotoUrl: '/uploads/checkin.jpg',
    });

    expect(result.status).toBe('not_configured');
    expect(result.message).toContain('FACE_RECOGNITION_HTTP_ENDPOINT');
  });

  it('posts base64 photos to the configured http gateway and accepts a match', async () => {
    await createPhotoFile(tempDir, 'reference.jpg');
    await createPhotoFile(tempDir, 'checkin.jpg');
    process.env.FACE_RECOGNITION_HTTP_ENDPOINT = 'https://face.example.test/verify';
    process.env.FACE_RECOGNITION_HTTP_API_KEY = 'secret-token';
    process.env.FACE_RECOGNITION_THRESHOLD = '0.75';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matched: true, score: 0.91, message: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getFaceRecognitionProvider('tencent').verify({
      provider: 'tencent',
      personnelId: 'person-1',
      referencePhotoUrl: '/uploads/reference.jpg',
      checkInPhotoUrl: '/uploads/checkin.jpg',
    });

    expect(result).toMatchObject({ provider: 'tencent', status: 'verified', score: 0.91 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://face.example.test/verify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
        body: expect.stringContaining('"personnelId":"person-1"'),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.referencePhoto).toBe(Buffer.from('fake-image-reference.jpg').toString('base64'));
    expect(body.checkInPhoto).toBe(Buffer.from('fake-image-checkin.jpg').toString('base64'));
    expect(body.threshold).toBe(0.75);
  });

  it('marks low score responses as mismatch', async () => {
    await createPhotoFile(tempDir, 'reference.jpg');
    await createPhotoFile(tempDir, 'checkin.jpg');
    process.env.FACE_RECOGNITION_HTTP_ENDPOINT = 'https://face.example.test/verify';
    process.env.FACE_RECOGNITION_THRESHOLD = '0.8';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ score: 0.42 }),
    }));

    const result = await getFaceRecognitionProvider('baidu').verify({
      provider: 'baidu',
      personnelId: 'person-1',
      referencePhotoUrl: '/uploads/reference.jpg',
      checkInPhotoUrl: '/uploads/checkin.jpg',
    });

    expect(result).toMatchObject({ provider: 'baidu', status: 'mismatch', score: 0.42 });
  });

  it('degrades to provider_error when the gateway fails', async () => {
    await createPhotoFile(tempDir, 'reference.jpg');
    await createPhotoFile(tempDir, 'checkin.jpg');
    process.env.FACE_RECOGNITION_HTTP_ENDPOINT = 'https://face.example.test/verify';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await getFaceRecognitionProvider('aliyun').verify({
      provider: 'aliyun',
      personnelId: 'person-1',
      referencePhotoUrl: '/uploads/reference.jpg',
      checkInPhotoUrl: '/uploads/checkin.jpg',
    });

    expect(result.status).toBe('provider_error');
    expect(result.message).toContain('人脸识别服务异常');
  });

  it('degrades to provider_error when an uploaded photo file is missing', async () => {
    await createPhotoFile(tempDir, 'reference.jpg');
    process.env.FACE_RECOGNITION_HTTP_ENDPOINT = 'https://face.example.test/verify';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getFaceRecognitionProvider('http').verify({
      provider: 'http',
      personnelId: 'person-1',
      referencePhotoUrl: '/uploads/reference.jpg',
      checkInPhotoUrl: '/uploads/missing.jpg',
    });

    expect(result.status).toBe('provider_error');
    expect(result.message).toContain('照片读取失败');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects upload path traversal attempts before calling the gateway', async () => {
    await createPhotoFile(tempDir, 'reference.jpg');
    process.env.FACE_RECOGNITION_HTTP_ENDPOINT = 'https://face.example.test/verify';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getFaceRecognitionProvider('http').verify({
      provider: 'http',
      personnelId: 'person-1',
      referencePhotoUrl: '/uploads/reference.jpg',
      checkInPhotoUrl: '/uploads/../../etc/passwd',
    });

    expect(result.status).toBe('provider_error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends remote photo URLs as URL fields instead of forcing base64', async () => {
    process.env.FACE_RECOGNITION_HTTP_ENDPOINT = 'https://face.example.test/verify';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matched: true, score: 0.88 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getFaceRecognitionProvider('cloud').verify({
      provider: 'cloud',
      personnelId: 'person-1',
      referencePhotoUrl: 'https://cdn.example.test/reference.jpg',
      checkInPhotoUrl: 'https://cdn.example.test/checkin.jpg',
    });

    expect(result.status).toBe('verified');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.referencePhotoUrl).toBe('https://cdn.example.test/reference.jpg');
    expect(body.checkInPhotoUrl).toBe('https://cdn.example.test/checkin.jpg');
    expect(body.referencePhotoBase64).toBeUndefined();
    expect(body.checkInPhotoBase64).toBeUndefined();
  });

  it('accepts data URI photos and forwards only the base64 payload', async () => {
    process.env.FACE_RECOGNITION_HTTP_ENDPOINT = 'https://face.example.test/verify';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matched: true, score: 0.93 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getFaceRecognitionProvider('http').verify({
      provider: 'http',
      personnelId: 'person-1',
      referencePhotoUrl: 'data:image/png;base64,cmVmZXJlbmNl',
      checkInPhotoUrl: 'data:image/png;base64,Y2hlY2tpbg==',
    });

    expect(result.status).toBe('verified');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.referencePhotoBase64).toBe('cmVmZXJlbmNl');
    expect(body.checkInPhotoBase64).toBe('Y2hlY2tpbg==');
    expect(body.referencePhotoUrl).toBeUndefined();
    expect(body.checkInPhotoUrl).toBeUndefined();
  });
});
