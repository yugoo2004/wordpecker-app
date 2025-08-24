#!/bin/bash

# 资源保护脚本
# 实现资源使用率告警和自动保护机制

# 配置文件
CONFIG_FILE="./config/resource-protection.conf"
LOG_FILE="./logs/resource-protection.log"
ALERT_LOG="./logs/resource-alerts.log"

# 默认配置
DEFAULT_CPU_WARNING=75
DEFAULT_CPU_CRITICAL=90
DEFAULT_MEMORY_WARNING=80
DEFAULT_MEMORY_CRITICAL=90
DEFAULT_DISK_WARNING=85
DEFAULT_DISK_CRITICAL=95
DEFAULT_LOAD_WARNING=2.0
DEFAULT_LOAD_CRITICAL=4.0

# 创建必要目录
mkdir -p ./logs ./config

# 加载配置
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
    else
        # 创建默认配置文件
        cat > "$CONFIG_FILE" << EOF
# 资源保护配置文件

# CPU使用率阈值（%）
CPU_WARNING_THRESHOLD=$DEFAULT_CPU_WARNING
CPU_CRITICAL_THRESHOLD=$DEFAULT_CPU_CRITICAL

# 内存使用率阈值（%）
MEMORY_WARNING_THRESHOLD=$DEFAULT_MEMORY_WARNING
MEMORY_CRITICAL_THRESHOLD=$DEFAULT_MEMORY_CRITICAL

# 磁盘使用率阈值（%）
DISK_WARNING_THRESHOLD=$DEFAULT_DISK_WARNING
DISK_CRITICAL_THRESHOLD=$DEFAULT_DISK_CRITICAL

# 系统负载阈值
LOAD_WARNING_THRESHOLD=$DEFAULT_LOAD_WARNING
LOAD_CRITICAL_THRESHOLD=$DEFAULT_LOAD_CRITICAL

# 保护措施配置
ENABLE_AUTO_RESTART=true
ENABLE_AUTO_CLEANUP=true
ENABLE_PROCESS_THROTTLING=true

# 通知配置
ENABLE_EMAIL_ALERTS=false
EMAIL_RECIPIENT=""
ENABLE_WEBHOOK_ALERTS=false
WEBHOOK_URL=""

# 清理配置
LOG_RETENTION_DAYS=7
CACHE_RETENTION_HOURS=24
TEMP_RETENTION_HOURS=6
EOF
        echo "已创建默认配置文件: $CONFIG_FILE"
    fi
    
    source "$CONFIG_FILE"
}

# 日志函数
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    if [ "$level" = "WARNING" ] || [ "$level" = "CRITICAL" ]; then
        echo "[$timestamp] [$level] $message" >> "$ALERT_LOG"
    fi
    
    # 输出到控制台（如果不是后台运行）
    if [ -t 1 ]; then
        echo "[$level] $message"
    fi
}

# 发送告警通知
send_alert() {
    local level=$1
    local message=$2
    
    # 邮件告警
    if [ "$ENABLE_EMAIL_ALERTS" = "true" ] && [ -n "$EMAIL_RECIPIENT" ]; then
        echo "WordPecker资源告警 [$level]: $message" | mail -s "WordPecker资源告警" "$EMAIL_RECIPIENT" 2>/dev/null || true
    fi
    
    # Webhook告警
    if [ "$ENABLE_WEBHOOK_ALERTS" = "true" ] && [ -n "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"level\":\"$level\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\",\"service\":\"wordpecker\"}" \
            2>/dev/null || true
    fi
    
    # 系统日志
    logger -t wordpecker-protection "[$level] $message"
}

# 获取系统资源使用情况
get_system_metrics() {
    # CPU使用率
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}' | sed 's/us,//')
    if [ -z "$CPU_USAGE" ]; then
        CPU_USAGE=$(awk '{u=$2+$4; t=$2+$3+$4+$5; if (NR==1){u1=u; t1=t;} else print ($2+$4-u1) * 100 / (t-t1); }' <(grep 'cpu ' /proc/stat; sleep 1; grep 'cpu ' /proc/stat) | tail -1)
    fi
    CPU_USAGE=${CPU_USAGE:-0}
    
    # 内存使用率
    MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    
    # 磁盘使用率
    DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    
    # 系统负载
    LOAD_AVERAGE=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    
    # 可用内存（MB）
    AVAILABLE_MEMORY=$(free -m | grep Mem | awk '{print $7}')
    
    # 可用磁盘空间（GB）
    AVAILABLE_DISK=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
}

