export type FaceStatus = 'verified' | 'provider_error' | 'not_configured';

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

class StubFaceRecognitionProvider implements FaceRecognitionProvider {
  async verify(input: FaceVerifyInput): Promise<FaceVerifyResult> {
    if (!input.referencePhotoUrl || !input.checkInPhotoUrl) {
      return {
        provider: input.provider || 'stub',
        status: 'provider_error',
        message: '人员未录入人脸照片或打卡照片缺失，已保留打卡数据等待后续核验',
      };
    }
    return {
      provider: input.provider || 'stub',
      status: 'verified',
      score: 1,
      message: '本地桩服务通过；生产环境应替换为第三方人脸比对服务',
    };
  }
}

export function getFaceRecognitionProvider(_provider: string): FaceRecognitionProvider {
  return new StubFaceRecognitionProvider();
}
