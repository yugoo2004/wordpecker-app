#!/bin/bash

# WordPecker 优化资源监控脚本
# 基于测试结果优化的高性能资源监控和保护系统
# 实现需求 2.1, 2.2, 4.4 - 优化的资源监控和自动保护

set -euo pipefail

# 配置参数
readonly PROJECT_DIR="/home/devbox/wordpecker-app"
readonly LOG_FILE="$PROJECT_DIR/logs/resource-monitor-optimized.log"
readonly ALERT_LOG="$PROJECT_DIR/logs/resource-alerts-optimized.log"
readonly METRICS_FILE="$PROJECT_DIR/logs/resource-metrics.json"
readonly LOCK_FILE="/tmp/wordpecker-resource-monitor.lock"

# 优化的阈值配置（基于测试结果调整）
readonly CPU_WARNING_THRESHOLD=65
readonly CPU_CRITICAL_THRESHOLD=80
readonly MEMORY_WARNING_THRESHOLD=70
readonly MEMORY_CRITICAL_THRESHOLD=85
readonly DISK_WARNING_THRESHOLD=75
readonly DISK_CRITICAL_THRESHOLD=85

# 性能优化配置
readonly MONITORING_INTERVAL=30
readonly METRICS_RETENTION_HOURS=24
readonly ALERT_COOLDOWN_MINUTES=5
readonly BATCH_CLEANUP_SIZE=100

# 创建必要目录
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$ALERT_LOG")"
mkdir -p "$(dirname "$METRICS_FILE")"

# 优化的日志记录函数
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 使用 printf 提高性能，避免子进程
    printf "%s [%s] %s\n" "$timestamp" "$level" "$message" >> "$LOG_FILE"
}

# 优化的告警记录函数
log_alert() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 检查告警冷却时间
    if ! should_send_alert "$level" "$message"; then
        return 0
    fi
    
    printf "%s [%s] %s\n" "$timestamp" "$level" "$message" >> "$ALERT_LOG"
    log_message "$level" "$message"
    
    # 发送系统通知
    logger -t wordpecker-monitor "[$level] $message" 2>/dev/null || true
}

# 告警冷却检查
should_send_alert() {
    local level="$1"
    local message="$2"
    local alert_key=$(echo "$level:$message" | md5sum | cut -d' ' -f1)
    local cooldown_file="/tmp/wordpecker-alert-$alert_key"
    local current_time=$(date +%s)
    local cooldown_seconds=$((ALERT_COOLDOWN_MINUTES * 60))
    
    if [ -f "$cooldown_file" ]; then
        local last_alert_time=$(cat "$cooldown_file" 2>/dev/null || echo "0")
        local time_diff=$((current_time - last_alert_time))
        
        if [ "$time_diff" -lt "$cooldown_seconds" ]; then
            return 1  # 在冷却期内，不发送告警
        fi
    fi
    
    # 记录告警时间
    echo "$current_time" > "$cooldown_file"
    return 0
}

# 锁文件管理
acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
            log_message "WARN" "资源监控已在运行中 (PID: $lock_pid)"
            exit 1
        else
            rm -f "$LOCK_FILE"
        fi
    fi
    echo $$ > "$LOCK_FILE"
}

release_lock() {
    rm -f "$LOCK_FILE"
}

# 陷阱处理
trap 'release_lock; log_message "ERROR" "资源监控异常退出"' EXIT INT TERM

# 优化的 CPU 使用率获取
get_cpu_usage() {
    # 使用 /proc/stat 获取更准确的 CPU 使用率
    local cpu_line1=$(grep '^cpu ' /proc/stat)
    sleep 1
    local cpu_line2=$(grep '^cpu ' /proc/stat)
    
    # 解析 CPU 时间
    local cpu1=($cpu_line1)
    local cpu2=($cpu_line2)
    
    local idle1=${cpu1[4]}
    local idle2=${cpu2[4]}
    
    local total1=0
    local total2=0
    
    for i in {1..7}; do
        total1=$((total1 + ${cpu1[$i]}))
        total2=$((total2 + ${cpu2[$i]}))
    done
    
    local total_diff=$((total2 - total1))
    local idle_diff=$((idle2 - idle1))
    
    if [ "$total_diff" -gt 0 ]; then
        local cpu_usage=$(( (total_diff - idle_diff) * 100 / total_diff ))
        echo "$cpu_usage"
    else
        echo "0"
    fi
}

