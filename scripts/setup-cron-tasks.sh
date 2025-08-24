#!/bin/bash
# WordPecker 定时任务配置脚本
# 用于配置健康检查、资源监控和日志清理的 Cron 任务
# 包含完整的错误处理和日志记录功能

set -e

PROJECT_DIR="/home/devbox/wordpecker-app"
CRON_LOG_DIR="$PROJECT_DIR/logs/cron"
SCRIPT_DIR="$PROJECT_DIR/scripts"
SETUP_LOG="$PROJECT_DIR/logs/cron-setup.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 创建必要目录
mkdir -p "$CRON_LOG_DIR"
mkdir -p "$(dirname "$SETUP_LOG")"

# 日志记录函数
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$SETUP_LOG"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
    esac
}

echo "=========================================="
echo "WordPecker 定时任务配置脚本"
echo "开始时间: $(date)"
echo "=========================================="

log_message "INFO" "开始设置 WordPecker 应用的定时任务"

# 检查脚本是否存在并验证
check_script_exists() {
    local script_path="$1"
    local script_name=$(basename "$script_path")
    
    log_message "INFO" "检查脚本: $script_name"
    
    if [ ! -f "$script_path" ]; then
        log_message "ERROR" "脚本不存在: $script_path"
        return 1
    fi
    
    # 确保脚本可执行
    if ! chmod +x "$script_path" 2>/dev/null; then
        log_message "ERROR" "无法设置脚本执行权限: $script_path"
        return 1
    fi
    
    # 验证脚本语法
    if ! bash -n "$script_path" 2>/dev/null; then
        log_message "ERROR" "脚本语法错误: $script_path"
        return 1
    fi
    
    log_message "SUCCESS" "脚本验证通过: $script_name"
    return 0
}

