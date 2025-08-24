#!/bin/bash
# 系统资源监控脚本
# 监控 CPU、内存、磁盘使用率，并在超过阈值时采取保护措施

set -e

PROJECT_DIR="/home/devbox/wordpecker-app"
LOG_FILE="$PROJECT_DIR/logs/resource-monitor.log"
ALERT_LOG="$PROJECT_DIR/logs/resource-alerts.log"

# 阈值配置
CPU_WARNING_THRESHOLD=70
CPU_CRITICAL_THRESHOLD=85
MEMORY_WARNING_THRESHOLD=75
MEMORY_CRITICAL_THRESHOLD=90
DISK_WARNING_THRESHOLD=80
DISK_CRITICAL_THRESHOLD=90

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$ALERT_LOG")"

# 记录日志函数
log_message() {
    local level=$1
    local message=$2
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >> "$LOG_FILE"
}

# 记录告警函数
log_alert() {
    local level=$1
    local message=$2
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >> "$ALERT_LOG"
    log_message "$level" "$message"
}

# 获取 CPU 使用率
get_cpu_usage() {
    # 使用 top 命令获取 CPU 使用率
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    echo "${cpu_usage:-0}"
}

# 获取内存使用率
get_memory_usage() {
    # 使用 free 命令获取内存使用率
    local memory_usage=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    echo "${memory_usage:-0}"
}

# 获取磁盘使用率
get_disk_usage() {
    # 获取根分区磁盘使用率
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    echo "${disk_usage:-0}"
}

# 获取进程信息
get_process_info() {
    # 获取 WordPecker 相关进程的资源使用情况
    local backend_pid=$(pgrep -f "wordpecker-backend" | head -1)
    local frontend_pid=$(pgrep -f "wordpecker-frontend" | head -1)
    
    if [ -n "$backend_pid" ]; then
        local backend_cpu=$(ps -p "$backend_pid" -o %cpu --no-headers 2>/dev/null || echo "0")
        local backend_mem=$(ps -p "$backend_pid" -o %mem --no-headers 2>/dev/null || echo "0")
        echo "Backend PID:$backend_pid CPU:${backend_cpu}% MEM:${backend_mem}%"
    else
        echo "Backend: 未运行"
    fi
    
    if [ -n "$frontend_pid" ]; then
        local frontend_cpu=$(ps -p "$frontend_pid" -o %cpu --no-headers 2>/dev/null || echo "0")
        local frontend_mem=$(ps -p "$frontend_pid" -o %mem --no-headers 2>/dev/null || echo "0")
        echo "Frontend PID:$frontend_pid CPU:${frontend_cpu}% MEM:${frontend_mem}%"
    else
        echo "Frontend: 未运行"
    fi
}

# CPU 监控和处理
monitor_cpu() {
    local cpu_usage=$(get_cpu_usage)
    local cpu_int=${cpu_usage%.*}  # 转换为整数
    
    log_message "INFO" "CPU 使用率: ${cpu_usage}%"
    
    if [ "$cpu_int" -ge "$CPU_CRITICAL_THRESHOLD" ]; then
        log_alert "CRITICAL" "CPU 使用率过高: ${cpu_usage}% (阈值: ${CPU_CRITICAL_THRESHOLD}%)"
        
        # 重启服务以释放 CPU
        log_alert "ACTION" "重启 WordPecker 服务以释放 CPU 资源"
        pm2 restart wordpecker-backend 2>/dev/null || true
        
        # 清理临时文件
        find "$PROJECT_DIR/audio-cache" -type f -mtime +0.5 -delete 2>/dev/null || true
        
    elif [ "$cpu_int" -ge "$CPU_WARNING_THRESHOLD" ]; then
        log_alert "WARNING" "CPU 使用率较高: ${cpu_usage}% (阈值: ${CPU_WARNING_THRESHOLD}%)"
    fi
}

# 内存监控和处理
monitor_memory() {
    local memory_usage=$(get_memory_usage)
    local memory_int=${memory_usage%.*}  # 转换为整数
    
    log_message "INFO" "内存使用率: ${memory_usage}%"
    
    if [ "$memory_int" -ge "$MEMORY_CRITICAL_THRESHOLD" ]; then
        log_alert "CRITICAL" "内存使用率过高: ${memory_usage}% (阈值: ${MEMORY_CRITICAL_THRESHOLD}%)"
        
        # 重启内存使用最高的服务
        log_alert "ACTION" "重启服务以释放内存"
        pm2 restart wordpecker-backend 2>/dev/null || true
        
        # 清理缓存文件
        find "$PROJECT_DIR/audio-cache" -type f -mtime +0.1 -delete 2>/dev/null || true
        find "$PROJECT_DIR/logs" -name "*.log" -mtime +1 -delete 2>/dev/null || true
        
        # 清理 PM2 日志
        pm2 flush 2>/dev/null || true
        
    elif [ "$memory_int" -ge "$MEMORY_WARNING_THRESHOLD" ]; then
        log_alert "WARNING" "内存使用率较高: ${memory_usage}% (阈值: ${MEMORY_WARNING_THRESHOLD}%)"
        
        # 清理旧的音频缓存
        find "$PROJECT_DIR/audio-cache" -type f -mtime +1 -delete 2>/dev/null || true
    fi
}

