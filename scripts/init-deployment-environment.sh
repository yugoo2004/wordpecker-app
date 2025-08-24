#!/bin/bash

# WordPecker 应用一键环境初始化脚本
# 用于在 Sealos devbox 环境中初始化部署环境

set -e

# 配置变量
PROJECT_DIR="/home/devbox/wordpecker-app"
SERVICE_USER="devbox"
LOG_FILE="./logs/init-deployment.log"
BACKUP_DIR="/home/devbox/backups"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date): [INFO] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date): [SUCCESS] $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date): [WARNING] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date): [ERROR] $1" >> "$LOG_FILE"
}

# 检查是否为 root 用户
check_user() {
    if [ "$EUID" -eq 0 ]; then
        log_error "请不要以 root 用户运行此脚本"
        exit 1
    fi
}

# 创建必要目录结构
create_directories() {
    log_info "创建项目目录结构..."
    
    # 创建主要目录
    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$PROJECT_DIR/audio-cache"
    mkdir -p "$PROJECT_DIR/scripts"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "./logs"
    
    # 创建配置目录
    mkdir -p "$PROJECT_DIR/config"
    mkdir -p "$PROJECT_DIR/.pm2"
    
    # 设置目录权限
    chmod 755 "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR/logs"
    chmod 755 "$PROJECT_DIR/audio-cache"
    chmod 755 "$PROJECT_DIR/scripts"
    chmod 755 "$BACKUP_DIR"
    
    log_success "目录结构创建完成"
}

# 检查系统要求
check_system_requirements() {
    log_info "检查系统要求..."
    
    # 检查操作系统
    if ! grep -q "Ubuntu" /etc/os-release; then
        log_warning "建议使用 Ubuntu 系统，当前系统可能不完全兼容"
    fi
    
    # 检查内存
    local memory_gb=$(free -g | awk 'NR==2{printf "%.1f", $2}')
    if (( $(echo "$memory_gb < 2" | bc -l) )); then
        log_warning "系统内存少于 2GB，可能影响性能"
    fi
    
    # 检查磁盘空间
    local disk_free=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$disk_free" -lt 5 ]; then
        log_error "磁盘空间不足 5GB，无法继续安装"
        exit 1
    fi
    
    log_success "系统要求检查通过"
}

# 安装系统依赖
install_system_dependencies() {
    log_info "安装系统依赖..."
    
    # 更新包管理器
    sudo apt update -qq
    
    # 安装基础工具
    sudo apt install -y curl wget git jq bc unzip
    
    # 安装构建工具
    sudo apt install -y build-essential
    
    log_success "系统依赖安装完成"
}

# 安装 Node.js
install_nodejs() {
    log_info "安装 Node.js..."
    
    # 检查是否已安装 Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node -v | cut -d'v' -f2)
        if node -e "process.exit(require('semver').gte('$node_version', '16.0.0') ? 0 : 1)" 2>/dev/null; then
            log_success "Node.js $node_version 已安装且版本符合要求"
            return 0
        else
            log_warning "Node.js 版本过低，将升级到最新版本"
        fi
    fi
    
    # 安装 Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # 验证安装
    local installed_version=$(node -v)
    log_success "Node.js $installed_version 安装完成"
    
    # 更新 npm
    sudo npm install -g npm@latest
    log_success "npm 已更新到最新版本"
}

# 安装 PM2
install_pm2() {
    log_info "安装 PM2 进程管理器..."
    
    # 检查是否已安装
    if command -v pm2 &> /dev/null; then
        local pm2_version=$(pm2 -v)
        log_success "PM2 $pm2_version 已安装"
        return 0
    fi
    
    # 安装 PM2
    sudo npm install -g pm2@latest
    
    # 验证安装
    local installed_version=$(pm2 -v)
    log_success "PM2 $installed_version 安装完成"
    
    # 设置 PM2 启动脚本
    pm2 startup systemd -u "$SERVICE_USER" --hp "/home/$SERVICE_USER"
    
    log_success "PM2 启动脚本配置完成"
}

# 安装项目依赖
install_project_dependencies() {
    log_info "安装项目依赖..."
    
    # 检查项目目录
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "项目目录不存在: $PROJECT_DIR"
        exit 1
    fi
    
    cd "$PROJECT_DIR"
    
    # 安装后端依赖
    if [ -d "backend" ]; then
        log_info "安装后端依赖..."
        cd backend
        npm ci --production
        cd ..
        log_success "后端依赖安装完成"
    fi
    
    # 安装前端依赖并构建
    if [ -d "frontend" ]; then
        log_info "安装前端依赖并构建..."
        cd frontend
        npm ci
        npm run build
        cd ..
        log_success "前端依赖安装和构建完成"
    fi
}

# 配置环境变量
setup_environment_variables() {
    log_info "配置环境变量..."
    
    # 创建环境变量模板
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        cat > "$PROJECT_DIR/.env" << 'EOF'
# WordPecker 应用环境变量配置

# 应用配置
NODE_ENV=production
PORT=3000
FRONTEND_PORT=5173

# 数据库配置
MONGODB_URL=mongodb://localhost:27017/wordpecker

# OpenAI API 配置
OPENAI_API_KEY=your_openai_api_key_here

# ElevenLabs API 配置（可选）
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Pexels API 配置（可选）
PEXELS_API_KEY=your_pexels_api_key_here

# 日志配置
LOG_LEVEL=info

# 会话配置
SESSION_SECRET=your_session_secret_here
EOF
        log_success "环境变量模板创建完成: $PROJECT_DIR/.env"
        log_warning "请编辑 .env 文件并填入正确的 API 密钥"
    else
        log_success "环境变量文件已存在"
    fi
}

# 设置脚本权限
setup_script_permissions() {
    log_info "设置脚本执行权限..."
    
    # 设置所有脚本为可执行
    find "$PROJECT_DIR/scripts" -name "*.sh" -type f -exec chmod +x {} \;
    
    log_success "脚本权限设置完成"
}

# 主初始化流程
main() {
    echo "=========================================="
    echo "WordPecker 应用环境初始化脚本"
    echo "=========================================="
    echo
    
    # 创建日志目录
    mkdir -p ./logs
    
    log_info "开始初始化部署环境..."
    
    # 执行初始化步骤
    check_user
    check_system_requirements
    create_directories
    install_system_dependencies
    install_nodejs
    install_pm2
    install_project_dependencies
    setup_environment_variables
    setup_script_permissions
    
    echo
    echo "=========================================="
    log_success "环境初始化完成！"
    echo "=========================================="
    echo
    echo "下一步操作："
    echo "1. 编辑环境变量文件: $PROJECT_DIR/.env"
    echo "2. 配置 Systemd 服务: ./scripts/setup-systemd-service.sh"
    echo "3. 设置定时任务: ./scripts/setup-cron-tasks.sh"
    echo "4. 运行部署脚本: ./scripts/deploy.sh"
    echo
}

# 错误处理
trap 'log_error "脚本执行失败，请检查日志: $LOG_FILE"' ERR

# 执行主函数
main "$@"