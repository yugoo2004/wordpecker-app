#!/bin/bash

# 自动清理脚本
# 配置日志和缓存文件的自动清理策略

# 配置参数
CLEANUP_CONFIG="./config/cleanup.conf"
LOG_FILE="./logs/cleanup.log"

# 默认清理策略
DEFAULT_LOG_RETENTION_DAYS=7
DEFAULT_CACHE_RETENTION_HOURS=24
DEFAULT_TEMP_RETENTION_HOURS=6
DEFAULT_AUDIO_CACHE_SIZE_LIMIT=500  # MB
DEFAULT_LOG_SIZE_LIMIT=100          # MB per file
DEFAULT_TOTAL_LOG_SIZE_LIMIT=1000   # MB total

# 创建必要目录
mkdir -p ./logs ./config

# 加载清理配置
load_cleanup_config() {
    if [ -f "$CLEANUP_CONFIG" ]; then
        source "$CLEANUP_CONFIG"
    else
        # 创建默认配置文件
        cat > "$CLEANUP_CONFIG" << EOF
# 自动清理配置文件

# 日志文件清理策略
LOG_RETENTION_DAYS=$DEFAULT_LOG_RETENTION_DAYS
LOG_SIZE_LIMIT_MB=$DEFAULT_LOG_SIZE_LIMIT
TOTAL_LOG_SIZE_LIMIT_MB=$DEFAULT_TOTAL_LOG_SIZE_LIMIT
COMPRESS_OLD_LOGS=true
COMPRESS_THRESHOLD_DAYS=3

# 缓存文件清理策略
CACHE_RETENTION_HOURS=$DEFAULT_CACHE_RETENTION_HOURS
AUDIO_CACHE_SIZE_LIMIT_MB=$DEFAULT_AUDIO_CACHE_SIZE_LIMIT
AUTO_CLEANUP_CACHE=true

# 临时文件清理策略
TEMP_RETENTION_HOURS=$DEFAULT_TEMP_RETENTION_HOURS
CLEANUP_NODE_MODULES_CACHE=true
CLEANUP_NPM_CACHE=false

# PM2日志清理策略
PM2_LOG_RETENTION_DAYS=3
AUTO_FLUSH_PM2_LOGS=true

# 构建文件清理策略
CLEANUP_BUILD_FILES=false
BUILD_RETENTION_DAYS=1

# 清理调度
ENABLE_SCHEDULED_CLEANUP=true
DAILY_CLEANUP_HOUR=2
HOURLY_CACHE_CLEANUP=true

# 安全设置
ENABLE_BACKUP_BEFORE_CLEANUP=true
BACKUP_RETENTION_DAYS=3
DRY_RUN_MODE=false
EOF
        echo "已创建默认清理配置文件: $CLEANUP_CONFIG"
    fi
    
    source "$CLEANUP_CONFIG"
}

# 日志函数
log_cleanup() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    if [ -t 1 ]; then
        echo "[$level] $message"
    fi
}

# 获取文件大小（MB）
get_file_size_mb() {
    local file=$1
    if [ -f "$file" ]; then
        stat -c%s "$file" 2>/dev/null | awk '{print int($1/1024/1024)}'
    else
        echo 0
    fi
}

# 获取目录大小（MB）
get_dir_size_mb() {
    local dir=$1
    if [ -d "$dir" ]; then
        du -sm "$dir" 2>/dev/null | awk '{print $1}'
    else
        echo 0
    fi
}

# 备份重要文件
backup_before_cleanup() {
    if [ "$ENABLE_BACKUP_BEFORE_CLEANUP" = "true" ]; then
        local backup_dir="./backups/cleanup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$backup_dir"
        
        # 备份重要日志文件
        find ./logs -name "*.log" -mtime -1 -exec cp {} "$backup_dir/" \; 2>/dev/null || true
        
        # 清理旧备份
        find ./backups -name "cleanup-*" -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
        
        log_cleanup "INFO" "已创建清理前备份: $backup_dir"
    fi
}