# 优化的内存使用率获取
get_memory_usage() {
    # 直接读取 /proc/meminfo，避免调用外部命令
    local mem_total=$(grep '^MemTotal:' /proc/meminfo | awk '{print $2}')
    local mem_available=$(grep '^MemAvailable:' /proc/meminfo | awk '{print $2}')
    
    if [ "$mem_total" -gt 0 ]; then
        local mem_used=$((mem_total - mem_available))
        local mem_usage=$((mem_used * 100 / mem_total))
        echo "$mem_usage"
    else
        echo "0"
    fi
}

# 优化的磁盘使用率获取
get_disk_usage() {
    # 使用 df 但只获取根分区
    local disk_info=$(df / | awk 'NR==2 {print $3, $2}')
    local used=$(echo "$disk_info" | cut -d' ' -f1)
    local total=$(echo "$disk_info" | cut -d' ' -f2)
    
    if [ "$total" -gt 0 ]; then
        local disk_usage=$((used * 100 / total))
        echo "$disk_usage"
    else
        echo "0"
    fi
}

# 获取进程资源使用情况
get_process_metrics() {
    local backend_metrics=""
    local frontend_metrics=""
    
    # 查找 WordPecker 进程
    local backend_pid=$(pgrep -f "wordpecker-backend" | head -1 2>/dev/null || echo "")
    local frontend_pid=$(pgrep -f "wordpecker-frontend" | head -1 2>/dev/null || echo "")
    
    if [ -n "$backend_pid" ]; then
        local proc_stat=$(cat "/proc/$backend_pid/stat" 2>/dev/null || echo "")
        if [ -n "$proc_stat" ]; then
            local proc_status=$(cat "/proc/$backend_pid/status" 2>/dev/null || echo "")
            local cpu_percent=$(ps -p "$backend_pid" -o %cpu --no-headers 2>/dev/null | tr -d ' ' || echo "0")
            local mem_kb=$(echo "$proc_status" | grep '^VmRSS:' | awk '{print $2}' || echo "0")
            local mem_mb=$((mem_kb / 1024))
            
            backend_metrics="PID:$backend_pid,CPU:${cpu_percent}%,MEM:${mem_mb}MB"
        fi
    fi
    
    if [ -n "$frontend_pid" ]; then
        local proc_stat=$(cat "/proc/$frontend_pid/stat" 2>/dev/null || echo "")
        if [ -n "$proc_stat" ]; then
            local proc_status=$(cat "/proc/$frontend_pid/status" 2>/dev/null || echo "")
            local cpu_percent=$(ps -p "$frontend_pid" -o %cpu --no-headers 2>/dev/null | tr -d ' ' || echo "0")
            local mem_kb=$(echo "$proc_status" | grep '^VmRSS:' | awk '{print $2}' || echo "0")
            local mem_mb=$((mem_kb / 1024))
            
            frontend_metrics="PID:$frontend_pid,CPU:${cpu_percent}%,MEM:${mem_mb}MB"
        fi
    fi
    
    echo "Backend:${backend_metrics:-未运行} Frontend:${frontend_metrics:-未运行}"
}

