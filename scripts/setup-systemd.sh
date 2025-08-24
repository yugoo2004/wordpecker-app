#!/bin/bash

# WordPecker systemd 服务配置脚本
# 创建 systemd 服务单元文件以管理应用进程

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
USER_NAME=$(whoami)

log_header "=========================================="
log_header "WordPecker systemd 服务配置脚本"
log_header "=========================================="
log_info "项目根目录: $PROJECT_ROOT"
log_info "当前用户: $USER_NAME"

# 检查是否有 systemd 权限
if ! systemctl --user status > /dev/null 2>&1; then
    log_error "无法访问 systemd 用户服务"
    log_info "将创建服务文件，但需要手动安装"
fi

# 创建 systemd 服务目录
SYSTEMD_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_DIR"

# 创建后端服务文件
log_info "创建后端服务文件..."

cat > "$SYSTEMD_DIR/wordpecker-backend.service" << EOF
[Unit]
Description=WordPecker Backend Service
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$PROJECT_ROOT/backend
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStartPre=/bin/bash -c 'cd $PROJECT_ROOT/backend && npm install'
ExecStartPre=/bin/bash -c 'cd $PROJECT_ROOT/backend && npm run build'
ExecStart=/bin/bash -c 'cd $PROJECT_ROOT/backend && npm start'
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_ROOT/logs/systemd-backend.log
StandardError=append:$PROJECT_ROOT/logs/systemd-backend-error.log

# 资源限制
MemoryMax=512M
CPUQuota=50%

# 安全设置
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$PROJECT_ROOT

[Install]
WantedBy=default.target
EOF

# 创建前端服务文件
log_info "创建前端服务文件..."

cat > "$SYSTEMD_DIR/wordpecker-frontend.service" << EOF
[Unit]
Description=WordPecker Frontend Service
After=network.target wordpecker-backend.service

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$PROJECT_ROOT/frontend
Environment=NODE_ENV=development
Environment=PORT=5173
Environment=VITE_API_URL=http://localhost:3000
ExecStartPre=/bin/bash -c 'cd $PROJECT_ROOT/frontend && npm install'
ExecStart=/bin/bash -c 'cd $PROJECT_ROOT/frontend && npm run dev -- --host 0.0.0.0 --port 5173'
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_ROOT/logs/systemd-frontend.log
StandardError=append:$PROJECT_ROOT/logs/systemd-frontend-error.log

# 资源限制
MemoryMax=256M
CPUQuota=30%

# 安全设置
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$PROJECT_ROOT

[Install]
WantedBy=default.target
EOF

# 创建前端生产服务文件
log_info "创建前端生产服务文件..."

cat > "$SYSTEMD_DIR/wordpecker-frontend-prod.service" << EOF
[Unit]
Description=WordPecker Frontend Production Service
After=network.target wordpecker-backend.service

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$PROJECT_ROOT/frontend
Environment=NODE_ENV=production
Environment=PORT=5173
Environment=VITE_API_URL=http://localhost:3000
ExecStartPre=/bin/bash -c 'cd $PROJECT_ROOT/frontend && npm install'
ExecStartPre=/bin/bash -c 'cd $PROJECT_ROOT/frontend && npm run build'
ExecStart=/bin/bash -c 'cd $PROJECT_ROOT/frontend && npm run preview -- --host 0.0.0.0 --port 5173'
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_ROOT/logs/systemd-frontend-prod.log
StandardError=append:$PROJECT_ROOT/logs/systemd-frontend-prod-error.log

# 资源限制
MemoryMax=128M
CPUQuota=20%

# 安全设置
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$PROJECT_ROOT

[Install]
WantedBy=default.target
EOF

# 创建目标文件（用于同时管理多个服务）
log_info "创建服务目标文件..."

cat > "$SYSTEMD_DIR/wordpecker.target" << EOF
[Unit]
Description=WordPecker Application Stack
Requires=wordpecker-backend.service
Wants=wordpecker-frontend.service

[Install]
WantedBy=default.target
EOF

# 创建日志目录
mkdir -p "$PROJECT_ROOT/logs"

# 创建 systemd 管理脚本
log_info "创建 systemd 管理脚本..."

cat > "$PROJECT_ROOT/scripts/systemd-manage.sh" << 'EOF'
#!/bin/bash

# WordPecker systemd 服务管理脚本

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

# 检查 systemd 是否可用
if ! systemctl --user status > /dev/null 2>&1; then
    log_error "systemd 用户服务不可用"
    exit 1
fi

log_header "WordPecker systemd 服务管理"

echo "管理选项:"
echo "1. 启动所有服务"
echo "2. 启动后端服务"
echo "3. 启动前端服务 (开发模式)"
echo "4. 启动前端服务 (生产模式)"
echo "5. 停止所有服务"
echo "6. 重启所有服务"
echo "7. 查看服务状态"
echo "8. 查看服务日志"
echo "9. 启用开机自启"
echo "10. 禁用开机自启"
echo "11. 重新加载服务配置"
echo "12. 退出"