# 清理应用日志文件
cleanup_application_logs() {
    log_cleanup "INFO" "开始清理应用日志文件"
    
    local cleaned_files=0
    local freed_space=0
    
    # 清理主日志目录
    if [ -d "./logs" ]; then
        # 删除过期日志文件
        while IFS= read -r -d '' file; do
            local size=$(get_file_size_mb "$file")
            if [ "$DRY_RUN_MODE" = "true" ]; then
                log_cleanup "INFO" "[DRY RUN] 将删除过期日志: $file (${size}MB)"
            else
                rm "$file"
                log_cleanup "INFO" "已删除过期日志: $file (${size}MB)"
                cleaned_files=$((cleaned_files + 1))
                freed_space=$((freed_space + size))
            fi
        done < <(find ./logs -name "*.log" -mtime +$LOG_RETENTION_DAYS -print0 2>/dev/null)
        
        # 压缩旧日志文件
        if [ "$COMPRESS_OLD_LOGS" = "true" ]; then
            while IFS= read -r -d '' file; do
                if [ "$DRY_RUN_MODE" = "true" ]; then
                    log_cleanup "INFO" "[DRY RUN] 将压缩日志: $file"
                else
                    gzip "$file" && log_cleanup "INFO" "已压缩日志: $file"
                fi
            done < <(find ./logs -name "*.log" -mtime +$COMPRESS_THRESHOLD_DAYS -print0 2>/dev/null)
        fi
        
        # 检查单个日志文件大小
        while IFS= read -r -d '' file; do
            local size=$(get_file_size_mb "$file")
            if [ "$size" -gt "$LOG_SIZE_LIMIT_MB" ]; then
                if [ "$DRY_RUN_MODE" = "true" ]; then
                    log_cleanup "INFO" "[DRY RUN] 将截断大日志文件: $file (${size}MB)"
                else
                    # 保留最后1000行
                    tail -1000 "$file" > "$file.tmp" && mv "$file.tmp" "$file"
                    log_cleanup "INFO" "已截断大日志文件: $file (原大小: ${size}MB)"
                fi
            fi
        done < <(find ./logs -name "*.log" -print0 2>/dev/null)
    fi
    
    # 清理后端日志目录
    if [ -d "./backend/logs" ]; then
        while IFS= read -r -d '' file; do
            local size=$(get_file_size_mb "$file")
            if [ "$DRY_RUN_MODE" = "true" ]; then
                log_cleanup "INFO" "[DRY RUN] 将删除后端日志: $file (${size}MB)"
            else
                rm "$file"
                log_cleanup "INFO" "已删除后端日志: $file (${size}MB)"
                cleaned_files=$((cleaned_files + 1))
                freed_space=$((freed_space + size))
            fi
        done < <(find ./backend/logs -name "*.log" -mtime +$LOG_RETENTION_DAYS -print0 2>/dev/null)
    fi
    
    log_cleanup "INFO" "应用日志清理完成 - 清理文件: $cleaned_files, 释放空间: ${freed_space}MB"
}

# 清理PM2日志
cleanup_pm2_logs() {
    log_cleanup "INFO" "开始清理PM2日志"
    
    if command -v pm2 &> /dev/null; then
        # 清理PM2日志文件
        local pm2_log_dir="$HOME/.pm2/logs"
        if [ -d "$pm2_log_dir" ]; then
            local cleaned_files=0
            while IFS= read -r -d '' file; do
                local size=$(get_file_size_mb "$file")
                if [ "$DRY_RUN_MODE" = "true" ]; then
                    log_cleanup "INFO" "[DRY RUN] 将删除PM2日志: $file (${size}MB)"
                else
                    rm "$file"
                    log_cleanup "INFO" "已删除PM2日志: $file (${size}MB)"
                    cleaned_files=$((cleaned_files + 1))
                fi
            done < <(find "$pm2_log_dir" -name "*.log" -mtime +$PM2_LOG_RETENTION_DAYS -print0 2>/dev/null)
            
            log_cleanup "INFO" "PM2日志文件清理完成 - 清理文件: $cleaned_files"
        fi
        
        # 刷新PM2日志
        if [ "$AUTO_FLUSH_PM2_LOGS" = "true" ] && [ "$DRY_RUN_MODE" != "true" ]; then
            pm2 flush 2>/dev/null && log_cleanup "INFO" "已刷新PM2日志缓冲区"
        fi
    else
        log_cleanup "WARNING" "PM2未安装，跳过PM2日志清理"
    fi
}

