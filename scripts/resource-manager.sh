#!/bin/bash

# 资源管理器主脚本
# 统一管理系统资源监控、保护和清理功能

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/resource-manager.log"

# 创建必要目录
mkdir -p "$PROJECT_DIR/logs" "$PROJECT_DIR/config"

# 日志函数
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    echo "[$level] $message"
}

# 检查脚本依赖
check_dependencies() {
    local missing_deps=()
    
    # 检查必需的命令
    for cmd in bc jq curl; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    # 检查脚本文件
    for script in "system-resource-monitor.sh" "resource-protection.sh" "auto-cleanup.sh"; do
        if [ ! -f "$SCRIPT_DIR/$script" ]; then
            missing_deps+=("$script")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_message "ERROR" "缺少依赖: ${missing_deps[*]}"
        echo "请安装缺少的依赖或确保脚本文件存在"
        return 1
    fi
    
    return 0
}

# 启动资源监控
start_monitoring() {
    log_message "INFO" "启动资源监控服务"
    
    # 启动系统资源监控
    if [ -f "$SCRIPT_DIR/system-resource-monitor.sh" ]; then
        nohup "$SCRIPT_DIR/system-resource-monitor.sh" start > "$PROJECT_DIR/logs/monitor-daemon.log" 2>&1 &
        local monitor_pid=$!
        echo "$monitor_pid" > "$PROJECT_DIR/logs/resource-monitor.pid"
        log_message "INFO" "系统资源监控已启动 (PID: $monitor_pid)"
    fi
    
    # 设置定时清理任务
    if [ -f "$SCRIPT_DIR/auto-cleanup.sh" ]; then
        "$SCRIPT_DIR/auto-cleanup.sh" setup-cron
        log_message "INFO" "自动清理任务已设置"
    fi
    
    log_message "INFO" "资源监控服务启动完成"
}

# 停止资源监控
stop_monitoring() {
    log_message "INFO" "停止资源监控服务"
    
    # 停止系统资源监控
    if [ -f "$PROJECT_DIR/logs/resource-monitor.pid" ]; then
        local pid=$(cat "$PROJECT_DIR/logs/resource-monitor.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            log_message "INFO" "已停止系统资源监控 (PID: $pid)"
        fi
        rm -f "$PROJECT_DIR/logs/resource-monitor.pid"
    fi
    
    # 清除定时任务
    crontab -l 2>/dev/null | grep -v "wordpecker.*auto-cleanup" | crontab - 2>/dev/null || true
    log_message "INFO" "已清除自动清理定时任务"
    
    log_message "INFO" "资源监控服务停止完成"
}

# 检查监控状态
check_status() {
    echo "=== WordPecker 资源监控状态 ==="
    echo ""
    
    # 检查系统资源监控状态
    if [ -f "$PROJECT_DIR/logs/resource-monitor.pid" ]; then
        local pid=$(cat "$PROJECT_DIR/logs/resource-monitor.pid")
        if kill -0 "$pid" 2>/dev/null; then
            echo "✅ 系统资源监控: 运行中 (PID: $pid)"
        else
            echo "❌ 系统资源监控: 已停止"
        fi
    else
        echo "❌ 系统资源监控: 未启动"
    fi
    
    # 检查定时任务
    if crontab -l 2>/dev/null | grep -q "wordpecker.*auto-cleanup"; then
        echo "✅ 自动清理任务: 已设置"
        echo "   定时任务:"
        crontab -l 2>/dev/null | grep "wordpecker.*auto-cleanup" | sed 's/^/   /'
    else
        echo "❌ 自动清理任务: 未设置"
    fi
    
    # 显示当前资源使用情况
    echo ""
    echo "=== 当前资源使用情况 ==="
    
    # CPU使用率
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}' | sed 's/us,//')
    echo "CPU使用率: ${cpu_usage:-N/A}%"
    
    # 内存使用率
    local memory_usage=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    echo "内存使用率: ${memory_usage}%"
    
    # 磁盘使用率
    local disk_usage=$(df -h / | awk 'NR==2{print $5}')
    echo "磁盘使用率: ${disk_usage}"
    
    # 系统负载
    local load_average=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    echo "系统负载: ${load_average}"
    
    # PM2进程状态
    if command -v pm2 &> /dev/null; then
        echo ""
        echo "=== PM2进程状态 ==="
        pm2 list --no-color 2>/dev/null || echo "PM2进程信息获取失败"
    fi
}

# 执行资源保护检查
run_protection_check() {
    log_message "INFO" "执行资源保护检查"
    
    if [ -f "$SCRIPT_DIR/resource-protection.sh" ]; then
        "$SCRIPT_DIR/resource-protection.sh" check
        log_message "INFO" "资源保护检查完成"
    else
        log_message "ERROR" "资源保护脚本不存在"
        return 1
    fi
}

# 执行清理操作
run_cleanup() {
    local cleanup_type=${1:-full}
    log_message "INFO" "执行清理操作: $cleanup_type"
    
    if [ -f "$SCRIPT_DIR/auto-cleanup.sh" ]; then
        "$SCRIPT_DIR/auto-cleanup.sh" "$cleanup_type"
        log_message "INFO" "清理操作完成: $cleanup_type"
    else
        log_message "ERROR" "自动清理脚本不存在"
        return 1
    fi
}