# 获取PM2进程信息
get_pm2_processes() {
    if command -v pm2 &> /dev/null; then
        PM2_PROCESSES=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.pm2_env.status == "online") | "\(.name):\(.monit.memory):\(.monit.cpu)"' 2>/dev/null)
    else
        PM2_PROCESSES=""
    fi
}

# CPU保护措施
handle_cpu_protection() {
    local cpu_usage=$1
    local level=$2
    
    if [ "$level" = "CRITICAL" ] && [ "$ENABLE_PROCESS_THROTTLING" = "true" ]; then
        log_message "CRITICAL" "CPU使用率达到临界值 ${cpu_usage}%，执行进程限制"
        
        # 限制PM2进程CPU使用
        if command -v pm2 &> /dev/null; then
            pm2 list --no-color | grep online | awk '{print $2}' | while read app_name; do
                if [ -n "$app_name" ] && [ "$app_name" != "App" ]; then
                    # 重启进程以释放资源
                    pm2 restart "$app_name" --max-memory-restart 300M 2>/dev/null || true
                    log_message "INFO" "已重启进程 $app_name 以释放CPU资源"
                fi
            done
        fi
        
        # 降低非关键进程优先级
        pgrep -f "node.*frontend" | xargs -r renice 10 2>/dev/null || true
        
        send_alert "CRITICAL" "CPU使用率过高: ${cpu_usage}%，已执行保护措施"
    elif [ "$level" = "WARNING" ]; then
        log_message "WARNING" "CPU使用率告警: ${cpu_usage}%"
        send_alert "WARNING" "CPU使用率告警: ${cpu_usage}%"
    fi
}

# 内存保护措施
handle_memory_protection() {
    local memory_usage=$1
    local level=$2
    
    if [ "$level" = "CRITICAL" ] && [ "$ENABLE_AUTO_RESTART" = "true" ]; then
        log_message "CRITICAL" "内存使用率达到临界值 ${memory_usage}%，执行内存保护"
        
        # 清理缓存
        if [ "$ENABLE_AUTO_CLEANUP" = "true" ]; then
            cleanup_memory_cache
        fi
        
        # 重启内存使用最高的PM2进程
        if command -v pm2 &> /dev/null && [ -n "$PM2_PROCESSES" ]; then
            local high_memory_process=$(echo "$PM2_PROCESSES" | sort -t: -k2 -nr | head -1 | cut -d: -f1)
            if [ -n "$high_memory_process" ]; then
                log_message "INFO" "重启高内存使用进程: $high_memory_process"
                pm2 restart "$high_memory_process" 2>/dev/null || true
            fi
        fi
        
        # 强制垃圾回收
        pkill -USR2 node 2>/dev/null || true
        
        send_alert "CRITICAL" "内存使用率过高: ${memory_usage}%，已执行保护措施"
    elif [ "$level" = "WARNING" ]; then
        log_message "WARNING" "内存使用率告警: ${memory_usage}%"
        send_alert "WARNING" "内存使用率告警: ${memory_usage}%"
    fi
}

# 磁盘保护措施
handle_disk_protection() {
    local disk_usage=$1
    local level=$2
    
    if [ "$level" = "CRITICAL" ] && [ "$ENABLE_AUTO_CLEANUP" = "true" ]; then
        log_message "CRITICAL" "磁盘使用率达到临界值 ${disk_usage}%，执行磁盘清理"
        
        # 执行紧急清理
        emergency_disk_cleanup
        
        send_alert "CRITICAL" "磁盘使用率过高: ${disk_usage}%，已执行清理措施"
    elif [ "$level" = "WARNING" ]; then
        log_message "WARNING" "磁盘使用率告警: ${disk_usage}%"
        send_alert "WARNING" "磁盘使用率告警: ${disk_usage}%"
        
        # 预防性清理
        if [ "$ENABLE_AUTO_CLEANUP" = "true" ]; then
            preventive_disk_cleanup
        fi
    fi
}

