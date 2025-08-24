#!/bin/bash

# WordPecker Systemd 服务管理脚本
# 提供便捷的服务管理命令

SERVICE_NAME="wordpecker"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 显示使用帮助
show_help() {
    echo "WordPecker 服务管理工具"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  start     启动服务"
    echo "  stop      停止服务"
    echo "  restart   重启服务"
    echo "  status    查看服务状态"
    echo "  logs      查看服务日志"
    echo "  enable    启用开机自启动"
    echo "  disable   禁用开机自启动"
    echo "  install   安装服务"
    echo "  uninstall 卸载服务"
    echo "  test      测试服务功能"
    echo "  help      显示此帮助信息"
}

# 检查root权限
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}错误: 此操作需要root权限${NC}"
        echo "请使用: sudo $0 $1"
        exit 1
    fi
}

# 执行命令
case "$1" in
    start)
        check_root "$1"
        echo -e "${BLUE}启动 $SERVICE_NAME 服务...${NC}"
        systemctl start "$SERVICE_NAME"
        echo -e "${GREEN}服务启动完成${NC}"
        ;;
    stop)
        check_root "$1"
        echo -e "${BLUE}停止 $SERVICE_NAME 服务...${NC}"
        systemctl stop "$SERVICE_NAME"
        echo -e "${GREEN}服务停止完成${NC}"
        ;;
    restart)
        check_root "$1"
        echo -e "${BLUE}重启 $SERVICE_NAME 服务...${NC}"
        systemctl restart "$SERVICE_NAME"
        echo -e "${GREEN}服务重启完成${NC}"
        ;;
    status)
        echo -e "${BLUE}$SERVICE_NAME 服务状态:${NC}"
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    logs)
        echo -e "${BLUE}$SERVICE_NAME 服务日志:${NC}"
        journalctl -u "$SERVICE_NAME" -f
        ;;
    enable)
        check_root "$1"
        echo -e "${BLUE}启用 $SERVICE_NAME 开机自启动...${NC}"
        systemctl enable "$SERVICE_NAME"
        echo -e "${GREEN}开机自启动已启用${NC}"
        ;;
    disable)
        check_root "$1"
        echo -e "${BLUE}禁用 $SERVICE_NAME 开机自启动...${NC}"
        systemctl disable "$SERVICE_NAME"
        echo -e "${YELLOW}开机自启动已禁用${NC}"
        ;;
    install)
        check_root "$1"
        echo -e "${BLUE}安装 $SERVICE_NAME 服务...${NC}"
        ./scripts/setup-systemd.sh
        ;;
    uninstall)
        check_root "$1"
        echo -e "${BLUE}卸载 $SERVICE_NAME 服务...${NC}"
        systemctl stop "$SERVICE_NAME" 2>/dev/null || true
        systemctl disable "$SERVICE_NAME" 2>/dev/null || true
        rm -f "/etc/systemd/system/$SERVICE_NAME.service"
        systemctl daemon-reload
        echo -e "${GREEN}服务卸载完成${NC}"
        ;;
    test)
        check_root "$1"
        echo -e "${BLUE}测试 $SERVICE_NAME 服务...${NC}"
        ./scripts/test-systemd-service.sh
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        show_help
        ;;
    *)
        echo -e "${RED}错误: 未知命令 '$1'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac