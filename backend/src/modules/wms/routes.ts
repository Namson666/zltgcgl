// ============================================
// 物资管理系统（WMS）路由模块 — HTTP 薄层
// ============================================
// 所有业务逻辑已抽取到 service.ts
// OCR 送货单识别代码、PDF 生成、Excel 解析保留在本文件

import { Router, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
// @ts-ignore - pdfkit has no type declarations
import PDFDocument from 'pdfkit';
import { registerChineseFont } from '../../common/utils/font';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { authenticate, requireUser } from '../../common/middleware/auth';
import { requirePermission } from '../../common/middleware/permission';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../../common/types';
import { logOperation } from '../../common/utils/logger';
import { aiExtractFromText } from '../../common/utils/ocr-ai';
import { baiduOcr } from '../../common/utils/baidu-ocr';
import { prisma } from '../../common/utils/prisma';
import { createLog } from '../../common/services/log.service';
import * as wms from './service';

// ============================================
// 初始化
// ============================================

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ============================================
// 辅助函数（保留：Excel 解析 / PDF 生成 / OCR）
// ============================================

function parseExcel(buffer: Buffer): any[] {
  const workbook = new ExcelJS.Workbook();
  const rows: any[] = [];
  try {
    console.warn('[Excel解析] 使用基础实现，建议后续升级为完整异步解析');
  } catch (e: any) {
    console.error('[Excel解析] 解析失败:', e.message);
  }
  return rows;
}

async function generateOutboundPdf(order: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const hasChineseFont = registerChineseFont(doc);
      if (hasChineseFont) doc.font('Chinese');

      const margin = 50;
      const pageHeight = 841.89;
      const signatureHeight = 55;
      const signatureY = pageHeight - margin - signatureHeight;

      const columns = [
        { header: '物资名称', width: 120 },
        { header: '规格型号', width: 65 },
        { header: '项目名称', width: 80 },
        { header: '单位', width: 35 },
        { header: '数量', width: 50 },
        { header: '单价', width: 55 },
        { header: '金额', width: 55 },
      ];
      const colTotalWidth = columns.reduce((s, c) => s + c.width, 0);

      function drawTableHeader(yPos: number): number {
        let x = margin;
        doc.fillColor('#f8fafc').rect(x, yPos, colTotalWidth, 25).fill().stroke();
        doc.fillColor('#000');
        for (const col of columns) {
          doc.text(col.header, x + 5, yPos + 6, { width: col.width - 10, align: 'center' });
          x += col.width;
        }
        return yPos + 25;
      }

      function drawSignature() {
        const y = signatureY;
        doc.moveTo(margin, y).lineTo(margin + colTotalWidth, y).stroke();
        doc.fontSize(11);
        doc.text(`经办人：______________         签收人：______________         签收日期：______________`, margin, y + 8, { width: colTotalWidth });
      }

      function hasRoom(currentY: number, rows: number): boolean {
        return currentY + rows * 22 + 5 <= signatureY;
      }

      doc.fontSize(20).text('出库单', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`出库单号：${order.orderNo || '-'}`);
      const deptName = order.subProject?.department?.name || order.departmentName || order.subProject?.name || '-';
      doc.text(`项目部：${deptName}`);
      doc.text(`出库时间：${order.outboundDate ? new Date(order.outboundDate).toLocaleString('zh-CN') : '-'}`);
      if (order.remark) { doc.text(`备注：${order.remark}`); }
      doc.moveDown(1);

      let y = drawTableHeader(doc.y);
      const items = order.items || [];
      let itemIndex = 0;

      while (itemIndex < items.length) {
        if (!hasRoom(y, 1)) {
          drawSignature();
          doc.addPage();
          if (hasChineseFont) doc.font('Chinese');
          y = drawTableHeader(margin);
        }
        const item = items[itemIndex];
        const values = [
          item.material?.name || item.materialName || item.name || '-',
          item.material?.spec || item.specification || item.spec || '-',
          item.projectName || item.subProjectName || '-',
          item.material?.unit || item.unit || '-',
          String(item.quantity || 0),
          String(item.unitPrice || 0),
          String(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)),
        ];
        let x = margin;
        for (let i = 0; i < columns.length; i++) {
          doc.rect(x, y, columns[i].width, 22).stroke();
          doc.text(values[i], x + 4, y + 5, { width: columns[i].width - 8, align: 'center' });
          x += columns[i].width;
        }
        y += 22;
        itemIndex++;
      }
      drawSignature();
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 生成调拨单 PDF
 */
async function generateTransferPdf(order: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const hasChineseFont = registerChineseFont(doc);
      if (hasChineseFont) doc.font('Chinese');

      const margin = 50;
      const pageHeight = 841.89;
      const signatureHeight = 55;
      const signatureY = pageHeight - margin - signatureHeight;

      const columns = [
        { header: '物资名称', width: 150 },
        { header: '规格型号', width: 80 },
        { header: '单位', width: 50 },
        { header: '数量', width: 60 },
        { header: '备注', width: 120 },
      ];
      const colTotalWidth = columns.reduce((s, c) => s + c.width, 0);

      function drawTableHeader(yPos: number): number {
        let x = margin;
        doc.fillColor('#f8fafc').rect(x, yPos, colTotalWidth, 25).fill().stroke();
        doc.fillColor('#000');
        for (const col of columns) {
          doc.text(col.header, x + 5, yPos + 6, { width: col.width - 10, align: 'center' });
          x += col.width;
        }
        return yPos + 25;
      }

      function drawSignature() {
        const y = signatureY;
        doc.moveTo(margin, y).lineTo(margin + colTotalWidth, y).stroke();
        doc.fontSize(11);
        doc.text(`经办人：______________         接收人：______________         日期：______________`, margin, y + 8, { width: colTotalWidth });
      }

      function hasRoom(currentY: number, rows: number): boolean {
        return currentY + rows * 22 + 5 <= signatureY;
      }

      doc.fontSize(20).text('物资调拨单', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`调拨单号：${order.orderNo || '-'}`);

      const fromContract = order.fromSubProject?.department?.contract?.name || order.fromDepartment?.contract?.name || '-';
      const fromDept = order.fromSubProject?.department?.name || order.fromSubProject?.name || order.fromDepartment?.name || '-';
      const toContract = order.toSubProject?.department?.contract?.name || order.toDepartment?.contract?.name || '-';
      const toDept = order.toSubProject?.department?.name || order.toSubProject?.name || order.toDepartment?.name || '-';

      doc.text(`调出方：${fromContract} → ${fromDept}`);
      doc.text(`调入方：${toContract} → ${toDept}`);
      doc.text(`调拨日期：${order.transferDate ? new Date(order.transferDate).toLocaleString('zh-CN') : '-'}`);
      if (order.remark) { doc.text(`备注：${order.remark}`); }
      doc.moveDown(1);

      let y = drawTableHeader(doc.y);
      const items = order.items || [];
      let itemIndex = 0;

      while (itemIndex < items.length) {
        if (!hasRoom(y, 1)) {
          drawSignature();
          doc.addPage();
          if (hasChineseFont) doc.font('Chinese');
          y = drawTableHeader(margin);
        }
        const item = items[itemIndex];
        const values = [
          item.material?.name || '-',
          item.material?.spec || '-',
          item.material?.unit || '-',
          String(item.quantity || 0),
          item.remark || '',
        ];
        let x = margin;
        for (let i = 0; i < columns.length; i++) {
          doc.rect(x, y, columns[i].width, 22).stroke();
          doc.text(values[i], x + 4, y + 5, { width: columns[i].width - 8, align: 'center' });
          x += columns[i].width;
        }
        y += 22;
        itemIndex++;
      }
      drawSignature();
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ============================================
// ⚠️ OCR 送货单识别（密封代码，不移动）
// ============================================

async function runOcr(fileBuffer: Buffer, mimeType: string, tenantId: string): Promise<{
  rawText: string;
  parsed: any;
  parsedBy: string;
}> {
  let ocrConfig = await prisma.ocrConfig.findFirst({
    where: { isEnabled: true, provider: 'baidu' },
    orderBy: { createdAt: 'desc' },
  });
  if (!ocrConfig) {
    ocrConfig = await prisma.ocrConfig.findFirst({
      where: { provider: 'baidu' },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (!ocrConfig || (!ocrConfig.apiKey && !ocrConfig.secretId) || !ocrConfig.secretKey) {
    throw new Error('请先在开发者后台的「OCR 配置」中配置并启用百度 OCR（需要填写 API Key 和 Secret Key）');
  }

  // 百度 API Key 可能存在 apiKey 或 secretId 字段（兼容两种配置方式）
  const baiduApiKey = ocrConfig.apiKey || ocrConfig.secretId!;

  const allTextLines: string[] = [];

  if (mimeType === 'application/pdf') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-pdf-'));
    const pdfPath = path.join(tmpDir, 'input.pdf');
    const outputPattern = path.join(tmpDir, 'page_%d.png');
    fs.writeFileSync(pdfPath, fileBuffer);
    try {
      execSync(
        `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile="${outputPattern}" "${pdfPath}"`,
        { timeout: 120000, stdio: 'pipe' },
      );
      const pageFiles: string[] = [];
      for (let i = 1; ; i++) {
        const p = path.join(tmpDir, `page_${i}.png`);
        if (fs.existsSync(p)) { pageFiles.push(p); continue; }
        const pAlt = path.join(tmpDir, `page_${String(i).padStart(2, '0')}.png`);
        if (fs.existsSync(pAlt)) { pageFiles.push(pAlt); continue; }
        break;
      }
      if (pageFiles.length === 0) {
        throw new Error('PDF 转换图片失败：无法找到转换后的图片文件');
      }
      console.log(`[OCR识别] PDF 共 ${pageFiles.length} 页，逐页发送百度 OCR...`);
      for (let pi = 0; pi < pageFiles.length; pi++) {
        const pngBuffer = fs.readFileSync(pageFiles[pi]);
        const b64 = pngBuffer.toString('base64');
        let lines = await baiduOcr(b64, baiduApiKey, ocrConfig.secretKey);
        const meaningfulLines = lines.filter(l => (l.match(/[一-鿿]/g) || []).length >= 2 && l.length >= 4).length;
        const totalLines = lines.length || 1;
        const garbledRatio = 1 - meaningfulLines / totalLines;
        if (garbledRatio > 0.6 && totalLines > 10) {
          console.log(`[OCR识别] 第${pi + 1}页可能旋转异常（有效行占比${((1 - garbledRatio) * 100).toFixed(1)}%），尝试180度旋转...`);
          try {
            const rotatedB64 = execSync(
              `python3 -c "
from PIL import Image
import sys, base64, io
b64 = sys.stdin.read().strip()
img = Image.open(io.BytesIO(base64.b64decode(b64)))
rotated = img.rotate(180, expand=True)
buf = io.BytesIO()
rotated.save(buf, format='PNG')
print(base64.b64encode(buf.getvalue()).decode())
"`,
              { input: b64, timeout: 30000, encoding: 'utf8' }
            ).toString().trim();
            const rotatedLines = await baiduOcr(rotatedB64, baiduApiKey, ocrConfig.secretKey);
            const rotatedMeaningful = rotatedLines.filter(l => (l.match(/[一-鿿]/g) || []).length >= 2 && l.length >= 4).length;
            const rotatedGarbled = 1 - rotatedMeaningful / (rotatedLines.length || 1);
            if (rotatedGarbled < garbledRatio) {
              lines = rotatedLines;
              console.log(`[OCR识别] 第${pi + 1}页旋转后正常（有效行占比${((1 - rotatedGarbled) * 100).toFixed(1)}%）`);
            }
          } catch (rotateErr: any) {
            console.warn(`[OCR识别] 第${pi + 1}页旋转识别失败：${rotateErr.message}`);
          }
        }
        allTextLines.push(`=== 第${pi + 1}页（共${pageFiles.length}页）===`);
        allTextLines.push(...lines);
      }
    } catch (err: any) {
      throw new Error(`PDF OCR 识别失败：${err.message}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } else {
    const b64 = fileBuffer.toString('base64');
    const lines = await baiduOcr(b64, baiduApiKey, ocrConfig.secretKey);
    allTextLines.push(...lines);
  }

  const rawText = allTextLines.join('\n');
  if (!rawText.trim()) {
    throw new Error('百度 OCR 未识别出任何文字，请检查图片质量');
  }

  const totalChars = rawText.length;
  console.log(`[OCR识别] 百度 OCR 完成: ${allTextLines.length} 行, ${totalChars} 字符, 交由 AI 结构化...`);

  const runId = Date.now();
  const ocrDebugLog = `\n=== OCR Run ${runId} ===\n时间: ${new Date().toISOString()}\n文件类型: ${mimeType}\n百度 OCR 行数: ${allTextLines.length}\n总字符数: ${totalChars}\n\n--- 百度 OCR 原始输出 ---\n${rawText.slice(0, 30000)}\n--- 百度 OCR 结束 ---\n\n`;
  fs.appendFileSync('/tmp/ocr_debug.log', ocrDebugLog);

  const aiResult = await aiExtractFromText(rawText, tenantId);

  if (aiResult.parsed.supplier || aiResult.parsed.items.length > 0) {
    console.log(`[OCR识别] AI 结构化成功：供应商=${aiResult.parsed.supplier}，物资数=${aiResult.parsed.items.length}`);
    fs.appendFileSync('/tmp/ocr_debug.log',
      `AI 结构化结果: ${aiResult.parsed.items.length} 条物资, 供应商="${aiResult.parsed.supplier}"\n=====\n\n`);
    return { ...aiResult, rawText };
  }

  console.warn(`[OCR识别] AI 未返回有效数据${aiResult.parsedBy ? '（' + aiResult.parsedBy + '）' : ''}`);
  fs.appendFileSync('/tmp/ocr_debug.log',
    `AI 结构化失败: 未返回有效数据 (parsedBy: ${aiResult.parsedBy})\n=====\n\n`);
  return { ...aiResult, rawText };
}

// ============================================
// 辅助函数：获取 tenantId 并校验
// ============================================

function getTenantId(req: AuthenticatedRequest): string {
  const tenantId = req.user?.tenantId;
  if (!tenantId) throw { status: 400, code: 'NO_TENANT', message: '当前用户未关联企业' };
  return tenantId;
}

// 获取有效的操作用户ID（用于 createdBy 字段）
// 开发者在企业视角下的 ID 属于 developers 表，不能用于引用 users 表的 FK
// 此时返回 undefined，让 createdBy 字段留空
function getEffectiveUserId(req: AuthenticatedRequest): string | undefined {
  if (req.user?.type === 'developer') return undefined;
  return req.user?.id;
}

// ============================================
// 辅助函数：统一错误处理包装器
// ============================================

function wrapHandler(handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: Response) => {
    try {
      await handler(req, res);
    } catch (err: any) {
      if (err.status && err.code) {
        res.status(err.status).json({ success: false, error: err.code, message: err.message } as unknown as ApiResponse);
      } else {
        console.error('[WMS Error]', err);
        res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message || '服务器内部错误' } as unknown as ApiResponse);
      }
    }
  };
}

function asPaginated(data: any, meta: { total: number; page: number; limit: number }) {
  return { success: true, data, meta } as unknown as PaginatedResponse<any>;
}

function asApi(data: any) {
  return { success: true, data } as unknown as ApiResponse;
}

// ============================================
// 一、物资目录管理（/materials）
// ============================================

const materialsRouter = Router();

materialsRouter.get('/', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { name, code } = req.query as any;
  const materials = await wms.listMaterials(tenantId, { name, code });
  res.json({ success: true, data: materials } as unknown as ApiResponse);
}));

materialsRouter.post('/', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const material = await wms.createMaterial({ tenantId, ...req.body });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `创建物资「${material.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: material } as unknown as ApiResponse);
}));

materialsRouter.put('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const material = await wms.updateMaterial(tenantId, req.params.id, req.body);
  res.json({ success: true, data: material } as unknown as ApiResponse);
}));

materialsRouter.delete('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  await wms.deleteMaterial(tenantId, req.params.id);
  res.json({ success: true, data: null } as unknown as ApiResponse);
}));

