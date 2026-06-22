# ============================================
# 资料通工程管理系统 - 后端 Dockerfile
# ============================================
# 多阶段构建：安装依赖 → 编译 TypeScript → 运行

# 阶段1：安装依赖
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_modules && \
    npm ci

# 阶段2：编译 TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && \
    npx tsc

# 阶段3：生产运行
FROM node:20-alpine AS runner
WORKDIR /app

# 安装 Prisma CLI（用于 migrate deploy）
COPY --from=deps /prod_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 复制编译产物和必要文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# 创建上传目录
RUN mkdir -p /app/uploads

EXPOSE 4001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
