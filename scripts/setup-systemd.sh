#!/bin/bash

# WordPecker Systemd 服务安装脚本
# 用于配置系统级服务管理，确保开机自启动

set -e

# 配置变量
SERVICE_NAME="wordpecker"
SERVICE_FILE="wordpecker.service"
SYSTEMD_DIR="/etc/systemd/system"
PROJECT_DIR="/home/devbox/wordpecker-app"
SERVICE_USER="devbox"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否以root权限运行
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
}

# 检查系统要求
check_requirements() {
    log_info "检查系统要求..."
    
    # 检查systemd
    if ! command -v systemctl &> /dev/null; then
        log_error "systemctl 命令未找到，此系统可能不支持systemd"
        exit 1
    fi
    
    # 检查PM2
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装，请先安装PM2: npm install -g pm2"
        exit 1
    fi
    
    # 检查项目目录
    if [[ ! -d "$PROJECT_DIR" ]]; then
        log_error "项目目录不存在: $PROJECT_DIR"
        exit 1
    fi
    
    # 检查ecosystem.config.js
    if [[ ! -f "$PROJECT_DIR/ecosystem.config.js" ]]; then
        log_error "PM2配置文件不存在: $PROJECT_DIR/ecosystem.config.js"
        exit 1
    fi
    
    # 检查服务用户
    if ! id "$SERVICE_USER" &>/dev/null; then
        log_error "服务用户不存在: $SERVICE_USER"
        exit 1
    fi
    
    log_info "系统要求检查通过"
}

# 创建必要目录
create_directories() {
    log_info "创建必要目录..."
    
    # 创建日志目录
    mkdir -p "$PROJECT_DIR/logs"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$PROJECT_DIR/logs"
    
    # 创建PM2目录
    sudo -u "$SERVICE_USER" mkdir -p "/home/$SERVICE_USER/.pm2"
    
    log_info "目录创建完成"
}

# 安装systemd服务
install_service() {
    log_info "安装systemd服务..."
    
    # 检查服务文件是否存在
    if [[ ! -f "$SCRIPT_DIR/$SERVICE_FILE" ]]; then
        log_error "服务文件不存在: $SCRIPT_DIR/$SERVICE_FILE"
        exit 1
    fi
    
    # 停止现有服务（如果存在）
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_warn "停止现有服务..."
        systemctl stop "$SERVICE_NAME"
    fi
    
    # 复制服务文件
    cp "$SCRIPT_DIR/$SERVICE_FILE" "$SYSTEMD_DIR/"
    chmod 644 "$SYSTEMD_DIR/$SERVICE_FILE"
    
    # 重新加载systemd配置
    systemctl daemon-reload
    
    log_info "服务文件安装完成"
}

# 配置服务
configure_service() {
    log_info "配置服务..."
    
    # 启用服务（开机自启动）
    systemctl enable "$SERVICE_NAME"
    
    # 设置PM2开机自启动
    sudo -u "$SERVICE_USER" bash -c "cd $PROJECT_DIR && pm2 startup systemd -u $SERVICE_USER --hp /home/$SERVICE_USER"
    
    log_info "服务配置完成"
}

# 测试服务
test_service() {
    log_info "测试服务功能..."
    
    # 启动服务
    log_info "启动服务..."
    systemctl start "$SERVICE_NAME"
    
    # 等待服务启动
    sleep 10
    
    # 检查服务状态
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "✓ 服务启动成功"
    else
        log_error "✗ 服务启动失败"
        systemctl status "$SERVICE_NAME" --no-pager
        exit 1
    fi
    
    # 测试重启功能
    log_info "测试服务重启..."
    systemctl restart "$SERVICE_NAME"
    sleep 10
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "✓ 服务重启成功"
    else
        log_error "✗ 服务重启失败"
        exit 1
    fi
    
    # 显示服务状态
    log_info "当前服务状态:"
    systemctl status "$SERVICE_NAME" --no-pager
}

# 显示管理命令
show_management_commands() {
    log_info "服务管理命令:"
    echo "启动服务:   sudo systemctl start $SERVICE_NAME"
    echo "停止服务:   sudo systemctl stop $SERVICE_NAME"
    echo "重启服务:   sudo systemctl restart $SERVICE_NAME"
    echo "查看状态:   sudo systemctl status $SERVICE_NAME"
    echo "查看日志:   sudo journalctl -u $SERVICE_NAME -f"
    echo "禁用服务:   sudo systemctl disable $SERVICE_NAME"
    echo ""
    echo "PM2管理命令:"
    echo "查看进程:   pm2 list"
    echo "查看日志:   pm2 logs"
    echo "重启应用:   pm2 restart all"
}

# 主函数
main() {
    log_info "开始安装WordPecker Systemd服务..."
    
    check_root
    check_requirements
    create_directories
    install_service
    configure_service
    test_service
    
    log_info "WordPecker Systemd服务安装完成！"
    show_management_commands
}

# 错误处理
trap 'log_error "脚本执行失败，请检查错误信息"; exit 1' ERR

# 执行主函数
main "$@"