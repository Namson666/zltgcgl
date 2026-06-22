import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '../../common/types';
import * as laborService from '../labor/service';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('仅支持上传打卡照片'));
      return;
    }
    cb(null, true);
  },
});

router.post('/check-in', upload.single('photo'), async (req, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : body.photoUrl;
    const data = await laborService.createMobileCheckIn({
      appId: body.appId,
      tenantId: body.tenantId,
      phone: body.phone,
      checkDate: body.checkDate,
      latitude: body.latitude !== undefined ? Number(body.latitude) : undefined,
      longitude: body.longitude !== undefined ? Number(body.longitude) : undefined,
      address: body.address,
      province: body.province,
      city: body.city,
      county: body.county,
      countyCode: body.countyCode,
      photoUrl,
    });
    if ((data as any).multiple) {
      res.status(409).json({ success: false, error: 'MULTIPLE_TENANTS', data, message: '该手机号匹配多个企业，请选择企业或由管理员预绑定' } as ApiResponse);
      return;
    }
    res.status(201).json({ success: true, data, message: '打卡成功' } as ApiResponse);
  } catch (error: any) {
    console.error('小程序打卡失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

export default router;
