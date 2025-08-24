#!/bin/bash

# WordPecker 日志管理脚本
# 用于日志清理、监控和维护

set -e

# 配置变量
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
BACKEND_LOG_DIR="$PROJECT_DIR/backend/logs"
MAX_LOG_SIZE_MB=100        # 单个日志文件最大大小（MB）
MAX_TOTAL_SIZE_GB=1        # 日志目录总大小限制（GB）
RETENTION_DAYS=14          # 日志保留天数
CLEANUP_LOG="$LOG_DIR/log-cleanup.log"

# 创建日志目录
mkdir -p "$LOG_DIR" "$BACKEND_LOG_DIR"

# 记录日志函数
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$CLEANUP_LOG"
}

# 获取文件大小（MB）
get_file_size_mb() {
    local file=$1
    if [ -f "$file" ]; then
        stat -f%z "$file" 2>/dev/null | awk '{print int($1/1024/1024)}' || \
        stat -c%s "$file" 2>/dev/null | awk '{print int($1/1024/1024)}' || \
        echo "0"
    else
        echo "0"
    fi
}

# 获取目录大小（MB）
get_dir_size_mb() {
    local dir=$1
    if [ -d "$dir" ]; then
        du -sm "$dir" 2>/dev/null | cut -f1 || echo "0"
    else
        echo "0"
    fi
}

# 清理旧日志文件
cleanup_old_logs() {
    log_message "INFO" "开始清理 $RETENTION_DAYS 天前的日志文件"
    
    local cleaned_count=0
    local cleaned_size=0
    
    # 清理主日志目录
    find "$LOG_DIR" -name "*.log*" -type f -mtime +$RETENTION_DAYS -print0 | while IFS= read -r -d '' file; do
        local size=$(get_file_size_mb "$file")
        if rm "$file" 2>/dev/null; then
            log_message "INFO" "删除旧日志文件: $(basename "$file") (${size}MB)"
            cleaned_count=$((cleaned_count + 1))
            cleaned_size=$((cleaned_size + size))
        else
            log_message "WARN" "无法删除文件: $file"
        fi
    done
    
    # 清理后端日志目录
    find "$BACKEND_LOG_DIR" -name "*.log*" -type f -mtime +$RETENTION_DAYS -print0 | while IFS= read -r -d '' file; do
        local size=$(get_file_size_mb "$file")
        if rm "$file" 2>/dev/null; then
            log_message "INFO" "删除旧后端日志文件: $(basename "$file") (${size}MB)"
            cleaned_count=$((cleaned_count + 1))
            cleaned_size=$((cleaned_size + size))
        else
            log_message "WARN" "无法删除文件: $file"
        fi
    done
    
    log_message "INFO" "清理完成: 删除了 $cleaned_count 个文件，释放了 ${cleaned_size}MB 空间"
}

# 压缩大日志文件
compress_large_logs() {
    log_message "INFO" "检查并压缩大于 ${MAX_LOG_SIZE_MB}MB 的日志文件"
    
    local compressed_count=0
    
    # 检查主日志目录
    find "$LOG_DIR" -name "*.log" -type f -size +${MAX_LOG_SIZE_MB}M | while read -r file; do
        if [ -f "$file" ]; then
            local size_before=$(get_file_size_mb "$file")
            if gzip "$file" 2>/dev/null; then
                local size_after=$(get_file_size_mb "${file}.gz")
                log_message "INFO" "压缩日志文件: $(basename "$file") (${size_before}MB -> ${size_after}MB)"
                compressed_count=$((compressed_count + 1))
            else
                log_message "WARN" "无法压缩文件: $file"
            fi
        fi
    done
    
    # 检查后端日志目录
    find "$BACKEND_LOG_DIR" -name "*.log" -type f -size +${MAX_LOG_SIZE_MB}M | while read -r file; do
        if [ -f "$file" ]; then
            local size_before=$(get_file_size_mb "$file")
            if gzip "$file" 2>/dev/null; then
                local size_after=$(get_file_size_mb "${file}.gz")
                log_message "INFO" "压缩后端日志文件: $(basename "$file") (${size_before}MB -> ${size_after}MB)"
                compressed_count=$((compressed_count + 1))
            else
                log_message "WARN" "无法压缩文件: $file"
            fi
        fi
    done
    
    log_message "INFO" "压缩完成: 处理了 $compressed_count 个文件"
}

# 检查日志目录大小
check_log_directory_size() {
    log_message "INFO" "检查日志目录大小限制"
    
    local total_size_mb=$(get_dir_size_mb "$LOG_DIR")
    local backend_size_mb=$(get_dir_size_mb "$BACKEND_LOG_DIR")
    local combined_size_mb=$((total_size_mb + backend_size_mb))
    local limit_mb=$((MAX_TOTAL_SIZE_GB * 1024))
    
    log_message "INFO" "当前日志大小: 主目录 ${total_size_mb}MB, 后端目录 ${backend_size_mb}MB, 总计 ${combined_size_mb}MB"
    
    if [ $combined_size_mb -gt $limit_mb ]; then
        log_message "WARN" "日志目录大小超过限制 (${combined_size_mb}MB > ${limit_mb}MB)"
        
        # 强制清理更多文件
        local emergency_retention=$((RETENTION_DAYS / 2))
        log_message "WARN" "启动紧急清理: 删除 $emergency_retention 天前的日志"
        
        find "$LOG_DIR" "$BACKEND_LOG_DIR" -name "*.log*" -type f -mtime +$emergency_retention -delete
        
        # 重新检查大小
        total_size_mb=$(get_dir_size_mb "$LOG_DIR")
        backend_size_mb=$(get_dir_size_mb "$BACKEND_LOG_DIR")
        combined_size_mb=$((total_size_mb + backend_size_mb))
        
        log_message "INFO" "紧急清理后大小: ${combined_size_mb}MB"
    else
        log_message "INFO" "日志目录大小正常"
    fi
}

