#!/bin/bash

# WordPecker 日志清理脚本
# 用于定期清理过期的日志文件和缓存

set -e

PROJECT_DIR="/home/devbox/wordpecker-app"
LOG_DIR="$PROJECT_DIR/logs"
AUDIO_CACHE_DIR="$PROJECT_DIR/audio-cache"
BACKUP_DIR="/home/devbox/backups"

# 配置参数
LOG_RETENTION_DAYS=7      # 日志保留天数
BACKUP_RETENTION_DAYS=30  # 备份保留天数
CACHE_RETENTION_HOURS=24  # 缓存保留小时数
MAX_LOG_SIZE_MB=100       # 单个日志文件最大大小（MB）

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date): $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date): $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date): $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date): $1"
}

# 清理应用日志
cleanup_application_logs() {
    log_info "清理应用日志文件..."
    
    local cleaned_count=0
    
    # 清理过期的日志文件
    if [ -d "$LOG_DIR" ]; then
        # 删除超过保留期的日志文件
        find "$LOG_DIR" -name "*.log" -type f -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null && {
            cleaned_count=$((cleaned_count + $(find "$LOG_DIR" -name "*.log" -type f -mtime +$LOG_RETENTION_DAYS | wc -l)))
        }
        
        # 删除过期的压缩日志
        find "$LOG_DIR" -name "*.log.gz" -type f -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null
        
        # 压缩大文件
        find "$LOG_DIR" -name "*.log" -type f -size +${MAX_LOG_SIZE_MB}M -exec gzip {} \; 2>/dev/null
        
        log_success "清理了 $cleaned_count 个过期日志文件"
    else
        log_warning "日志目录不存在: $LOG_DIR"
    fi
}

# 清理 PM2 日志
cleanup_pm2_logs() {
    log_info "清理 PM2 日志..."
    
    # 获取 PM2 日志目录
    local pm2_log_dir="$HOME/.pm2/logs"
    
    if [ -d "$pm2_log_dir" ]; then
        # 清理过期的 PM2 日志
        find "$pm2_log_dir" -name "*.log" -type f -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null
        
        # 压缩大的 PM2 日志文件
        find "$pm2_log_dir" -name "*.log" -type f -size +${MAX_LOG_SIZE_MB}M -exec gzip {} \; 2>/dev/null
        
        log_success "PM2 日志清理完成"
    else
        log_warning "PM2 日志目录不存在: $pm2_log_dir"
    fi
}

# 清理音频缓存
cleanup_audio_cache() {
    log_info "清理音频缓存文件..."
    
    local cleaned_count=0
    
    if [ -d "$AUDIO_CACHE_DIR" ]; then
        # 删除超过保留时间的缓存文件
        cleaned_count=$(find "$AUDIO_CACHE_DIR" -type f -mmin +$((CACHE_RETENTION_HOURS * 60)) | wc -l)
        find "$AUDIO_CACHE_DIR" -type f -mmin +$((CACHE_RETENTION_HOURS * 60)) -delete 2>/dev/null
        
        # 清理空目录
        find "$AUDIO_CACHE_DIR" -type d -empty -delete 2>/dev/null
        
        log_success "清理了 $cleaned_count 个过期缓存文件"
    else
        log_warning "音频缓存目录不存在: $AUDIO_CACHE_DIR"
    fi
}

# 清理备份文件
cleanup_backups() {
    log_info "清理过期备份文件..."
    
    local cleaned_count=0
    
    if [ -d "$BACKUP_DIR" ]; then
        # 删除超过保留期的备份
        cleaned_count=$(find "$BACKUP_DIR" -type d -mtime +$BACKUP_RETENTION_DAYS | wc -l)
        find "$BACKUP_DIR" -type d -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null
        
        log_success "清理了 $cleaned_count 个过期备份"
    else
        log_warning "备份目录不存在: $BACKUP_DIR"
    fi
}

# 清理系统临时文件
cleanup_temp_files() {
    log_info "清理系统临时文件..."
    
    # 清理 /tmp 中的应用临时文件
    find /tmp -name "wordpecker-*" -type f -mtime +1 -delete 2>/dev/null || true
    find /tmp -name "npm-*" -type d -mtime +1 -exec rm -rf {} \; 2>/dev/null || true
    
    # 清理 Node.js 缓存
    if [ -d "$HOME/.npm" ]; then
        npm cache clean --force 2>/dev/null || true
    fi
    
    log_success "系统临时文件清理完成"
}

# 检查磁盘空间
check_disk_space() {
    log_info "检查磁盘空间..."
    
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    local available_space=$(df -h / | awk 'NR==2{print $4}')
    
    echo "磁盘使用率: ${disk_usage}%"
    echo "可用空间: ${available_space}"
    
    if [ "$disk_usage" -gt 85 ]; then
        log_warning "磁盘使用率过高: ${disk_usage}%"
        
        # 强制清理更多文件
        log_info "执行强制清理..."
        
        # 减少日志保留时间
        find "$LOG_DIR" -name "*.log" -type f -mtime +3 -delete 2>/dev/null || true
        find "$AUDIO_CACHE_DIR" -type f -mmin +360 -delete 2>/dev/null || true  # 6小时
        
        # 清理更多临时文件
        find /tmp -type f -mtime +0 -delete 2>/dev/null || true
        
        log_warning "强制清理完成，请监控磁盘空间"
    else
        log_success "磁盘空间充足"
    fi
}

# 生成清理报告
generate_cleanup_report() {
    log_info "生成清理报告..."
    
    local report_file="$LOG_DIR/cleanup-report-$(date +%Y%m%d).log"
    
    cat > "$report_file" << EOF
WordPecker 日志清理报告
========================
清理时间: $(date)
清理脚本: $0

目录状态:
---------
日志目录大小: $(du -sh "$LOG_DIR" 2>/dev/null | cut -f1 || echo "N/A")
缓存目录大小: $(du -sh "$AUDIO_CACHE_DIR" 2>/dev/null | cut -f1 || echo "N/A")
备份目录大小: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "N/A")

文件统计:
---------
日志文件数量: $(find "$LOG_DIR" -name "*.log" -type f | wc -l 2>/dev/null || echo "0")
缓存文件数量: $(find "$AUDIO_CACHE_DIR" -type f | wc -l 2>/dev/null || echo "0")
备份数量: $(find "$BACKUP_DIR" -maxdepth 1 -type d | wc -l 2>/dev/null || echo "0")

系统状态:
---------
磁盘使用率: $(df -h / | awk 'NR==2{print $5}')
可用空间: $(df -h / | awk 'NR==2{print $4}')
内存使用率: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')

清理配置:
---------
日志保留天数: $LOG_RETENTION_DAYS
缓存保留小时数: $CACHE_RETENTION_HOURS
备份保留天数: $BACKUP_RETENTION_DAYS
最大日志文件大小: ${MAX_LOG_SIZE_MB}MB
EOF
    
    log_success "清理报告已生成: $report_file"
}

# 主清理流程
main() {
    echo "=========================================="
    echo "WordPecker 日志清理脚本"
    echo "开始时间: $(date)"
    echo "=========================================="
    
    # 执行清理操作
    cleanup_application_logs
    cleanup_pm2_logs
    cleanup_audio_cache
    cleanup_backups
    cleanup_temp_files
    check_disk_space
    generate_cleanup_report
    
    echo "=========================================="
    log_success "日志清理完成"
    echo "结束时间: $(date)"
    echo "=========================================="
}

# 错误处理
trap 'log_error "日志清理过程中发生错误"' ERR

# 执行主函数
main "$@"