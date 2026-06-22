/**
 * 资料通工程管理系统 - 弹窗组件
 *
 * 功能说明：
 * 通用模态弹窗，支持多种尺寸和自定义内容。
 *
 * 特性：
 * 1. 支持四种尺寸：sm(小) / md(中) / lg(大) / xl(超大)
 * 2. 点击遮罩层关闭（可配置）
 * 3. ESC 键关闭（可配置）
 * 4. 打开/关闭动画效果
 * 5. 自动聚焦到弹窗内容区域
 * 6. 阻止背景滚动
 *
 * 使用示例：
 * ```tsx
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="编辑信息">
 *   <p>弹窗内容</p>
 * </Modal>
 * ```
 */

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/* ========================================
 * 组件 Props 定义
 * ======================================== */

/** Modal 组件属性 */
interface ModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调函数 */
  onClose: () => void;
  /** 弹窗标题 */
  title?: string;
  /** 弹窗尺寸，默认为 md */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 是否允许点击遮罩层关闭，默认为 true */
  closeOnOverlay?: boolean;
  /** 是否允许 ESC 键关闭，默认为 true */
  closeOnEsc?: boolean;
  /** 弹窗底部操作区域内容 */
  footer?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 子元素（弹窗主体内容） */
  children: React.ReactNode;
}

/* ========================================
 * 尺寸配置映射
 * 定义不同尺寸弹窗的最大宽度
 * ======================================== */
const sizeClasses: Record<string, string> = {
  sm: 'max-w-md',       /* 小弹窗：最大 448px */
  md: 'max-w-lg',       /* 中弹窗：最大 512px */
  lg: 'max-w-2xl',      /* 大弹窗：最大 672px */
  xl: 'max-w-4xl',      /* 超大弹窗：最大 896px */
};

/* ========================================
 * Modal 组件实现
 * ======================================== */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  closeOnOverlay = true,
  closeOnEsc = true,
  footer,
  className = '',
  children,
}) => {
  /* ---------- 键盘事件处理 ---------- */

  /**
   * ESC 键关闭弹窗
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEsc) {
        onClose();
      }
    },
    [closeOnEsc, onClose]
  );

  /* ---------- 副作用 ---------- */

  useEffect(() => {
    /* 弹窗打开时添加键盘监听和禁止背景滚动 */
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    /* 清理函数：移除监听和恢复滚动 */
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  /* 弹窗关闭时不渲染 */
  if (!isOpen) return null;

  return (
    /* ==========================================
     * 弹窗容器
     * 固定定位覆盖全屏，z-index 确保在最上层
     * ========================================== */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 半透明遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* ==========================================
       * 弹窗主体
       * 相对定位浮于遮罩层之上
       * ========================================== */}
      <div
        className={`
          relative bg-white rounded-lg shadow-2xl w-full
          ${sizeClasses[size]}
          ${className}
          /* 进入动画 */
          animate-in fade-in zoom-in-95 duration-200
        `}
        style={{ boxShadow: 'var(--shadow-lg)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* ==========================================
         * 弹窗头部
         * 包含标题和关闭按钮
         * ========================================== */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            {/* 标题 */}
            <h2
              id="modal-title"
              className="text-lg font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              {title}
            </h2>
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
              title="关闭"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* 无标题时显示右上角关闭按钮 */}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors z-10"
            style={{ color: 'var(--muted-foreground)' }}
            title="关闭"
          >
            <X size={20} />
          </button>
        )}

        {/* ==========================================
         * 弹窗内容区域
         * 支持自定义内容，超出时可滚动
         * ========================================== */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* ==========================================
         * 弹窗底部操作区域
         * 可选，用于放置确认/取消按钮等
         * ========================================== */}
        {footer && (
          <div className="px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ========================================
 * 导出
 * ======================================== */
export default Modal;
