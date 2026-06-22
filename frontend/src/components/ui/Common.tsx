/**
 * 资料通工程管理系统 - 通用工具组件集合
 *
 * 功能说明：
 * 提供系统中常用的通用 UI 组件和工具函数。
 *
 * 组件列表：
 * 1. Pagination - 分页组件
 * 2. EmptyState - 空状态占位组件
 * 3. ConfirmDialog - 确认弹窗组件
 * 4. StatusBadge - 状态标签组件
 * 5. SearchInput - 搜索输入框组件
 *
 * 工具函数：
 * 1. formatMoney - 金额格式化（千分位 + 两位小数）
 * 2. formatDate - 日期格式化
 * 3. formatMonth - 月份格式化
 */

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  AlertTriangle,
  FileQuestion,
  Info,
  X,
} from 'lucide-react';
import Modal from './Modal';

/* ========================================
 * 一、格式化工具函数
 * ======================================== */

/**
 * 金额格式化
 * 将数字转换为带千分位分隔符和两位小数的金额字符串
 *
 * @param amount - 金额数值
 * @param prefix - 前缀符号，默认为 '¥'
 * @returns 格式化后的金额字符串
 *
 * @example
 * formatMoney(1234567.8)  // => '¥1,234,567.80'
 * formatMoney(1000, '$')  // => '$1,000.00'
 */