materialsRouter.get('/export', requirePermission('canExport'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { rows, count } = await wms.getMaterialsExportData(tenantId);
  const buffer = await wms.exportToExcel(rows, '物资目录');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="materials_${Date.now()}.xlsx"`);
  res.send(buffer);
}));

// ============================================
// 二、库存查询（/inventory）
// ============================================

const inventoryRouter = Router();

inventoryRouter.get('/', requirePermission('canViewInventory'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listInventory({
    tenantId, page: parseInt(q.page) || 1, pageSize: parseInt(q.pageSize) || 20,
    status: q.status, viewMode: q.viewMode,
    subProjectId: q.subProjectId, contractId: q.contractId, contractIds: q.contractIds, departmentId: q.departmentId, departmentIds: q.departmentIds, projectCode: q.projectCode, projectName: q.projectName,
    workTeamId: q.workTeamId, materialName: q.materialName || q.keyword, materialCode: q.materialCode,
    startDate: q.startDate, endDate: q.endDate,
  });
  res.json({ success: true, data: result.items, meta: { total: result.total, page: result.page, limit: result.pageSize } } as unknown as PaginatedResponse<any>);
}));

inventoryRouter.get('/export', requirePermission('canExport'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const { rows, count } = await wms.getInventoryExportData({
    tenantId,
    status: q.status,
    viewMode: q.viewMode,
    contractId: q.contractId,
    contractIds: q.contractIds,
    departmentId: q.departmentId,
    departmentIds: q.departmentIds,
    subProjectId: q.subProjectId,
    projectCode: q.projectCode,
    projectName: q.projectName,
    workTeamId: q.workTeamId,
    materialName: q.materialName || q.keyword,
    materialCode: q.materialCode,
    startDate: q.startDate,
    endDate: q.endDate,
  });
  const buffer = await wms.exportToExcel(rows, '库存报表');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="inventory_${Date.now()}.xlsx"`);
  res.send(buffer);
}));

