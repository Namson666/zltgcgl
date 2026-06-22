// ============================================
// 资料通工程管理系统 - 后端入口文件
// ============================================
// 启动 Express 服务器，连接数据库
// 最后更新：2026-04-24

import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量（从项目根目录的 .env 文件）
dotenv.config({ path: path.join(__dirname, '../.env') });

import app from './app';

// 服务器端口
const PORT = parseInt(process.env.PORT || '4001', 10);

// 启动服务器
app.listen(PORT, () => {
  console.log('========================================');
  console.log('  资料通工程管理系统 - 后端服务');
  console.log('========================================');
  console.log(`  环境：${process.env.NODE_ENV || 'development'}`);
  console.log(`  端口：${PORT}`);
  console.log(`  地址：http://localhost:${PORT}`);
  console.log(`  API：http://localhost:${PORT}/api`);
  console.log('========================================');
});

// 优雅退出
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});
