#!/bin/bash
# ============================================
# 资料通工程管理系统 - 本地开发一键启动脚本
# ============================================
# 使用方法：chmod +x start-dev.sh && ./start-dev.sh

set -e

echo "========================================"
echo "  资料通工程管理系统 - 本地开发环境"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误：未检测到 Node.js，请先安装 Node.js >= 18${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 版本：$(node -v)${NC}"

# 检查 PostgreSQL（通过 Docker 或本地）
check_postgres() {
    # 尝试连接 PostgreSQL
    if docker ps | grep -q zlt_postgres; then
        echo -e "${GREEN}✓ PostgreSQL (Docker) 已运行${NC}"
        return 0
    elif pg_isready -h localhost -p 5432 -U zlt_user &> /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL (本地) 已运行${NC}"
        return 0
    else
        return 1
    fi
}

if ! check_postgres; then
    echo -e "${YELLOW}PostgreSQL 未运行，正在启动 Docker 容器...${NC}"
    docker run -d \
        --name zlt_postgres \
        -e POSTGRES_USER=zlt_user \
        -e POSTGRES_PASSWORD=Zlt_password_2024 \
        -e POSTGRES_DB=zlt_management \
        -p 5432:5432 \
        postgres:15-alpine

    # 等待 PostgreSQL 启动
    echo -e "${YELLOW}等待 PostgreSQL 启动...${NC}"
    sleep 5
fi

# 安装后端依赖
echo ""
echo -e "${YELLOW}安装后端依赖...${NC}"
cd backend
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✓ 后端依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ 后端依赖已存在${NC}"
fi

# 生成 Prisma Client
echo -e "${YELLOW}生成 Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma Client 生成完成${NC}"

# 同步数据库结构
echo -e "${YELLOW}同步数据库结构...${NC}"
npx prisma db push
echo -e "${GREEN}✓ 数据库结构同步完成${NC}"

# 导入种子数据（如果数据库为空）
echo -e "${YELLOW}检查种子数据...${NC}"
cd ..
if [ -f "backend/prisma/seed.ts" ]; then
    cd backend
    npx ts-node prisma/seed.ts 2>/dev/null && echo -e "${GREEN}✓ 种子数据导入完成${NC}" || echo -e "${YELLOW}种子数据已存在或导入跳过${NC}"
    cd ..
fi

# 安装前端依赖
echo ""
echo -e "${YELLOW}安装前端依赖...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✓ 前端依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ 前端依赖已存在${NC}"
fi
cd ..

# 创建上传目录
mkdir -p uploads

echo ""
echo "========================================"
echo -e "${GREEN}  开发环境准备完成！${NC}"
echo "========================================"
echo ""
echo "后端地址：http://localhost:4001"
echo "前端地址：http://localhost:5173"
echo "数据库：  postgresql://zlt_user:Zlt_password_2024@localhost:5432/zlt_management"
echo ""
echo "启动命令："
echo "  后端：cd backend && npm run dev"
echo "  前端：cd frontend && npm run dev"
echo ""
