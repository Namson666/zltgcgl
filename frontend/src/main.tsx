/**
 * 资料通工程管理系统 - React 应用入口文件
 *
 * 功能说明：
 * 1. 导入全局样式文件
 * 2. 渲染根组件 App 到 DOM
 * 3. 包裹 BrowserRouter 实现客户端路由
 * 4. 包裹 Toaster 提供全局消息提示（react-hot-toast）
 *
 * 技术栈：React 19 + TypeScript + React Router v7 + react-hot-toast
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

/* 导入全局样式 */
import './styles/index.css';

/* 导入根组件 */
import App from './App';

/**
 * 创建 React 根节点并渲染应用
 * - StrictMode：启用严格模式，帮助发现潜在问题
 * - BrowserRouter：客户端路由，支持 HTML5 History API
 * - Toaster：全局消息提示配置
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* 全局消息提示组件配置 */}
      <Toaster
        position="top-right"           /* 消息显示位置：右上角 */
        gutter={12}                    /* 消息间距 */
        containerStyle={{
          top: 80,                     /* 容器顶部偏移，避免遮挡导航栏 */
          pointerEvents: 'none',       /* 提示层不拦截页面按钮点击 */
        }}
        toastOptions={{
          duration: 3000,              /* 默认显示时长：3秒 */
          style: {
            background: 'var(--card)',  /* 白色背景 */
            color: 'var(--foreground)', /* 深色文字 */
            borderRadius: 'var(--radius-lg)', /* 8px 圆角 */
            fontSize: '14px',          /* 字体大小 */
            boxShadow: 'var(--shadow-lg)', /* 阴影效果 */
            /* 如果未来增加“撤销/查看”等可点击 toast，需要对该自定义内容单独恢复 pointer-events */
            pointerEvents: 'none',     /* 单条提示也不拦截点击 */
          },
          /* 成功消息样式 */
          success: {
            iconTheme: {
              primary: 'var(--primary)', /* 主题蓝色图标 */
              secondary: 'var(--primary-foreground)',
            },
          },
          /* 错误消息样式 */
          error: {
            iconTheme: {
              primary: 'var(--destructive)',  /* 红色错误图标 */
              secondary: 'var(--destructive-foreground)',
            },
          },
        }}
      />
      {/* 应用根组件 */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