# 验证系统环境
verify_environment() {
    log_message "INFO" "验证系统环境"
    
    # 检查必要命令
    local required_commands=("crontab" "pm2" "curl" "jq")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [ ${#missing_commands[@]} -gt 0 ]; then
        log_message "ERROR" "缺少必要命令: ${missing_commands[*]}"
        log_message "INFO" "请安装缺少的命令后重试"
        return 1
    fi
    
    # 检查项目目录
    if [ ! -d "$PROJECT_DIR" ]; then
        log_message "ERROR" "项目目录不存在: $PROJECT_DIR"
        return 1
    fi
    
    # 检查脚本目录
    if [ ! -d "$SCRIPT_DIR" ]; then
        log_message "ERROR" "脚本目录不存在: $SCRIPT_DIR"
        return 1
    fi
    
    log_message "SUCCESS" "系统环境验证通过"
    return 0
}

# 备份现有的 crontab
backup_crontab() {
    log_message "INFO" "备份现有的 crontab 配置"
    
    local backup_file="$PROJECT_DIR/logs/crontab-backup-$(date +%Y%m%d-%H%M%S).txt"
    
    if crontab -l > "$backup_file" 2>/dev/null; then
        log_message "SUCCESS" "crontab 备份完成: $(basename "$backup_file")"
        
        # 显示当前 crontab 内容
        local cron_count=$(crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' | wc -l)
        log_message "INFO" "当前 crontab 包含 $cron_count 个任务"
    else
        log_message "INFO" "当前用户没有 crontab 配置，跳过备份"
        touch "$backup_file"
    fi
}

# 创建定时任务错误处理包装器
create_cron_wrapper() {
    local wrapper_script="$SCRIPT_DIR/cron-wrapper.sh"
    
    log_message "INFO" "创建定时任务错误处理包装器"
    
    cat > "$wrapper_script" << 'EOF'
#!/bin/bash
# Cron 任务错误处理包装器
# 用于统一处理定时任务的错误和日志记录

SCRIPT_NAME="$1"
SCRIPT_PATH="$2"
LOG_FILE="$3"

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

# 记录任务开始
echo "$(date '+%Y-%m-%d %H:%M:%S') [START] 开始执行 $SCRIPT_NAME" >> "$LOG_FILE"

# 执行脚本并捕获输出
if timeout 300 bash "$SCRIPT_PATH" >> "$LOG_FILE" 2>&1; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $SCRIPT_NAME 执行成功" >> "$LOG_FILE"
    exit 0
else
    local exit_code=$?
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $SCRIPT_NAME 执行失败 (退出码: $exit_code)" >> "$LOG_FILE"
    
    # 记录到错误日志
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $SCRIPT_NAME 执行失败 (退出码: $exit_code)" >> "$(dirname "$LOG_FILE")/cron-errors.log"
    
    exit $exit_code
fi
EOF
    
    chmod +x "$wrapper_script"
    log_message "SUCCESS" "包装器脚本创建完成: $(basename "$wrapper_script")"
}

# 设置定时任务
setup_cron_jobs() {
    log_message "INFO" "开始配置定时任务"
    
    # 验证必要的脚本
    local scripts_to_check=(
        "$SCRIPT_DIR/health-check.sh"
        "$SCRIPT_DIR/resource-monitor.sh" 
        "$SCRIPT_DIR/log-cleanup.sh"
    )
    
    local script_check_failed=false
    for script in "${scripts_to_check[@]}"; do
        if ! check_script_exists "$script"; then
            script_check_failed=true
        fi
    done
    
    if [ "$script_check_failed" = true ]; then
        log_message "ERROR" "脚本验证失败，无法继续配置定时任务"
        return 1
    fi
    
    # 创建错误处理包装器
    create_cron_wrapper
    
    # 创建临时 crontab 文件
    local temp_cron=$(mktemp)
    
    log_message "INFO" "准备新的 crontab 配置"
    
    # 保留现有的非 WordPecker 相关任务
    if crontab -l 2>/dev/null | grep -v "wordpecker\|health-check\|resource-monitor\|log-cleanup\|cron-wrapper" > "$temp_cron"; then
        log_message "INFO" "保留现有的非 WordPecker 定时任务"
    else
        log_message "INFO" "创建新的 crontab 配置"
        touch "$temp_cron"
    fi
    
    # 添加 WordPecker 相关的定时任务
    cat >> "$temp_cron" << EOF

# ============================================
# WordPecker 应用定时任务配置
# 配置时间: $(date)
# ============================================

# 健康检查 - 每分钟执行一次
* * * * * $SCRIPT_DIR/cron-wrapper.sh "health-check" "$SCRIPT_DIR/health-check.sh" "$CRON_LOG_DIR/health-check.log"

# 资源监控 - 每5分钟执行一次  
*/5 * * * * $SCRIPT_DIR/cron-wrapper.sh "resource-monitor" "$SCRIPT_DIR/resource-monitor.sh" "$CRON_LOG_DIR/resource-monitor.log"

# 日志清理 - 每天凌晨2点执行
0 2 * * * $SCRIPT_DIR/cron-wrapper.sh "log-cleanup" "$SCRIPT_DIR/log-cleanup.sh" "$CRON_LOG_DIR/log-cleanup.log"

# 缓存清理 - 每天凌晨3点执行
0 3 * * * find $PROJECT_DIR/audio-cache -type f -mtime +1 -delete >> $CRON_LOG_DIR/cache-cleanup.log 2>&1

# PM2 日志轮转 - 每周日凌晨4点执行
0 4 * * 0 pm2 flush >> $CRON_LOG_DIR/pm2-flush.log 2>&1

# 定时任务日志清理 - 每月1号凌晨5点执行
0 5 1 * * find $CRON_LOG_DIR -name "*.log" -mtime +30 -delete >> $CRON_LOG_DIR/cron-maintenance.log 2>&1

EOF
    
    # 安装新的 crontab
    if crontab "$temp_cron" 2>/dev/null; then
        log_message "SUCCESS" "定时任务配置完成"
        rm "$temp_cron"
        return 0
    else
        log_message "ERROR" "安装 crontab 失败"
        rm "$temp_cron"
        return 1
    fi
}

# 验证定时任务配置
verify_cron_jobs() {
    log_message "INFO" "验证定时任务配置"
    
    # 检查 crontab 是否安装成功
    if ! crontab -l &>/dev/null; then
        log_message "ERROR" "无法读取 crontab 配置"
        return 1
    fi
    
    # 统计 WordPecker 相关任务
    local wordpecker_jobs=$(crontab -l 2>/dev/null | grep -c "wordpecker\|health-check\|resource-monitor\|log-cleanup\|cron-wrapper" || echo "0")
    
    if [ "$wordpecker_jobs" -gt 0 ]; then
        log_message "SUCCESS" "发现 $wordpecker_jobs 个 WordPecker 相关定时任务"
        
        # 显示配置的任务
        log_message "INFO" "当前配置的定时任务："
        crontab -l | grep -A 20 "WordPecker 应用定时任务" | while read -r line; do
            if [[ "$line" =~ ^[0-9*] ]]; then
                log_message "INFO" "  - $line"
            fi
        done
        
        return 0
    else
        log_message "ERROR" "未找到 WordPecker 定时任务"
        return 1
    fi
}

# 测试定时任务
test_cron_jobs() {
    log_message "INFO" "测试定时任务脚本"
    
    local test_results=()
    
    # 测试健康检查脚本
    log_message "INFO" "测试健康检查脚本"
    if timeout 30 "$SCRIPT_DIR/health-check.sh" --quiet; then
        test_results+=("health-check: PASS")
        log_message "SUCCESS" "健康检查脚本测试通过"
    else
        test_results+=("health-check: FAIL")
        log_message "ERROR" "健康检查脚本测试失败"
    fi
    
    # 测试资源监控脚本
    log_message "INFO" "测试资源监控脚本"
    if timeout 30 "$SCRIPT_DIR/resource-monitor.sh"; then
        test_results+=("resource-monitor: PASS")
        log_message "SUCCESS" "资源监控脚本测试通过"
    else
        test_results+=("resource-monitor: FAIL")
        log_message "ERROR" "资源监控脚本测试失败"
    fi
    
    # 测试日志清理脚本
    log_message "INFO" "测试日志清理脚本"
    if timeout 60 "$SCRIPT_DIR/log-cleanup.sh"; then
        test_results+=("log-cleanup: PASS")
        log_message "SUCCESS" "日志清理脚本测试通过"
    else
        test_results+=("log-cleanup: FAIL")
        log_message "ERROR" "日志清理脚本测试失败"
    fi
    
    # 汇总测试结果
    local passed_tests=$(printf '%s\n' "${test_results[@]}" | grep -c "PASS" || echo "0")
    local total_tests=${#test_results[@]}
    
    log_message "INFO" "脚本测试完成: $passed_tests/$total_tests 通过"
    
    if [ "$passed_tests" -eq "$total_tests" ]; then
        log_message "SUCCESS" "所有脚本测试通过"
        return 0
    else
        log_message "WARNING" "部分脚本测试失败，请检查相关脚本"
        return 1
    fi
}

# 创建监控脚本
create_monitoring_script() {
    local monitor_script="$SCRIPT_DIR/monitor-cron-jobs.sh"
    
    log_message "INFO" "创建定时任务监控脚本"
    
    cat > "$monitor_script" << EOF
#!/bin/bash
# 定时任务监控脚本
# 用于监控定时任务的执行状态和健康情况

CRON_LOG_DIR="$CRON_LOG_DIR"
PROJECT_DIR="$PROJECT_DIR"

# 检查定时任务日志
check_cron_logs() {
    echo "=== 定时任务执行状态 ==="
    echo "检查时间: \$(date)"
    echo ""
    
    # 检查各个任务的最后执行时间
    for log_file in "\$CRON_LOG_DIR"/*.log; do
        if [ -f "\$log_file" ]; then
            local task_name=\$(basename "\$log_file" .log)
            local last_run=\$(tail -n 1 "\$log_file" 2>/dev/null | grep -o '^[0-9-]* [0-9:]*' || echo "从未执行")
            local file_size=\$(du -h "\$log_file" | cut -f1)
            
            echo "任务: \$task_name"
            echo "  最后执行: \$last_run"
            echo "  日志大小: \$file_size"
            echo ""
        fi
    done
}

# 检查错误日志
check_error_logs() {
    local error_log="\$CRON_LOG_DIR/cron-errors.log"
    
    if [ -f "\$error_log" ]; then
        local error_count=\$(wc -l < "\$error_log")
        echo "=== 错误统计 ==="
        echo "总错误数: \$error_count"
        
        if [ "\$error_count" -gt 0 ]; then
            echo "最近的错误:"
            tail -n 5 "\$error_log"
        fi
        echo ""
    fi
}

# 主函数
main() {
    check_cron_logs
    check_error_logs
}

main "\$@"
EOF
    
    chmod +x "$monitor_script"
    log_message "SUCCESS" "监控脚本创建完成: $(basename "$monitor_script")"
}

# 显示配置摘要和使用说明
show_configuration_summary() {
    echo ""
    echo "=========================================="
    log_message "SUCCESS" "定时任务配置完成！"
    echo "=========================================="
    echo ""
    
    echo "已配置的定时任务:"
    echo "1. 健康检查: 每分钟执行一次"
    echo "2. 资源监控: 每5分钟执行一次"
    echo "3. 日志清理: 每天凌晨2点执行"
    echo "4. 缓存清理: 每天凌晨3点执行"
    echo "5. PM2日志轮转: 每周日凌晨4点执行"
    echo "6. 定时任务日志清理: 每月1号凌晨5点执行"
    echo ""
    
    echo "重要文件位置:"
    echo "- 定时任务日志目录: $CRON_LOG_DIR/"
    echo "- 错误处理包装器: $SCRIPT_DIR/cron-wrapper.sh"
    echo "- 监控脚本: $SCRIPT_DIR/monitor-cron-jobs.sh"
    echo "- 配置日志: $SETUP_LOG"
    echo ""
    
    echo "管理命令:"
    echo "- 查看定时任务: crontab -l"
    echo "- 编辑定时任务: crontab -e"
    echo "- 删除定时任务: crontab -r"
    echo "- 查看任务日志: ls -la $CRON_LOG_DIR/"
    echo "- 监控任务状态: $SCRIPT_DIR/monitor-cron-jobs.sh"
    echo ""
    
    echo "故障排除:"
    echo "- 检查错误日志: cat $CRON_LOG_DIR/cron-errors.log"
    echo "- 手动测试脚本: $SCRIPT_DIR/health-check.sh --verbose"
    echo "- 重新配置任务: $0"
    echo ""
}

# 清理函数
cleanup_on_error() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_message "ERROR" "脚本执行失败 (退出码: $exit_code)"
        log_message "INFO" "请检查错误信息并重新运行脚本"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 定时任务配置脚本

用法: $0 [选项]

选项:
  -h, --help     显示此帮助信息
  -t, --test     仅测试脚本，不安装定时任务
  -f, --force    强制重新配置，覆盖现有任务
  -r, --remove   移除所有 WordPecker 定时任务
  -s, --status   显示当前定时任务状态

示例:
  $0              # 配置定时任务
  $0 --test       # 测试脚本
  $0 --force      # 强制重新配置
  $0 --remove     # 移除定时任务
  $0 --status     # 查看状态
EOF
}

# 移除定时任务
remove_cron_jobs() {
    log_message "INFO" "移除 WordPecker 定时任务"
    
    # 备份当前 crontab
    backup_crontab
    
    # 创建临时文件，移除 WordPecker 相关任务
    local temp_cron=$(mktemp)
    
    if crontab -l 2>/dev/null | grep -v "wordpecker\|health-check\|resource-monitor\|log-cleanup\|cron-wrapper" > "$temp_cron"; then
        crontab "$temp_cron"
        log_message "SUCCESS" "WordPecker 定时任务已移除"
    else
        log_message "INFO" "没有找到 WordPecker 定时任务"
    fi
    
    rm "$temp_cron"
}

# 显示当前状态
show_status() {
    echo "=========================================="
    echo "WordPecker 定时任务状态"
    echo "=========================================="
    
    # 检查 crontab 中的任务
    local wordpecker_jobs=$(crontab -l 2>/dev/null | grep -c "wordpecker\|health-check\|resource-monitor\|log-cleanup\|cron-wrapper" || echo "0")
    
    echo "配置的定时任务数量: $wordpecker_jobs"
    
    if [ "$wordpecker_jobs" -gt 0 ]; then
        echo ""
        echo "当前定时任务:"
        crontab -l | grep -A 20 "WordPecker 应用定时任务" | grep -E "^[0-9*]" | while read -r line; do
            echo "  $line"
        done
    fi
    
    echo ""
    echo "日志目录状态:"
    if [ -d "$CRON_LOG_DIR" ]; then
        echo "  日志目录: $CRON_LOG_DIR (存在)"
        echo "  日志文件数量: $(find "$CRON_LOG_DIR" -name "*.log" | wc -l)"
        echo "  目录大小: $(du -sh "$CRON_LOG_DIR" 2>/dev/null | cut -f1 || echo "未知")"
    else
        echo "  日志目录: $CRON_LOG_DIR (不存在)"
    fi
    
    echo ""
    echo "脚本状态:"
    local scripts=("health-check.sh" "resource-monitor.sh" "log-cleanup.sh")
    for script in "${scripts[@]}"; do
        if [ -f "$SCRIPT_DIR/$script" ]; then
            echo "  $script: 存在"
        else
            echo "  $script: 缺失"
        fi
    done
}

# 主函数
main() {
    # 设置错误处理
    trap cleanup_on_error EXIT
    
    # 处理命令行参数
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--test)
            log_message "INFO" "测试模式：仅验证脚本，不安装定时任务"
            verify_environment && test_cron_jobs
            exit $?
            ;;
        -f|--force)
            log_message "INFO" "强制模式：重新配置所有定时任务"
            ;;
        -r|--remove)
            remove_cron_jobs
            exit $?
            ;;
        -s|--status)
            show_status
            exit 0
            ;;
        "")
            # 默认模式
            ;;
        *)
            echo "未知选项: $1"
            echo "使用 $0 --help 查看帮助信息"
            exit 1
            ;;
    esac
    
    # 执行主要配置流程
    log_message "INFO" "开始配置 WordPecker 定时任务"
    
    # 验证环境
    if ! verify_environment; then
        log_message "ERROR" "环境验证失败"
        exit 1
    fi
    
    # 备份现有配置
    backup_crontab
    
    # 配置定时任务
    if ! setup_cron_jobs; then
        log_message "ERROR" "定时任务配置失败"
        exit 1
    fi
    
    # 验证配置
    if ! verify_cron_jobs; then
        log_message "ERROR" "定时任务验证失败"
        exit 1
    fi
    
    # 测试脚本
    test_cron_jobs
    
    # 创建监控脚本
    create_monitoring_script
    
    # 显示配置摘要
    show_configuration_summary
    
    log_message "SUCCESS" "WordPecker 定时任务配置完成"
    
    # 清除错误处理陷阱
    trap - EXIT
}

# 如果直接运行此脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi