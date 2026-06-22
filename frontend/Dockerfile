# ============================================
# 资料通工程管理系统 - 前端 Dockerfile
# ============================================
# 多阶段构建：安装依赖 → Vite 构建 → Nginx 部署

# 阶段1：安装依赖并构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# 阶段2：Nginx 部署
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

# 复制构建产物
COPY --from=builder /app/dist ./

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制上传文件目录（如果需要直接访问）
# COPY --from=builder /app/uploads ./uploads

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
