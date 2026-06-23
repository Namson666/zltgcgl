import { Router, Response } from 'express';
import prisma from '../../common/utils/prisma';
import { AuthenticatedRequest, ApiResponse } from '../../common/types';

const router = Router();

const parseLimit = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.min(20, Math.max(1, Math.trunc(parsed)));
};

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = parseLimit(req.query.limit);
    const announcements = await prisma.announcement.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: [
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    res.json({ success: true, data: announcements } as ApiResponse);
  } catch (error) {
    console.error('获取企业公告失败:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器错误',
    } as ApiResponse);
  }
});

export default router;
