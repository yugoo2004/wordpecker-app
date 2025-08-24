#!/bin/bash

# WordPecker Systemd 服务配置脚本
# 用于配置系统级服务管理和开机自启动

set -e

# 配置变量
PROJECT_DIR="/home/devbox/wordpecker-app"
SERVICE_USER="devbox"
SERVICE_NAME="wordpecker"
LOG_FILE="./logs/systemd-setup.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 检查权限
check_permissions() {
    if [ "$EUID" -eq 0 ]; then
        log_error "请不要以 root 用户运行此脚本"
        exit 1
    fi
    
    # 检查 sudo 权限
    if ! sudo -n true 2>/dev/null; then
        log_error "需要 sudo 权限来配置系统服务"
        exit 1
    fi
}

# 检查 PM2 安装
check_pm2_installation() {
    log_info "检查 PM2 安装状态..."
    
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装，请先运行环境初始化脚本"
        exit 1
    fi
    
    local pm2_version=$(pm2 -v)
    log_success "PM2 $pm2_version 已安装"
}

# 创建 Systemd 服务文件
create_systemd_service() {
    log_info "创建 Systemd 服务文件..."
    
    # 获取 PM2 路径
    local pm2_path=$(which pm2)
    local node_path=$(which node)
    
    # 创建服务文件
    sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=WordPecker Language Learning Application
Documentation=https://github.com/your-repo/wordpecker
After=network.target
Wants=network.target

[Service]
Type=forking
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${PROJECT_DIR}

# 环境变量
Environment=NODE_ENV=production
Environment=PATH=${PATH}
Environment=PM2_HOME=/home/${SERVICE_USER}/.pm2

# 服务命令
ExecStart=${pm2_path} start ecosystem.config.js --env production
ExecReload=${pm2_path} reload ecosystem.config.js --env production
ExecStop=${pm2_path} stop ecosystem.config.js

# 进程管理
PIDFile=/home/${SERVICE_USER}/.pm2/pm2.pid
Restart=always
RestartSec=10
StartLimitInterval=60s
StartLimitBurst=3

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${PROJECT_DIR}
ReadWritePaths=/home/${SERVICE_USER}/.pm2
ReadWritePaths=/tmp

# 资源限制
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "Systemd 服务文件创建完成"
}

# 配置 PM2 启动脚本
setup_pm2_startup() {
    log_info "配置 PM2 启动脚本..."
    
    # 生成 PM2 启动脚本
    local startup_script=$(pm2 startup systemd -u "$SERVICE_USER" --hp "/home/$SERVICE_USER" | tail -n 1)
    
    # 执行启动脚本配置
    if [[ $startup_script == sudo* ]]; then
        eval "$startup_script"
        log_success "PM2 启动脚本配置完成"
    else
        log_warning "PM2 启动脚本可能已配置"
    fi
}

# 重新加载 systemd 配置
reload_systemd() {
    log_info "重新加载 systemd 配置..."
    
    sudo systemctl daemon-reload
    log_success "systemd 配置重新加载完成"
}

# 启用服务
enable_service() {
    log_info "启用 WordPecker 服务..."
    
    sudo systemctl enable ${SERVICE_NAME}.service
    log_success "WordPecker 服务已启用，将在系统启动时自动运行"
}

# 验证服务配置
verify_service_config() {
    log_info "验证服务配置..."
    
    # 检查服务文件语法
    if sudo systemctl cat ${SERVICE_NAME}.service > /dev/null 2>&1; then
        log_success "服务文件语法正确"
    else
        log_error "服务文件语法错误"
        exit 1
    fi
    
    # 检查服务状态
    local service_status=$(sudo systemctl is-enabled ${SERVICE_NAME}.service 2>/dev/null || echo "disabled")
    if [ "$service_status" = "enabled" ]; then
        log_success "服务已启用"
    else
        log_warning "服务未启用"
    fi
}