# 磁盘监控和处理
monitor_disk() {
    local disk_usage=$(get_disk_usage)
    
    log_message "INFO" "磁盘使用率: ${disk_usage}%"
    
    if [ "$disk_usage" -ge "$DISK_CRITICAL_THRESHOLD" ]; then
        log_alert "CRITICAL" "磁盘使用率过高: ${disk_usage}% (阈值: ${DISK_CRITICAL_THRESHOLD}%)"
        
        # 激进的清理策略
        log_alert "ACTION" "执行紧急磁盘清理"
        
        # 清理所有音频缓存
        find "$PROJECT_DIR/audio-cache" -type f -delete 2>/dev/null || true
        
        # 清理旧日志（保留最近3天）
        find "$PROJECT_DIR/logs" -name "*.log" -mtime +3 -delete 2>/dev/null || true
        
        # 清理 PM2 日志
        pm2 flush 2>/dev/null || true
        
        # 清理系统临时文件
        sudo find /tmp -type f -mtime +1 -delete 2>/dev/null || true
        
    elif [ "$disk_usage" -ge "$DISK_WARNING_THRESHOLD" ]; then
        log_alert "WARNING" "磁盘使用率较高: ${disk_usage}% (阈值: ${DISK_WARNING_THRESHOLD}%)"
        
        # 温和的清理策略
        find "$PROJECT_DIR/audio-cache" -type f -mtime +1 -delete 2>/dev/null || true
        find "$PROJECT_DIR/logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    fi
}

# 监控 PM2 进程状态
monitor_pm2_processes() {
    log_message "INFO" "检查 PM2 进程状态"
    
    # 检查 PM2 是否运行
    if ! pgrep -f "PM2" > /dev/null; then
        log_alert "CRITICAL" "PM2 进程管理器未运行"
        return 1
    fi
    
    # 获取 PM2 进程状态
    local pm2_status=$(pm2 jlist 2>/dev/null || echo "[]")
    
    if [ "$pm2_status" = "[]" ]; then
        log_alert "WARNING" "没有 PM2 管理的进程在运行"
        return 1
    fi
    
    # 检查各个服务状态
    local backend_status=$(echo "$pm2_status" | jq -r '.[] | select(.name=="wordpecker-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")
    local frontend_status=$(echo "$pm2_status" | jq -r '.[] | select(.name=="wordpecker-frontend") | .pm2_env.status' 2>/dev/null || echo "unknown")
    
    log_message "INFO" "Backend 状态: $backend_status, Frontend 状态: $frontend_status"
    
    # 检查异常状态
    if [ "$backend_status" = "errored" ] || [ "$backend_status" = "stopped" ]; then
        log_alert "CRITICAL" "Backend 服务状态异常: $backend_status"
        pm2 restart wordpecker-backend 2>/dev/null || true
    fi
    
    if [ "$frontend_status" = "errored" ] || [ "$frontend_status" = "stopped" ]; then
        log_alert "CRITICAL" "Frontend 服务状态异常: $frontend_status"
        pm2 restart wordpecker-frontend 2>/dev/null || true
    fi
}

# 生成资源使用报告
generate_report() {
    local cpu_usage=$(get_cpu_usage)
    local memory_usage=$(get_memory_usage)
    local disk_usage=$(get_disk_usage)
    local process_info=$(get_process_info)
    
    log_message "REPORT" "=== 系统资源使用报告 ==="
    log_message "REPORT" "CPU: ${cpu_usage}%"
    log_message "REPORT" "内存: ${memory_usage}%"
    log_message "REPORT" "磁盘: ${disk_usage}%"
    log_message "REPORT" "进程信息: $process_info"
    log_message "REPORT" "=========================="
}

# 主监控函数
main() {
    log_message "INFO" "开始系统资源监控"
    
    # 执行各项监控
    monitor_cpu
    monitor_memory
    monitor_disk
    monitor_pm2_processes
    
    # 生成报告
    generate_report
    
    log_message "INFO" "系统资源监控完成"
}

# 错误处理
trap 'log_message "ERROR" "资源监控脚本执行出错: $?"' ERR

# 执行主函数
main "$@"