export const formatMoney = (amount: number | string | undefined, prefix: string = '¥'): string => {
  if (amount === undefined || amount === null || amount === '') return `${prefix}0.00`;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${prefix}0.00`;
  return `${prefix}${num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * 日期格式化
 * 将日期字符串或 Date 对象格式化为指定格式
 *
 * @param date - 日期字符串或 Date 对象
 * @param format - 格式模板，默认为 'YYYY-MM-DD'
 * @returns 格式化后的日期字符串
 *
 * @example
 * formatDate('2024-01-15T10:30:00')  // => '2024-01-15'
 * formatDate(new Date(), 'YYYY年MM月DD日')  // => '2024年01月15日'
 */
export const formatDate = (
  date: string | Date | undefined | null,
  format: string = 'YYYY-MM-DD'
): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * 月份格式化
 * 将月份字符串格式化为中文显示格式
 *
 * @param month - 月份字符串，格式为 'YYYY-MM'
 * @returns 中文月份字符串
 *
 * @example
 * formatMonth('2024-01')  // => '2024年01月'
 * formatMonth('2024-12')  // => '2024年12月'
 */
export const formatMonth = (month: string | undefined | null): string => {
  if (!month) return '-';
  const parts = month.split('-');
  if (parts.length !== 2) return month;
  return `${parts[0]}年${parts[1]}月`;
};

/* ========================================
 * 二、Pagination 分页组件
 * ======================================== */

/** Pagination 组件属性 */
interface PaginationProps {
  /** 当前页码（从 1 开始） */
  current: number;
  /** 总页数 */
  total: number;
  /** 每页条数 */
  pageSize?: number;
  /** 总记录数 */
  totalRecords?: number;
  /** 页码变化回调 */
  onChange: (page: number) => void;
}

/**
 * 分页组件
 * 显示页码导航，支持首页、上一页、下一页、末页跳转
 */
const Pagination: React.FC<PaginationProps> = ({
  current,
  total,
  pageSize = 20,
  totalRecords,
  onChange,
}) => {
  /* 无数据时不渲染 */
  if (total <= 1) return null;

  /**
   * 生成要显示的页码列表
   * 当总页数较多时，显示省略号
   */
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5; /* 最多显示的页码数 */

    if (total <= maxVisible + 2) {
      /* 总页数较少，全部显示 */
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      /* 总页数较多，显示省略号 */
      pages.push(1);

      let start = Math.max(2, current - 1);
      let end = Math.min(total - 1, current + 1);

      /* 确保至少显示 maxVisible 个页码 */
      if (current <= 3) {
        end = Math.min(total - 1, maxVisible);
      } else if (current >= total - 2) {
        start = Math.max(2, total - maxVisible + 1);
      }

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < total - 1) pages.push('...');

      pages.push(total);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between">
      {/* 左侧：总记录数 */}
      {totalRecords !== undefined && (
        <span className="text-sm text-gray-500">
          共 {totalRecords} 条记录
        </span>
      )}
      {totalRecords === undefined && <div />}

      {/* 右侧：页码导航 */}
      <div className="flex items-center gap-1">
        {/* 首页按钮 */}
        <button
          onClick={() => onChange(1)}
          disabled={current === 1}
          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="首页"
        >
          <ChevronsLeft size={16} />
        </button>

        {/* 上一页按钮 */}
        <button
          onClick={() => onChange(current - 1)}
          disabled={current === 1}
          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="上一页"
        >
          <ChevronLeft size={16} />
        </button>

        {/* 页码按钮列表 */}
        {getPageNumbers().map((page, index) =>
          typeof page === 'string' ? (
            /* 省略号 */
            <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
              ...
            </span>
          ) : (
            /* 页码按钮 */
            <button
              key={page}
              onClick={() => onChange(page)}
              className={`min-w-[32px] h-8 px-2 rounded text-sm transition-colors ${
                page === current
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          )
        )}

        {/* 下一页按钮 */}
        <button
          onClick={() => onChange(current + 1)}
          disabled={current === total}
          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="下一页"
        >
          <ChevronRight size={16} />
        </button>

        {/* 末页按钮 */}
        <button
          onClick={() => onChange(total)}
          disabled={current === total}
          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="末页"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

/* ========================================
 * 三、EmptyState 空状态组件
 * ======================================== */

/** EmptyState 组件属性 */
interface EmptyStateProps {
  /** 标题文字 */
  title?: string;
  /** 描述文字 */
  description?: string;
  /** 自定义图标 */
  icon?: React.ReactNode;
  /** 操作按钮 */
  action?: React.ReactNode;
}

/**
 * 空状态占位组件
 * 用于列表无数据、搜索无结果等场景
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  title = '暂无数据',
  description = '当前没有可显示的内容',
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* 图标 */}
      <div className="mb-4 text-gray-300">
        {icon || <FileQuestion size={64} />}
      </div>
      {/* 标题 */}
      <h3 className="text-lg font-medium text-gray-500 mb-1">{title}</h3>
      {/* 描述 */}
      {description && (
        <p className="text-sm text-gray-400 mb-4 max-w-sm">{description}</p>
      )}
      {/* 操作按钮 */}
      {action && <div>{action}</div>}
    </div>
  );
};

/* ========================================
 * 四、ConfirmDialog 确认弹窗组件
 * ======================================== */

/** ConfirmDialog 组件属性 */
interface ConfirmDialogProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调 */
  onConfirm: () => void;
  /** 弹窗标题 */
  title?: string;
  /** 确认信息描述 */
  message: string;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 确认按钮类型：danger(红色) 或 primary(蓝色) */
  type?: 'danger' | 'primary';
  /** 是否正在处理中（显示加载状态） */
  loading?: boolean;
}

/**
 * 确认弹窗组件
 * 用于删除确认、重要操作确认等场景
 * 基于 Modal 组件封装
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = '操作确认',
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'primary',
  loading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          {/* 取消按钮 */}
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            {cancelText}
          </button>
          {/* 确认按钮 */}
          <button
            onClick={onConfirm}
            className={type === 'danger' ? 'btn-danger' : 'btn-primary'}
            disabled={loading}
          >
            {loading ? '处理中...' : confirmText}
          </button>
        </>
      }
    >
      {/* 确认信息内容 */}
      <div className="flex items-start gap-3">
        {/* 警告图标 */}
        <div
          className={`flex-shrink-0 mt-0.5 ${
            type === 'danger' ? 'text-red-500' : 'text-blue-500'
          }`}
        >
          {type === 'danger' ? (
            <AlertTriangle size={20} />
          ) : (
            <Info size={20} />
          )}
        </div>
        {/* 描述文字 */}
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
};

/* ========================================
 * 五、StatusBadge 状态标签组件
 * ======================================== */

/** StatusBadge 组件属性 */
interface StatusBadgeProps {
  /** 状态文本 */
  status: string;
  /** 状态类型，决定颜色样式 */
  type?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  /** 自定义类名 */
  className?: string;
}

/**
 * 状态标签组件
 * 用于表格、列表中显示记录状态
 * 根据类型自动应用对应的颜色样式
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'default',
  className = '',
}) => {
  /* 类型与样式映射 */
  const typeStyles: Record<string, string> = {
    success: 'bg-green-100 text-green-800',     /* 成功/正常 - 绿色 */
    warning: 'bg-yellow-100 text-yellow-800',   /* 警告 - 黄色 */
    danger: 'bg-red-100 text-red-800',           /* 危险/异常 - 红色 */
    info: 'bg-blue-100 text-blue-800',           /* 信息 - 蓝色 */
    default: 'bg-gray-100 text-gray-800',        /* 默认 - 灰色 */
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeStyles[type]} ${className}`}
    >
      {status}
    </span>
  );
};

/* ========================================
 * 六、SearchInput 搜索输入框组件
 * ======================================== */

/** SearchInput 组件属性 */
interface SearchInputProps {
  /** 搜索值 */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 占位提示文字 */
  placeholder?: string;
  /** 搜索触发回调（按下回车或点击搜索按钮时触发） */
  onSearch?: (value: string) => void;
  /** 是否显示清除按钮 */
  clearable?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 搜索输入框组件
 * 带搜索图标和可选清除按钮的输入框
 * 支持回车触发搜索
 */
const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = '搜索...',
  onSearch,
  clearable = true,
  className = '',
}) => {
  /**
   * 处理键盘按下事件
   * 回车键触发搜索
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  /**
   * 处理清除按钮点击
   */
  const handleClear = () => {
    onChange('');
    if (onSearch) onSearch('');
  };

  return (
    <div className={`relative ${className}`}>
      {/* 搜索图标 */}
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />

      {/* 输入框 */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input pl-9 pr-9"
      />

      {/* 清除按钮 */}
      {clearable && value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

/* ========================================
 * 导出所有组件和工具函数
 * ======================================== */
export {
  Pagination,
  EmptyState,
  ConfirmDialog,
  StatusBadge,
  SearchInput,
};
