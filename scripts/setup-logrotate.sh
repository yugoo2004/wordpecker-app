#!/bin/bash

# WordPecker 日志轮转配置脚本
# 配置系统日志轮转以管理应用日志文件

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
log_header "WordPecker 日志轮转配置脚本"
log_header "=========================================="
log_info "项目根目录: $PROJECT_ROOT"

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 创建日志目录
mkdir -p logs

# 创建 logrotate 配置文件
LOGROTATE_CONFIG="$PROJECT_ROOT/logrotate.conf"

log_info "创建 logrotate 配置文件: $LOGROTATE_CONFIG"

cat > "$LOGROTATE_CONFIG" << 'EOF'
# WordPecker 应用日志轮转配置

# PM2 日志文件
/home/devbox/project/logs/pm2-*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 devbox devbox
    postrotate
        # 重新加载 PM2 日志
        pm2 reloadLogs 2>/dev/null || true
    endscript
}

# 应用日志文件
/home/devbox/project/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 devbox devbox
    copytruncate
}

# 错误日志文件（保留更长时间）
/home/devbox/project/logs/*error*.log {
    daily
    missingok
    rotate 60
    compress
    delaycompress
    notifempty
    create 644 devbox devbox
    copytruncate
}
EOF

log_success "logrotate 配置文件创建完成"

# 创建日志轮转测试脚本
log_info "创建日志轮转测试脚本..."

cat > "scripts/test-logrotate.sh" << 'EOF'
#!/bin/bash

# 测试日志轮转配置

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "测试 logrotate 配置..."
logrotate -d logrotate.conf

echo ""
echo "强制执行日志轮转（测试）..."
logrotate -f logrotate.conf

echo ""
echo "检查日志文件..."
ls -la logs/
EOF

chmod +x scripts/test-logrotate.sh

# 创建 PM2 日志管理脚本
log_info "创建 PM2 日志管理脚本..."

cat > "scripts/pm2-logs.sh" << 'EOF'
#!/bin/bash

# PM2 日志管理脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "PM2 日志管理选项:"
echo "1. 查看所有日志"
echo "2. 查看后端日志"
echo "3. 查看前端日志"
echo "4. 清空所有日志"
echo "5. 重新加载日志"
echo "6. 查看日志文件大小"
echo "7. 压缩旧日志"
echo "8. 退出"

read -p "请选择选项 (1-8): " CHOICE

case $CHOICE in
    1)
        log_info "查看所有日志..."
        pm2 logs
        ;;
    2)
        log_info "查看后端日志..."
        pm2 logs wordpecker-backend
        ;;
    3)
        log_info "查看前端日志..."
        pm2 logs wordpecker-frontend-dev wordpecker-frontend-preview
        ;;
    4)
        log_warning "清空所有日志..."
        read -p "确认清空所有日志? (y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            pm2 flush
            log_success "所有日志已清空"
        else
            log_info "操作已取消"
        fi
        ;;
    5)
        log_info "重新加载日志..."
        pm2 reloadLogs
        log_success "日志重新加载完成"
        ;;
    6)
        log_info "查看日志文件大小..."
        du -sh logs/*
        ;;
    7)
        log_info "压缩旧日志..."
        find logs/ -name "*.log" -mtime +1 -exec gzip {} \;
        log_success "旧日志压缩完成"
        ;;
    8)
        log_info "退出日志管理"
        exit 0
        ;;
    *)
        log_error "无效选项"
        exit 1
        ;;
esac
EOF

chmod +x scripts/pm2-logs.sh

# 创建系统监控脚本
log_info "创建系统监控脚本..."

cat > "scripts/monitor.sh" << 'EOF'
#!/bin/bash

# WordPecker 系统监控脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

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

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 监控函数
check_services() {
    log_header "服务状态检查"
    
    # 检查 PM2 进程
    if command -v pm2 &> /dev/null; then
        log_info "PM2 进程状态:"
        pm2 list
    else
        log_warning "PM2 未安装"
    fi
    
    # 检查端口
    log_info "端口占用情况:"
    if lsof -i :3000 > /dev/null 2>&1; then
        log_success "后端服务运行中 (端口 3000)"
    else
        log_error "后端服务未运行"
    fi
    
    if lsof -i :5173 > /dev/null 2>&1; then
        log_success "前端服务运行中 (端口 5173)"
    else
        log_error "前端服务未运行"
    fi
}

check_resources() {
    log_header "系统资源使用情况"
    
    # CPU 使用率
    if command -v top &> /dev/null; then
        log_info "CPU 使用率:"
        top -bn1 | grep "Cpu(s)" | head -1
    fi
    
    # 内存使用情况
    if command -v free &> /dev/null; then
        log_info "内存使用情况:"
        free -h
    fi
    
    # 磁盘使用情况
    log_info "磁盘使用情况:"
    df -h .
    
    # 日志文件大小
    if [ -d "logs" ]; then
        log_info "日志文件大小:"
        du -sh logs/* 2>/dev/null || log_info "暂无日志文件"
    fi
}

check_health() {
    log_header "健康检查"
    
    # 后端健康检查
    if command -v curl &> /dev/null; then
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "后端服务健康检查通过"
        else
            log_error "后端服务健康检查失败"
        fi
        
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            log_success "前端服务健康检查通过"
        else
            log_error "前端服务健康检查失败"
        fi
    else
        log_warning "curl 未安装，跳过健康检查"
    fi
}

# 主监控循环
if [ "$1" = "--watch" ]; then
    log_header "开始持续监控模式 (按 Ctrl+C 退出)"
    while true; do
        clear
        echo "监控时间: $(date)"
        echo "========================================"
        check_services
        echo ""
        check_resources
        echo ""
        check_health
        echo ""
        echo "下次更新: 30秒后"
        sleep 30
    done
else
    # 单次检查
    check_services
    echo ""
    check_resources
    echo ""
    check_health
    
    echo ""
    log_info "使用 --watch 参数启用持续监控模式"
fi
EOF

chmod +x scripts/monitor.sh

# 设置定时任务（可选）
log_header "配置选项:"
echo "1. 设置系统 crontab 定时日志轮转"
echo "2. 仅创建配置文件"
echo "3. 测试日志轮转配置"

read -p "请选择选项 (1-3): " SETUP_CHOICE

case $SETUP_CHOICE in
    1)
        log_info "设置系统 crontab..."
        
        # 检查是否有权限设置 crontab
        if crontab -l > /dev/null 2>&1; then
            # 添加日志轮转任务到 crontab
            (crontab -l 2>/dev/null; echo "0 2 * * * /usr/sbin/logrotate $PROJECT_ROOT/logrotate.conf") | crontab -
            log_success "crontab 定时任务设置完成"
            log_info "日志轮转将在每天凌晨 2 点执行"
        else
            log_warning "无法设置 crontab，请手动配置"
            log_info "手动添加到 crontab: 0 2 * * * /usr/sbin/logrotate $PROJECT_ROOT/logrotate.conf"
        fi
        ;;
        
    2)
        log_info "仅创建配置文件，不设置定时任务"
        ;;
        
    3)
        log_info "测试日志轮转配置..."
        ./scripts/test-logrotate.sh
        ;;
        
    *)
        log_error "无效选项"
        exit 1
        ;;
esac

log_header "日志轮转配置完成！"
log_info "配置文件: $LOGROTATE_CONFIG"
log_info "测试脚本: scripts/test-logrotate.sh"
log_info "日志管理: scripts/pm2-logs.sh"
log_info "系统监控: scripts/monitor.sh"

log_header "使用说明:"
log_info "  - 测试配置: ./scripts/test-logrotate.sh"
log_info "  - 管理日志: ./scripts/pm2-logs.sh"
log_info "  - 系统监控: ./scripts/monitor.sh"
log_info "  - 持续监控: ./scripts/monitor.sh --watch"