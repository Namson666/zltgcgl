#!/bin/bash
# ===========================================
# 资料通工程管理系统 - GitHub 自动备份脚本
# 使用方式: ./scripts/backup.sh [commit_message]
# ===========================================

set -e

# 配置
PROJECT_DIR="/Users/Namson/Documents/Claude code/资料通工程管理系统"
REMOTE_NAME="origin"
REMOTE_BRANCH="main"
GITHUB_REPO="git@github.com:Namson666/ziliaotong-backup.git"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$PROJECT_DIR"

# 检查git远程
if ! git remote get-url $REMOTE_NAME &>/dev/null; then
    log_info "添加GitHub远程仓库..."
    git remote add $REMOTE_NAME "$GITHUB_REPO"
fi

# 获取远程最新代码
log_info "拉取远程最新代码..."
git pull $REMOTE_NAME $REMOTE_BRANCH --rebase || true

# 添加所有更改
log_info "暂存所有更改..."
git add -A

# 检查是否有更改
if git diff --cached --quiet; then
    log_warn "没有检测到更改，跳过提交"
    exit 0
fi

# 获取提交消息
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
else
    COMMIT_MSG="备份 $(date '+%Y-%m-%d %H:%M:%S')"
fi

# 提交
log_info "提交更改: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

# 推送到GitHub
log_info "推送到GitHub..."
git push $REMOTE_NAME $REMOTE_BRANCH

log_info "✅ 备份完成!"

# 显示提交历史
echo ""
echo "最近5次提交:"
git log --oneline -5