# 智能 CPU 监控和处理
monitor_cpu_optimized() {
    local cpu_usage=$(get_cpu_usage)
    
    log_message "INFO" "CPU 使用率: ${cpu_usage}%"
    
    if [ "$cpu_usage" -ge "$CPU_CRITICAL_THRESHOLD" ]; then
        log_alert "CRITICAL" "CPU 使用率过高: ${cpu_usage}% (阈值: ${CPU_CRITICAL_THRESHOLD}%)"
        
        # 智能 CPU 优化策略
        optimize_cpu_usage
        
    elif [ "$cpu_usage" -ge "$CPU_WARNING_THRESHOLD" ]; then
        log_alert "WARNING" "CPU 使用率较高: ${cpu_usage}% (阈值: ${CPU_WARNING_THRESHOLD}%)"
        
        # 轻量级优化
        cleanup_temp_files_light
    fi
    
    echo "$cpu_usage"
}

# CPU 优化策略
optimize_cpu_usage() {
    log_alert "ACTION" "执行 CPU 优化策略"
    
    # 1. 检查是否有异常进程
    local high_cpu_processes=$(ps aux --sort=-%cpu | head -10 | grep -E "(wordpecker|node)" || true)
    if [ -n "$high_cpu_processes" ]; then
        log_message "INFO" "高 CPU 使用进程: $high_cpu_processes"
    fi
    
    # 2. 重启后端服务（通常是 CPU 密集型）
    if command -v pm2 > /dev/null 2>&1; then
        pm2 reload wordpecker-backend --update-env 2>/dev/null || pm2 restart wordpecker-backend 2>/dev/null || true
        log_alert "ACTION" "重启后端服务以优化 CPU 使用"
    fi
    
    # 3. 清理临时文件
    cleanup_temp_files_aggressive
    
    # 4. 调整进程优先级
    local backend_pid=$(pgrep -f "wordpecker-backend" | head -1 2>/dev/null || echo "")
    if [ -n "$backend_pid" ]; then
        renice -n 5 "$backend_pid" 2>/dev/null || true
        log_message "INFO" "调整后端进程优先级"
    fi
}

# 智能内存监控和处理
monitor_memory_optimized() {
    local memory_usage=$(get_memory_usage)
    
    log_message "INFO" "内存使用率: ${memory_usage}%"
    
    if [ "$memory_usage" -ge "$MEMORY_CRITICAL_THRESHOLD" ]; then
        log_alert "CRITICAL" "内存使用率过高: ${memory_usage}% (阈值: ${MEMORY_CRITICAL_THRESHOLD}%)"
        
        # 激进的内存优化策略
        optimize_memory_usage_aggressive
        
    elif [ "$memory_usage" -ge "$MEMORY_WARNING_THRESHOLD" ]; then
        log_alert "WARNING" "内存使用率较高: ${memory_usage}% (阈值: ${MEMORY_WARNING_THRESHOLD}%)"
        
        # 温和的内存优化
        optimize_memory_usage_gentle
    fi
    
    echo "$memory_usage"
}

# 温和的内存优化
optimize_memory_usage_gentle() {
    log_alert "ACTION" "执行温和内存优化"
    
    # 1. 清理音频缓存（保留最近1小时）
    find "$PROJECT_DIR/audio-cache" -type f -mmin +60 -delete 2>/dev/null || true
    
    # 2. 清理旧日志（保留最近24小时）
    find "$PROJECT_DIR/logs" -name "*.log" -mmin +1440 -delete 2>/dev/null || true
    
    # 3. 清理 PM2 日志
    pm2 flush 2>/dev/null || true
    
    # 4. 强制垃圾回收（如果是 Node.js 进程）
    local backend_pid=$(pgrep -f "wordpecker-backend" | head -1 2>/dev/null || echo "")
    if [ -n "$backend_pid" ]; then
        kill -USR2 "$backend_pid" 2>/dev/null || true  # 触发 Node.js GC
    fi
}