// ============================================
// 三、送货单管理（/delivery-orders）
// ============================================

const deliveryOrdersRouter = Router();

deliveryOrdersRouter.get('/', requirePermission('canViewRecords'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listDeliveryOrders({
    tenantId, page: parseInt(q.page) || 1, pageSize: parseInt(q.pageSize) || 20,
    contractId: q.contractId, supplierId: q.supplierId, subProjectId: q.subProjectId,
    startDate: q.startDate, endDate: q.endDate,
  });
  res.json({ success: true, data: result.orders, meta: { total: result.total, page: result.page, limit: result.pageSize } } as unknown as PaginatedResponse<any>);
}));

deliveryOrdersRouter.post('/', requirePermission('canInbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { supplierId, contractId, deliveryDate, remark, departmentId, subProjectId, deliveryNoticeNo, items } = req.body;

  const order = await prisma.$transaction(async (tx) => {
    let resolvedSubProjectId: string | null = subProjectId || null;

    // 按项目分组，参考 projectName 匹配 subProject
    const grouped = new Map<string, any[]>();
    for (const item of items || []) {
      const key = item.projectCode || item.projectName || '_default';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }

    const allItems: any[] = [];
    for (const [, groupItems] of grouped.entries()) {
      const firstItem = groupItems[0];
      if (!resolvedSubProjectId && firstItem.projectName) {
        const sp = await tx.subProject.findFirst({ where: { tenantId, name: { contains: firstItem.projectName } } });
        resolvedSubProjectId = sp?.id || null;
      }
      for (const item of groupItems) {
        let materialId = item.materialId;
        if (!materialId && item.materialName) {
          const mat = await tx.material.findFirst({ where: { tenantId, name: item.materialName } });
          if (!mat) {
            const created = await tx.material.create({ data: { tenantId, name: item.materialName, spec: item.spec, unit: item.unit || '个', unitPrice: item.unitPrice || 0 } });
            materialId = created.id;
          } else {
            materialId = mat.id;
          }
        }
        if (materialId) {
          allItems.push({ materialId, materialName: item.materialName, spec: item.spec, unit: item.unit, deliveryQty: item.deliveryQty || item.quantity || 0, actualQty: item.actualQty || item.quantity || 0, unitPrice: item.unitPrice, projectName: item.projectName || null, projectCode: item.projectCode || null });
        }
      }
    }

    return tx.deliveryOrder.create({
      data: {
        tenantId, supplierId, contractId, departmentId,
        subProjectId: resolvedSubProjectId,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
        orderNo: await wms.generateOrderNo('DO'),
        remark, source: 'MANUAL',
        items: { create: allItems },
      },
      include: { items: true },
    });
  });

  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `创建送货单 ${order.orderNo}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: order } as unknown as ApiResponse);
}));

// ⚠️ OCR 送货单识别路由（密封，不移动）
deliveryOrdersRouter.post('/ocr', requirePermission('canInbound'), upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'MISSING_FILE', message: '请上传文件' } as unknown as ApiResponse);
      return;
    }
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'NO_TENANT', message: '当前用户未关联企业' } as unknown as ApiResponse);
      return;
    }
    const { rawText, parsed, parsedBy } = await runOcr(req.file.buffer, req.file.mimetype, tenantId);

    let supplierMatch: { id: string; name: string; isNew: boolean } | null = null;
    if (parsed.supplier) {
      const existing = await prisma.supplier.findFirst({ where: { tenantId, name: { contains: parsed.supplier.slice(0, 10) } } });
      supplierMatch = existing ? { id: existing.id, name: existing.name, isNew: false } : { id: '', name: parsed.supplier, isNew: true };
    }

    let contractMatch: { id: string; name: string } | null = null;
    if (parsed.contractCode) {
      const cleanCode = parsed.contractCode.replace(/\s/g, '');
      const c = await prisma.contract.findFirst({ where: { tenantId, OR: [{ code: { contains: parsed.contractCode } }, { code: { contains: cleanCode } }] } });
      if (c) contractMatch = { id: c.id, name: c.name };
    }

    let projectMatch: { id: string; name: string } | null = null;
    const projectName = parsed.projectName || (parsed.items?.length === 1 ? parsed.items[0].projectName : null);
    if (projectName) {
      const sp = await prisma.subProject.findFirst({ where: { tenantId, name: { contains: projectName } } });
      if (sp) projectMatch = { id: sp.id, name: sp.name };
    }

    res.json({ success: true, data: { rawText, parsed, supplierMatch, contractMatch, projectMatch, parsedBy } } as unknown as ApiResponse);
  } catch (err: any) {
    console.error('[OCR Error]', err.message);
    res.status(500).json({ success: false, error: 'OCR_ERROR', message: err.message || '识别失败' } as unknown as ApiResponse);
  }
});

// ⚠️ 送货单手动生成入库单（保留，含特殊分组逻辑）
deliveryOrdersRouter.post('/:id/create-inbound', requirePermission('canInbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { contractId, inboundDate } = req.body;

  const delivery = await prisma.deliveryOrder.findFirst({
    where: { id: req.params.id, tenantId },
    include: { items: true, supplier: true },
  });
  if (!delivery) throw { status: 404, code: 'NOT_FOUND', message: '送货单不存在' };

  const grouped = new Map<string, any[]>();
  for (const item of delivery.items) {
    const key = item.projectCode || item.projectName || '_default';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  const orders: any[] = [];
  await prisma.$transaction(async (tx) => {
    for (const [key, groupItems] of grouped.entries()) {
      const firstItem = groupItems[0];
      let subProjectId: string | null = delivery.subProjectId;
      if (!subProjectId && firstItem.projectCode) {
        const proj = await tx.subProject.findFirst({ where: { tenantId, code: firstItem.projectCode } });
        subProjectId = proj?.id || null;
      }
      if (!subProjectId && firstItem.projectName) {
        const proj = await tx.subProject.findFirst({ where: { tenantId, name: { contains: firstItem.projectName } } });
        subProjectId = proj?.id || null;
      }
      if (!subProjectId) continue;

      const itemsData: any[] = [];
      for (const dItem of groupItems) {
        let materialId = dItem.materialId;
        if (!materialId && dItem.projectCode) {
          let mat = await tx.material.findFirst({ where: { tenantId, code: dItem.projectCode } });
          if (!mat) {
            mat = await tx.material.create({ data: { tenantId, code: dItem.projectCode, name: dItem.materialName, spec: dItem.spec, unit: dItem.unit, unitPrice: dItem.unitPrice } });
          }
          materialId = mat.id;
        }
        if (!materialId) continue;
        itemsData.push({ materialId, quantity: dItem.actualQty, unitPrice: dItem.unitPrice, unit: dItem.unit, projectName: firstItem.projectName || null });
      }
      if (!itemsData.length) continue;

      const orderNo = await wms.generateOrderNo('IN');
      const inboundOrder = await tx.inboundOrder.create({
        data: {
          tenantId, contractId: contractId || delivery.contractId || null,
          subProjectId, deliveryOrderId: delivery.id, orderNo,
          inboundDate: inboundDate ? new Date(inboundDate) : new Date(),
          source: 'delivery', createdBy: req.user!.id,
          items: { create: itemsData },
        },
        include: { subProject: true, items: { include: { material: true } } },
      });

      for (const item of itemsData) {
        await tx.inventory.upsert({
          where: { subProjectId_materialId_projectName: { subProjectId: subProjectId!, materialId: item.materialId, projectName: item.projectName || null! } },
          update: { quantity: { increment: item.quantity } },
          create: { tenantId, subProjectId: subProjectId!, materialId: item.materialId, projectName: item.projectName || null, quantity: item.quantity },
        });
      }
      orders.push(inboundOrder);
    }
  });

  await logOperation({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `送货单转入库单 ${orders.map((o: any) => o.orderNo).join('、')}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: orders } as unknown as ApiResponse);
}));

