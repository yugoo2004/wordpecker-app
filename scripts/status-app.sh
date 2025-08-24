#!/bin/bash

# WordPecker 应用状态检查脚本
# 用于检查在 Sealos devbox 环境中运行的服务状态

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
log_header "WordPecker 应用状态检查"
log_header "=========================================="
log_info "项目根目录: $PROJECT_ROOT"
log_info "检查时间: $(date)"

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 检查端口占用情况
check_port_status() {
    local service_name=$1
    local port=$2
    local expected_url=$3
    
    log_header "检查 $service_name 服务 (端口 $port)"
    
    if lsof -i :$port > /dev/null 2>&1; then
        local pids=$(lsof -ti :$port)
        log_success "$service_name 服务正在运行"
        
        for pid in $pids; do
            local cmd=$(ps -p "$pid" -o cmd= 2>/dev/null || echo "未知进程")
            local user=$(ps -p "$pid" -o user= 2>/dev/null || echo "未知用户")
            local start_time=$(ps -p "$pid" -o lstart= 2>/dev/null || echo "未知时间")
            
            log_info "  PID: $pid"
            log_info "  用户: $user"
            log_info "  启动时间: $start_time"
            log_info "  命令: $cmd"
        done
        
        # 健康检查
        if [ -n "$expected_url" ] && command -v curl &> /dev/null; then
            log_info "  健康检查: $expected_url"
            if curl -s "$expected_url" > /dev/null 2>&1; then
                log_success "  ✓ 服务响应正常"
            else
                log_warning "  ✗ 服务无响应"
            fi
        fi
        
    else
        log_error "$service_name 服务未运行"
    fi
    
    echo ""
}

# 检查 PID 文件
check_pid_files() {
    log_header "检查 PID 文件"
    
    if [ -f "logs/backend.pid" ]; then
        local backend_pid=$(cat logs/backend.pid)
        if kill -0 "$backend_pid" 2>/dev/null; then
            log_success "后端 PID 文件有效: $backend_pid"
        else
            log_warning "后端 PID 文件无效: $backend_pid (进程不存在)"
        fi
    else
        log_info "后端 PID 文件不存在"
    fi
    
    if [ -f "logs/frontend.pid" ]; then
        local frontend_pid=$(cat logs/frontend.pid)
        if kill -0 "$frontend_pid" 2>/dev/null; then
            log_success "前端 PID 文件有效: $frontend_pid"
        else
            log_warning "前端 PID 文件无效: $frontend_pid (进程不存在)"
        fi
    else
        log_info "前端 PID 文件不存在"
    fi
    
    echo ""
}

# 检查日志文件
check_log_files() {
    log_header "检查日志文件"
    
    if [ -f "logs/backend.log" ]; then
        local backend_log_size=$(du -h logs/backend.log | cut -f1)
        local backend_log_lines=$(wc -l < logs/backend.log)
        log_info "后端日志: logs/backend.log ($backend_log_size, $backend_log_lines 行)"
        
        # 显示最后几行日志
        log_info "最近的后端日志:"
        tail -3 logs/backend.log | sed 's/^/    /'
    else
        log_info "后端日志文件不存在"
    fi
    
    if [ -f "logs/frontend.log" ]; then
        local frontend_log_size=$(du -h logs/frontend.log | cut -f1)
        local frontend_log_lines=$(wc -l < logs/frontend.log)
        log_info "前端日志: logs/frontend.log ($frontend_log_size, $frontend_log_lines 行)"
        
        # 显示最后几行日志
        log_info "最近的前端日志:"
        tail -3 logs/frontend.log | sed 's/^/    /'
    else
        log_info "前端日志文件不存在"
    fi
    
    echo ""
}

# 检查环境配置
check_environment() {
    log_header "检查环境配置"
    
    # 检查 Node.js
    if command -v node &> /dev/null; then
        log_success "Node.js: $(node --version)"
    else
        log_error "Node.js 未安装"
    fi
    
    # 检查 npm
    if command -v npm &> /dev/null; then
        log_success "npm: $(npm --version)"
    else
        log_error "npm 未安装"
    fi
    
    # 检查环境变量文件
    if [ -f "backend/.env" ]; then
        log_success "后端环境变量文件存在"
    else
        log_warning "后端环境变量文件不存在"
    fi
    
    if [ -f "frontend/.env" ]; then
        log_success "前端环境变量文件存在"
    else
        log_warning "前端环境变量文件不存在"
    fi
    
    echo ""
}

# 检查数据库连接
check_database() {
    log_header "检查数据库连接"
    
    if [ -f "backend/src/scripts/testMongoConnection.ts" ]; then
        cd backend
        if npx ts-node src/scripts/testMongoConnection.ts > /dev/null 2>&1; then
            log_success "数据库连接正常"
        else
            log_error "数据库连接失败"
        fi
        cd "$PROJECT_ROOT"
    else
        log_info "数据库连接测试脚本不存在"
    fi
    
    echo ""
}

# 检查网络访问
check_network_access() {
    log_header "检查网络访问"
    
    # 内网访问
    log_info "内网地址:"
    log_info "  - 前端: http://10.108.38.66:5173"
    log_info "  - 后端: http://10.108.38.66:3000"
    
    # 公网访问
    log_info "公网地址:"
    log_info "  - 前端: http://101.126.5.123:5173"
    log_info "  - 后端: http://101.126.5.123:3000"
    
    # 本地访问
    log_info "本地地址:"
    log_info "  - 前端: http://localhost:5173"
    log_info "  - 后端: http://localhost:3000"
    
    echo ""
}

# 系统资源使用情况
check_system_resources() {
    log_header "系统资源使用情况"
    
    # CPU 使用率
    if command -v top &> /dev/null; then
        local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
        log_info "CPU 使用率: ${cpu_usage}%"
    fi
    
    # 内存使用情况
    if command -v free &> /dev/null; then
        local memory_info=$(free -h | grep "Mem:")
        log_info "内存使用: $memory_info"
    fi
    
    # 磁盘使用情况
    if command -v df &> /dev/null; then
        local disk_usage=$(df -h . | tail -1)
        log_info "磁盘使用: $disk_usage"
    fi
    
    echo ""
}

# 执行所有检查
check_environment
check_port_status "后端" "3000" "http://localhost:3000/api/health"
check_port_status "前端" "5173" "http://localhost:5173"
check_pid_files
check_log_files
check_database
check_network_access
check_system_resources

# 总结
log_header "状态总结"

# 服务运行状态
local backend_running=false
local frontend_running=false

if lsof -i :3000 > /dev/null 2>&1; then
    backend_running=true
fi

if lsof -i :5173 > /dev/null 2>&1; then
    frontend_running=true
fi

if $backend_running && $frontend_running; then
    log_success "✓ 完整应用正在运行"
elif $backend_running; then
    log_warning "⚠ 仅后端服务运行"
elif $frontend_running; then
    log_warning "⚠ 仅前端服务运行"
else
    log_error "✗ 没有服务在运行"
fi

log_info "管理命令:"
log_info "  - 启动: ./scripts/start-app.sh"
log_info "  - 停止: ./scripts/stop-app.sh"
log_info "  - 重启: ./scripts/restart-app.sh"
log_info "  - 状态: ./scripts/status-app.sh"