# 清理缓存文件
cleanup_cache_files() {
    log_cleanup "INFO" "开始清理缓存文件"
    
    local cleaned_files=0
    local freed_space=0
    
    # 清理音频缓存
    for cache_dir in "./audio-cache" "./backend/audio-cache"; do
        if [ -d "$cache_dir" ]; then
            local cache_size=$(get_dir_size_mb "$cache_dir")
            
            # 按时间清理
            while IFS= read -r -d '' file; do
                local size=$(get_file_size_mb "$file")
                if [ "$DRY_RUN_MODE" = "true" ]; then
                    log_cleanup "INFO" "[DRY RUN] 将删除过期缓存: $file (${size}MB)"
                else
                    rm "$file"
                    cleaned_files=$((cleaned_files + 1))
                    freed_space=$((freed_space + size))
                fi
            done < <(find "$cache_dir" -type f -mmin +$((CACHE_RETENTION_HOURS * 60)) -print0 2>/dev/null)
            
            # 按大小清理（如果缓存目录超过限制）
            if [ "$cache_size" -gt "$AUDIO_CACHE_SIZE_LIMIT_MB" ]; then
                log_cleanup "WARNING" "音频缓存目录过大 (${cache_size}MB > ${AUDIO_CACHE_SIZE_LIMIT_MB}MB)，执行大小限制清理"
                
                # 删除最旧的文件直到达到限制
                while [ "$(get_dir_size_mb "$cache_dir")" -gt "$AUDIO_CACHE_SIZE_LIMIT_MB" ]; do
                    local oldest_file=$(find "$cache_dir" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | head -1 | cut -d' ' -f2-)
                    if [ -n "$oldest_file" ]; then
                        local size=$(get_file_size_mb "$oldest_file")
                        if [ "$DRY_RUN_MODE" = "true" ]; then
                            log_cleanup "INFO" "[DRY RUN] 将删除最旧缓存: $oldest_file (${size}MB)"
                            break
                        else
                            rm "$oldest_file"
                            log_cleanup "INFO" "已删除最旧缓存: $oldest_file (${size}MB)"
                            cleaned_files=$((cleaned_files + 1))
                            freed_space=$((freed_space + size))
                        fi
                    else
                        break
                    fi
                done
            fi
        fi
    done
    
    # 清理Node.js缓存
    if [ "$CLEANUP_NODE_MODULES_CACHE" = "true" ]; then
        for cache_dir in "./node_modules/.cache" "./frontend/node_modules/.cache" "./backend/node_modules/.cache"; do
            if [ -d "$cache_dir" ]; then
                local size=$(get_dir_size_mb "$cache_dir")
                if [ "$DRY_RUN_MODE" = "true" ]; then
                    log_cleanup "INFO" "[DRY RUN] 将清理Node.js缓存: $cache_dir (${size}MB)"
                else
                    rm -rf "$cache_dir"
                    log_cleanup "INFO" "已清理Node.js缓存: $cache_dir (${size}MB)"
                    freed_space=$((freed_space + size))
                fi
            fi
        done
    fi
    
    # 清理npm缓存
    if [ "$CLEANUP_NPM_CACHE" = "true" ] && [ "$DRY_RUN_MODE" != "true" ]; then
        npm cache clean --force 2>/dev/null && log_cleanup "INFO" "已清理npm缓存"
    fi
    
    log_cleanup "INFO" "缓存文件清理完成 - 清理文件: $cleaned_files, 释放空间: ${freed_space}MB"
}