# 内存缓存清理
cleanup_memory_cache() {
    log_message "INFO" "开始清理内存缓存"
    
    # 清理系统缓存
    sync
    echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true
    
    # 清理应用缓存
    find ./audio-cache -type f -mmin +60 -delete 2>/dev/null || true
    find ./backend/audio-cache -type f -mmin +60 -delete 2>/dev/null || true
    
    # 清理npm缓存
    npm cache clean --force 2>/dev/null || true
    
    log_message "INFO" "内存缓存清理完成"
}

# 预防性磁盘清理
preventive_disk_cleanup() {
    log_message "INFO" "开始预防性磁盘清理"
    
    # 清理旧日志文件
    find ./logs -name "*.log" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true
    find ./backend/logs -name "*.log" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true
    
    # 清理缓存文件
    find ./audio-cache -type f -mmin +$((CACHE_RETENTION_HOURS * 60)) -delete 2>/dev/null || true
    find ./backend/audio-cache -type f -mmin +$((CACHE_RETENTION_HOURS * 60)) -delete 2>/dev/null || true
    
    log_message "INFO" "预防性磁盘清理完成"
}

# 紧急磁盘清理
emergency_disk_cleanup() {
    log_message "INFO" "开始紧急磁盘清理"
    
    # 清理所有日志文件（保留最近1天）
    find ./logs -name "*.log" -mtime +1 -delete 2>/dev/null || true
    find ./backend/logs -name "*.log" -mtime +1 -delete 2>/dev/null || true
    
    # 清理所有缓存文件
    rm -rf ./audio-cache/* 2>/dev/null || true
    rm -rf ./backend/audio-cache/* 2>/dev/null || true
    
    # 清理临时文件
    find ./tmp -type f -delete 2>/dev/null || true
    find /tmp -name "*wordpecker*" -delete 2>/dev/null || true
    
    # 清理PM2日志
    if command -v pm2 &> /dev/null; then
        pm2 flush 2>/dev/null || true
    fi
    
    # 清理构建文件
    rm -rf ./frontend/dist 2>/dev/null || true
    rm -rf ./backend/dist 2>/dev/null || true
    
    # 压缩大文件
    find . -name "*.log" -size +10M -exec gzip {} \; 2>/dev/null || true
    
    log_message "INFO" "紧急磁盘清理完成"
}

# 系统负载保护
handle_load_protection() {
    local load_average=$1
    local level=$2
    
    if [ "$level" = "CRITICAL" ]; then
        log_message "CRITICAL" "系统负载过高: ${load_average}"
        
        # 限制并发连接
        if command -v pm2 &> /dev/null; then
            pm2 scale wordpecker-backend 1 2>/dev/null || true
        fi
        
        send_alert "CRITICAL" "系统负载过高: ${load_average}"
    elif [ "$level" = "WARNING" ]; then
        log_message "WARNING" "系统负载告警: ${load_average}"
        send_alert "WARNING" "系统负载告警: ${load_average}"
    fi
}

# 检查资源使用情况并执行保护措施
check_and_protect() {
    # 加载配置
    load_config
    
    # 获取系统指标
    get_system_metrics
    get_pm2_processes
    
    log_message "INFO" "系统资源检查 - CPU: ${CPU_USAGE}%, 内存: ${MEMORY_USAGE}%, 磁盘: ${DISK_USAGE}%, 负载: ${LOAD_AVERAGE}"
    
    # 检查CPU使用率
    if (( $(echo "$CPU_USAGE >= $CPU_CRITICAL_THRESHOLD" | bc -l) )); then
        handle_cpu_protection "$CPU_USAGE" "CRITICAL"
    elif (( $(echo "$CPU_USAGE >= $CPU_WARNING_THRESHOLD" | bc -l) )); then
        handle_cpu_protection "$CPU_USAGE" "WARNING"
    fi
    
    # 检查内存使用率
    if (( $(echo "$MEMORY_USAGE >= $MEMORY_CRITICAL_THRESHOLD" | bc -l) )); then
        handle_memory_protection "$MEMORY_USAGE" "CRITICAL"
    elif (( $(echo "$MEMORY_USAGE >= $MEMORY_WARNING_THRESHOLD" | bc -l) )); then
        handle_memory_protection "$MEMORY_USAGE" "WARNING"
    fi
    
    # 检查磁盘使用率
    if [ "$DISK_USAGE" -ge "$DISK_CRITICAL_THRESHOLD" ]; then
        handle_disk_protection "$DISK_USAGE" "CRITICAL"
    elif [ "$DISK_USAGE" -ge "$DISK_WARNING_THRESHOLD" ]; then
        handle_disk_protection "$DISK_USAGE" "WARNING"
    fi
    
    # 检查系统负载
    if (( $(echo "$LOAD_AVERAGE >= $LOAD_CRITICAL_THRESHOLD" | bc -l) )); then
        handle_load_protection "$LOAD_AVERAGE" "CRITICAL"
    elif (( $(echo "$LOAD_AVERAGE >= $LOAD_WARNING_THRESHOLD" | bc -l) )); then
        handle_load_protection "$LOAD_AVERAGE" "WARNING"
    fi
}

# 生成资源报告
generate_report() {
    local report_file="./logs/resource-report-$(date +%Y%m%d).log"
    
    echo "=== WordPecker 资源使用报告 ===" > "$report_file"
    echo "生成时间: $(date)" >> "$report_file"
    echo "" >> "$report_file"
    
    get_system_metrics
    get_pm2_processes
    
    echo "系统资源使用情况:" >> "$report_file"
    echo "  CPU使用率: ${CPU_USAGE}%" >> "$report_file"
    echo "  内存使用率: ${MEMORY_USAGE}%" >> "$report_file"
    echo "  磁盘使用率: ${DISK_USAGE}%" >> "$report_file"
    echo "  系统负载: ${LOAD_AVERAGE}" >> "$report_file"
    echo "  可用内存: ${AVAILABLE_MEMORY}MB" >> "$report_file"
    echo "  可用磁盘: ${AVAILABLE_DISK}GB" >> "$report_file"
    echo "" >> "$report_file"
    
    if [ -n "$PM2_PROCESSES" ]; then
        echo "PM2进程状态:" >> "$report_file"
        echo "$PM2_PROCESSES" | while IFS=: read name memory cpu; do
            echo "  $name: 内存=${memory}bytes, CPU=${cpu}%" >> "$report_file"
        done
    fi
    
    echo "报告已生成: $report_file"
}

# 主函数
main() {
    case "${1:-check}" in
        check)
            check_and_protect
            ;;
        report)
            generate_report
            ;;
        cleanup)
            echo "执行手动清理..."
            preventive_disk_cleanup
            cleanup_memory_cache
            echo "清理完成"
            ;;
        emergency-cleanup)
            echo "执行紧急清理..."
            emergency_disk_cleanup
            cleanup_memory_cache
            echo "紧急清理完成"
            ;;
        config)
            echo "当前配置文件: $CONFIG_FILE"
            if [ -f "$CONFIG_FILE" ]; then
                cat "$CONFIG_FILE"
            else
                echo "配置文件不存在，将创建默认配置"
                load_config
            fi
            ;;
        *)
            echo "用法: $0 {check|report|cleanup|emergency-cleanup|config}"
            echo "  check            - 检查资源使用情况并执行保护措施"
            echo "  report           - 生成资源使用报告"
            echo "  cleanup          - 执行预防性清理"
            echo "  emergency-cleanup - 执行紧急清理"
            echo "  config           - 显示当前配置"
            exit 1
            ;;
    esac
}

main "$@"