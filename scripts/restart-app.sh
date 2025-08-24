#!/bin/bash

# WordPecker 应用重启脚本
# 用于重启在 Sealos devbox 环境中运行的服务

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}[HEADER]${NC} $1"
}

# 获取脚本所在目录的父目录（项目根目录）
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log_header "=========================================="
log_header "WordPecker 应用重启脚本"
log_header "=========================================="
log_info "项目根目录: $PROJECT_ROOT"

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 检查必要的脚本是否存在
if [ ! -f "scripts/stop-app.sh" ]; then
    log_error "停止脚本不存在: scripts/stop-app.sh"
    exit 1
fi

if [ ! -f "scripts/start-app.sh" ]; then
    log_error "启动脚本不存在: scripts/start-app.sh"
    exit 1
fi

# 确保脚本有执行权限
chmod +x scripts/stop-app.sh
chmod +x scripts/start-app.sh

# 重启选项
log_header "重启选项:"
echo "1. 重启完整应用 (停止所有服务后重新启动)"
echo "2. 重启后端服务"
echo "3. 重启前端服务"
echo "4. 后台重启完整应用"
echo "5. 快速重启 (仅重启，不完全停止)"
echo "6. 退出"

# 如果有命令行参数，直接使用
if [ $# -gt 0 ]; then
    CHOICE=$1
else
    read -p "请选择重启选项 (1-6): " CHOICE
fi

case $CHOICE in
    1)
        log_header "重启完整应用..."
        
        # 停止所有服务
        log_info "停止现有服务..."
        ./scripts/stop-app.sh
        
        # 等待服务完全停止
        log_info "等待服务完全停止..."
        sleep 3
        
        # 启动完整应用
        log_info "启动完整应用..."
        ./scripts/start-app.sh 1
        ;;
        
    2)
        log_header "重启后端服务..."
        
        # 停止后端服务
        log_info "停止后端服务..."
        if lsof -i :3000 > /dev/null 2>&1; then
            local pids=$(lsof -ti :3000)
            for pid in $pids; do
                kill "$pid" 2>/dev/null || true
            done
            sleep 2
        fi
        
        # 启动后端服务
        log_info "启动后端服务..."
        ./scripts/start-app.sh 2
        ;;
        
    3)
        log_header "重启前端服务..."
        
        # 停止前端服务
        log_info "停止前端服务..."
        if lsof -i :5173 > /dev/null 2>&1; then
            local pids=$(lsof -ti :5173)
            for pid in $pids; do
                kill "$pid" 2>/dev/null || true
            done
            sleep 2
        fi
        
        # 启动前端服务
        log_info "启动前端服务..."
        ./scripts/start-app.sh 3
        ;;
        
    4)
        log_header "后台重启完整应用..."
        
        # 停止所有服务
        log_info "停止现有服务..."
        ./scripts/stop-app.sh
        
        # 等待服务完全停止
        log_info "等待服务完全停止..."
        sleep 3
        
        # 后台启动完整应用
        log_info "后台启动完整应用..."
        ./scripts/start-app.sh 4
        ;;
        
    5)
        log_header "快速重启..."
        log_warning "快速重启可能不会完全清理所有进程"
        
        # 快速停止主要端口的服务
        if lsof -i :3000 > /dev/null 2>&1; then
            log_info "快速停止后端服务..."
            pkill -f "node.*3000\|npm.*start" 2>/dev/null || true
        fi
        
        if lsof -i :5173 > /dev/null 2>&1; then
            log_info "快速停止前端服务..."
            pkill -f "vite\|npm.*dev" 2>/dev/null || true
        fi
        
        # 短暂等待
        sleep 1
        
        # 启动服务
        log_info "快速启动服务..."
        ./scripts/start-app.sh 4
        ;;
        
    6)
        log_info "退出重启脚本"
        exit 0
        ;;
        
    *)
        log_error "无效选项: $CHOICE"
        exit 1
        ;;
esac

log_header "重启完成！"
log_info "服务状态检查:"

# 检查服务状态
if lsof -i :3000 > /dev/null 2>&1; then
    log_success "后端服务正在运行 (端口 3000)"
else
    log_warning "后端服务未运行"
fi

if lsof -i :5173 > /dev/null 2>&1; then
    log_success "前端服务正在运行 (端口 5173)"
else
    log_warning "前端服务未运行"
fi

log_info "访问地址:"
log_info "  - 前端: http://localhost:5173"
log_info "  - 后端: http://localhost:3000"
log_info "  - 公网: http://101.126.5.123:5173"