# 生成综合报告
generate_report() {
    local report_file="$PROJECT_DIR/logs/resource-comprehensive-report-$(date +%Y%m%d-%H%M%S).log"
    
    echo "=== WordPecker 资源管理综合报告 ===" > "$report_file"
    echo "生成时间: $(date)" >> "$report_file"
    echo "" >> "$report_file"
    
    # 系统信息
    echo "=== 系统信息 ===" >> "$report_file"
    echo "操作系统: $(uname -a)" >> "$report_file"
    echo "运行时间: $(uptime)" >> "$report_file"
    echo "" >> "$report_file"
    
    # 资源使用情况
    echo "=== 资源使用情况 ===" >> "$report_file"
    echo "CPU信息:" >> "$report_file"
    lscpu | head -10 >> "$report_file" 2>/dev/null || echo "CPU信息获取失败" >> "$report_file"
    echo "" >> "$report_file"
    
    echo "内存信息:" >> "$report_file"
    free -h >> "$report_file"
    echo "" >> "$report_file"
    
    echo "磁盘信息:" >> "$report_file"
    df -h >> "$report_file"
    echo "" >> "$report_file"
    
    # 进程信息
    echo "=== 进程信息 ===" >> "$report_file"
    if command -v pm2 &> /dev/null; then
        echo "PM2进程:" >> "$report_file"
        pm2 list --no-color >> "$report_file" 2>/dev/null || echo "PM2信息获取失败" >> "$report_file"
    fi
    echo "" >> "$report_file"
    
    echo "高CPU使用进程:" >> "$report_file"
    ps aux --sort=-%cpu | head -10 >> "$report_file"
    echo "" >> "$report_file"
    
    echo "高内存使用进程:" >> "$report_file"
    ps aux --sort=-%mem | head -10 >> "$report_file"
    echo "" >> "$report_file"
    
    # 目录大小统计
    echo "=== 目录大小统计 ===" >> "$report_file"
    for dir in "logs" "audio-cache" "backend/logs" "backend/audio-cache" "frontend/dist" "backend/dist"; do
        if [ -d "$PROJECT_DIR/$dir" ]; then
            local size=$(du -sh "$PROJECT_DIR/$dir" 2>/dev/null | awk '{print $1}')
            echo "$dir: $size" >> "$report_file"
        fi
    done
    echo "" >> "$report_file"
    
    # 最近的监控日志
    echo "=== 最近监控活动 ===" >> "$report_file"
    if [ -f "$LOG_FILE" ]; then
        tail -50 "$LOG_FILE" >> "$report_file"
    else
        echo "无监控日志" >> "$report_file"
    fi
    
    echo "综合报告已生成: $report_file"
    log_message "INFO" "已生成综合报告: $report_file"
}

# 安装资源管理服务
install_service() {
    log_message "INFO" "安装资源管理服务"
    
    # 创建systemd服务文件
    local service_file="/etc/systemd/system/wordpecker-resource-manager.service"
    
    sudo tee "$service_file" > /dev/null << EOF
[Unit]
Description=WordPecker Resource Manager
After=network.target
Wants=network.target

[Service]
Type=forking
User=$(whoami)
WorkingDirectory=$PROJECT_DIR
ExecStart=$SCRIPT_DIR/resource-manager.sh start
ExecStop=$SCRIPT_DIR/resource-manager.sh stop
ExecReload=$SCRIPT_DIR/resource-manager.sh restart
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    # 重新加载systemd并启用服务
    sudo systemctl daemon-reload
    sudo systemctl enable wordpecker-resource-manager.service
    
    log_message "INFO" "资源管理服务安装完成"
    echo "服务已安装并设置为开机自启动"
    echo "使用以下命令管理服务:"
    echo "  sudo systemctl start wordpecker-resource-manager"
    echo "  sudo systemctl stop wordpecker-resource-manager"
    echo "  sudo systemctl status wordpecker-resource-manager"
}

# 卸载资源管理服务
uninstall_service() {
    log_message "INFO" "卸载资源管理服务"
    
    # 停止并禁用服务
    sudo systemctl stop wordpecker-resource-manager.service 2>/dev/null || true
    sudo systemctl disable wordpecker-resource-manager.service 2>/dev/null || true
    
    # 删除服务文件
    sudo rm -f /etc/systemd/system/wordpecker-resource-manager.service
    
    # 重新加载systemd
    sudo systemctl daemon-reload
    
    log_message "INFO" "资源管理服务卸载完成"
    echo "服务已卸载"
}

# 主函数
main() {
    # 检查依赖
    if ! check_dependencies; then
        exit 1
    fi
    
    case "${1:-status}" in
        start)
            start_monitoring
            ;;
        stop)
            stop_monitoring
            ;;
        restart)
            stop_monitoring
            sleep 2
            start_monitoring
            ;;
        status)
            check_status
            ;;
        check)
            run_protection_check
            ;;
        cleanup)
            run_cleanup "${2:-full}"
            ;;
        report)
            generate_report
            ;;
        install)
            install_service
            ;;
        uninstall)
            uninstall_service
            ;;
        *)
            echo "WordPecker 资源管理器"
            echo ""
            echo "用法: $0 {start|stop|restart|status|check|cleanup|report|install|uninstall}"
            echo ""
            echo "命令说明:"
            echo "  start     - 启动资源监控服务"
            echo "  stop      - 停止资源监控服务"
            echo "  restart   - 重启资源监控服务"
            echo "  status    - 查看监控状态和资源使用情况"
            echo "  check     - 执行资源保护检查"
            echo "  cleanup   - 执行清理操作 [full|logs|cache|temp]"
            echo "  report    - 生成综合资源报告"
            echo "  install   - 安装为系统服务（需要sudo权限）"
            echo "  uninstall - 卸载系统服务（需要sudo权限）"
            echo ""
            echo "示例:"
            echo "  $0 start              # 启动监控"
            echo "  $0 status             # 查看状态"
            echo "  $0 cleanup cache      # 清理缓存"
            echo "  $0 report             # 生成报告"
            exit 1
            ;;
    esac
}

main "$@"