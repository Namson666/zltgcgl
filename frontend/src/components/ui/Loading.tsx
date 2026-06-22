/**
 * 资料通工程管理系统 - 加载组件
 *
 * 功能说明：
 * 提供多种样式的加载指示器，用于页面加载、数据请求等等待场景。
 *
 * 包含三种加载样式：
 * 1. Loading - 全屏居中加载（带文字提示）
 * 2. LoadingInline - 行内加载（嵌入在内容中）
 * 3. LoadingSpinner - 纯旋转动画（最小化组件）
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

/* ========================================
 * 组件 Props 定义
 * ======================================== */

/** Loading 组件属性 */
interface LoadingProps {
  /** 提示文字，默认为"加载中..." */
  text?: string;
  /** 自定义尺寸，默认为 40px */
  size?: number;
  /** 是否全屏覆盖，默认为 false */
  fullScreen?: boolean;
}

/** LoadingInline 组件属性 */
interface LoadingInlineProps {
  /** 提示文字 */
  text?: string;
  /** 旋转图标尺寸，默认为 20px */
  size?: number;
}

/** LoadingSpinner 组件属性 */
interface LoadingSpinnerProps {
  /** 旋转图标尺寸，默认为 24px */
  size?: number;
  /** 自定义颜色类名 */
  className?: string;
}

/* ========================================
 * Loading - 全屏/居中加载组件
 * 用于页面级加载场景，显示旋转图标和提示文字
 * ======================================== */
const Loading: React.FC<LoadingProps> = ({
  text = '加载中...',
  size = 40,
  fullScreen = false,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center ${
        fullScreen ? 'fixed inset-0 bg-white/80 z-50' : 'py-20'
      }`}
    >
      {/* 旋转加载图标 */}
      <Loader2
        size={size}
        className="text-blue-600 animate-spin"
      />
      {/* 加载提示文字 */}
      <p className="mt-4 text-sm text-gray-500">{text}</p>
    </div>
  );
};

/* ========================================
 * LoadingInline - 行内加载组件
 * 嵌入在表格、卡片等内容区域中
 * ======================================== */
const LoadingInline: React.FC<LoadingInlineProps> = ({
  text = '加载中...',
  size = 20,
}) => {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
      <Loader2 size={size} className="animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
};

/* ========================================
 * LoadingSpinner - 纯旋转动画组件
 * 最小化的加载指示器，用于按钮、小区域等
 * ======================================== */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 24,
  className = 'text-blue-600',
}) => {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
};

/* ========================================
 * 导出所有加载组件
 * ======================================== */
export { Loading, LoadingInline, LoadingSpinner };
export default Loading;
