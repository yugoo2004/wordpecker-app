#!/bin/bash

# WordPecker PM2 停止脚本
# 使用 PM2 进程管理器停止应用服务

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
log_header "WordPecker PM2 停止脚本"
log_header "=========================================="
log_info "项目根目录: $PROJECT_ROOT"

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    log_error "PM2 未安装"
    exit 1
fi

# 显示当前 PM2 进程状态
log_info "当前 PM2 进程状态:"
pm2 list

# 停止选项
log_header "PM2 停止选项:"
echo "1. 停止所有 WordPecker 服务"
echo "2. 停止后端服务"
echo "3. 停止前端服务"
echo "4. 停止并删除所有服务"
echo "5. 重启所有服务"
echo "6. 查看服务状态"
echo "7. 退出"

# 如果有命令行参数，直接使用
if [ $# -gt 0 ]; then
    CHOICE=$1
else
    read -p "请选择停止选项 (1-7): " CHOICE
fi

case $CHOICE in
    1)
        log_header "停止所有 WordPecker 服务..."
        
        # 停止所有相关服务
        pm2 stop wordpecker-backend 2>/dev/null || log_warning "后端服务未运行"
        pm2 stop wordpecker-frontend-dev 2>/dev/null || log_warning "前端开发服务未运行"
        pm2 stop wordpecker-frontend-preview 2>/dev/null || log_warning "前端预览服务未运行"
        
        log_success "所有 WordPecker 服务已停止"
        ;;
        
    2)
        log_header "停止后端服务..."
        pm2 stop wordpecker-backend 2>/dev/null || log_warning "后端服务未运行"
        log_success "后端服务已停止"
        ;;
        
    3)
        log_header "停止前端服务..."
        pm2 stop wordpecker-frontend-dev 2>/dev/null || log_warning "前端开发服务未运行"
        pm2 stop wordpecker-frontend-preview 2>/dev/null || log_warning "前端预览服务未运行"
        log_success "前端服务已停止"
        ;;
        
    4)
        log_header "停止并删除所有服务..."
        
        # 停止并删除所有相关服务
        pm2 delete wordpecker-backend 2>/dev/null || log_warning "后端服务未运行"
        pm2 delete wordpecker-frontend-dev 2>/dev/null || log_warning "前端开发服务未运行"
        pm2 delete wordpecker-frontend-preview 2>/dev/null || log_warning "前端预览服务未运行"
        
        log_success "所有 WordPecker 服务已停止并删除"
        ;;
        
    5)
        log_header "重启所有服务..."
        
        # 重启所有相关服务
        pm2 restart wordpecker-backend 2>/dev/null || log_warning "后端服务未运行"
        pm2 restart wordpecker-frontend-dev 2>/dev/null || log_warning "前端开发服务未运行"
        pm2 restart wordpecker-frontend-preview 2>/dev/null || log_warning "前端预览服务未运行"
        
        log_success "所有服务重启完成"
        ;;
        
    6)
        log_header "查看服务状态..."
        pm2 list
        
        # 显示详细信息
        echo ""
        log_info "详细服务信息:"
        pm2 show wordpecker-backend 2>/dev/null || log_info "后端服务未运行"
        pm2 show wordpecker-frontend-dev 2>/dev/null || log_info "前端开发服务未运行"
        pm2 show wordpecker-frontend-preview 2>/dev/null || log_info "前端预览服务未运行"
        ;;
        
    7)
        log_info "退出 PM2 停止脚本"
        exit 0
        ;;
        
    *)
        log_error "无效选项: $CHOICE"
        exit 1
        ;;
esac

# 显示最终状态
echo ""
log_header "操作完成后的 PM2 进程状态:"
pm2 list

# 检查端口占用情况
log_header "端口占用检查:"
if lsof -i :3000 > /dev/null 2>&1; then
    log_warning "端口 3000 仍被占用"
else
    log_success "端口 3000 已释放"
fi

if lsof -i :5173 > /dev/null 2>&1; then
    log_warning "端口 5173 仍被占用"
else
    log_success "端口 5173 已释放"
fi

log_header "PM2 管理命令提醒:"
log_info "  - 启动服务: ./scripts/pm2-start.sh"
log_info "  - 查看状态: pm2 list"
log_info "  - 查看日志: pm2 logs"
log_info "  - 监控面板: pm2 monit"