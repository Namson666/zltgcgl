import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { isTenantModuleEnabled, TenantModuleKey } from '../services/module-entitlement.service';

export const requireTenantModule = (moduleKey: TenantModuleKey) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: '认证令牌缺少企业信息，无法验证模块开通状态',
        });
        return;
      }

      const enabled = await isTenantModuleEnabled(tenantId, moduleKey);
      if (!enabled) {
        res.status(403).json({
          success: false,
          error: 'MODULE_NOT_ENABLED',
          message: '该企业未开通此模块',
          data: { moduleKey },
        });
        return;
      }

      next();
    } catch (error) {
      console.error('模块开通验证失败:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '模块开通验证过程中发生错误',
      });
    }
  };
};