deliveryOrdersRouter.get('/export', requirePermission('canExport'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const { rows } = await wms.getDeliveryOrderExportData({
    tenantId,
    supplierId: q.supplierId,
    contractId: q.contractId,
    subProjectId: q.subProjectId,
    startDate: q.startDate,
    endDate: q.endDate,
  });
  const buffer = await wms.exportToExcel(rows, '送货单');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="delivery_orders_${Date.now()}.xlsx"`);
  res.send(buffer);
}));

// ============================================
// 四、入库管理（/inbound）
// ============================================

const inboundRouter = Router();

inboundRouter.get('/template', async (_req, res) => {
  const rows = [{ '物资名称': '举例：水泥42.5', '项目名称': '举例：1号楼', '单位': '吨', '数量': 10, '单价': 350, '供应商': 'XX建材', '送货单号': 'DO-20250101', '规格型号': '42.5R' }];
  const buffer = await wms.exportToExcel(rows, '入库模板');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="inbound_template.xlsx"`);
  res.send(buffer);
});

inboundRouter.get('/project-names', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { contractId, departmentId } = req.query as any;
  const data = await wms.getInventoryProjectNames(tenantId, contractId, departmentId);
  res.json({ success: true, data } as unknown as ApiResponse);
}));

inboundRouter.get('/', requirePermission('canViewRecords'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listInboundOrders({
    tenantId, page: parseInt(q.page) || 1, pageSize: parseInt(q.pageSize) || 20,
    contractId: q.contractId, supplierId: q.supplierId, subProjectId: q.subProjectId,
    materialName: q.materialName, source: q.source, orderNo: q.orderNo,
    startDate: q.startDate, endDate: q.endDate,
  });
  res.json({ success: true, data: result.orders, meta: { total: result.total, page: result.page, limit: result.pageSize } } as unknown as PaginatedResponse<any>);
}));

