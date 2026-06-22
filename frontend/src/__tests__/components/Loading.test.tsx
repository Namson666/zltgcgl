// ============================================
// Loading 组件渲染测试
// ============================================
// 测试 Loading, LoadingInline, LoadingSpinner 三个组件的基础渲染
// ============================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Loading, LoadingInline, LoadingSpinner } from '../../components/ui/Loading';

// ---------------------------------------------------------------------------
// Loading 组件测试 (全屏/居中)
// ---------------------------------------------------------------------------

describe('Loading', () => {
  it('renders with default text', () => {
    render(<Loading />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    render(<Loading text="数据加载中，请稍候..." />);
    expect(screen.getByText('数据加载中，请稍候...')).toBeInTheDocument();
  });

  it('renders loading icon', () => {
    render(<Loading />);
    // lucide-react Loader2 renders as an SVG
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('animate-spin');
  });

  it('applies fullScreen class when fullScreen=true', () => {
    render(<Loading fullScreen />);
    const container = screen.getByText('加载中...').parentElement;
    expect(container).toBeInTheDocument();
    expect(container?.className).toContain('fixed');
    expect(container?.className).toContain('inset-0');
  });

  it('does not apply fixed positioning when fullScreen=false', () => {
    render(<Loading fullScreen={false} />);
    const container = screen.getByText('加载中...').parentElement;
    expect(container?.className).toContain('py-20');
  });
});

// ---------------------------------------------------------------------------
// LoadingInline 组件测试
// ---------------------------------------------------------------------------

describe('LoadingInline', () => {
  it('renders with default text', () => {
    render(<LoadingInline />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    render(<LoadingInline text="正在获取数据..." />);
    expect(screen.getByText('正在获取数据...')).toBeInTheDocument();
  });

  it('renders a spinning icon', () => {
    render(<LoadingInline />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('animate-spin');
  });
});

// ---------------------------------------------------------------------------
// LoadingSpinner 组件测试
// ---------------------------------------------------------------------------

describe('LoadingSpinner', () => {
  it('renders without text (icon only)', () => {
    render(<LoadingSpinner />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('animate-spin');
  });

  it('applies custom className', () => {
    render(<LoadingSpinner className="text-red-500" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveClass('text-red-500');
  });

  it('has default blue-600 class', () => {
    render(<LoadingSpinner />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveClass('text-blue-600');
  });
});
