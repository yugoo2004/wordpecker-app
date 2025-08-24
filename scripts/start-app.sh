#!/bin/bash

# WordPecker 完整应用启动脚本
# 用于在 Sealos devbox 环境中启动完整的应用栈

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
log_header "WordPecker 完整应用启动脚本"
log_header "=========================================="
log_info "项目根目录: $PROJECT_ROOT"

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 检查必要的目录
if [ ! -d "backend" ]; then
    log_error "后端目录不存在"
    exit 1
fi

if [ ! -d "frontend" ]; then
    log_error "前端目录不存在"
    exit 1
fi

if [ ! -d "scripts" ]; then
    log_error "脚本目录不存在"
    exit 1
fi

# 检查启动脚本是否存在
if [ ! -f "scripts/start-backend.sh" ]; then
    log_error "后端启动脚本不存在: scripts/start-backend.sh"
    exit 1
fi

if [ ! -f "scripts/start-frontend.sh" ]; then
    log_error "前端启动脚本不存在: scripts/start-frontend.sh"
    exit 1
fi

# 确保脚本有执行权限
chmod +x scripts/start-backend.sh
chmod +x scripts/start-frontend.sh

# 创建日志目录
mkdir -p logs

# 检查是否已有服务在运行
log_info "检查现有服务..."

# 检查后端端口
if lsof -i :3000 > /dev/null 2>&1; then
    log_warning "端口 3000 已被占用，可能有后端服务正在运行"
    log_info "如需重启，请先运行: ./scripts/stop-app.sh"
fi

# 检查前端端口
if lsof -i :5173 > /dev/null 2>&1; then
    log_warning "端口 5173 已被占用，可能有前端服务正在运行"
    log_info "如需重启，请先运行: ./scripts/stop-app.sh"
fi

# 环境检查
log_info "环境检查..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js 未安装"
    exit 1
fi
log_info "Node.js 版本: $(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    log_error "npm 未安装"
    exit 1
fi
log_info "npm 版本: $(npm --version)"

# 检查环境变量文件
log_info "检查环境变量配置..."

if [ ! -f "backend/.env" ]; then
    log_warning "后端 .env 文件不存在"
    if [ -f "backend/.env.example" ]; then
        log_info "建议复制示例配置: cp backend/.env.example backend/.env"
    fi
fi

if [ ! -f "frontend/.env" ]; then
    log_warning "前端 .env 文件不存在"
    if [ -f "frontend/.env.example" ]; then
        log_info "建议复制示例配置: cp frontend/.env.example frontend/.env"
    fi
fi

# 数据库连接检查
log_info "检查数据库连接..."
if [ -f "backend/src/scripts/testMongoConnection.ts" ]; then
    cd backend
    if npx ts-node src/scripts/testMongoConnection.ts > /dev/null 2>&1; then
        log_success "数据库连接正常"
    else
        log_warning "数据库连接失败，请检查 MongoDB 配置"
        log_info "确保 Sealos MongoDB 服务正在运行"
    fi
    cd "$PROJECT_ROOT"
fi

# 启动选项
log_header "启动选项:"
echo "1. 启动完整应用 (后端 + 前端)"
echo "2. 仅启动后端服务"
echo "3. 仅启动前端服务"
echo "4. 后台启动完整应用"
echo "5. 退出"

# 如果有命令行参数，直接使用
if [ $# -gt 0 ]; then
    CHOICE=$1
else
    read -p "请选择启动选项 (1-5): " CHOICE
fi

case $CHOICE in
    1)
        log_header "启动完整应用..."
        log_info "将在前台启动后端和前端服务"
        log_info "使用 Ctrl+C 停止所有服务"
        
        # 启动后端服务（后台）
        log_info "启动后端服务..."
        ./scripts/start-backend.sh > logs/backend.log 2>&1 &
        BACKEND_PID=$!
        echo $BACKEND_PID > logs/backend.pid
        
        # 等待后端启动
        sleep 5
        
        # 检查后端是否启动成功
        if kill -0 $BACKEND_PID 2>/dev/null; then
            log_success "后端服务启动成功 (PID: $BACKEND_PID)"
        else
            log_error "后端服务启动失败"
            exit 1
        fi
        
        # 启动前端服务（前台）
        log_info "启动前端服务..."
        ./scripts/start-frontend.sh
        ;;
        
    2)
        log_header "仅启动后端服务..."
        ./scripts/start-backend.sh
        ;;
        
    3)
        log_header "仅启动前端服务..."
        ./scripts/start-frontend.sh
        ;;
        
    4)
        log_header "后台启动完整应用..."
        
        # 启动后端服务（后台）
        log_info "后台启动后端服务..."
        nohup ./scripts/start-backend.sh > logs/backend.log 2>&1 &
        BACKEND_PID=$!
        echo $BACKEND_PID > logs/backend.pid
        log_success "后端服务已启动 (PID: $BACKEND_PID)"
        
        # 等待后端启动
        sleep 5
        
        # 启动前端服务（后台）
        log_info "后台启动前端服务..."
        nohup ./scripts/start-frontend.sh > logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        echo $FRONTEND_PID > logs/frontend.pid
        log_success "前端服务已启动 (PID: $FRONTEND_PID)"
        
        log_header "服务启动完成！"
        log_info "后端服务: http://localhost:3000 (PID: $BACKEND_PID)"
        log_info "前端服务: http://localhost:5173 (PID: $FRONTEND_PID)"
        log_info "公网访问: http://101.126.5.123:5173"
        log_info "日志文件: logs/backend.log, logs/frontend.log"
        log_info "停止服务: ./scripts/stop-app.sh"
        ;;
        
    5)
        log_info "退出启动脚本"
        exit 0
        ;;
        
    *)
        log_error "无效选项: $CHOICE"
        exit 1
        ;;
esac