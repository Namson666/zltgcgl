#!/bin/bash
# ===========================================
# 资料通工程管理系统 - GitHub 回滚脚本
# 使用方式: ./scripts/restore.sh [commit_hash]
# 不带参数则显示提交历史供选择
# ===========================================

set -e

# 配置
PROJECT_DIR="/Users/Namson/Documents/Claude code/资料通工程管理系统"
REMOTE_NAME="origin"
REMOTE_BRANCH="main"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$PROJECT_DIR"

# 如果没有指定commit hash，显示历史供选择
if [ -z "$1" ]; then
    echo ""
    log_info "可用提交历史 (最近10次):"
    echo ""
    git log --oneline -10
    echo ""
    echo "使用方法: $0 <commit_hash>"
    echo "例如:    $0 $(git log --oneline -1 | cut -d' ' -f1)"
    exit 0
fi

COMMIT_HASH="$1"

log_warn "即将回滚到: $COMMIT_HASH"
log_warn "按 Ctrl+C 取消，或按 Enter 继续..."
read

# 回滚到指定commit
log_info "回滚到 $COMMIT_HASH ..."
git reset --hard "$COMMIT_HASH"

log_info "推送到远程..."
git push -f $REMOTE_NAME $REMOTE_BRANCH

log_info "✅ 回滚完成!"
log_info "当前版本: $(git log --oneline -1)"
