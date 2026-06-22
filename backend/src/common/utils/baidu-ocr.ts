/**
 * 百度 OCR 识别服务
 *
 * 调用百度 OCR REST API 对图片进行文字识别。
 * 从 OcrConfig 中读取 baidu 配置（apiKey → API Key, secretKey → Secret Key）。
 */

interface BaiduOcrResult {
  words: string;
}

interface BaiduOcrResponse {
  words_result: BaiduOcrResult[];
  words_result_num: number;
  log_id: number;
}

interface BaiduTokenResponse {
  access_token?: string;
}

function isBaiduOcrResponse(data: unknown): data is BaiduOcrResponse {
  return typeof data === 'object'
    && data !== null
    && Array.isArray((data as { words_result?: unknown }).words_result);
}

/**
 * 获取百度 OCR access token
 */
async function getAccessToken(apiKey: string, secretKey: string): Promise<string> {
  const tokenUrl = new URL('https://aip.baidubce.com/oauth/2.0/token');
  tokenUrl.searchParams.set('grant_type', 'client_credentials');
  tokenUrl.searchParams.set('client_id', apiKey);
  tokenUrl.searchParams.set('client_secret', secretKey);
  const res = await fetch(tokenUrl.toString(), { method: 'POST' });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`百度 OCR 获取 token 失败 (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as BaiduTokenResponse;
  if (!data.access_token) {
    throw new Error(`百度 OCR 获取 token 失败: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.access_token;
}

/**
 * 调用百度 OCR accurate_basic 接口识别图片文字
 *
 * 使用免费高精度版（accurate_basic），已验证大量 PDF 送货单识别可达 45+ 条物资。
 * 参数：language_type=CHN_ENG 支持中英文混合，detect_direction=true 自动检测方向。
 *
 * @param imageBase64 - 图片的 base64 编码
 * @param apiKey - 百度 OCR API Key
 * @param secretKey - 百度 OCR Secret Key
 * @returns 识别出的文字行数组
 */
export async function baiduOcr(imageBase64: string, apiKey: string, secretKey: string): Promise<string[]> {
  // 获取 access token
  const token = await getAccessToken(apiKey, secretKey);

  // 调用 accurate_basic 接口（免费高精度版，已验证可靠）
  const ocrUrl = new URL('https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic');
  ocrUrl.searchParams.set('access_token', token);
  const body = new URLSearchParams();
  body.append('image', imageBase64);
  body.append('language_type', 'CHN_ENG');
  body.append('detect_direction', 'true');

  const res = await fetch(ocrUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`百度 OCR 识别失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json() as unknown;

  if (!isBaiduOcrResponse(data)) {
    throw new Error(`百度 OCR 返回异常: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return data.words_result.map(item => item.words);
}