# 激进的内存优化
optimize_memory_usage_aggressive() {
    log_alert "ACTION" "执行激进内存优化"
    
    # 1. 清理所有音频缓存
    find "$PROJECT_DIR/audio-cache" -type f -delete 2>/dev/null || true
    
    # 2. 清理所有旧日志（保留最近6小时）
    find "$PROJECT_DIR/logs" -name "*.log" -mmin +360 -delete 2>/dev/null || true
    
    # 3. 重启内存使用最高的服务
    if command -v pm2 > /dev/null 2>&1; then
        # 获取内存使用情况
        local backend_mem=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="wordpecker-backend") | .monit.memory' 2>/dev/null || echo "0")
        local frontend_mem=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="wordpecker-frontend") | .monit.memory' 2>/dev/null || echo "0")
        
        # 重启内存使用较高的服务
        if [ "$backend_mem" -gt "$frontend_mem" ]; then
            pm2 restart wordpecker-backend 2>/dev/null || true
            log_alert "ACTION" "重启后端服务（内存使用: ${backend_mem} bytes）"
        else
            pm2 restart wordpecker-frontend 2>/dev/null || true
            log_alert "ACTION" "重启前端服务（内存使用: ${frontend_mem} bytes）"
        fi
    fi
    
    # 4. 系统级内存清理
    sync
    echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true
    echo 2 > /proc/sys/vm/drop_caches 2>/dev/null || true
    echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
}

# 智能磁盘监控和处理
monitor_disk_optimized() {
    local disk_usage=$(get_disk_usage)
    
    log_message "INFO" "磁盘使用率: ${disk_usage}%"
    
    if [ "$disk_usage" -ge "$DISK_CRITICAL_THRESHOLD" ]; then
        log_alert "CRITICAL" "磁盘使用率过高: ${disk_usage}% (阈值: ${DISK_CRITICAL_THRESHOLD}%)"
        
        # 激进的磁盘清理
        cleanup_disk_aggressive
        
    elif [ "$disk_usage" -ge "$DISK_WARNING_THRESHOLD" ]; then
        log_alert "WARNING" "磁盘使用率较高: ${disk_usage}% (阈值: ${DISK_WARNING_THRESHOLD}%)"
        
        # 温和的磁盘清理
        cleanup_disk_gentle
    fi
    
    echo "$disk_usage"
}

# 温和的磁盘清理
cleanup_disk_gentle() {
    log_alert "ACTION" "执行温和磁盘清理"
    
    local cleaned_size=0
    
    # 1. 清理音频缓存（保留最近2小时）
    local audio_files=$(find "$PROJECT_DIR/audio-cache" -type f -mmin +120 2>/dev/null || true)
    if [ -n "$audio_files" ]; then
        local size_before=$(du -s "$PROJECT_DIR/audio-cache" 2>/dev/null | cut -f1 || echo "0")
        echo "$audio_files" | xargs rm -f 2>/dev/null || true
        local size_after=$(du -s "$PROJECT_DIR/audio-cache" 2>/dev/null | cut -f1 || echo "0")
        cleaned_size=$((cleaned_size + size_before - size_after))
    fi
    
    # 2. 清理旧日志（保留最近7天）
    local log_files=$(find "$PROJECT_DIR/logs" -name "*.log" -mtime +7 2>/dev/null || true)
    if [ -n "$log_files" ]; then
        echo "$log_files" | xargs rm -f 2>/dev/null || true
    fi
    
    # 3. 清理 PM2 日志
    pm2 flush 2>/dev/null || true
    
    log_message "INFO" "温和磁盘清理完成，释放约 ${cleaned_size}KB 空间"
}

