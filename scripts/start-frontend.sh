#!/bin/bash

# WordPecker 前端服务启动脚本
# 用于在 Sealos devbox 环境中启动前端服务

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# 获取脚本所在目录的父目录（项目根目录）
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

log_info "WordPecker 前端服务启动脚本"
log_info "项目根目录: $PROJECT_ROOT"
log_info "前端目录: $FRONTEND_DIR"

# 检查前端目录是否存在
if [ ! -d "$FRONTEND_DIR" ]; then
    log_error "前端目录不存在: $FRONTEND_DIR"
    exit 1
fi

# 切换到前端目录
cd "$FRONTEND_DIR"

# 检查 package.json 是否存在
if [ ! -f "package.json" ]; then
    log_error "package.json 文件不存在"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    log_warning ".env 文件不存在，将使用默认配置"
    if [ -f ".env.example" ]; then
        log_info "发现 .env.example 文件，建议复制并配置"
        log_info "运行: cp .env.example .env"
    fi
fi

# 检查 Node.js 版本
log_info "检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    log_error "Node.js 未安装"
    exit 1
fi

NODE_VERSION=$(node --version)
log_info "Node.js 版本: $NODE_VERSION"

# 检查 npm 版本
if ! command -v npm &> /dev/null; then
    log_error "npm 未安装"
    exit 1
fi

NPM_VERSION=$(npm --version)
log_info "npm 版本: $NPM_VERSION"

# 安装依赖
log_info "检查并安装依赖..."
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    log_info "安装 npm 依赖..."
    npm install
    if [ $? -eq 0 ]; then
        log_success "依赖安装完成"
    else
        log_error "依赖安装失败"
        exit 1
    fi
else
    log_info "依赖已是最新版本"
fi

# 检查后端服务连接
log_info "检查后端服务连接..."
BACKEND_URL="${VITE_API_URL:-http://localhost:3000}"
log_info "后端服务地址: $BACKEND_URL"

# 简单的后端健康检查
if command -v curl &> /dev/null; then
    if curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1; then
        log_success "后端服务连接正常"
    else
        log_warning "无法连接到后端服务，请确保后端服务已启动"
        log_info "后端启动命令: ./scripts/start-backend.sh"
    fi
else
    log_warning "curl 未安装，跳过后端连接检查"
fi

# 启动服务
log_info "启动前端服务..."
log_info "服务将监听端口: ${PORT:-5173}"
log_info "开发服务器将监听所有网络接口 (0.0.0.0)"

# 创建日志目录
mkdir -p logs

# 启动服务并记录日志
log_success "前端服务启动中..."
log_info "日志文件: logs/frontend.log"
log_info "使用 Ctrl+C 停止服务"
log_info "访问地址:"
log_info "  - 本地: http://localhost:5173"
log_info "  - 内网: http://10.108.38.66:5173"
log_info "  - 公网: http://101.126.5.123:5173"

# 启动 Vite 开发服务器，监听所有网络接口
npm run dev -- --host 0.0.0.0 --port 5173 2>&1 | tee logs/frontend.log