inboundRouter.post('/manual', requirePermission('canInbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { subProjectId, contractId, departmentId, supplierName, inboundDate, remark, items } = req.body;
  // 验证 subProjectId：如果提供了子项目ID，必须确保它存在且属于当前租户
  if (subProjectId) {
    const sp = await prisma.subProject.findFirst({ where: { id: subProjectId, tenantId } });
    if (!sp) throw { status: 400, code: 'INVALID_SUBPROJECT', message: '子项目不存在或不属于当前企业' };
  }
  const order = await wms.createManualInbound({ tenantId, userId: getEffectiveUserId(req), subProjectId, contractId, departmentId, supplierName, inboundDate, remark, items } as any);
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `手动入库 ${order.orderNo}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: order } as unknown as ApiResponse);
}));

inboundRouter.post('/', requirePermission('canInbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { subProjectId, contractId, departmentId, supplierName, inboundDate, remark, items } = req.body;
  const order = await wms.createManualInbound({
    tenantId, userId: getEffectiveUserId(req), subProjectId, contractId, departmentId, supplierName, inboundDate, remark,
    items: (items || []).map((item: any) => ({ ...item, projectName: item.projectName || null })),
  } as any);
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `创建入库单 ${order.orderNo}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: order } as unknown as ApiResponse);
}));

inboundRouter.post('/excel', requirePermission('canInbound'), upload.single('file'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  if (!req.file) throw { status: 400, code: 'MISSING_FILE', message: '请上传文件' };
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer as any);
  const sheet = workbook.worksheets[0];
  const rows: any[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals: any = {};
    row.eachCell((cell, colNumber) => {
      const header = sheet.getRow(1).getCell(colNumber).text || `col_${colNumber}`;
      vals[header] = cell.value;
    });
    if (Object.keys(vals).length > 0) rows.push(vals);
  });
  const items = rows.map(row => ({
    materialName: row['物资名称'] || row['材料名称'] || '',
    projectName: row['项目名称'] || null,
    unit: row['单位'] || '个', quantity: parseFloat(row['数量']) || 0,
    unitPrice: parseFloat(row['单价']) || 0,
  })).filter(item => item.materialName && item.quantity > 0);
  const { subProjectId, contractId, departmentId, supplierName, inboundDate, deliveryDate, remark } = req.body;
  const order = await wms.createExcelInbound({
    tenantId,
    userId: getEffectiveUserId(req),
    subProjectId,
    contractId,
    departmentId,
    supplierName,
    inboundDate: inboundDate || deliveryDate,
    remark,
    items,
  });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `Excel导入入库 ${order.orderNo}（${items.length}条）`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: order } as unknown as ApiResponse);
}));

inboundRouter.get('/export', requirePermission('canExport'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listInboundOrders({
    tenantId, page: 1, pageSize: 99999,
    contractId: q.contractId, supplierId: q.supplierId, subProjectId: q.subProjectId,
    startDate: q.startDate, endDate: q.endDate,
  });
  const rows = result.orders.flatMap((o: any) => o.items.map((item: any) => ({
    '入库单号': o.orderNo, '入库日期': o.inboundDate.toLocaleDateString('zh-CN'),
    '子项目': o.subProject?.name || '', '物资名称': item.material?.name || '',
    '物资编码': item.material?.code || '', '项目名称': item.projectName || '',
    '单位': item.unit, '数量': item.quantity, '单价': item.unitPrice,
  })));
  const buffer = await wms.exportToExcel(rows, '入库记录');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="inbound_${Date.now()}.xlsx"`);
  res.send(buffer);
}));

inboundRouter.get('/:id/cascade-preview', requirePermission('canInbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const preview = await wms.getInboundCascadePreview(tenantId, req.params.id);
  res.json({ success: true, data: preview } as unknown as ApiResponse);
}));

inboundRouter.delete('/:id', requirePermission('canInbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  await wms.deleteInboundOrder(tenantId, req.params.id);
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'DELETE', module: '物资管理', description: `删除入库单 ${req.params.id}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: null } as unknown as ApiResponse);
}));

inboundRouter.put('/:id', requirePermission('canInbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const order = await wms.updateInboundOrder(tenantId, req.params.id, req.body);
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'UPDATE', module: '物资管理', description: `修改入库单 ${order.orderNo}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: order } as unknown as ApiResponse);
}));

// ============================================
// 五、出库管理（/outbound）
// ============================================

const outboundRouter = Router();

outboundRouter.get('/', requirePermission('canViewInventory'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listOutboundOrders({
    tenantId, page: parseInt(q.page) || 1, pageSize: parseInt(q.pageSize) || 20,
    subProjectId: q.subProjectId, workTeamId: q.workTeamId, keyword: q.keyword,
    startDate: q.startDate, endDate: q.endDate,
  });
  res.json({ success: true, data: result.orders, meta: { total: result.total, page: result.page, limit: result.pageSize } } as unknown as PaginatedResponse<any>);
}));

outboundRouter.post('/', requirePermission('canOutbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { subProjectId, departmentId, workTeamId, outboundDate, remark, items } = req.body;
  const { order, subProject, department, workTeam } = await wms.createOutbound({
    tenantId, userId: getEffectiveUserId(req), subProjectId: subProjectId || null, departmentId, workTeamId, outboundDate, remark,
    items: items || [],
  });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `创建出库单 ${order.orderNo}（${items.length}项）`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: { order, subProject, department, workTeam } } as unknown as ApiResponse);
}));

outboundRouter.get('/:id/pdf', requirePermission('canOutbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const order = await wms.getOutboundOrderById(tenantId, req.params.id);
  const pdfBuffer = await generateOutboundPdf(order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${order.orderNo}.pdf"`);
  res.send(pdfBuffer);
}));

outboundRouter.get('/:id/excel', requirePermission('canOutbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const order = await wms.getOutboundOrderById(tenantId, req.params.id);
  const rows = (order.items || []).map((item: any) => ({
    '物资名称': item.material?.name || '', '规格型号': item.material?.spec || '',
    '项目名称': item.projectName || '', '单位': item.unit,
    '数量': item.quantity, '单价': item.unitPrice, '金额': (item.quantity * item.unitPrice).toFixed(2),
  }));
  const buffer = await wms.exportToExcel(rows, `出库单_${order.orderNo}`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${order.orderNo}.xlsx"`);
  res.send(buffer);
}));

outboundRouter.get('/export', requirePermission('canExport'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { subProjectId, workTeamId, keyword, startDate, endDate } = req.query as any;
  const { rows } = await wms.getOutboundExportData(tenantId, subProjectId, workTeamId, keyword, startDate, endDate);
  const buffer = await wms.exportToExcel(rows, '出库记录');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="outbound_${Date.now()}.xlsx"`);
  res.send(buffer);
}));

outboundRouter.get('/:id/cascade-preview', requirePermission('canOutbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const preview = await wms.getOutboundCascadePreview(tenantId, req.params.id);
  res.json({ success: true, data: preview } as unknown as ApiResponse);
}));

outboundRouter.delete('/:id', requirePermission('canOutbound'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  await wms.deleteOutboundOrder(tenantId, req.params.id);
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'DELETE', module: '物资管理', description: `删除出库单 ${req.params.id}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: null } as unknown as ApiResponse);
}));