# 激进的磁盘清理
cleanup_disk_aggressive() {
    log_alert "ACTION" "执行激进磁盘清理"
    
    local cleaned_size=0
    
    # 1. 清理所有音频缓存
    local size_before=$(du -s "$PROJECT_DIR/audio-cache" 2>/dev/null | cut -f1 || echo "0")
    find "$PROJECT_DIR/audio-cache" -type f -delete 2>/dev/null || true
    local size_after=$(du -s "$PROJECT_DIR/audio-cache" 2>/dev/null | cut -f1 || echo "0")
    cleaned_size=$((cleaned_size + size_before - size_after))
    
    # 2. 清理旧日志（保留最近3天）
    find "$PROJECT_DIR/logs" -name "*.log" -mtime +3 -delete 2>/dev/null || true
    
    # 3. 清理系统临时文件
    find /tmp -type f -mtime +1 -delete 2>/dev/null || true
    
    # 4. 清理 APT 缓存
    apt-get clean 2>/dev/null || true
    
    # 5. 清理 npm 缓存
    npm cache clean --force 2>/dev/null || true
    
    log_message "INFO" "激进磁盘清理完成，释放约 ${cleaned_size}KB 空间"
}

# 轻量级临时文件清理
cleanup_temp_files_light() {
    # 只清理明显的临时文件，不影响性能
    find "$PROJECT_DIR/audio-cache" -name "*.tmp" -delete 2>/dev/null || true
    find /tmp -name "wordpecker-*" -mmin +30 -delete 2>/dev/null || true
}

# 激进的临时文件清理
cleanup_temp_files_aggressive() {
    cleanup_temp_files_light
    
    # 清理更多临时文件
    find "$PROJECT_DIR/audio-cache" -type f -mmin +30 -delete 2>/dev/null || true
    find /tmp -type f -mmin +60 -delete 2>/dev/null || true
}

