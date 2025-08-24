#!/bin/bash

# WordPecker 日志实时监控脚本
# 用于监控应用日志并发出告警

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
BACKEND_LOG_DIR="$PROJECT_DIR/backend/logs"
MONITOR_LOG="$LOG_DIR/log-monitor.log"
ALERT_LOG="$LOG_DIR/log-alerts.log"

# 监控配置
ERROR_THRESHOLD=10          # 每分钟错误数阈值
CRITICAL_KEYWORDS=("CRITICAL" "FATAL" "OutOfMemoryError" "ECONNREFUSED" "ETIMEDOUT")
PERFORMANCE_THRESHOLD=2000  # 响应时间阈值（毫秒）
MONITOR_INTERVAL=60         # 监控间隔（秒）

# 创建必要目录
mkdir -p "$LOG_DIR" "$BACKEND_LOG_DIR"

# 记录监控日志
log_monitor() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$MONITOR_LOG"
}

# 发送告警
send_alert() {
    local severity=$1
    local title=$2
    local message=$3
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 记录到告警日志
    cat >> "$ALERT_LOG" << EOF
[$timestamp] [$severity] $title
$message
---
EOF
    
    # 记录到系统日志
    logger -t wordpecker-monitor "[$severity] $title: $message"
    
    # 如果是严重告警，可以发送通知（邮件、Slack等）
    if [ "$severity" = "CRITICAL" ]; then
        log_monitor "CRITICAL" "CRITICAL ALERT: $title - $message"
        
        # 这里可以添加发送邮件或其他通知的逻辑
        # send_email_alert "$title" "$message"
        # send_slack_alert "$title" "$message"
    fi
}

# 监控错误率
monitor_error_rate() {
    local error_log="$LOG_DIR/error-current.log"
    local combined_log="$LOG_DIR/combined-current.log"
    
    if [ ! -f "$error_log" ] || [ ! -f "$combined_log" ]; then
        log_monitor "WARN" "日志文件不存在，跳过错误率监控"
        return
    fi
    
    # 统计最近1分钟的日志
    local minute_ago=$(date -d '1 minute ago' '+%Y-%m-%d %H:%M' 2>/dev/null || date -v-1M '+%Y-%m-%d %H:%M')
    local error_count=$(grep "$minute_ago" "$error_log" 2>/dev/null | wc -l)
    local total_count=$(grep "$minute_ago" "$combined_log" 2>/dev/null | wc -l)
    
    if [ $total_count -eq 0 ]; then
        log_monitor "INFO" "最近1分钟无日志记录"
        return
    fi
    
    local error_rate=$((error_count * 100 / total_count))
    
    log_monitor "INFO" "错误率监控: ${error_count}/${total_count} (${error_rate}%)"
    
    # 检查错误数量阈值
    if [ $error_count -gt $ERROR_THRESHOLD ]; then
        send_alert "HIGH" "错误率过高" "最近1分钟内发生了 $error_count 个错误，超过阈值 $ERROR_THRESHOLD"
    fi
    
    # 检查错误率阈值
    if [ $error_rate -gt 20 ]; then
        send_alert "HIGH" "错误率异常" "错误率达到 ${error_rate}%，可能存在系统问题"
    fi
}

# 监控关键字
monitor_critical_keywords() {
    local combined_log="$LOG_DIR/combined-current.log"
    
    if [ ! -f "$combined_log" ]; then
        return
    fi
    
    # 检查最近1分钟的日志
    local minute_ago=$(date -d '1 minute ago' '+%Y-%m-%d %H:%M' 2>/dev/null || date -v-1M '+%Y-%m-%d %H:%M')
    local recent_logs=$(grep "$minute_ago" "$combined_log" 2>/dev/null || echo "")
    
    if [ -z "$recent_logs" ]; then
        return
    fi
    
    # 检查每个关键字
    for keyword in "${CRITICAL_KEYWORDS[@]}"; do
        local count=$(echo "$recent_logs" | grep -c "$keyword" 2>/dev/null || echo "0")
        
        if [ $count -gt 0 ]; then
            local sample_log=$(echo "$recent_logs" | grep "$keyword" | head -1)
            send_alert "CRITICAL" "发现关键错误" "检测到关键字 '$keyword' 出现 $count 次。示例: $sample_log"
        fi
    done
}

# 监控性能问题
monitor_performance() {
    local performance_log="$LOG_DIR/performance-current.log"
    
    if [ ! -f "$performance_log" ]; then
        return
    fi
    
    # 检查最近1分钟的性能日志
    local minute_ago=$(date -d '1 minute ago' '+%Y-%m-%d %H:%M' 2>/dev/null || date -v-1M '+%Y-%m-%d %H:%M')
    local slow_requests=$(grep "$minute_ago" "$performance_log" 2>/dev/null | \
                         grep -E "responseTime\":[0-9]*[0-9]{4,}" | wc -l)
    
    if [ $slow_requests -gt 5 ]; then
        send_alert "MEDIUM" "性能问题" "最近1分钟内检测到 $slow_requests 个慢请求（>2秒）"
    fi
    
    # 检查数据库查询性能
    local slow_queries=$(grep "$minute_ago" "$performance_log" 2>/dev/null | \
                        grep -E "dbQueryTime\":[0-9]*[0-9]{3,}" | wc -l)
    
    if [ $slow_queries -gt 3 ]; then
        send_alert "MEDIUM" "数据库性能问题" "最近1分钟内检测到 $slow_queries 个慢查询（>100ms）"
    fi
}

