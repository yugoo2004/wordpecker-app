#!/bin/bash

# 系统资源监控脚本
# 监控 CPU、内存、磁盘使用率，并在超过阈值时采取保护措施

# 配置参数
MONITOR_INTERVAL=60  # 监控间隔（秒）
LOG_FILE="./logs/resource-monitor.log"
ALERT_LOG="./logs/resource-alerts.log"
PID_FILE="./logs/resource-monitor.pid"

# 告警阈值
CPU_THRESHOLD=80      # CPU使用率告警阈值（%）
MEMORY_THRESHOLD=85   # 内存使用率告警阈值（%）
DISK_THRESHOLD=90     # 磁盘使用率告警阈值（%）

# 严重告警阈值（触发保护措施）
CPU_CRITICAL=95
MEMORY_CRITICAL=95
DISK_CRITICAL=95

# 创建必要目录
mkdir -p ./logs

# 记录PID
echo $$ > "$PID_FILE"

# 日志函数
log_info() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$LOG_FILE"
}

log_warning() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$LOG_FILE"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$ALERT_LOG"
}

log_critical() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [CRITICAL] $1" >> "$LOG_FILE"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [CRITICAL] $1" >> "$ALERT_LOG"
}

# 获取CPU使用率
get_cpu_usage() {
    # 使用top命令获取CPU使用率
    local cpu_idle=$(top -bn1 | grep "Cpu(s)" | awk '{print $8}' | awk -F'%' '{print $1}')
    if [ -n "$cpu_idle" ]; then
        echo "scale=1; 100 - $cpu_idle" | bc
    else
        # 备用方法：使用/proc/stat
        local cpu_usage=$(awk '{u=$2+$4; t=$2+$3+$4+$5; if (NR==1){u1=u; t1=t;} else print ($2+$4-u1) * 100 / (t-t1) "%"; }' <(grep 'cpu ' /proc/stat; sleep 1; grep 'cpu ' /proc/stat) | tail -1 | sed 's/%//')
        echo "${cpu_usage:-0}"
    fi
}

# 获取内存使用率
get_memory_usage() {
    free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}'
}

# 获取磁盘使用率
get_disk_usage() {
    df -h / | awk 'NR==2{print $5}' | sed 's/%//'
}

# 获取系统负载
get_system_load() {
    uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//'
}

# 获取进程信息
get_process_info() {
    echo "=== PM2 进程状态 ===" >> "$LOG_FILE"
    if command -v pm2 &> /dev/null; then
        pm2 jlist 2>/dev/null | jq -r '.[] | "进程: \(.name), 状态: \(.pm2_env.status), 内存: \(.monit.memory/1024/1024 | floor)MB, CPU: \(.monit.cpu)%"' >> "$LOG_FILE" 2>/dev/null || {
            pm2 list --no-color >> "$LOG_FILE" 2>/dev/null
        }
    else
        echo "PM2 未安装" >> "$LOG_FILE"
    fi
    echo "" >> "$LOG_FILE"
}

# CPU保护措施
protect_cpu() {
    local cpu_usage=$1
    log_critical "CPU使用率过高: ${cpu_usage}%，执行保护措施"
    
    # 降低PM2进程优先级
    if command -v pm2 &> /dev/null; then
        log_info "降低PM2进程优先级"
        pm2 list --no-color | grep -E "online|errored" | awk '{print $2}' | while read app_name; do
            if [ -n "$app_name" ] && [ "$app_name" != "App" ]; then
                pm2 restart "$app_name" --max-memory-restart 400M 2>/dev/null || true
            fi
        done
    fi
    
    # 清理临时文件
    cleanup_temp_files
}

# 内存保护措施
protect_memory() {
    local memory_usage=$1
    log_critical "内存使用率过高: ${memory_usage}%，执行保护措施"
    
    # 清理缓存
    cleanup_cache_files
    
    # 重启内存使用最高的PM2进程
    if command -v pm2 &> /dev/null; then
        log_info "重启内存使用最高的PM2进程"
        # 获取内存使用最高的进程并重启
        local high_memory_app=$(pm2 jlist 2>/dev/null | jq -r 'sort_by(.monit.memory) | reverse | .[0].name' 2>/dev/null)
        if [ -n "$high_memory_app" ] && [ "$high_memory_app" != "null" ]; then
            log_info "重启高内存使用进程: $high_memory_app"
            pm2 restart "$high_memory_app" 2>/dev/null || true
        fi
    fi
    
    # 强制垃圾回收（如果是Node.js进程）
    pkill -USR2 node 2>/dev/null || true
}

# 磁盘保护措施
protect_disk() {
    local disk_usage=$1
    log_critical "磁盘使用率过高: ${disk_usage}%，执行保护措施"
    
    # 清理日志文件
    cleanup_log_files
    
    # 清理缓存文件
    cleanup_cache_files
    
    # 清理临时文件
    cleanup_temp_files
    
    # 清理PM2日志
    if command -v pm2 &> /dev/null; then
        log_info "清理PM2日志"
        pm2 flush 2>/dev/null || true
    fi
}

