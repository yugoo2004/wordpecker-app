#!/bin/bash

# WordPecker PM2 启动脚本
# 使用 PM2 进程管理器启动和管理应用服务

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
log_header "WordPecker PM2 启动脚本"
log_header "=========================================="
log_info "项目根目录: $PROJECT_ROOT"

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 未安装，正在安装..."
    
    # 检查 npm 是否可用
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装，无法安装 PM2"
        exit 1
    fi
    
    # 全局安装 PM2
    log_info "全局安装 PM2..."
    npm install -g pm2
    
    if [ $? -eq 0 ]; then
        log_success "PM2 安装完成"
    else
        log_error "PM2 安装失败"
        exit 1
    fi
fi

# 显示 PM2 版本
PM2_VERSION=$(pm2 --version)
log_info "PM2 版本: $PM2_VERSION"

# 检查配置文件是否存在
if [ ! -f "ecosystem.config.js" ]; then
    log_error "PM2 配置文件不存在: ecosystem.config.js"
    exit 1
fi

# 创建日志目录
mkdir -p logs

# 检查现有的 PM2 进程
log_info "检查现有的 PM2 进程..."
pm2 list

# 启动选项
log_header "PM2 启动选项:"
echo "1. 启动完整应用 (后端 + 前端开发模式)"
echo "2. 启动完整应用 (后端 + 前端生产预览)"
echo "3. 仅启动后端服务"
echo "4. 仅启动前端服务 (开发模式)"
echo "5. 仅启动前端服务 (生产预览)"
echo "6. 重启所有服务"
echo "7. 停止所有服务"
echo "8. 查看服务状态"
echo "9. 查看日志"
echo "10. 退出"

# 如果有命令行参数，直接使用
if [ $# -gt 0 ]; then
    CHOICE=$1
else
    read -p "请选择启动选项 (1-10): " CHOICE
fi

case $CHOICE in
    1)
        log_header "启动完整应用 (开发模式)..."
        
        # 停止可能存在的进程
        pm2 delete wordpecker-backend 2>/dev/null || true
        pm2 delete wordpecker-frontend-dev 2>/dev/null || true
        pm2 delete wordpecker-frontend-preview 2>/dev/null || true
        
        # 启动后端
        log_info "启动后端服务..."
        pm2 start ecosystem.config.js --only wordpecker-backend
        
        # 等待后端启动
        sleep 3
        
        # 启动前端（开发模式）
        log_info "启动前端服务 (开发模式)..."
        pm2 start ecosystem.config.js --only wordpecker-frontend-dev
        
        log_success "完整应用启动完成 (开发模式)"
        ;;
        
    2)
        log_header "启动完整应用 (生产预览)..."
        
        # 停止可能存在的进程
        pm2 delete wordpecker-backend 2>/dev/null || true
        pm2 delete wordpecker-frontend-dev 2>/dev/null || true
        pm2 delete wordpecker-frontend-preview 2>/dev/null || true
        
        # 构建前端
        log_info "构建前端应用..."
        cd frontend
        npm run build
        cd "$PROJECT_ROOT"
        
        # 启动后端
        log_info "启动后端服务..."
        pm2 start ecosystem.config.js --only wordpecker-backend
        
        # 等待后端启动
        sleep 3
        
        # 启动前端（生产预览）
        log_info "启动前端服务 (生产预览)..."
        pm2 start ecosystem.config.js --only wordpecker-frontend-preview
        
        log_success "完整应用启动完成 (生产预览)"
        ;;
        
    3)
        log_header "仅启动后端服务..."
        pm2 delete wordpecker-backend 2>/dev/null || true
        pm2 start ecosystem.config.js --only wordpecker-backend
        log_success "后端服务启动完成"
        ;;
        
    4)
        log_header "仅启动前端服务 (开发模式)..."
        pm2 delete wordpecker-frontend-dev 2>/dev/null || true
        pm2 delete wordpecker-frontend-preview 2>/dev/null || true
        pm2 start ecosystem.config.js --only wordpecker-frontend-dev
        log_success "前端服务启动完成 (开发模式)"
        ;;
        
    5)
        log_header "仅启动前端服务 (生产预览)..."
        
        # 构建前端
        log_info "构建前端应用..."
        cd frontend
        npm run build
        cd "$PROJECT_ROOT"
        
        pm2 delete wordpecker-frontend-dev 2>/dev/null || true
        pm2 delete wordpecker-frontend-preview 2>/dev/null || true
        pm2 start ecosystem.config.js --only wordpecker-frontend-preview
        log_success "前端服务启动完成 (生产预览)"
        ;;
        
    6)
        log_header "重启所有服务..."
        pm2 restart all
        log_success "所有服务重启完成"
        ;;
        
    7)
        log_header "停止所有服务..."
        pm2 stop all
        log_success "所有服务已停止"
        ;;
        
    8)
        log_header "查看服务状态..."
        pm2 list
        pm2 monit
        ;;
        
    9)
        log_header "查看日志..."
        echo "选择要查看的日志:"
        echo "1. 所有日志"
        echo "2. 后端日志"
        echo "3. 前端日志"
        read -p "请选择 (1-3): " LOG_CHOICE
        
        case $LOG_CHOICE in
            1) pm2 logs ;;
            2) pm2 logs wordpecker-backend ;;
            3) pm2 logs wordpecker-frontend-dev wordpecker-frontend-preview ;;
            *) log_error "无效选项" ;;
        esac
        ;;
        
    10)
        log_info "退出 PM2 管理脚本"
        exit 0
        ;;
        
    *)
        log_error "无效选项: $CHOICE"
        exit 1
        ;;
esac

# 显示最终状态
log_header "当前 PM2 进程状态:"
pm2 list

log_header "访问地址:"
log_info "  - 前端: http://localhost:5173"
log_info "  - 后端: http://localhost:3000"
log_info "  - 公网: http://101.126.5.123:5173"

log_header "PM2 管理命令:"
log_info "  - 查看状态: pm2 list"
log_info "  - 查看日志: pm2 logs"
log_info "  - 监控面板: pm2 monit"
log_info "  - 重启服务: pm2 restart <app-name>"
log_info "  - 停止服务: pm2 stop <app-name>"
log_info "  - 删除服务: pm2 delete <app-name>"