// ============================================
// 六、退库管理（/returns）
// ============================================

const returnsRouter = Router();

returnsRouter.get('/template', async (_req, res) => {
  const rows = [{ '物资名称': '举例：水泥42.5', '项目名称': '1号楼', '单位': '吨', '数量': 2, '单价': 350 }];
  const buffer = await wms.exportToExcel(rows, '退库模板');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="return_template.xlsx"`);
  res.send(buffer);
});

returnsRouter.get('/', requirePermission('canViewRecords'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listReturnOrders({
    tenantId, page: parseInt(q.page) || 1, pageSize: parseInt(q.pageSize) || 20,
    subProjectId: q.subProjectId, workTeamId: q.workTeamId,
    startDate: q.startDate, endDate: q.endDate,
  });
  res.json({ success: true, data: result.orders, meta: { total: result.total, page: result.page, limit: result.pageSize } } as unknown as PaginatedResponse<any>);
}));

returnsRouter.get('/outbound-items', requirePermission('canReturn'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const items = await wms.listReturnableOutboundItems({
    tenantId, subProjectId: q.subProjectId, workTeamId: q.workTeamId,
    startDate: q.startDate, endDate: q.endDate,
  });
  res.json({ success: true, data: items } as unknown as ApiResponse);
}));

returnsRouter.post('/', requirePermission('canReturn'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { subProjectId, workTeamId, returnDate, remark, items } = req.body;
  if (!subProjectId) throw { status: 400, code: 'MISSING_PARAM', message: '请选择子项目' };
  const order = await wms.createReturn({ tenantId, userId: getEffectiveUserId(req), subProjectId, workTeamId, returnDate, remark, items });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `创建退库单 ${order.orderNo}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: order } as unknown as ApiResponse);
}));

returnsRouter.post('/excel', requirePermission('canReturn'), upload.single('file'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  if (!req.file) throw { status: 400, code: 'MISSING_FILE', message: '请上传文件' };
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer as any);
  const sheet = workbook.worksheets[0];
  const rows: any[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals: any = {};
    row.eachCell((cell, colNumber) => {
      const header = sheet.getRow(1).getCell(colNumber).text || `col_${colNumber}`;
      vals[header] = cell.value;
    });
    if (Object.keys(vals).length > 0) rows.push(vals);
  });
  // Resolve material IDs from names
  const items = await Promise.all(rows.map(async row => {
    const materialName = row['物资名称'] || row['材料名称'] || '';
    const material = await prisma.material.findFirst({ where: { tenantId, name: materialName } });
    return { materialId: material?.id || '', quantity: parseFloat(row['数量']) || 0, projectName: row['项目名称'] || null, unitPrice: parseFloat(row['单价']) || 0, unit: row['单位'] || '' };
  }));
  const validItems = items.filter(item => item.materialId && item.quantity > 0);
  const { subProjectId, returnDate, remark } = req.body;
  const order = await wms.createExcelReturn({ tenantId, userId: getEffectiveUserId(req), subProjectId, returnDate, remark, items: validItems });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `Excel导入退库 ${order.orderNo}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: order } as unknown as ApiResponse);
}));

returnsRouter.get('/export', requirePermission('canExport'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listReturnOrders({
    tenantId, page: 1, pageSize: 99999,
    subProjectId: q.subProjectId, startDate: q.startDate, endDate: q.endDate,
  });
  const rows = result.orders.flatMap((o: any) => o.items.map((item: any) => ({
    '退库单号': o.orderNo, '退库日期': o.returnDate.toLocaleDateString('zh-CN'),
    '子项目': o.subProject?.name || '', '物资名称': item.material?.name || '',
    '项目名称': item.projectName || '', '数量': item.quantity,
  })));
  const buffer = await wms.exportToExcel(rows, '退库记录');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="returns_${Date.now()}.xlsx"`);
  res.send(buffer);
}));

returnsRouter.get('/:id/cascade-preview', requirePermission('canReturn'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const preview = await wms.getReturnCascadePreview(tenantId, req.params.id);
  res.json({ success: true, data: preview } as unknown as ApiResponse);
}));

returnsRouter.delete('/:id', requirePermission('canReturn'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  await wms.deleteReturnOrder(tenantId, req.params.id);
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'DELETE', module: '物资管理', description: `删除退库单 ${req.params.id}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: null } as unknown as ApiResponse);
}));

// ============================================
// 七、调拨管理（/transfers）
// ============================================

const transfersRouter = Router();

transfersRouter.get('/', requirePermission('canViewRecords'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listTransferOrders({
    tenantId, page: parseInt(q.page) || 1, pageSize: parseInt(q.pageSize) || 20,
    fromSubProjectId: q.fromSubProjectId, toSubProjectId: q.toSubProjectId,
    startDate: q.startDate, endDate: q.endDate,
  });
  res.json({ success: true, data: result.orders, meta: { total: result.total, page: result.page, limit: result.pageSize } } as unknown as PaginatedResponse<any>);
}));

transfersRouter.post('/', requirePermission('canTransfer'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { fromSubProjectId, toSubProjectId, fromDepartmentId, toDepartmentId, transferDate, remark, items } = req.body;
  if (!fromSubProjectId && !fromDepartmentId) throw { status: 400, code: 'MISSING_PARAM', message: '请选择调出方' };
  if (!toSubProjectId && !toDepartmentId) throw { status: 400, code: 'MISSING_PARAM', message: '请选择调入方' };
  const { order, fromSubProject, toSubProject, fromDepartment, toDepartment } = await wms.createTransfer({
    tenantId, userId: getEffectiveUserId(req), fromSubProjectId, toSubProjectId, fromDepartmentId, toDepartmentId, transferDate, remark,
    items: items || [],
  });
  const fromName = fromSubProject?.name || fromDepartment?.name || '—';
  const toName = toSubProject?.name || toDepartment?.name || '—';
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `创建调拨单 ${order.orderNo}（${fromName} → ${toName}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: { order, fromSubProject, toSubProject, fromDepartment, toDepartment } } as unknown as ApiResponse);
}));

transfersRouter.get('/export', requirePermission('canExport'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { fromSubProjectId, toSubProjectId } = req.query as any;
  const { rows } = await wms.getTransferExportData(tenantId, fromSubProjectId, toSubProjectId);
  const buffer = await wms.exportToExcel(rows, '调拨记录');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="transfers_${Date.now()}.xlsx"`);
  res.send(buffer);
}));

transfersRouter.get('/:id/pdf', requirePermission('canTransfer'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const order = await prisma.transferOrder.findFirst({
    where: { id: req.params.id, tenantId, isActive: true },
    include: {
      fromSubProject: { include: { department: { include: { contract: true } } } },
      toSubProject: { include: { department: { include: { contract: true } } } },
      fromDepartment: { include: { contract: true } },
      toDepartment: { include: { contract: true } },
      items: { include: { material: true } },
    },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '调拨单不存在' };
  const pdfBuffer = await generateTransferPdf(order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${order.orderNo}.pdf"`);
  res.send(pdfBuffer);
}));

