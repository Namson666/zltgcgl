/**
 * 资料通工程管理系统 - 404 页面
 *
 * 功能说明：
 * 当用户访问不存在的路由时显示此页面。
 * 提供返回首页的按钮。
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="text-center">
        {/* 404 大字 */}
        <h1 className="text-8xl font-bold text-gray-200 mb-4">404</h1>
        {/* 提示信息 */}
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">页面不存在</h2>
        <p className="text-gray-500 mb-8">
          您访问的页面不存在或已被移除
        </p>
        {/* 操作按钮 */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            <ArrowLeft size={16} className="mr-2" />
            返回上页
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
          >
            <Home size={16} className="mr-2" />
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