# 清理临时文件
cleanup_temp_files() {
    log_cleanup "INFO" "开始清理临时文件"
    
    local cleaned_files=0
    local freed_space=0
    
    # 清理应用临时文件
    for temp_dir in "./tmp" "./temp" "/tmp"; do
        if [ -d "$temp_dir" ]; then
            # 清理WordPecker相关临时文件
            while IFS= read -r -d '' file; do
                local size=$(get_file_size_mb "$file")
                if [ "$DRY_RUN_MODE" = "true" ]; then
                    log_cleanup "INFO" "[DRY RUN] 将删除临时文件: $file (${size}MB)"
                else
                    rm "$file"
                    cleaned_files=$((cleaned_files + 1))
                    freed_space=$((freed_space + size))
                fi
            done < <(find "$temp_dir" -name "*wordpecker*" -o -name "*.tmp" -mmin +$((TEMP_RETENTION_HOURS * 60)) -print0 2>/dev/null)
        fi
    done
    
    # 清理构建文件
    if [ "$CLEANUP_BUILD_FILES" = "true" ]; then
        for build_dir in "./frontend/dist" "./backend/dist" "./build"; do
            if [ -d "$build_dir" ]; then
                # 检查构建文件年龄
                local build_age=$(find "$build_dir" -type f -printf '%T@\n' 2>/dev/null | sort -n | tail -1)
                local current_time=$(date +%s)
                local age_days=$(( (current_time - ${build_age%.*}) / 86400 ))
                
                if [ "$age_days" -gt "$BUILD_RETENTION_DAYS" ]; then
                    local size=$(get_dir_size_mb "$build_dir")
                    if [ "$DRY_RUN_MODE" = "true" ]; then
                        log_cleanup "INFO" "[DRY RUN] 将删除旧构建文件: $build_dir (${size}MB, ${age_days}天前)"
                    else
                        rm -rf "$build_dir"
                        log_cleanup "INFO" "已删除旧构建文件: $build_dir (${size}MB, ${age_days}天前)"
                        freed_space=$((freed_space + size))
                    fi
                fi
            fi
        done
    fi
    
    log_cleanup "INFO" "临时文件清理完成 - 清理文件: $cleaned_files, 释放空间: ${freed_space}MB"
}

# 检查总日志大小并清理
check_total_log_size() {
    local total_size=$(get_dir_size_mb "./logs")
    
    if [ "$total_size" -gt "$TOTAL_LOG_SIZE_LIMIT_MB" ]; then
        log_cleanup "WARNING" "日志目录总大小超限 (${total_size}MB > ${TOTAL_LOG_SIZE_LIMIT_MB}MB)，执行额外清理"
        
        # 删除最旧的日志文件直到达到限制
        while [ "$(get_dir_size_mb "./logs")" -gt "$TOTAL_LOG_SIZE_LIMIT_MB" ]; do
            local oldest_log=$(find ./logs -name "*.log" -printf '%T@ %p\n' 2>/dev/null | sort -n | head -1 | cut -d' ' -f2-)
            if [ -n "$oldest_log" ]; then
                local size=$(get_file_size_mb "$oldest_log")
                if [ "$DRY_RUN_MODE" = "true" ]; then
                    log_cleanup "INFO" "[DRY RUN] 将删除最旧日志: $oldest_log (${size}MB)"
                    break
                else
                    rm "$oldest_log"
                    log_cleanup "INFO" "已删除最旧日志: $oldest_log (${size}MB)"
                fi
            else
                break
            fi
        done
    fi
}

