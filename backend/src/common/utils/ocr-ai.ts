/**
 * AI OCR 识别服务
 *
 * 参考原物资管理系统的成熟方案，使用 AI 大模型对送货单图片进行结构化识别。
 * 架构：AI 视觉直读（图片→AI→JSON）
 *
 * 核心改进（对比旧版）：
 * 1. 详细提取提示词 — 精确指定哪些行提取、哪些行忽略、字段提取规则
 * 2. temperature=0.05 — 确保输出一致性，减少幻觉
 * 3. max_tokens=65535 — 支持最大输出长度（适配 MiniMax 百万上下文和 200 页文档）
 * 4. 多重 JSON 提取 — 兼容 markdown 代码块、纯 JSON、带前缀后缀等情况
 * 5. 数量字段清洗 — 只保留数字和小数点
 * 6. MiniMax 使用 MCP VLM 接口（/v1/coding_plan/vlm），OpenAI 使用标准格式
 */

import { prisma } from './prisma';
import { appendFileSync } from 'fs';

interface OcrResult {
  rawText: string;
  parsed: {
    supplier: string;
    deliveryNo: string;
    deliveryDate: string;
    projectName?: string;
    items: Array<{
      name: string;
      unit: string;
      quantity: number;
      projectName?: string;
    }>;
  };
  parsedBy: string;
}

/**
 * 文本结构化提取提示词
 *
 * 用于将百度 OCR 返回的原始文本行，由 AI 整理为结构化 JSON。
 * 要求 AI 按原始顺序逐条提取，同类型物资不合并数量。
 */
const TEXT_EXTRACTION_PROMPT = `你是一个专业的物资管理系统数据提取助手，处理电力工程企业的送货单（可能是多页扫描件，OCR后合并成一段文字）。

【你的任务】
从送货单OCR文字中精确提取结构化数据，返回JSON格式。

【送货单结构说明】
一张送货单可能有多页扫描：
- 第1页：表头信息（供应商、合同编号等）+ 部分物资明细行（序号1开始）
- 中间页：继续的物资明细行（序号接续）
- 最后页：剩余明细行 + 「小计」行 + 签收信息区域

【关键识别规则 — 哪些行要提取，哪些行要忽略】

✅ 要提取的行：有序号数字（1、2、3...）的物资明细行
   - 必须严格按照序号顺序逐条提取，不允许合并任何行
   - 哪怕多行的物资名称、规格完全一样，只要序号不同，就必须分别提取为多条记录！
   - 不要合并或去重，每个序号对应一条记录
   - 同一送货单同种物资发往不同项目，每行都是独立记录
   - 注意不要漏掉任何有序号的物资行

❌ 绝对忽略的行（不要提取为物资）：
   - 「小计」行（第一列是"小计"）→ 这是数量合计，不是物资
   - 「合计」「总计」行
   - 签收信息行（含"签字"、"盖章"、"收货人"、"仓管人员"等）
   - 说明/备注文字段落（①②③④⑤类的说明性文字）
   - 空行

【字段提取规则】

supplier（供应商）：
- 在"供应商（盖章）："、"供货商："、"供应商名称："后面的公司名称
- 如"萍乡市中源瓷业有限公司"，是公司不是人名

deliveryNo（送货单号）：
- 找"送货通知单号："、"通知单号："、"送货单号："后面的值

deliveryDate（送货日期）：
- 找"送货日期："、"日期："后面的值，格式 YYYY-MM-DD

每行物资明细 items[]（只提取有序号的行）：
- name：物资名称，原样完整保留，不能省略任何字符
- unit：计量单位，如"只"、"吨"、"米"、"个"
- quantity：本次送货数量，只保留数字和小数点
- projectName：该行物资对应的项目名称，必须完整拼接

【项目名称提取规则】
projectName 在 OCR 文本中通常分布在多个行中，必须完整拼接：
- 项目名称可能出现在序号行之前（如"2025技改/遵义播州供电局"）和序号行之后（如"整治工程【2025年过载低电压"两消除"】"）
- 必须将序号前出现的项目相关文字作为项目名称的起始部分，不可以丢弃
- 必须完整保留项目名称的所有文字，不能截断、省略、改写任何部分
- 每一行的项目名称都不同，各行独立提取，不要互相复制
- 忽略干扰项：合同编号（D060004...）、送货通知单号（05FW...、HYRN...）、物资编码（060300...、07630...等纯数字）
- 注意：项目名称不含括号内的物资规格说明（如"(无瓷裙，低压)"、"(镀锌)"等），此类括号内容应拼接在物资名称后面，不是项目名称
- 如果没有项目信息，填空字符串

【重要注意事项】
- 数量字段只保留数字和小数点，不要带单位
- 不要编造数据，不确定的字段填空字符串或0
- 严格按照序号顺序提取，不能改变顺序
- 不能合并任何行（即使物资名称完全相同）
- 不能添加原文不存在的行

【只返回 JSON，不要任何解释文字】
{
  "supplier": "供应商名称",
  "deliveryNo": "送货单号",
  "deliveryDate": "YYYY-MM-DD",
  "projectName": "整单项目名称（如果表头有的话）",
  "items": [
    {
      "name": "物资名称",
      "unit": "单位",
      "quantity": 数量,
      "projectName": "每条物资对应的项目名称"
    }
  ]
}`;