# 清理临时文件
cleanup_temp_files() {
    log_info "清理临时文件"
    
    # 清理音频缓存（保留最近1天）
    find ./audio-cache -type f -mtime +1 -delete 2>/dev/null || true
    find ./backend/audio-cache -type f -mtime +1 -delete 2>/dev/null || true
    
    # 清理系统临时文件
    find /tmp -type f -name "*.tmp" -mtime +1 -delete 2>/dev/null || true
    
    # 清理Node.js缓存
    find . -name "node_modules/.cache" -type d -exec rm -rf {} + 2>/dev/null || true
}

# 清理缓存文件
cleanup_cache_files() {
    log_info "清理缓存文件"
    
    # 清理音频缓存（保留最近6小时）
    find ./audio-cache -type f -mmin +360 -delete 2>/dev/null || true
    find ./backend/audio-cache -type f -mmin +360 -delete 2>/dev/null || true
    
    # 清理构建缓存
    rm -rf ./frontend/dist/.vite 2>/dev/null || true
    rm -rf ./backend/dist 2>/dev/null || true
    
    # 清理npm缓存
    npm cache clean --force 2>/dev/null || true
}

# 清理日志文件
cleanup_log_files() {
    log_info "清理旧日志文件"
    
    # 清理应用日志（保留最近3天）
    find ./logs -name "*.log" -mtime +3 -delete 2>/dev/null || true
    find ./backend/logs -name "*.log" -mtime +3 -delete 2>/dev/null || true
    
    # 清理PM2日志（保留最近1天）
    find ~/.pm2/logs -name "*.log" -mtime +1 -delete 2>/dev/null || true
    
    # 压缩大日志文件
    find ./logs -name "*.log" -size +50M -exec gzip {} \; 2>/dev/null || true
}

# 监控主循环
monitor_resources() {
    log_info "开始系统资源监控，监控间隔: ${MONITOR_INTERVAL}秒"
    
    while true; do
        # 获取资源使用情况
        local cpu_usage=$(get_cpu_usage)
        local memory_usage=$(get_memory_usage)
        local disk_usage=$(get_disk_usage)
        local system_load=$(get_system_load)
        
        # 记录当前状态
        log_info "资源使用情况 - CPU: ${cpu_usage}%, 内存: ${memory_usage}%, 磁盘: ${disk_usage}%, 负载: ${system_load}"
        
        # 记录进程信息（每10分钟一次）
        if [ $(($(date +%s) % 600)) -lt $MONITOR_INTERVAL ]; then
            get_process_info
        fi
        
        # 检查CPU使用率
        if (( $(echo "$cpu_usage >= $CPU_CRITICAL" | bc -l) )); then
            protect_cpu "$cpu_usage"
        elif (( $(echo "$cpu_usage >= $CPU_THRESHOLD" | bc -l) )); then
            log_warning "CPU使用率告警: ${cpu_usage}%"
        fi
        
        # 检查内存使用率
        if (( $(echo "$memory_usage >= $MEMORY_CRITICAL" | bc -l) )); then
            protect_memory "$memory_usage"
        elif (( $(echo "$memory_usage >= $MEMORY_THRESHOLD" | bc -l) )); then
            log_warning "内存使用率告警: ${memory_usage}%"
        fi
        
        # 检查磁盘使用率
        if [ "$disk_usage" -ge "$DISK_CRITICAL" ]; then
            protect_disk "$disk_usage"
        elif [ "$disk_usage" -ge "$DISK_THRESHOLD" ]; then
            log_warning "磁盘使用率告警: ${disk_usage}%"
        fi
        
        # 检查系统负载
        local load_threshold=$(nproc)
        if (( $(echo "$system_load > $load_threshold" | bc -l) )); then
            log_warning "系统负载过高: ${system_load} (CPU核心数: $load_threshold)"
        fi
        
        sleep "$MONITOR_INTERVAL"
    done
}

# 信号处理
cleanup_and_exit() {
    log_info "收到退出信号，停止资源监控"
    rm -f "$PID_FILE"
    exit 0
}

trap cleanup_and_exit SIGTERM SIGINT

# 检查是否已有实例在运行
if [ -f "$PID_FILE" ]; then
    local old_pid=$(cat "$PID_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
        echo "资源监控已在运行 (PID: $old_pid)"
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

# 启动监控
case "${1:-start}" in
    start)
        echo "启动系统资源监控..."
        monitor_resources
        ;;
    stop)
        if [ -f "$PID_FILE" ]; then
            local pid=$(cat "$PID_FILE")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid"
                echo "已停止资源监控 (PID: $pid)"
            else
                echo "资源监控未运行"
            fi
            rm -f "$PID_FILE"
        else
            echo "资源监控未运行"
        fi
        ;;
    status)
        if [ -f "$PID_FILE" ]; then
            local pid=$(cat "$PID_FILE")
            if kill -0 "$pid" 2>/dev/null; then
                echo "资源监控正在运行 (PID: $pid)"
                exit 0
            else
                echo "资源监控未运行"
                exit 1
            fi
        else
            echo "资源监控未运行"
            exit 1
        fi
        ;;
    cleanup)
        echo "执行手动清理..."
        cleanup_log_files
        cleanup_cache_files
        cleanup_temp_files
        echo "清理完成"
        ;;
    *)
        echo "用法: $0 {start|stop|status|cleanup}"
        echo "  start   - 启动资源监控"
        echo "  stop    - 停止资源监控"
        echo "  status  - 查看监控状态"
        echo "  cleanup - 手动执行清理"
        exit 1
        ;;
esac