read -p "请选择选项 (1-12): " CHOICE

case $CHOICE in
    1)
        log_header "启动所有服务..."
        systemctl --user start wordpecker-backend.service
        systemctl --user start wordpecker-frontend.service
        log_success "所有服务启动完成"
        ;;
    2)
        log_header "启动后端服务..."
        systemctl --user start wordpecker-backend.service
        log_success "后端服务启动完成"
        ;;
    3)
        log_header "启动前端服务 (开发模式)..."
        systemctl --user stop wordpecker-frontend-prod.service 2>/dev/null || true
        systemctl --user start wordpecker-frontend.service
        log_success "前端服务启动完成 (开发模式)"
        ;;
    4)
        log_header "启动前端服务 (生产模式)..."
        systemctl --user stop wordpecker-frontend.service 2>/dev/null || true
        systemctl --user start wordpecker-frontend-prod.service
        log_success "前端服务启动完成 (生产模式)"
        ;;
    5)
        log_header "停止所有服务..."
        systemctl --user stop wordpecker-backend.service
        systemctl --user stop wordpecker-frontend.service
        systemctl --user stop wordpecker-frontend-prod.service
        log_success "所有服务已停止"
        ;;
    6)
        log_header "重启所有服务..."
        systemctl --user restart wordpecker-backend.service
        systemctl --user restart wordpecker-frontend.service
        log_success "所有服务重启完成"
        ;;
    7)
        log_header "查看服务状态..."
        echo "后端服务状态:"
        systemctl --user status wordpecker-backend.service --no-pager
        echo ""
        echo "前端服务状态:"
        systemctl --user status wordpecker-frontend.service --no-pager
        echo ""
        echo "前端生产服务状态:"
        systemctl --user status wordpecker-frontend-prod.service --no-pager
        ;;
    8)
        log_header "查看服务日志..."
        echo "选择要查看的日志:"
        echo "1. 后端日志"
        echo "2. 前端日志"
        echo "3. 前端生产日志"
        echo "4. 所有日志"
        read -p "请选择 (1-4): " LOG_CHOICE
        
        case $LOG_CHOICE in
            1) journalctl --user -u wordpecker-backend.service -f ;;
            2) journalctl --user -u wordpecker-frontend.service -f ;;
            3) journalctl --user -u wordpecker-frontend-prod.service -f ;;
            4) journalctl --user -u wordpecker-backend.service -u wordpecker-frontend.service -f ;;
            *) log_error "无效选项" ;;
        esac
        ;;
    9)
        log_header "启用开机自启..."
        systemctl --user enable wordpecker-backend.service
        systemctl --user enable wordpecker-frontend.service
        log_success "开机自启已启用"
        ;;
    10)
        log_header "禁用开机自启..."
        systemctl --user disable wordpecker-backend.service
        systemctl --user disable wordpecker-frontend.service
        systemctl --user disable wordpecker-frontend-prod.service
        log_success "开机自启已禁用"
        ;;
    11)
        log_header "重新加载服务配置..."
        systemctl --user daemon-reload
        log_success "服务配置重新加载完成"
        ;;
    12)
        log_info "退出服务管理"
        exit 0
        ;;
    *)
        log_error "无效选项"
        exit 1
        ;;
esac

echo ""
log_header "当前服务状态:"
systemctl --user list-units --type=service | grep wordpecker
EOF

chmod +x "$PROJECT_ROOT/scripts/systemd-manage.sh"

# 重新加载 systemd 配置
log_info "重新加载 systemd 配置..."
if systemctl --user daemon-reload 2>/dev/null; then
    log_success "systemd 配置重新加载完成"
else
    log_warning "无法重新加载 systemd 配置，请手动执行: systemctl --user daemon-reload"
fi

log_header "systemd 服务配置完成！"
log_info "服务文件位置: $SYSTEMD_DIR"
log_info "管理脚本: scripts/systemd-manage.sh"

log_header "创建的服务:"
log_info "  - wordpecker-backend.service (后端服务)"
log_info "  - wordpecker-frontend.service (前端开发服务)"
log_info "  - wordpecker-frontend-prod.service (前端生产服务)"
log_info "  - wordpecker.target (服务组)"

log_header "使用说明:"
log_info "  - 管理服务: ./scripts/systemd-manage.sh"
log_info "  - 查看状态: systemctl --user status wordpecker-backend.service"
log_info "  - 查看日志: journalctl --user -u wordpecker-backend.service -f"
log_info "  - 启动服务: systemctl --user start wordpecker-backend.service"
log_info "  - 停止服务: systemctl --user stop wordpecker-backend.service"

log_header "下一步:"
echo "1. 运行 ./scripts/systemd-manage.sh 来管理服务"
echo "2. 或者手动启动服务: systemctl --user start wordpecker-backend.service"