# 生成清理报告
generate_cleanup_report() {
    local report_file="./logs/cleanup-report-$(date +%Y%m%d).log"
    
    echo "=== WordPecker 自动清理报告 ===" > "$report_file"
    echo "清理时间: $(date)" >> "$report_file"
    echo "配置文件: $CLEANUP_CONFIG" >> "$report_file"
    echo "" >> "$report_file"
    
    echo "清理前磁盘使用情况:" >> "$report_file"
    df -h / >> "$report_file"
    echo "" >> "$report_file"
    
    echo "目录大小统计:" >> "$report_file"
    echo "  日志目录: $(get_dir_size_mb "./logs")MB" >> "$report_file"
    echo "  音频缓存: $(get_dir_size_mb "./audio-cache")MB" >> "$report_file"
    echo "  后端缓存: $(get_dir_size_mb "./backend/audio-cache")MB" >> "$report_file"
    echo "" >> "$report_file"
    
    echo "清理策略配置:" >> "$report_file"
    echo "  日志保留天数: $LOG_RETENTION_DAYS" >> "$report_file"
    echo "  缓存保留小时: $CACHE_RETENTION_HOURS" >> "$report_file"
    echo "  临时文件保留小时: $TEMP_RETENTION_HOURS" >> "$report_file"
    echo "  音频缓存大小限制: ${AUDIO_CACHE_SIZE_LIMIT_MB}MB" >> "$report_file"
    echo "" >> "$report_file"
    
    # 添加最近的清理日志
    echo "最近清理活动:" >> "$report_file"
    tail -20 "$LOG_FILE" >> "$report_file" 2>/dev/null || echo "无清理日志" >> "$report_file"
    
    echo "清理报告已生成: $report_file"
}

# 执行完整清理
run_full_cleanup() {
    log_cleanup "INFO" "开始执行完整自动清理"
    
    # 加载配置
    load_cleanup_config
    
    # 创建备份
    backup_before_cleanup
    
    # 执行各项清理
    cleanup_application_logs
    cleanup_pm2_logs
    cleanup_cache_files
    cleanup_temp_files
    
    # 检查总大小限制
    check_total_log_size
    
    log_cleanup "INFO" "完整自动清理执行完成"
}

# 设置定时清理任务
setup_scheduled_cleanup() {
    if [ "$ENABLE_SCHEDULED_CLEANUP" = "true" ]; then
        local cron_file="/tmp/wordpecker-cleanup-cron"
        
        # 创建cron任务
        cat > "$cron_file" << EOF
# WordPecker 自动清理任务

# 每日完整清理（凌晨${DAILY_CLEANUP_HOUR}点）
0 $DAILY_CLEANUP_HOUR * * * $(pwd)/scripts/auto-cleanup.sh full

# 每小时缓存清理
EOF
        
        if [ "$HOURLY_CACHE_CLEANUP" = "true" ]; then
            echo "0 * * * * $(pwd)/scripts/auto-cleanup.sh cache" >> "$cron_file"
        fi
        
        # 安装cron任务
        crontab "$cron_file"
        rm "$cron_file"
        
        log_cleanup "INFO" "已设置定时清理任务"
        echo "定时清理任务已设置:"
        echo "  每日完整清理: 凌晨${DAILY_CLEANUP_HOUR}点"
        if [ "$HOURLY_CACHE_CLEANUP" = "true" ]; then
            echo "  每小时缓存清理: 每小时整点"
        fi
    fi
}

# 主函数
main() {
    case "${1:-full}" in
        full)
            run_full_cleanup
            ;;
        logs)
            load_cleanup_config
            backup_before_cleanup
            cleanup_application_logs
            cleanup_pm2_logs
            check_total_log_size
            ;;
        cache)
            load_cleanup_config
            cleanup_cache_files
            ;;
        temp)
            load_cleanup_config
            cleanup_temp_files
            ;;
        report)
            load_cleanup_config
            generate_cleanup_report
            ;;
        setup-cron)
            load_cleanup_config
            setup_scheduled_cleanup
            ;;
        dry-run)
            DRY_RUN_MODE=true
            echo "=== 干运行模式 - 仅显示将要执行的操作 ==="
            run_full_cleanup
            ;;
        config)
            echo "当前清理配置文件: $CLEANUP_CONFIG"
            if [ -f "$CLEANUP_CONFIG" ]; then
                cat "$CLEANUP_CONFIG"
            else
                echo "配置文件不存在，将创建默认配置"
                load_cleanup_config
            fi
            ;;
        *)
            echo "用法: $0 {full|logs|cache|temp|report|setup-cron|dry-run|config}"
            echo "  full       - 执行完整清理（默认）"
            echo "  logs       - 仅清理日志文件"
            echo "  cache      - 仅清理缓存文件"
            echo "  temp       - 仅清理临时文件"
            echo "  report     - 生成清理报告"
            echo "  setup-cron - 设置定时清理任务"
            echo "  dry-run    - 干运行模式（仅显示操作）"
            echo "  config     - 显示当前配置"
            exit 1
            ;;
    esac
}

main "$@""
            rm -f "$file"
            ((cleaned_count++))
        done
    fi
    
    log_cleanup "应用日志清理完成，清理了 $cleaned_count 个文件"
}

# 清理PM2日志文件
cleanup_pm2_logs() {
    if [ "$ENABLE_LOG_CLEANUP" != "true" ] || ! command -v pm2 &> /dev/null; then
        return 0
    fi
    
    log_cleanup "开始清理PM2日志文件"
    
    # 清理PM2日志目录
    local pm2_log_dir="$HOME/.pm2/logs"
    if [ -d "$pm2_log_dir" ]; then
        find "$pm2_log_dir" -name "*.log" -type f -mtime +$PM2_LOG_RETENTION_DAYS -print0 | while IFS= read -r -d '' file; do
            log_cleanup "删除PM2过期日志: $file"
            rm -f "$file"
        done
    fi
    
    # 清理PM2 PID文件
    find "$HOME/.pm2/pids" -name "*.pid" -type f -mtime +1 -delete 2>/dev/null || true
    
    # 清理PM2临时文件
    find "$HOME/.pm2" -name "*.sock" -type f -mtime +1 -delete 2>/dev/null || true
    
    log_cleanup "PM2日志清理完成"
}

# 清理缓存文件
cleanup_cache_files() {
    if [ "$ENABLE_CACHE_CLEANUP" != "true" ]; then
        return 0
    fi
    
    log_cleanup "开始清理缓存文件"
    local cleaned_size=0
    
    # 清理音频缓存
    if [ -d "./audio-cache" ]; then
        find ./audio-cache -type f -mmin +$((AUDIO_CACHE_RETENTION_HOURS * 60)) -print0 | while IFS= read -r -d '' file; do
            local file_size=$(get_file_size_mb "$file")
            log_cleanup "INFO" "删除音频缓存: $file"
            rm -f "$file"
            cleaned_size=$((cleaned_size + file_size))
        done
    fi
    
    if [ -d "./backend/audio-cache" ]; then
        find ./backend/audio-cache -type f -mmin +$((AUDIO_CACHE_RETENTION_HOURS * 60)) -print0 | while IFS= read -r -d '' file; do
            local file_size=$(get_file_size_mb "$file")
            log_cleanup "删除后端音频缓存: $file (${file_size}MB)"
            rm -f "$file"
            cleaned_size=$((cleaned_size + file_size))
        done
    fi
    
    # 清理图片缓存
    if [ -d "./image-cache" ]; then
        find ./image-cache -type f -mmin +$((IMAGE_CACHE_RETENTION_HOURS * 60)) -delete 2>/dev/null || true
    fi
    
    # 清理构建缓存
    if [ -d "./frontend/dist/.vite" ]; then
        find ./frontend/dist/.vite -type f -mmin +$((BUILD_CACHE_RETENTION_HOURS * 60)) -delete 2>/dev/null || true
    fi
    
    # 清理Node.js缓存
    if [ -d "./node_modules/.cache" ]; then
        rm -rf ./node_modules/.cache 2>/dev/null || true
    fi
    
    if [ -d "./backend/node_modules/.cache" ]; then
        rm -rf ./backend/node_modules/.cache 2>/dev/null || true
    fi
    
    if [ -d "./frontend/node_modules/.cache" ]; then
        rm -rf ./frontend/node_modules/.cache 2>/dev/null || true
    fi
    
    log_cleanup "缓存文件清理完成，释放了约 ${cleaned_size}MB 空间"
}

