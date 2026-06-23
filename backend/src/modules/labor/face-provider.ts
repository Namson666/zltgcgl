import fs from 'fs/promises';
import path from 'path';

export type FaceStatus = 'verified' | 'provider_error' | 'not_configured' | 'mismatch';

export interface FaceVerifyInput {
  provider: string;
  personnelId: string;
  referencePhotoUrl?: string | null;
  checkInPhotoUrl?: string | null;
}

export interface FaceVerifyResult {
  provider: string;
  status: FaceStatus;
  score?: number;
  message?: string;
}

export interface FaceRecognitionProvider {
  verify(input: FaceVerifyInput): Promise<FaceVerifyResult>;
}

const HTTP_PROVIDER_ALIASES = new Set(['http', 'cloud', 'tencent', 'baidu', 'aliyun']);

function normalizeProvider(provider?: string | null) {
  return (provider || 'stub').trim().toLowerCase();
}

function resolveUploadPath(photoUrl: string) {
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  if (photoUrl.startsWith('/uploads/')) {
    const resolved = path.resolve(uploadRoot, photoUrl.replace('/uploads/', ''));
    if (!resolved.startsWith(uploadRoot + path.sep) && resolved !== uploadRoot) return null;
    return resolved;
  }
  if (photoUrl.startsWith('uploads/')) {
    const resolved = path.resolve(uploadRoot, photoUrl.replace('uploads/', ''));
    if (!resolved.startsWith(uploadRoot + path.sep) && resolved !== uploadRoot) return null;
    return resolved;
  }
  if (path.isAbsolute(photoUrl)) return photoUrl;
  return path.resolve(process.cwd(), photoUrl);
}

type PreparedPhoto = { base64: string } | { url: string };

async function preparePhoto(photoUrl?: string | null): Promise<PreparedPhoto | null> {
  if (!photoUrl) return null;
  if (/^data:image\/[^;]+;base64,/.test(photoUrl)) {
    const base64 = photoUrl.split(',')[1] || '';
    return base64 ? { base64 } : null;
  }
  if (/^https?:\/\//i.test(photoUrl)) {
    return { url: photoUrl };
  }
  const filePath = resolveUploadPath(photoUrl);
  if (!filePath) return null;
  try {
    const buffer = await fs.readFile(filePath);
    return { base64: buffer.toString('base64') };
  } catch {
    return null;
  }
}