const EXTRACTION_PROMPT = `你是一个专业的物资管理系统数据提取助手，处理电力工程企业的送货单（图片格式，可能包含多页扫描件）。

【你的任务】
从送货单图片中精确提取结构化数据，只返回 JSON 格式，不要任何解释文字。

【重要：输出格式要求】
- 严禁输出 <think> 推理标签或任何思考过程
- 直接输出纯 JSON，不要 markdown 代码块包裹，不要任何前缀后缀
- 只输出 JSON 本身

【送货单结构说明】
一张送货单通常包含：
- 表头区域：供应商名称、合同编号、送货通知单号、日期
- 表格区域：有序号的物资明细行（序号、物资名称、规格、单位、数量等）
- 表尾区域：小计、签字、备注等

【关键识别规则 — 哪些行要提取，哪些行要忽略】

✅ 要提取的行：有序号数字（1、2、3...）的物资明细行
   - 必须严格按照序号顺序逐条提取，不允许合并任何行
   - 哪怕多行的物资名称、规格完全一样，只要序号不同，就必须分别提取为多条记录！
   - 不要合并或去重，每个序号对应一条记录
   - 同一送货单同种物资发往不同项目，每行都是独立记录
   - 注意不要漏掉任何有序号的物资行

❌ 绝对忽略的行（不要提取为物资）：
   - 「小计」行（第一列是"小计"）→ 这是数量合计，不是物资
   - 「合计」「总计」行
   - 签收信息行（含"签字"、"盖章"、"收货人"、"仓管人员"等）
   - 说明/备注文字段落（①②③④⑤类的说明性文字）
   - 空行

【字段提取规则】

supplier（供应商）：
- 在"供应商（盖章）："、"供货商："、"供应商名称："、"供方："后面的公司名称
- 如"江苏宝安电缆股份有限公司"，是公司实体名称，不是项目名称或部门名称
- 如果无法确定供应商，留空字符串不要猜测

deliveryNo（送货单号/送货通知单号）：
- "送货通知单号："或"通知单号："后面的值

deliveryDate（送货日期）：
- "送货日期："或"日期："后面的值，格式 YYYY-MM-DD

每行物资明细 items[]（只提取有序号的行）：
- name：物资名称，原样完整保留，不能省略任何字符
- unit：计量单位，如"只"、"吨"、"米"、"个"
- quantity：本次送货数量，只保留数字和小数点
- projectName：该行物资对应的项目名称

【⚠️ 项目名称提取规则 — 特别重要】
projectName 在 OCR 文本中通常分布在多个行中，必须完整拼接：
- 项目名称可能出现在序号行之前（如"2025技改/遵义播州供电局"）和序号行之后（如"整治工程【2025年过载低电压"两消除"】"）
- 【关键】必须将序号前出现的 "2025技改/XXX供电局"、"2025年检修/XXX局" 等文字作为项目名称的起始部分，不可以丢弃
- 【关键】必须完整保留项目名称的所有文字，不能截断、省略、改写任何部分
- 【关键】每一行的项目名称都不同，各行独立提取，不要互相复制
- 如果没有项目信息，填空字符串

【重要注意事项】
- 数量字段只保留数字和小数点，不要带单位
- 不要编造数据，不确定的字段填空字符串或0

【只返回 JSON，不要任何解释文字】
{
  "supplier": "供应商名称",
  "deliveryNo": "送货单号",
  "deliveryDate": "YYYY-MM-DD",
  "projectName": "整单项目名称（如果表头有的话）",
  "items": [
    {
      "name": "物资名称",
      "unit": "单位",
      "quantity": 数量,
      "projectName": "每条物资对应的项目名称"
    }
  ]
}`;

/**
 * 调用 AI 模型进行 OCR 识别
 */
export async function aiOcr(imageBase64: string, mimeType: string, tenantId: string): Promise<OcrResult> {
  const aiConfig = await prisma.aiConfig.findFirst({
    where: { isEnabled: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!aiConfig) {
    throw new Error('请先在开发者后台的「AI 模型配置」中配置并启用 AI 模型（需要配置 OpenAI 或 MiniMax 的 API Key）');
  }

  const { provider, model, apiKey, baseUrl } = aiConfig;

  if (provider === 'openai') {
    return await callOpenAI(imageBase64, mimeType, model || 'gpt-4o', apiKey, baseUrl, `OpenAI ${model || 'gpt-4o'}`);
  } else if (provider === 'minimax') {
    // MiniMax VL 需要视觉能力模型，M2.7 系列支持 VLM 接口
    return await callMiniMaxVL(imageBase64, mimeType, model || 'MiniMax-M2.7-highspeed', apiKey, baseUrl, `MiniMax ${model || 'MiniMax-M2.7-highspeed'}`);
  } else {
    throw new Error(`不支持的 AI 提供商: ${provider}，当前仅支持 openai 和 minimax`);
  }
}

/**
 * 从 OCR 原始文本中提取结构化数据（两阶段管线的第二阶段）
 *
 * 将百度 OCR 识别出的原始文本发送给 AI 模型，由其整理为结构化 JSON。
 * 支持 OpenAI 和 MiniMax 两种 AI 提供商。
 *
 * @param ocrText - 百度 OCR 返回的原始文本（每行一段文字）
 * @param tenantId - 租户 ID（用于查找 AI 配置）
 * @returns 结构化 OCR 结果
 */
export async function aiExtractFromText(ocrText: string, tenantId: string): Promise<OcrResult> {
  const aiConfig = await prisma.aiConfig.findFirst({
    where: { isEnabled: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!aiConfig) {
    throw new Error('请先在开发者后台的「AI 模型配置」中配置并启用 AI 模型');
  }

  const { provider, model, apiKey, baseUrl } = aiConfig;

  if (provider === 'openai') {
    return await callOpenAIText(ocrText, model || 'gpt-4o-mini', apiKey, baseUrl, `OpenAI ${model || 'gpt-4o-mini'}`);
  } else if (provider === 'minimax') {
    // MiniMax-Text-01 为非推理模型，不会输出 <think> 标签，更适合 OCR 文本结构化
    return await callMiniMaxText(ocrText, model || 'MiniMax-Text-01', apiKey, baseUrl, `MiniMax ${model || 'MiniMax-Text-01'}`);
  } else {
    throw new Error(`不支持的 AI 提供商: ${provider}，当前仅支持 openai 和 minimax`);
  }
}

/**
 * 调用 OpenAI 兼容格式的 AI 模型（GPT-4o 等）
 *
 * 使用标准的 OpenAI 格式：
 * POST /chat/completions
 * { model, messages: [{ role: 'user', content: [{ type: 'text' }, { type: 'image_url' }] }] }
 */
async function callOpenAI(
  imageBase64: string, mimeType: string, model: string, apiKey: string, baseUrl?: string, parsedBy?: string,
): Promise<OcrResult> {
  const url = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/chat/completions`
    : openAIDefaultUrl();

  const requestBody = {
    model,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: EXTRACTION_PROMPT },
          { type: 'image_url' as const, image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
    temperature: 0.05,
    max_tokens: 32768,
  };

  return await sendRequest(url, requestBody, apiKey, model, mimeType, imageBase64, parsedBy);
}

/**
 * 调用 MiniMax MCP VLM（视觉语言）接口
 *
 * MiniMax 的视觉理解能力通过 /v1/coding_plan/vlm 端点提供，
 * 使用 prompt + image_url 格式，不支持 OpenAI 的 content 数组格式。
 *
 * 接口文档：https://platform.minimaxi.com/docs/token-plan/mcp-guide
 */
async function callMiniMaxVL(
  imageBase64: string, mimeType: string, model: string, apiKey: string, baseUrl?: string, parsedBy?: string,
): Promise<OcrResult> {
  // MiniMax VLM 接口地址
  const url = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/coding_plan/vlm`
    : 'https://api.minimaxi.com/v1/coding_plan/vlm';

  // MiniMax VLM 接口使用 prompt + image_url 格式
  const requestBody = {
    prompt: EXTRACTION_PROMPT,
    image_url: `data:${mimeType};base64,${imageBase64}`,
  };

  return await sendRequest(url, requestBody, apiKey, model, mimeType, imageBase64, parsedBy);
}

/**
 * 调用 OpenAI 兼容接口，从 OCR 文本中提取结构化数据（纯文本模式）
 */
async function callOpenAIText(
  ocrText: string, model: string, apiKey: string, baseUrl?: string, parsedBy?: string,
): Promise<OcrResult> {
  const url = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/chat/completions`
    : openAIDefaultUrl();

  const requestBody = {
    model,
    messages: [
      { role: 'system' as const, content: TEXT_EXTRACTION_PROMPT },
      { role: 'user' as const, content: `以下是百度OCR识别的送货单文字（可能多页）。注意：OCR文本可能不完美，有乱码或倾斜等，但不影响提取。必须完整提取所有有序号的物资行，一条都不能跳过。请提取全部物资明细行返回JSON：\n\n${ocrText}` },
    ],
    temperature: 0.05,
    max_tokens: 32768,
  };

  return await sendTextRequest(url, requestBody, apiKey, parsedBy || `${model}`);
}

/**
 * 调用 MiniMax LLM 接口，从 OCR 文本中提取结构化数据（纯文本模式）
 *
 * 使用 MiniMax 的 chat/completions 接口（文本对话模式，非 VLM）。
 */
async function callMiniMaxText(
  ocrText: string, model: string, apiKey: string, baseUrl?: string, parsedBy?: string,
): Promise<OcrResult> {
  const url = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/chat/completions`
    : 'https://api.minimaxi.com/v1/chat/completions';


  // MiniMax 的文本对话使用 system 角色来设定 prompt
  // user 消息包裹上下文说明，帮助模型理解任务（参照原物资管理系统的成熟方案）
  const requestBody = {
    model,
    messages: [
      { role: 'system' as const, content: TEXT_EXTRACTION_PROMPT },
      { role: 'user' as const, content: `以下是百度OCR识别的送货单文字（可能多页）。注意：OCR文本可能不完美，有乱码或倾斜等，但不影响提取。必须完整提取所有有序号的物资行，一条都不能跳过。请提取全部物资明细行返回JSON：\n\n${ocrText}` },
    ],
    temperature: 0.05,
    max_tokens: 32768,
  };

  return await sendTextRequest(url, requestBody, apiKey, parsedBy || model);
}

/**
 * 发送 HTTP 请求到 AI API（纯文本模式，无图片）
 */
async function sendTextRequest(
  url: string, requestBody: any, apiKey: string, parsedBy?: string,
): Promise<OcrResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API 错误 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();

  // 提取 AI 回复内容
  let content = '';
  if (data?.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  } else if (data?.reply) {
    content = data.reply;
  }

  // 写入调试日志
  const charCount = content.length;
  const debugLog = `[${new Date().toISOString()}]
URL: ${url}
Model: ${parsedBy || 'ai'}
调用模式: 文本提取（第二阶段 AI 结构化）
输入长度: ${requestBody.messages?.[1]?.content?.length || '未知'} 字符
输出长度: ${charCount} 字符
响应前 500 字符: ${JSON.stringify(data).slice(0, 500)}
提取的 content 前 500 字符: ${content.slice(0, 500)}
---\n`;
  appendFileSync('/tmp/ocr_debug.log', debugLog);

  if (!content) {
    throw new Error(`AI 返回内容为空（URL: ${url}），请检查 API Key 和模型名称是否正确`);
  }

  return parseAiResponse(content, parsedBy || 'ai');
}

/**
 * 发送 HTTP 请求到 AI API 并解析响应
 */
async function sendRequest(
  url: string, requestBody: any, apiKey: string, model: string,
  mimeType: string, imageBase64: string, parsedBy?: string,
): Promise<OcrResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API 错误 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();

  // 兼容多种响应格式：OpenAI 格式、MiniMax VLM 格式
  let content = '';
  if (data?.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  } else if (data?.content) {
    content = data.content;
  } else if (data?.reply) {
    content = data.reply;
  } else if (data?.output?.text) {
    content = data.output.text;
  }

  // 写入调试日志
  const debugLog = `[${new Date().toISOString()}]
URL: ${url}
Model: ${model}
MimeType: ${mimeType}
图片大小: ${(imageBase64.length * 0.75 / 1024 / 1024).toFixed(2)} MB
响应结构: ${JSON.stringify(data).slice(0, 2000)}
提取的 content: ${(content || '').slice(0, 1000)}
---\n`;
  appendFileSync('/tmp/ocr_debug.log', debugLog);

  if (!content) {
    throw new Error(`AI 返回内容为空（URL: ${url}），请检查 API Key 和模型名称是否正确`);
  }

  return parseAiResponse(content, parsedBy || `${model}`);
}

/**
 * OpenAI 默认 API 地址
 */
function openAIDefaultUrl(): string {
  return 'https://api.openai.com/v1/chat/completions';
}

/**
 * 解析 AI 返回的 JSON 字符串
 *
 * 兼容处理：
 * 1. 剥离 MiniMax 推理模型的 <think>...</think> 标签
 * 2. 匹配 ```json ... ``` 标记
 * 3. 正则提取 supplier+items 结构
 * 4. 直接 JSON 解析兜底
 */
function parseAiResponse(content: string, parsedBy: string): OcrResult {
  // 剥离 <think> 推理标签（MiniMax-M2.7 等推理模型）
  let cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  // 也处理没有闭合标签的情况
  if (cleanContent === '' && content.includes('<think>')) {
    cleanContent = content.replace(/<think>[\s\S]*$/g, '').trim();
  }
  // 如果剥离后为空，回退到原始内容
  if (!cleanContent) cleanContent = content;

  const jsonMatch =
    cleanContent.match(/```json\s*([\s\S]*?)\s*```/) ||
    cleanContent.match(/```\s*([\s\S]*?)\s*```/) ||
    cleanContent.match(/(\{[\s\S]*"supplier"[\s\S]*"items"[\s\S]*\})/) ||
    cleanContent.match(/(\{[\s\S]*"items"[\s\S]*\})/);

  const jsonStr = jsonMatch ? jsonMatch[1].trim() : cleanContent.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    const items = Array.isArray(parsed.items) ? parsed.items.map((i: any) => {
      let qty = 0;
      const rawQty = i.quantity ?? i.deliveryQty ?? i.qty;
      if (rawQty != null && rawQty !== '') {
        const cleaned = typeof rawQty === 'string' ? rawQty.replace(/[^\d.]/g, '') : String(rawQty);
        qty = parseFloat(cleaned) || 0;
      }
      return {
        name: i.name || i.materialName || '',
        unit: i.unit || '',
        quantity: qty,
        projectName: i.projectName || '',
      };
    }) : [];

    if (items.length === 0 && parsed.materialName) {
      items.push({
        name: parsed.materialName || '',
        unit: parsed.unit || '',
        quantity: parseFloat(String(parsed.quantity || parsed.deliveryQty || '0').replace(/[^\d.]/g, '')) || 0,
        projectName: parsed.projectName || '',
      });
    }

    return {
      rawText: content,
      parsed: {
        supplier: parsed.supplier || '',
        deliveryNo: parsed.deliveryNo || parsed.deliveryNoticeNo || '',
        deliveryDate: parsed.deliveryDate || '',
        projectName: parsed.projectName || '',
        items,
      },
      parsedBy,
    };
  } catch {
    console.error('[AI-OCR] JSON解析失败, 内容:', jsonStr.slice(0, 400));
    return {
      rawText: content,
      parsed: { supplier: '', deliveryNo: '', deliveryDate: '', projectName: '', items: [] },
      parsedBy: `${parsedBy}（解析失败）`,
    };
  }
}
