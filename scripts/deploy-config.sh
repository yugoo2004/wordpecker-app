#!/bin/bash
# WordPecker 部署配置文件
# 功能：统一管理部署相关的配置变量

# 项目配置
export PROJECT_NAME="wordpecker"
export PROJECT_VERSION="1.0.0"
export PROJECT_DIR="/home/devbox/wordpecker-app"

# 服务配置
export BACKEND_PORT="3000"
export FRONTEND_PORT="5173"
export BACKEND_URL="http://localhost:${BACKEND_PORT}"
export FRONTEND_URL="http://localhost:${FRONTEND_PORT}"

# 部署配置
export BACKUP_DIR="/home/devbox/backups"
export LOG_DIR="./logs"
export MAX_BACKUPS="10"
export DEPLOY_TIMEOUT="300"  # 5分钟

# PM2配置
export PM2_APP_NAME_BACKEND="wordpecker-backend"
export PM2_APP_NAME_FRONTEND="wordpecker-frontend"
export PM2_MAX_MEMORY_RESTART="500M"
export PM2_MAX_RESTARTS="10"

# 健康检查配置
export HEALTH_CHECK_INTERVAL="60"  # 秒
export HEALTH_CHECK_TIMEOUT="10"   # 秒
export MAX_HEALTH_CHECK_FAILURES="3"

# 资源监控配置
export CPU_THRESHOLD="80"     # CPU使用率阈值 (%)
export MEMORY_THRESHOLD="80"  # 内存使用率阈值 (%)
export DISK_THRESHOLD="85"    # 磁盘使用率阈值 (%)

# 日志配置
export LOG_RETENTION_DAYS="7"
export LOG_MAX_SIZE="10M"
export LOG_MAX_FILES="5"

# 网络配置
export CONNECT_TIMEOUT="10"
export REQUEST_TIMEOUT="30"
export RETRY_ATTEMPTS="3"
export RETRY_DELAY="5"

# 安全配置
export REQUIRE_HTTPS="false"
export ENABLE_CORS="true"
export RATE_LIMIT_ENABLED="true"

# 开发/生产环境配置
if [ "$NODE_ENV" = "production" ]; then
    export LOG_LEVEL="info"
    export DEBUG_MODE="false"
    export ENABLE_MONITORING="true"
else
    export LOG_LEVEL="debug"
    export DEBUG_MODE="true"
    export ENABLE_MONITORING="false"
fi

# 颜色配置（用于日志输出）
export COLOR_RED='\033[0;31m'
export COLOR_GREEN='\033[0;32m'
export COLOR_YELLOW='\033[1;33m'
export COLOR_BLUE='\033[0;34m'
export COLOR_NC='\033[0m'

# 函数：验证配置
validate_config() {
    local errors=0
    
    # 检查必需的环境变量
    local required_vars=(
        "OPENAI_API_KEY"
        "MONGODB_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "错误: 环境变量 $var 未设置" >&2
            errors=$((errors + 1))
        fi
    done
    
    # 检查目录权限
    if [ ! -w "$(dirname "$BACKUP_DIR")" ]; then
        echo "错误: 备份目录 $BACKUP_DIR 不可写" >&2
        errors=$((errors + 1))
    fi
    
    if [ ! -w "$(dirname "$LOG_DIR")" ]; then
        echo "错误: 日志目录 $LOG_DIR 不可写" >&2
        errors=$((errors + 1))
    fi
    
    # 检查端口可用性
    if netstat -tuln 2>/dev/null | grep -q ":$BACKEND_PORT "; then
        echo "警告: 后端端口 $BACKEND_PORT 可能已被占用" >&2
    fi
    
    if netstat -tuln 2>/dev/null | grep -q ":$FRONTEND_PORT "; then
        echo "警告: 前端端口 $FRONTEND_PORT 可能已被占用" >&2
    fi
    
    return $errors
}

# 函数：显示配置信息
show_config() {
    echo "WordPecker 部署配置:"
    echo "===================="
    echo "项目名称: $PROJECT_NAME"
    echo "项目版本: $PROJECT_VERSION"
    echo "项目目录: $PROJECT_DIR"
    echo "后端端口: $BACKEND_PORT"
    echo "前端端口: $FRONTEND_PORT"
    echo "备份目录: $BACKUP_DIR"
    echo "日志目录: $LOG_DIR"
    echo "环境模式: ${NODE_ENV:-development}"
    echo "日志级别: $LOG_LEVEL"
    echo "===================="
}

# 函数：创建必要目录
create_directories() {
    local dirs=(
        "$BACKUP_DIR"
        "$LOG_DIR"
        "./audio-cache"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            echo "创建目录: $dir"
        fi
    done
}

# 函数：设置日志轮转
setup_log_rotation() {
    local logrotate_config="/etc/logrotate.d/wordpecker"
    
    if [ -w "/etc/logrotate.d" ]; then
        cat > "$logrotate_config" << EOF
$PROJECT_DIR/logs/*.log {
    daily
    rotate $LOG_RETENTION_DAYS
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        pm2 reloadLogs 2>/dev/null || true
    endscript
}
EOF
        echo "配置日志轮转: $logrotate_config"
    else
        echo "警告: 无法配置系统日志轮转，权限不足"
    fi
}

# 如果直接运行此脚本，显示配置信息
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-show}" in
        "show")
            show_config
            ;;
        "validate")
            if validate_config; then
                echo "✅ 配置验证通过"
                exit 0
            else
                echo "❌ 配置验证失败"
                exit 1
            fi
            ;;
        "init")
            create_directories
            setup_log_rotation
            echo "✅ 配置初始化完成"
            ;;
        *)
            echo "用法: $0 [show|validate|init]"
            exit 1
            ;;
    esac
fi