function parseScore(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export interface FaceProviderDiagnostic {
  provider: string;
  mode: 'stub' | 'http';
  ready: boolean;
  status: 'ready' | 'not_configured';
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  timeoutMs: number;
  threshold: number;
  message: string;
}

export function getFaceProviderDiagnostic(provider?: string | null): FaceProviderDiagnostic {
  const normalized = normalizeProvider(provider);
  const timeoutRaw = Number(process.env.FACE_RECOGNITION_TIMEOUT_MS || '8000');
  const thresholdRaw = Number(process.env.FACE_RECOGNITION_THRESHOLD || '0.8');
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 8000;
  const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 0.8;

  if (!HTTP_PROVIDER_ALIASES.has(normalized)) {
    return {
      provider: normalized,
      mode: 'stub',
      ready: true,
      status: 'ready',
      endpointConfigured: false,
      apiKeyConfigured: false,
      timeoutMs,
      threshold,
      message: '当前使用本地 Stub 人脸识别，仅适合开发/测试；生产环境请配置 HTTP 网关',
    };
  }

  const endpointConfigured = Boolean(process.env.FACE_RECOGNITION_HTTP_ENDPOINT);
  const apiKeyConfigured = Boolean(process.env.FACE_RECOGNITION_HTTP_API_KEY);
  return {
    provider: normalized,
    mode: 'http',
    ready: endpointConfigured,
    status: endpointConfigured ? 'ready' : 'not_configured',
    endpointConfigured,
    apiKeyConfigured,
    timeoutMs,
    threshold,
    message: endpointConfigured
      ? '生产人脸识别 HTTP 网关已配置；可在小程序打卡时调用'
      : '未配置 FACE_RECOGNITION_HTTP_ENDPOINT；生产人脸识别网关尚不可用',
  };
}

function parseFaceResponse(provider: string, body: any, threshold: number): FaceVerifyResult {
  const data = body?.data ?? body?.result ?? body;
  const score = parseScore(data?.score ?? data?.similarity ?? body?.score ?? body?.similarity);
  const explicitMatched = data?.matched ?? data?.match ?? body?.matched ?? body?.match;
  const explicitStatus = String(data?.status ?? body?.status ?? '').toLowerCase();
  const matched = typeof explicitMatched === 'boolean'
    ? explicitMatched
    : explicitStatus === 'verified' || explicitStatus === 'match'
      ? true
      : explicitStatus === 'mismatch' || explicitStatus === 'failed'
        ? false
        : score === undefined
          ? false
          : score >= threshold;

  return {
    provider,
    status: matched ? 'verified' : 'mismatch',
    score,
    message: data?.message || body?.message || (matched ? '人脸比对通过' : '人脸比对未通过'),
  };
}

class StubFaceRecognitionProvider implements FaceRecognitionProvider {
  async verify(input: FaceVerifyInput): Promise<FaceVerifyResult> {
    if (!input.referencePhotoUrl || !input.checkInPhotoUrl) {
      return {
        provider: normalizeProvider(input.provider),
        status: 'provider_error',
        message: '人员未录入人脸照片或打卡照片缺失，已保留打卡数据等待后续核验',
      };
    }
    return {
      provider: normalizeProvider(input.provider),
      status: 'verified',
      score: 1,
      message: '本地桩服务通过；生产环境应替换为第三方人脸比对服务',
    };
  }
}

class HttpFaceRecognitionProvider implements FaceRecognitionProvider {
  constructor(private readonly provider: string) {}

  async verify(input: FaceVerifyInput): Promise<FaceVerifyResult> {
    const endpoint = process.env.FACE_RECOGNITION_HTTP_ENDPOINT;
    const apiKey = process.env.FACE_RECOGNITION_HTTP_API_KEY;
    const timeoutMs = Number(process.env.FACE_RECOGNITION_TIMEOUT_MS || '8000');
    const threshold = Number(process.env.FACE_RECOGNITION_THRESHOLD || '0.8');

    if (!endpoint) {
      return {
        provider: this.provider,
        status: 'not_configured',
        message: '未配置 FACE_RECOGNITION_HTTP_ENDPOINT，已保留打卡数据等待后续核验',
      };
    }
    if (!input.referencePhotoUrl || !input.checkInPhotoUrl) {
      return {
        provider: this.provider,
        status: 'provider_error',
        message: '人员未录入人脸照片或打卡照片缺失，已保留打卡数据等待后续核验',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000);
    try {
      const [referencePhoto, checkInPhoto] = await Promise.all([
        preparePhoto(input.referencePhotoUrl),
        preparePhoto(input.checkInPhotoUrl),
      ]);
      if (!referencePhoto || !checkInPhoto) {
        return {
          provider: this.provider,
          status: 'provider_error',
          message: '人脸照片读取失败，已保留打卡数据等待后续核验',
        };
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          provider: this.provider,
          personnelId: input.personnelId,
          referencePhoto: 'base64' in referencePhoto ? referencePhoto.base64 : referencePhoto.url,
          checkInPhoto: 'base64' in checkInPhoto ? checkInPhoto.base64 : checkInPhoto.url,
          referencePhotoBase64: 'base64' in referencePhoto ? referencePhoto.base64 : undefined,
          checkInPhotoBase64: 'base64' in checkInPhoto ? checkInPhoto.base64 : undefined,
          referencePhotoUrl: 'url' in referencePhoto ? referencePhoto.url : undefined,
          checkInPhotoUrl: 'url' in checkInPhoto ? checkInPhoto.url : undefined,
          threshold,
        }),
        signal: controller.signal,
      });
      const body: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          provider: this.provider,
          status: 'provider_error',
          message: body?.message || `人脸识别服务返回 ${response.status}`,
        };
      }
      return parseFaceResponse(this.provider, body, Number.isFinite(threshold) ? threshold : 0.8);
    } catch (error: any) {
      return {
        provider: this.provider,
        status: 'provider_error',
        message: error?.name === 'AbortError' ? '人脸识别服务超时，已保留打卡数据等待后续核验' : '人脸识别服务异常，已保留打卡数据等待后续核验',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function getFaceRecognitionProvider(provider: string): FaceRecognitionProvider {
  const normalized = normalizeProvider(provider);
  if (HTTP_PROVIDER_ALIASES.has(normalized)) {
    return new HttpFaceRecognitionProvider(normalized);
  }
  return new StubFaceRecognitionProvider();
}