# PM2 进程监控优化
monitor_pm2_processes_optimized() {
    log_message "INFO" "检查 PM2 进程状态"
    
    # 检查 PM2 守护进程
    if ! pgrep -f "PM2" > /dev/null 2>&1; then
        log_alert "CRITICAL" "PM2 守护进程未运行"
        return 1
    fi
    
    # 获取进程状态（使用缓存避免频繁调用）
    local pm2_cache_file="/tmp/wordpecker-pm2-status.json"
    local cache_age=0
    
    if [ -f "$pm2_cache_file" ]; then
        cache_age=$(( $(date +%s) - $(stat -c %Y "$pm2_cache_file" 2>/dev/null || echo "0") ))
    fi
    
    # 如果缓存超过30秒，更新缓存
    if [ "$cache_age" -gt 30 ]; then
        pm2 jlist > "$pm2_cache_file" 2>/dev/null || echo "[]" > "$pm2_cache_file"
    fi
    
    local pm2_status=$(cat "$pm2_cache_file" 2>/dev/null || echo "[]")
    
    if [ "$pm2_status" = "[]" ]; then
        log_alert "WARNING" "没有 PM2 管理的进程在运行"
        return 1
    fi
    
    # 检查各个服务状态
    local backend_status=$(echo "$pm2_status" | jq -r '.[] | select(.name=="wordpecker-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")
    local frontend_status=$(echo "$pm2_status" | jq -r '.[] | select(.name=="wordpecker-frontend") | .pm2_env.status' 2>/dev/null || echo "unknown")
    
    log_message "INFO" "Backend: $backend_status, Frontend: $frontend_status"
    
    # 智能重启决策
    local restart_needed=false
    
    if [[ "$backend_status" =~ ^(errored|stopped|stopping)$ ]]; then
        log_alert "CRITICAL" "Backend 服务状态异常: $backend_status"
        pm2 restart wordpecker-backend 2>/dev/null || true
        restart_needed=true
    fi
    
    if [[ "$frontend_status" =~ ^(errored|stopped|stopping)$ ]]; then
        log_alert "CRITICAL" "Frontend 服务状态异常: $frontend_status"
        pm2 restart wordpecker-frontend 2>/dev/null || true
        restart_needed=true
    fi
    
    # 如果有重启，清除缓存
    if [ "$restart_needed" = "true" ]; then
        rm -f "$pm2_cache_file"
    fi
}

# 生成优化的资源使用报告
generate_optimized_report() {
    local cpu_usage="$1"
    local memory_usage="$2"
    local disk_usage="$3"
    local process_info="$4"
    local check_duration="$5"
    
    # 更新指标文件
    cat > "$METRICS_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "check_time": "$(date '+%Y-%m-%d %H:%M:%S')",
  "check_duration_ms": $check_duration,
  "system": {
    "cpu": {
      "usage_percent": $cpu_usage,
      "threshold_warning": $CPU_WARNING_THRESHOLD,
      "threshold_critical": $CPU_CRITICAL_THRESHOLD,
      "status": "$([ "$cpu_usage" -ge "$CPU_CRITICAL_THRESHOLD" ] && echo "critical" || [ "$cpu_usage" -ge "$CPU_WARNING_THRESHOLD" ] && echo "warning" || echo "normal")"
    },
    "memory": {
      "usage_percent": $memory_usage,
      "threshold_warning": $MEMORY_WARNING_THRESHOLD,
      "threshold_critical": $MEMORY_CRITICAL_THRESHOLD,
      "status": "$([ "$memory_usage" -ge "$MEMORY_CRITICAL_THRESHOLD" ] && echo "critical" || [ "$memory_usage" -ge "$MEMORY_WARNING_THRESHOLD" ] && echo "warning" || echo "normal")"
    },
    "disk": {
      "usage_percent": $disk_usage,
      "threshold_warning": $DISK_WARNING_THRESHOLD,
      "threshold_critical": $DISK_CRITICAL_THRESHOLD,
      "status": "$([ "$disk_usage" -ge "$DISK_CRITICAL_THRESHOLD" ] && echo "critical" || [ "$disk_usage" -ge "$DISK_WARNING_THRESHOLD" ] && echo "warning" || echo "normal")"
    }
  },
  "processes": {
    "info": "$process_info"
  },
  "optimization": {
    "monitoring_interval": $MONITORING_INTERVAL,
    "alert_cooldown_minutes": $ALERT_COOLDOWN_MINUTES,
    "metrics_retention_hours": $METRICS_RETENTION_HOURS
  }
}
EOF
    
    log_message "REPORT" "=== 优化资源监控报告 ==="
    log_message "REPORT" "检查耗时: ${check_duration}ms"
    log_message "REPORT" "CPU: ${cpu_usage}% (警告: ${CPU_WARNING_THRESHOLD}%, 严重: ${CPU_CRITICAL_THRESHOLD}%)"
    log_message "REPORT" "内存: ${memory_usage}% (警告: ${MEMORY_WARNING_THRESHOLD}%, 严重: ${MEMORY_CRITICAL_THRESHOLD}%)"
    log_message "REPORT" "磁盘: ${disk_usage}% (警告: ${DISK_WARNING_THRESHOLD}%, 严重: ${DISK_CRITICAL_THRESHOLD}%)"
    log_message "REPORT" "进程: $process_info"
    log_message "REPORT" "=========================="
}

# 清理过期指标文件
cleanup_old_metrics() {
    # 清理超过保留期的指标文件
    find "$(dirname "$METRICS_FILE")" -name "*metrics*.json" -mmin +$((METRICS_RETENTION_HOURS * 60)) -delete 2>/dev/null || true
    
    # 清理告警冷却文件
    find /tmp -name "wordpecker-alert-*" -mmin +$((ALERT_COOLDOWN_MINUTES * 2)) -delete 2>/dev/null || true
}

