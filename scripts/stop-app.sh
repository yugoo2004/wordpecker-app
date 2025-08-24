#!/bin/bash

# WordPecker 应用停止脚本
# 用于停止在 Sealos devbox 环境中运行的服务

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
log_header "WordPecker 应用停止脚本"
log_header "=========================================="
log_info "项目根目录: $PROJECT_ROOT"

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 创建日志目录（如果不存在）
mkdir -p logs

# 停止通过 PID 文件记录的进程
stop_service_by_pid() {
    local service_name=$1
    local pid_file=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "停止 $service_name 服务 (PID: $pid)..."
            kill "$pid"
            
            # 等待进程结束
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            if kill -0 "$pid" 2>/dev/null; then
                log_warning "$service_name 服务未能正常停止，强制终止..."
                kill -9 "$pid" 2>/dev/null || true
            fi
            
            log_success "$service_name 服务已停止"
        else
            log_warning "$service_name 服务进程不存在 (PID: $pid)"
        fi
        rm -f "$pid_file"
    else
        log_info "未找到 $service_name 服务的 PID 文件"
    fi
}

# 通过端口停止服务
stop_service_by_port() {
    local service_name=$1
    local port=$2
    
    log_info "检查端口 $port 上的 $service_name 服务..."
    
    # 查找占用端口的进程
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        log_info "发现 $service_name 服务进程: $pids"
        for pid in $pids; do
            log_info "停止进程 $pid..."
            kill "$pid" 2>/dev/null || true
            
            # 等待进程结束
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 5 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            if kill -0 "$pid" 2>/dev/null; then
                log_warning "进程 $pid 未能正常停止，强制终止..."
                kill -9 "$pid" 2>/dev/null || true
            fi
        done
        log_success "$service_name 服务已停止"
    else
        log_info "端口 $port 上没有运行的服务"
    fi
}

# 停止所有相关的 Node.js 进程
stop_nodejs_processes() {
    log_info "查找相关的 Node.js 进程..."
    
    # 查找包含 wordpecker 或相关路径的 Node.js 进程
    local pids=$(pgrep -f "node.*wordpecker\|npm.*start\|npm.*dev\|vite" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        log_info "发现相关 Node.js 进程: $pids"
        for pid in $pids; do
            local cmd=$(ps -p "$pid" -o cmd= 2>/dev/null || echo "未知进程")
            log_info "停止进程 $pid: $cmd"
            kill "$pid" 2>/dev/null || true
        done
        
        # 等待进程结束
        sleep 2
        
        # 检查是否还有进程存在
        local remaining=$(pgrep -f "node.*wordpecker\|npm.*start\|npm.*dev\|vite" 2>/dev/null || true)
        if [ -n "$remaining" ]; then
            log_warning "强制终止剩余进程: $remaining"
            for pid in $remaining; do
                kill -9 "$pid" 2>/dev/null || true
            done
        fi
        
        log_success "Node.js 进程已清理"
    else
        log_info "未发现相关的 Node.js 进程"
    fi
}

# 主停止逻辑
log_header "开始停止服务..."

# 方法1: 通过 PID 文件停止服务
log_info "方法1: 通过 PID 文件停止服务"
stop_service_by_pid "后端" "logs/backend.pid"
stop_service_by_pid "前端" "logs/frontend.pid"

# 方法2: 通过端口停止服务
log_info "方法2: 通过端口停止服务"
stop_service_by_port "后端" "3000"
stop_service_by_port "前端" "5173"

# 方法3: 停止所有相关的 Node.js 进程
log_info "方法3: 清理相关 Node.js 进程"
stop_nodejs_processes

# 清理临时文件
log_info "清理临时文件..."
rm -f logs/*.pid

# 最终检查
log_header "最终检查..."
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

log_header "服务停止完成！"
log_info "如需重新启动服务，请运行: ./scripts/start-app.sh"