transfersRouter.get('/:id/cascade-preview', requirePermission('canTransfer'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const preview = await wms.getTransferCascadePreview(tenantId, req.params.id);
  res.json({ success: true, data: preview } as unknown as ApiResponse);
}));

transfersRouter.delete('/:id', requirePermission('canTransfer'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  await wms.deleteTransferOrder(tenantId, req.params.id);
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'DELETE', module: '物资管理', description: `删除调拨单 ${req.params.id}`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: null } as unknown as ApiResponse);
}));

// ============================================
// 八、供应商查询（/suppliers）
// ============================================

const suppliersRouter = Router();

suppliersRouter.get('/', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { name, keyword, search } = req.query as any;
  const suppliers = await wms.listSuppliers(tenantId, name || keyword || search);
  res.json({ success: true, data: suppliers } as unknown as ApiResponse);
}));

suppliersRouter.post('/', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) throw { status: 400, code: 'VALIDATION_ERROR', message: '供应商名称不能为空' };

  const supplier = await prisma.supplier.create({
    data: {
      tenantId,
      name,
      contactName: body.contactName ?? body.contact ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      bankAccount: body.bankAccount ?? null,
      bankName: body.bankName ?? null,
      remark: body.remark ?? null,
    },
  });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `创建供应商「${supplier.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: { ...supplier, contact: supplier.contactName } } as unknown as ApiResponse);
}));

suppliersRouter.put('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, tenantId } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '供应商不存在' };

  const body = req.body || {};
  const name = body.name === undefined ? existing.name : String(body.name || '').trim();
  if (!name) throw { status: 400, code: 'VALIDATION_ERROR', message: '供应商名称不能为空' };

  const supplier = await prisma.supplier.update({
    where: { id: existing.id },
    data: {
      name,
      contactName: body.contactName ?? body.contact ?? existing.contactName,
      phone: body.phone ?? existing.phone,
      address: body.address ?? existing.address,
      bankAccount: body.bankAccount ?? existing.bankAccount,
      bankName: body.bankName ?? existing.bankName,
      remark: body.remark ?? existing.remark,
    },
  });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'UPDATE', module: '物资管理', description: `更新供应商「${supplier.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: { ...supplier, contact: supplier.contactName } } as unknown as ApiResponse);
}));

suppliersRouter.delete('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const existing = await prisma.supplier.findFirst({
    where: { id: req.params.id, tenantId },
    include: { _count: { select: { deliveryOrders: true, contracts: true } } },
  });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '供应商不存在' };
  if (existing._count.deliveryOrders > 0 || existing._count.contracts > 0) {
    throw { status: 400, code: 'SUPPLIER_IN_USE', message: '供应商已有业务数据，不能删除' };
  }

  await prisma.supplier.delete({ where: { id: existing.id } });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'DELETE', module: '物资管理', description: `删除供应商「${existing.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: null } as unknown as ApiResponse);
}));

// ============================================
// 九、班组管理（/work-teams）
// ============================================

const workTeamsRouter = Router();

workTeamsRouter.get('/', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listWorkTeams({
    tenantId, search: q.search, page: parseInt(q.page) || 1, pageSize: parseInt(q.pageSize) || 20,
  });
  res.json({ success: true, data: result.teams, meta: { total: result.total, page: result.page, limit: result.pageSize } } as unknown as PaginatedResponse<any>);
}));

workTeamsRouter.post('/', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) throw { status: 400, code: 'VALIDATION_ERROR', message: '班组名称不能为空' };
  const team = await prisma.workTeam.create({
    data: {
      tenantId,
      name,
      leaderName: body.leaderName ?? body.leader ?? null,
      phone: body.phone ?? null,
      memberCount: body.memberCount === '' || body.memberCount === undefined ? null : Number(body.memberCount),
      remark: body.remark ?? null,
    },
  });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'CREATE', module: '物资管理', description: `创建班组「${team.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ success: true, data: { ...team, leader: team.leaderName } } as unknown as ApiResponse);
}));

workTeamsRouter.put('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const existing = await prisma.workTeam.findFirst({ where: { id: req.params.id, tenantId } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '班组不存在' };
  const body = req.body || {};
  const name = body.name === undefined ? existing.name : String(body.name || '').trim();
  if (!name) throw { status: 400, code: 'VALIDATION_ERROR', message: '班组名称不能为空' };
  const team = await prisma.workTeam.update({
    where: { id: existing.id },
    data: {
      name,
      leaderName: body.leaderName ?? body.leader ?? existing.leaderName,
      phone: body.phone ?? existing.phone,
      memberCount: body.memberCount === '' || body.memberCount === undefined ? existing.memberCount : Number(body.memberCount),
      remark: body.remark ?? existing.remark,
    },
  });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'UPDATE', module: '物资管理', description: `更新班组「${team.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: { ...team, leader: team.leaderName } } as unknown as ApiResponse);
}));

workTeamsRouter.delete('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const existing = await prisma.workTeam.findFirst({ where: { id: req.params.id, tenantId } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '班组不存在' };
  const [subContractCount, outboundCount, returnCount] = await Promise.all([
    prisma.subContract.count({ where: { tenantId, workTeamId: existing.id } }),
    prisma.outboundOrder.count({ where: { tenantId, workTeamId: existing.id } }),
    prisma.returnOrder.count({ where: { tenantId, workTeamId: existing.id } }),
  ]);
  if (subContractCount > 0 || outboundCount > 0 || returnCount > 0) {
    throw { status: 400, code: 'WORK_TEAM_IN_USE', message: '班组已有合同或出入库业务数据，不能删除' };
  }
  await prisma.workTeam.delete({ where: { id: existing.id } });
  await createLog({ tenantId, userId: getEffectiveUserId(req), action: 'DELETE', module: '物资管理', description: `删除班组「${existing.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ success: true, data: null } as unknown as ApiResponse);
}));

// ============================================
// 十、班组台账（/work-team-ledger）
// ============================================

const workTeamLedgerRouter = Router();

workTeamLedgerRouter.get('/', requirePermission('canViewWorkTeamLedger'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const result = await wms.listWorkTeamLedger({
    tenantId, page: parseInt(q.page) || 1, pageSize: parseInt(q.pageSize) || 20,
    workTeamId: q.workTeamId, subProjectId: q.subProjectId, keyword: q.keyword,
    startDate: q.startDate, endDate: q.endDate,
  });
  res.json({ success: true, data: result.items, meta: { total: result.total, page: result.page, limit: result.pageSize } } as unknown as PaginatedResponse<any>);
}));

