#!/bin/bash

# WordPecker 后端服务启动脚本
# 用于在 Sealos devbox 环境中启动后端服务

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
BACKEND_DIR="$PROJECT_ROOT/backend"

log_info "WordPecker 后端服务启动脚本"
log_info "项目根目录: $PROJECT_ROOT"
log_info "后端目录: $BACKEND_DIR"

# 检查后端目录是否存在
if [ ! -d "$BACKEND_DIR" ]; then
    log_error "后端目录不存在: $BACKEND_DIR"
    exit 1
fi

# 切换到后端目录
cd "$BACKEND_DIR"

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

# 构建项目
log_info "构建 TypeScript 项目..."
npm run build
if [ $? -eq 0 ]; then
    log_success "项目构建完成"
else
    log_error "项目构建失败"
    exit 1
fi

# 检查数据库连接
log_info "检查数据库连接..."
if [ -f "src/scripts/testMongoConnection.ts" ]; then
    npx ts-node src/scripts/testMongoConnection.ts
    if [ $? -ne 0 ]; then
        log_warning "数据库连接测试失败，但继续启动服务"
    fi
fi

# 启动服务
log_info "启动后端服务..."
log_info "服务将监听端口: ${PORT:-3000}"
log_info "环境: ${NODE_ENV:-development}"

# 创建日志目录
mkdir -p logs

# 启动服务并记录日志
log_success "后端服务启动中..."
log_info "日志文件: logs/backend.log"
log_info "使用 Ctrl+C 停止服务"

# 启动服务
npm start 2>&1 | tee logs/backend.log