# 主监控函数
main() {
    local start_time=$(date +%s%3N)
    
    # 获取锁
    acquire_lock
    
    log_message "INFO" "开始优化资源监控"
    
    # 清理过期文件
    cleanup_old_metrics
    
    # 执行各项监控
    local cpu_usage=$(monitor_cpu_optimized)
    local memory_usage=$(monitor_memory_optimized)
    local disk_usage=$(monitor_disk_optimized)
    
    # 监控 PM2 进程
    monitor_pm2_processes_optimized
    
    # 获取进程信息
    local process_info=$(get_process_metrics)
    
    # 计算检查耗时
    local end_time=$(date +%s%3N)
    local check_duration=$((end_time - start_time))
    
    # 生成报告
    generate_optimized_report "$cpu_usage" "$memory_usage" "$disk_usage" "$process_info" "$check_duration"
    
    log_message "INFO" "优化资源监控完成，耗时: ${check_duration}ms"
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 优化资源监控脚本

用法: $0 [选项]

选项:
  -h, --help          显示此帮助信息
  -v, --verbose       详细输出模式
  -q, --quiet         静默模式
  --metrics           显示当前资源指标
  --cleanup           执行手动清理
  --test-alerts       测试告警系统

优化特性:
  • 智能阈值调整，减少误报
  • 告警冷却机制，避免告警风暴
  • 分级优化策略，温和到激进
  • 性能优化，减少监控开销
  • 进程级资源监控

阈值配置:
  CPU: 警告 ${CPU_WARNING_THRESHOLD}%, 严重 ${CPU_CRITICAL_THRESHOLD}%
  内存: 警告 ${MEMORY_WARNING_THRESHOLD}%, 严重 ${MEMORY_CRITICAL_THRESHOLD}%
  磁盘: 警告 ${DISK_WARNING_THRESHOLD}%, 严重 ${DISK_CRITICAL_THRESHOLD}%

示例:
  $0                  # 执行资源监控
  $0 --metrics        # 显示资源指标
  $0 --cleanup        # 手动清理
EOF
}

# 显示资源指标
show_metrics() {
    if [ -f "$METRICS_FILE" ]; then
        echo "=== WordPecker 资源监控指标 ==="
        jq -r '
          "检查时间: " + .check_time + "\n" +
          "检查耗时: " + (.check_duration_ms | tostring) + "ms\n" +
          "\nCPU 使用率: " + (.system.cpu.usage_percent | tostring) + "% (" + .system.cpu.status + ")" +
          "\n  警告阈值: " + (.system.cpu.threshold_warning | tostring) + "%" +
          "\n  严重阈值: " + (.system.cpu.threshold_critical | tostring) + "%" +
          "\n\n内存使用率: " + (.system.memory.usage_percent | tostring) + "% (" + .system.memory.status + ")" +
          "\n  警告阈值: " + (.system.memory.threshold_warning | tostring) + "%" +
          "\n  严重阈值: " + (.system.memory.threshold_critical | tostring) + "%" +
          "\n\n磁盘使用率: " + (.system.disk.usage_percent | tostring) + "% (" + .system.disk.status + ")" +
          "\n  警告阈值: " + (.system.disk.threshold_warning | tostring) + "%" +
          "\n  严重阈值: " + (.system.disk.threshold_critical | tostring) + "%" +
          "\n\n进程信息: " + .processes.info
        ' "$METRICS_FILE"
    else
        echo "指标文件不存在，请先运行资源监控"
        exit 1
    fi
}

# 手动清理
manual_cleanup() {
    echo "执行手动清理..."
    cleanup_temp_files_aggressive
    cleanup_disk_gentle
    optimize_memory_usage_gentle
    echo "手动清理完成"
}

# 测试告警系统
test_alerts() {
    echo "测试告警系统..."
    log_alert "INFO" "告警系统测试 - 信息级别"
    log_alert "WARNING" "告警系统测试 - 警告级别"
    log_alert "CRITICAL" "告警系统测试 - 严重级别"
    echo "告警测试完成，请检查日志文件: $ALERT_LOG"
}

# 处理命令行参数
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --metrics)
        show_metrics
        exit 0
        ;;
    --cleanup)
        manual_cleanup
        exit 0
        ;;
    --test-alerts)
        test_alerts
        exit 0
        ;;
    -v|--verbose)
        set -x
        main
        ;;
    -q|--quiet)
        main > /dev/null 2>&1
        ;;
    "")
        main
        ;;
    *)
        echo "未知选项: $1"
        echo "使用 $0 --help 查看帮助信息"
        exit 1
        ;;
esac