workTeamLedgerRouter.get('/export', requirePermission('canExport'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const q = req.query as any;
  const { rows } = await wms.getWorkTeamLedgerExportData({
    tenantId,
    workTeamId: q.workTeamId,
    subProjectId: q.subProjectId,
    keyword: q.keyword,
    startDate: q.startDate,
    endDate: q.endDate,
  });
  const buffer = await wms.exportToExcel(rows, '班组台账');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="work_team_ledger_${Date.now()}.xlsx"`);
  res.send(buffer);
}));

// ============================================
// 组装路由器
// ============================================

router.use('/materials', authenticate, requireUser, materialsRouter);
router.use('/inventory', authenticate, requireUser, inventoryRouter);
router.use('/delivery-orders', authenticate, requireUser, deliveryOrdersRouter);
router.use('/inbound', authenticate, requireUser, inboundRouter);
router.use('/outbound', authenticate, requireUser, outboundRouter);
router.use('/returns', authenticate, requireUser, returnsRouter);
router.use('/transfers', authenticate, requireUser, transfersRouter);
router.use('/suppliers', authenticate, requireUser, suppliersRouter);
router.use('/work-teams', authenticate, requireUser, workTeamsRouter);
router.use('/work-team-ledger', authenticate, requireUser, workTeamLedgerRouter);

// ⚠️ OCR 调试端点（密封，不移动）
router.post('/ocr-debug', upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'MISSING_FILE', message: '请上传文件' } as unknown as ApiResponse);
      return;
    }
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'NO_TENANT', message: '当前用户未关联企业' } as unknown as ApiResponse);
      return;
    }

    let ocrConfig = await prisma.ocrConfig.findFirst({ where: { isEnabled: true, provider: 'baidu' }, orderBy: { createdAt: 'desc' } });
    if (!ocrConfig) { ocrConfig = await prisma.ocrConfig.findFirst({ where: { provider: 'baidu' }, orderBy: { createdAt: 'desc' } }); }
    if (!ocrConfig) {
      res.status(400).json({ success: false, error: 'NO_OCR_CONFIG', message: '未配置百度 OCR' } as unknown as ApiResponse);
      return;
    }

    // 百度 API Key 可能存在 apiKey 或 secretId 字段（兼容两种配置方式）
    const baiduApiKey = ocrConfig.apiKey || ocrConfig.secretId || '';
    if (!baiduApiKey || !ocrConfig.secretKey) {
      res.status(400).json({ success: false, error: 'NO_OCR_CREDENTIALS', message: '百度 OCR 凭证不完整，请检查 API Key 和 Secret Key' } as unknown as ApiResponse);
      return;
    }

    const stage1Result: { pageCount: number; linesPerPage: number[]; rawTextPerPage: string[]; totalLines: number; totalChars: number } = { pageCount: 0, linesPerPage: [], rawTextPerPage: [], totalLines: 0, totalChars: 0 };
    const allTextLines: string[] = [];

    if (req.file.mimetype === 'application/pdf') {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-debug-'));
      const pdfPath = path.join(tmpDir, 'input.pdf');
      const outputPattern = path.join(tmpDir, 'page_%d.png');
      fs.writeFileSync(pdfPath, req.file.buffer);
      try {
        execSync(`gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile="${outputPattern}" "${pdfPath}"`, { timeout: 120000, stdio: 'pipe' });
        const pageFiles: string[] = [];
        for (let i = 1; ; i++) {
          const p = path.join(tmpDir, `page_${i}.png`);
          if (fs.existsSync(p)) { pageFiles.push(p); continue; }
          const pAlt = path.join(tmpDir, `page_${String(i).padStart(2, '0')}.png`);
          if (fs.existsSync(pAlt)) { pageFiles.push(pAlt); continue; }
          break;
        }
        stage1Result.pageCount = pageFiles.length;
        for (let pi = 0; pi < pageFiles.length; pi++) {
          const pngBuffer = fs.readFileSync(pageFiles[pi]);
          const b64 = pngBuffer.toString('base64');
          const lines = await baiduOcr(b64, baiduApiKey, ocrConfig!.secretKey!);
          stage1Result.linesPerPage.push(lines.length);
          stage1Result.rawTextPerPage.push(lines.join('\n'));
          allTextLines.push(`=== 第${pi + 1}页（共${pageFiles.length}页）===`);
          allTextLines.push(...lines);
        }
      } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    } else {
      const b64 = req.file.buffer.toString('base64');
      const lines = await baiduOcr(b64, baiduApiKey, ocrConfig!.secretKey!);
      stage1Result.pageCount = 1; stage1Result.linesPerPage = [lines.length];
      stage1Result.rawTextPerPage = [lines.join('\n')]; allTextLines.push(...lines);
    }

    const rawText = allTextLines.join('\n');
    stage1Result.totalLines = allTextLines.length; stage1Result.totalChars = rawText.length;

    let stage2Result: any = { itemsCount: 0, supplier: '', deliveryNo: '', deliveryDate: '', parsedBy: '' };
    try {
      const aiResult = await aiExtractFromText(rawText, tenantId);
      stage2Result = { itemsCount: aiResult.parsed.items.length, supplier: aiResult.parsed.supplier, deliveryNo: aiResult.parsed.deliveryNo, deliveryDate: aiResult.parsed.deliveryDate, projectName: aiResult.parsed.projectName, items: aiResult.parsed.items, parsedBy: aiResult.parsedBy };
    } catch (aiErr: any) { stage2Result.error = aiErr.message; }

    const diagnostics: string[] = [];
    if (stage1Result.totalLines < 30) diagnostics.push('⚠ 百度 OCR 识别行数偏少（< 30 行），可能是图片质量不足，建议提高分辨率或检查 PDF 清晰度');
    if (stage2Result.itemsCount === 0 && stage1Result.totalLines > 50) diagnostics.push('⚠ 百度 OCR 识别了大量文字但 AI 未能提取出物资，请检查 TEXT_EXTRACTION_PROMPT 或 AI 模型配置');
    if (stage2Result.itemsCount > 0 && stage1Result.totalLines / stage2Result.itemsCount > 15) diagnostics.push(`⚠ 平均 ${(stage1Result.totalLines / stage2Result.itemsCount).toFixed(1)} 行 OCR 文字才提取出 1 条物资，可能存在大量无关文字或物资行被遗漏`);
    if (!stage2Result.supplier && stage1Result.rawTextPerPage.some((t: string) => t.includes('供应'))) diagnostics.push('⚠ 百度 OCR 识别到含"供应"的文字行，但 AI 未提取出供应商名称，可能格式不匹配');

    res.json({ success: true, data: { stage1: stage1Result, stage2: stage2Result, diagnostics: diagnostics.length > 0 ? diagnostics : ['✓ 各项指标正常'], rawText: rawText.slice(0, 10000) } } as unknown as ApiResponse);
  } catch (err: any) {
    console.error('[OCR Debug Error]', err.message);
    res.status(500).json({ success: false, error: 'OCR_DEBUG_ERROR', message: err.message } as unknown as ApiResponse);
  }
});

// 获取子项目列表
router.get('/sub-projects', authenticate, requireUser, wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const subProjects = await prisma.subProject.findMany({
    where: { tenantId },
    include: { department: { select: { id: true, name: true, contract: { select: { id: true, name: true } } } } },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: subProjects } as unknown as ApiResponse);
}));

export default router;