# 清理临时文件
cleanup_temp_files() {
    if [ "$ENABLE_TEMP_CLEANUP" != "true" ]; then
        return 0
    fi
    
    log_cleanup "开始清理临时文件"
    
    # 清理应用临时文件
    if [ -d "./tmp" ]; then
        find ./tmp -type f -mmin +$((TEMP_RETENTION_HOURS * 60)) -delete 2>/dev/null || true
    fi
    
    # 清理系统临时文件（WordPecker相关）
    find /tmp -name "*wordpecker*" -type f -mmin +$((TEMP_RETENTION_HOURS * 60)) -delete 2>/dev/null || true
    find /tmp -name "*.tmp" -type f -mmin +$((TEMP_RETENTION_HOURS * 60)) -delete 2>/dev/null || true
    
    # 清理构建临时文件
    rm -rf ./frontend/dist/tmp 2>/dev/null || true
    rm -rf ./backend/dist/tmp 2>/dev/null || true
    
    # 清理上传临时文件
    if [ -d "./uploads/tmp" ]; then
        find ./uploads/tmp -type f -mmin +60 -delete 2>/dev/null || true
    fi
    
    log_cleanup "临时文件清理完成"
}

# 清理备份文件
cleanup_backup_files() {
    if [ "$ENABLE_BACKUP_CLEANUP" != "true" ]; then
        return 0
    fi
    
    log_cleanup "开始清理备份文件"
    
    # 清理应用备份
    if [ -d "./backups" ]; then
        find ./backups -type f -name "*.tar.gz" -mtime +$BACKUP_RETENTION_DAYS -print0 | while IFS= read -r -d '' file; do
            log_cleanup "删除过期备份: $file"
            rm -f "$file"
        done
    fi
    
    # 清理数据库备份
    if [ -d "./db-backups" ]; then
        find ./db-backups -type f -name "*.sql" -o -name "*.dump" -mtime +$DATABASE_BACKUP_RETENTION_DAYS -print0 | while IFS= read -r -d '' file; do
            log_cleanup "删除过期数据库备份: $file"
            rm -f "$file"
        done
    fi
    
    log_cleanup "备份文件清理完成"
}

# 清理大文件
cleanup_large_files() {
    log_cleanup "检查大文件"
    
    # 查找大文件并记录
    find . -type f -size +${LARGE_FILE_THRESHOLD_MB}M -not -path "./node_modules/*" -not -path "./.git/*" -print0 | while IFS= read -r -d '' file; do
        local file_size=$(get_file_size_mb "$file")
        log_cleanup "发现大文件: $file (${file_size}MB)"
        
        # 如果是日志文件且启用压缩，则压缩
        if [[ "$file" == *.log ]] && [ "$ENABLE_COMPRESSION" = "true" ] && [ ! -f "${file}.gz" ]; then
            log_cleanup "压缩大日志文件: $file"
            gzip "$file"
        fi
    done
}

# 紧急清理（磁盘空间不足时）
emergency_cleanup() {
    log_cleanup "执行紧急清理"
    
    # 清理所有缓存
    rm -rf ./audio-cache/* 2>/dev/null || true
    rm -rf ./backend/audio-cache/* 2>/dev/null || true
    rm -rf ./image-cache/* 2>/dev/null || true
    
    # 清理所有临时文件
    rm -rf ./tmp/* 2>/dev/null || true
    find /tmp -name "*wordpecker*" -delete 2>/dev/null || true
    
    # 清理构建文件
    rm -rf ./frontend/dist 2>/dev/null || true
    rm -rf ./backend/dist 2>/dev/null || true
    
    # 清理旧日志（保留最近1天）
    find ./logs -name "*.log" -mtime +1 -delete 2>/dev/null || true
    find ./backend/logs -name "*.log" -mtime +1 -delete 2>/dev/null || true
    
    # 清理PM2日志
    if command -v pm2 &> /dev/null; then
        pm2 flush 2>/dev/null || true
    fi
    
    # 清理npm缓存
    npm cache clean --force 2>/dev/null || true
    
    log_cleanup "紧急清理完成"
}

# 生成清理报告
generate_cleanup_report() {
    local report_file="./logs/cleanup-report-$(date +%Y%m%