# 监控磁盘空间
monitor_disk_space() {
    local log_dir_usage=$(df "$LOG_DIR" | awk 'NR==2{print $5}' | sed 's/%//')
    local root_usage=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
    
    log_monitor "INFO" "磁盘使用率: 根目录 ${root_usage}%, 日志目录 ${log_dir_usage}%"
    
    if [ $root_usage -gt 90 ]; then
        send_alert "CRITICAL" "磁盘空间严重不足" "根目录使用率达到 ${root_usage}%"
    elif [ $root_usage -gt 80 ]; then
        send_alert "HIGH" "磁盘空间不足" "根目录使用率达到 ${root_usage}%"
    fi
    
    if [ $log_dir_usage -gt 85 ]; then
        send_alert "MEDIUM" "日志目录空间不足" "日志目录使用率达到 ${log_dir_usage}%"
        
        # 自动清理旧日志
        log_monitor "INFO" "自动触发日志清理"
        "$PROJECT_DIR/scripts/log-manager.sh" cleanup
    fi
}

# 监控应用进程
monitor_processes() {
    local backend_status=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="wordpecker-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")
    local frontend_status=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="wordpecker-frontend") | .pm2_env.status' 2>/dev/null || echo "unknown")
    
    log_monitor "INFO" "进程状态: Backend=$backend_status, Frontend=$frontend_status"
    
    if [ "$backend_status" != "online" ]; then
        send_alert "CRITICAL" "后端服务异常" "后端服务状态: $backend_status"
    fi
    
    if [ "$frontend_status" != "online" ]; then
        send_alert "HIGH" "前端服务异常" "前端服务状态: $frontend_status"
    fi
}

# 监控内存使用
monitor_memory() {
    local memory_usage=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    local swap_usage=$(free | grep Swap | awk '{if($2>0) printf("%.1f", $3/$2 * 100.0); else print "0"}')
    
    log_monitor "INFO" "内存使用率: RAM ${memory_usage}%, Swap ${swap_usage}%"
    
    if (( $(echo "$memory_usage > 90" | bc -l) )); then
        send_alert "CRITICAL" "内存使用率过高" "内存使用率达到 ${memory_usage}%"
    elif (( $(echo "$memory_usage > 80" | bc -l) )); then
        send_alert "HIGH" "内存使用率较高" "内存使用率达到 ${memory_usage}%"
    fi
    
    if (( $(echo "$swap_usage > 50" | bc -l) )); then
        send_alert "MEDIUM" "Swap使用率较高" "Swap使用率达到 ${swap_usage}%"
    fi
}

# 生成监控报告
generate_monitor_report() {
    local report_file="$LOG_DIR/monitor-report-$(date +%Y%m%d-%H%M).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "monitoring_period": "${MONITOR_INTERVAL}s",
  "system_status": {
    "memory_usage": "$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')%",
    "disk_usage": "$(df / | awk 'NR==2{print $5}')",
    "load_average": "$(uptime | awk -F'load average:' '{print $2}' | xargs)"
  },
  "process_status": {
    "backend": "$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="wordpecker-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")",
    "frontend": "$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="wordpecker-frontend") | .pm2_env.status' 2>/dev/null || echo "unknown")"
  },
  "log_stats": {
    "error_log_size": "$([ -f "$LOG_DIR/error-current.log" ] && wc -l < "$LOG_DIR/error-current.log" || echo "0")",
    "combined_log_size": "$([ -f "$LOG_DIR/combined-current.log" ] && wc -l < "$LOG_DIR/combined-current.log" || echo "0")"
  }
}
EOF
    
    log_monitor "INFO" "监控报告已生成: $report_file"
}

# 主监控循环
main() {
    local mode=${1:-"daemon"}
    
    log_monitor "INFO" "启动日志监控 (模式: $mode)"
    
    if [ "$mode" = "once" ]; then
        # 单次执行
        monitor_error_rate
        monitor_critical_keywords
        monitor_performance
        monitor_disk_space
        monitor_processes
        monitor_memory
        generate_monitor_report
    else
        # 守护进程模式
        while true; do
            log_monitor "INFO" "开始监控周期"
            
            monitor_error_rate
            monitor_critical_keywords
            monitor_performance
            monitor_disk_space
            monitor_processes
            monitor_memory
            
            # 每小时生成一次报告
            local current_minute=$(date +%M)
            if [ "$current_minute" = "00" ]; then
                generate_monitor_report
            fi
            
            log_monitor "INFO" "监控周期完成，等待 ${MONITOR_INTERVAL} 秒"
            sleep $MONITOR_INTERVAL
        done
    fi
}

# 信号处理
trap 'log_monitor "INFO" "收到终止信号，停止监控"; exit 0' SIGTERM SIGINT

# 执行主函数
main "$@"