# 生成日志统计报告
generate_log_stats() {
    log_message "INFO" "生成日志统计报告"
    
    local stats_file="$LOG_DIR/log-stats-$(date +%Y%m%d).json"
    
    cat > "$stats_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "directories": {
    "main_log_dir": {
      "path": "$LOG_DIR",
      "size_mb": $(get_dir_size_mb "$LOG_DIR"),
      "file_count": $(find "$LOG_DIR" -name "*.log*" -type f | wc -l)
    },
    "backend_log_dir": {
      "path": "$BACKEND_LOG_DIR",
      "size_mb": $(get_dir_size_mb "$BACKEND_LOG_DIR"),
      "file_count": $(find "$BACKEND_LOG_DIR" -name "*.log*" -type f | wc -l)
    }
  },
  "config": {
    "retention_days": $RETENTION_DAYS,
    "max_log_size_mb": $MAX_LOG_SIZE_MB,
    "max_total_size_gb": $MAX_TOTAL_SIZE_GB
  },
  "recent_files": [
EOF

    # 添加最近的日志文件信息
    find "$LOG_DIR" "$BACKEND_LOG_DIR" -name "*.log*" -type f -mtime -1 -exec ls -la {} \; | \
    head -10 | while read -r line; do
        echo "    \"$line\"," >> "$stats_file"
    done
    
    # 移除最后一个逗号并关闭JSON
    sed -i '$ s/,$//' "$stats_file"
    echo "  ]" >> "$stats_file"
    echo "}" >> "$stats_file"
    
    log_message "INFO" "统计报告已生成: $stats_file"
}

# 清理PM2日志
cleanup_pm2_logs() {
    log_message "INFO" "清理PM2日志"
    
    if command -v pm2 >/dev/null 2>&1; then
        # 获取PM2日志大小
        local pm2_log_dir="$HOME/.pm2/logs"
        if [ -d "$pm2_log_dir" ]; then
            local pm2_size=$(get_dir_size_mb "$pm2_log_dir")
            log_message "INFO" "PM2日志目录大小: ${pm2_size}MB"
            
            # 如果PM2日志过大，清空它们
            if [ $pm2_size -gt 50 ]; then
                log_message "WARN" "PM2日志过大，执行清理"
                pm2 flush
                log_message "INFO" "PM2日志已清理"
            fi
        fi
    else
        log_message "WARN" "PM2未安装或不可用"
    fi
}

# 监控日志错误率
monitor_error_rate() {
    log_message "INFO" "监控日志错误率"
    
    local error_log="$LOG_DIR/error-current.log"
    local combined_log="$LOG_DIR/combined-current.log"
    
    if [ -f "$error_log" ] && [ -f "$combined_log" ]; then
        # 统计最近1小时的错误数量
        local hour_ago=$(date -d '1 hour ago' '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v-1H '+%Y-%m-%d %H:%M:%S')
        local error_count=$(grep -c "$hour_ago" "$error_log" 2>/dev/null || echo "0")
        local total_count=$(grep -c "$hour_ago" "$combined_log" 2>/dev/null || echo "1")
        
        local error_rate=0
        if [ $total_count -gt 0 ]; then
            error_rate=$((error_count * 100 / total_count))
        fi
        
        log_message "INFO" "最近1小时错误率: ${error_rate}% (${error_count}/${total_count})"
        
        # 如果错误率过高，发出警告
        if [ $error_rate -gt 10 ]; then
            log_message "WARN" "错误率过高: ${error_rate}%，建议检查应用状态"
            
            # 记录最近的错误到单独文件
            local alert_file="$LOG_DIR/high-error-rate-$(date +%Y%m%d-%H%M%S).log"
            tail -50 "$error_log" > "$alert_file"
            log_message "WARN" "最近错误已保存到: $alert_file"
        fi
    else
        log_message "WARN" "无法找到当前日志文件进行错误率监控"
    fi
}

# 主函数
main() {
    local action=${1:-"all"}
    
    log_message "INFO" "开始日志管理任务: $action"
    
    case $action in
        "cleanup")
            cleanup_old_logs
            ;;
        "compress")
            compress_large_logs
            ;;
        "check-size")
            check_log_directory_size
            ;;
        "stats")
            generate_log_stats
            ;;
        "pm2")
            cleanup_pm2_logs
            ;;
        "monitor")
            monitor_error_rate
            ;;
        "all")
            cleanup_old_logs
            compress_large_logs
            check_log_directory_size
            cleanup_pm2_logs
            monitor_error_rate
            generate_log_stats
            ;;
        *)
            echo "用法: $0 [cleanup|compress|check-size|stats|pm2|monitor|all]"
            echo "  cleanup    - 清理旧日志文件"
            echo "  compress   - 压缩大日志文件"
            echo "  check-size - 检查日志目录大小"
            echo "  stats      - 生成统计报告"
            echo "  pm2        - 清理PM2日志"
            echo "  monitor    - 监控错误率"
            echo "  all        - 执行所有任务（默认）"
            exit 1
            ;;
    esac
    
    log_message "INFO" "日志管理任务完成: $action"
}

# 执行主函数
main "$@"