# 创建服务管理脚本
create_service_management_scripts() {
    log_info "创建服务管理脚本..."
    
    # 创建启动脚本
    cat > "$PROJECT_DIR/scripts/service-start.sh" << 'EOF'
#!/bin/bash
# 启动 WordPecker 服务

echo "启动 WordPecker 服务..."
sudo systemctl start wordpecker.service

# 等待服务启动
sleep 5

# 检查服务状态
if sudo systemctl is-active --quiet wordpecker.service; then
    echo "✅ WordPecker 服务启动成功"
    sudo systemctl status wordpecker.service --no-pager -l
else
    echo "❌ WordPecker 服务启动失败"
    sudo systemctl status wordpecker.service --no-pager -l
    exit 1
fi
EOF
    
    # 创建停止脚本
    cat > "$PROJECT_DIR/scripts/service-stop.sh" << 'EOF'
#!/bin/bash
# 停止 WordPecker 服务

echo "停止 WordPecker 服务..."
sudo systemctl stop wordpecker.service

# 等待服务停止
sleep 3

# 检查服务状态
if ! sudo systemctl is-active --quiet wordpecker.service; then
    echo "✅ WordPecker 服务已停止"
else
    echo "❌ WordPecker 服务停止失败"
    exit 1
fi
EOF
    
    # 创建重启脚本
    cat > "$PROJECT_DIR/scripts/service-restart.sh" << 'EOF'
#!/bin/bash
# 重启 WordPecker 服务

echo "重启 WordPecker 服务..."
sudo systemctl restart wordpecker.service

# 等待服务重启
sleep 5

# 检查服务状态
if sudo systemctl is-active --quiet wordpecker.service; then
    echo "✅ WordPecker 服务重启成功"
    sudo systemctl status wordpecker.service --no-pager -l
else
    echo "❌ WordPecker 服务重启失败"
    sudo systemctl status wordpecker.service --no-pager -l
    exit 1
fi
EOF
    
    # 创建状态查询脚本
    cat > "$PROJECT_DIR/scripts/service-status.sh" << 'EOF'
#!/bin/bash
# 查询 WordPecker 服务状态

echo "WordPecker 服务状态："
echo "===================="

# 系统服务状态
echo "🔧 Systemd 服务状态："
sudo systemctl status wordpecker.service --no-pager -l

echo
echo "📊 PM2 进程状态："
pm2 status

echo
echo "🏥 健康检查："
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务健康"
else
    echo "❌ 后端服务异常"
fi

if curl -f http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ 前端服务健康"
else
    echo "❌ 前端服务异常"
fi
EOF
    
    # 设置脚本权限
    chmod +x "$PROJECT_DIR/scripts/service-"*.sh
    
    log_success "服务管理脚本创建完成"
}

# 主配置流程
main() {
    echo "=========================================="
    echo "WordPecker Systemd 服务配置"
    echo "=========================================="
    echo
    
    # 创建日志目录
    mkdir -p ./logs
    
    log_info "开始配置 Systemd 服务..."
    
    # 执行配置步骤
    check_permissions
    check_pm2_installation
    create_systemd_service
    setup_pm2_startup
    reload_systemd
    enable_service
    verify_service_config
    create_service_management_scripts
    
    echo
    echo "=========================================="
    log_success "Systemd 服务配置完成！"
    echo "=========================================="
    echo
    echo "服务管理命令："
    echo "• 启动服务: ./scripts/service-start.sh"
    echo "• 停止服务: ./scripts/service-stop.sh"
    echo "• 重启服务: ./scripts/service-restart.sh"
    echo "• 查看状态: ./scripts/service-status.sh"
    echo
    echo "系统命令："
    echo "• sudo systemctl start wordpecker"
    echo "• sudo systemctl stop wordpecker"
    echo "• sudo systemctl restart wordpecker"
    echo "• sudo systemctl status wordpecker"
    echo
}

# 错误处理
trap 'log_error "Systemd 服务配置失败，请检查日志: $LOG_FILE"' ERR

# 执行主函数
main "$@"