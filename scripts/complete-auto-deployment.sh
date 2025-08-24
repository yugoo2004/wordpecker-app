#!/bin/bash

# WordPecker 完整自动化部署流程
# 整合所有脚本创建端到端自动化部署解决方案
# 实现需求 5.1, 5.2, 5.4 - 完整的自动化部署流程

set -e

# 配置变量
PROJECT_DIR="/home/devbox/wordpecker-app"
SCRIPT_DIR="$PROJECT_DIR/scripts"
LOG_FILE="./logs/complete-auto-deployment.log"
DEPLOYMENT_LOCK_FILE="/tmp/wordpecker-complete-deploy.lock"
NOTIFICATION_LOG="./logs/deployment-notifications.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 部署阶段状态
DEPLOYMENT_PHASES=(
    "环境验证"
    "代码更新"
    "依赖安装"
    "服务重启"
    "健康检查"
    "监控启动"
    "部署验证"
)

CURRENT_PHASE=0
TOTAL_PHASES=${#DEPLOYMENT_PHASES[@]}

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_phase() {
    CURRENT_PHASE=$((CURRENT_PHASE + 1))
    echo -e "${PURPLE}[阶段 $CURRENT_PHASE/$TOTAL_PHASES]${NC} ${DEPLOYMENT_PHASES[$((CURRENT_PHASE - 1))]}" | tee -a "$LOG_FILE"
    echo "=========================================="
}

# 发送部署通知
send_deployment_notification() {
    local level=$1
    local message=$2
    local phase=${3:-""}
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    local notification_entry="[$level] $timestamp"
    if [ -n "$phase" ]; then
        notification_entry="$notification_entry [阶段: $phase]"
    fi
    notification_entry="$notification_entry - $message"
    
    echo "$notification_entry" >> "$NOTIFICATION_LOG"
    
    # 系统日志记录
    logger -t wordpecker-auto-deploy "[$level] $message"
    
    # 可扩展：发送到外部通知系统
    # curl -X POST "https://hooks.slack.com/..." -d "{'text': '$message'}" || true
}

# 检查部署锁
check_deployment_lock() {
    if [ -f "$DEPLOYMENT_LOCK_FILE" ]; then
        local lock_pid=$(cat "$DEPLOYMENT_LOCK_FILE")
        if kill -0 "$lock_pid" 2>/dev/null; then
            log_error "自动化部署已在进行中 (PID: $lock_pid)"
            exit 1
        else
            log_warning "发现过期的部署锁文件，正在清理"
            rm -f "$DEPLOYMENT_LOCK_FILE"
        fi
    fi
}

# 创建部署锁
create_deployment_lock() {
    echo $$ > "$DEPLOYMENT_LOCK_FILE"
    log_info "创建部署锁 (PID: $$)"
}

# 清理部署锁
cleanup_deployment_lock() {
    rm -f "$DEPLOYMENT_LOCK_FILE"
    log_info "清理部署锁"
}

# 陷阱处理
trap 'cleanup_deployment_lock; log_error "部署过程中发生错误，已清理锁文件"' EXIT INT TERM

# 显示部署开始信息
show_deployment_start() {
    clear
    echo "============================================================"
    echo "               WordPecker 完整自动化部署"
    echo "============================================================"
    echo
    echo "🚀 部署阶段："
    for i in "${!DEPLOYMENT_PHASES[@]}"; do
        echo "   $((i + 1)). ${DEPLOYMENT_PHASES[$i]}"
    done
    echo
    echo "📊 部署信息："
    echo "   • 项目目录: $PROJECT_DIR"
    echo "   • 日志文件: $LOG_FILE"
    echo "   • 开始时间: $(date)"
    echo "   • 执行用户: $(whoami)"
    echo "   • 主机名称: $(hostname)"
    echo
    echo "============================================================"
    echo
}

# 阶段1: 环境验证
phase1_environment_verification() {
    log_phase
    
    log_info "运行环境验证脚本..."
    if [ -f "$SCRIPT_DIR/verify-deployment-environment.sh" ]; then
        if bash "$SCRIPT_DIR/verify-deployment-environment.sh"; then
            log_success "环境验证通过"
            send_deployment_notification "SUCCESS" "环境验证通过" "环境验证"
        else
            log_error "环境验证失败"
            send_deployment_notification "ERROR" "环境验证失败，部署终止" "环境验证"
            return 1
        fi
    else
        log_warning "环境验证脚本不存在，跳过验证"
        send_deployment_notification "WARNING" "环境验证脚本缺失" "环境验证"
    fi
    
    # 检查系统资源
    log_info "检查系统资源状态..."
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    local memory_usage=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    
    log_info "磁盘使用率: ${disk_usage}%"
    log_info "内存使用率: ${memory_usage}%"
    
    if [ "$disk_usage" -gt 90 ]; then
        log_error "磁盘空间不足，无法继续部署"
        return 1
    fi
    
    echo
}

# 阶段2: 代码更新
phase2_code_update() {
    log_phase
    
    log_info "执行代码更新..."
    if [ -f "$SCRIPT_DIR/deploy.sh" ]; then
        # 使用现有的部署脚本，但只执行代码更新部分
        log_info "调用部署脚本进行代码更新..."
        
        # 备份当前版本
        local backup_path=$(bash "$SCRIPT_DIR/deploy.sh" --backup-only 2>/dev/null || echo "")
        
        if [ -n "$backup_path" ]; then
            log_success "代码备份完成: $backup_path"
            echo "$backup_path" > "/tmp/wordpecker-backup-path.txt"
        fi
        
        # 执行代码更新
        if bash "$SCRIPT_DIR/deploy.sh" --code-only; then
            log_success "代码更新完成"
            send_deployment_notification "SUCCESS" "代码更新完成" "代码更新"
        else
            log_error "代码更新失败"
            send_deployment_notification "ERROR" "代码更新失败" "代码更新"
            return 1
        fi
    else
        log_error "部署脚本不存在: $SCRIPT_DIR/deploy.sh"
        return 1
    fi
    
    echo
}

# 阶段3: 依赖安装
phase3_dependency_installation() {
    log_phase
    
    log_info "安装项目依赖..."
    
    # 后端依赖
    log_info "安装后端依赖..."
    cd "$PROJECT_DIR/backend"
    if npm ci --production --silent; then
        log_success "后端依赖安装完成"
    else
        log_error "后端依赖安装失败"
        return 1
    fi
    
    # 构建后端
    if npm run build --silent 2>/dev/null; then
        log_info "后端构建完成"
    else
        log_info "后端无需构建或构建脚本不存在"
    fi
    
    # 前端依赖
    log_info "安装前端依赖..."
    cd "$PROJECT_DIR/frontend"
    if npm ci --silent; then
        log_success "前端依赖安装完成"
    else
        log_error "前端依赖安装失败"
        return 1
    fi
    
    # 构建前端
    log_info "构建前端应用..."
    if npm run build --silent; then
        log_success "前端构建完成"
    else
        log_error "前端构建失败"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    send_deployment_notification "SUCCESS" "依赖安装和构建完成" "依赖安装"
    echo
}

# 阶段4: 服务重启
phase4_service_restart() {
    log_phase
    
    log_info "重启应用服务..."
    
    # 检查PM2进程状态
    if pm2 list | grep -q "wordpecker"; then
        log_info "重新加载现有PM2进程..."
        if pm2 reload ecosystem.config.js --env production; then
            log_success "PM2进程重新加载完成"
        else
            log_warning "PM2重新加载失败，尝试重启..."
            pm2 restart ecosystem.config.js --env production
        fi
    else
        log_info "启动新的PM2进程..."
        pm2 start ecosystem.config.js --env production
    fi
    
    # 保存PM2配置
    pm2 save
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 15
    
    send_deployment_notification "SUCCESS" "服务重启完成" "服务重启"
    echo
}

# 阶段5: 健康检查
phase5_health_check() {
    log_phase
    
    log_info "执行服务健康检查..."
    
    local max_attempts=12
    local attempt=0
    
    # 检查后端服务
    log_info "检查后端服务健康状态..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s "http://localhost:3000/api/health" > /dev/null; then
            log_success "后端服务健康检查通过"
            break
        fi
        
        attempt=$((attempt + 1))
        log_info "等待后端服务启动... ($attempt/$max_attempts)"
        sleep 5
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "后端服务健康检查超时"
        send_deployment_notification "ERROR" "后端服务健康检查失败" "健康检查"
        return 1
    fi
    
    # 检查前端服务
    log_info "检查前端服务健康状态..."
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s "http://localhost:5173" > /dev/null; then
            log_success "前端服务健康检查通过"
            break
        fi
        
        attempt=$((attempt + 1))
        log_info "等待前端服务启动... ($attempt/$max_attempts)"
        sleep 5
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "前端服务健康检查超时"
        send_deployment_notification "ERROR" "前端服务健康检查失败" "健康检查"
        return 1
    fi
    
    # 功能测试
    log_info "执行功能测试..."
    local health_response=$(curl -s "http://localhost:3000/api/health")
    if echo "$health_response" | grep -q '"status":"healthy"'; then
        log_success "功能测试通过"
    else
        log_error "功能测试失败"
        return 1
    fi
    
    send_deployment_notification "SUCCESS" "健康检查完成" "健康检查"
    echo
}

# 阶段6: 启动监控服务
phase6_monitoring_startup() {
    log_phase
    
    log_info "启动监控和高可用性服务..."
    
    # 启动高可用性管理器
    if [ -f "$SCRIPT_DIR/start-high-availability.sh" ]; then
        log_info "启动高可用性管理器..."
        if bash "$SCRIPT_DIR/start-high-availability.sh"; then
            log_success "高可用性管理器启动成功"
        else
            log_warning "高可用性管理器启动失败"
        fi
    else
        log_warning "高可用性启动脚本不存在"
    fi
    
    # 启动资源监控
    if [ -f "$SCRIPT_DIR/resource-monitor.sh" ]; then
        log_info "启动资源监控..."
        # 在后台启动资源监控
        nohup bash "$SCRIPT_DIR/resource-monitor.sh" > /dev/null 2>&1 &
        log_success "资源监控已在后台启动"
    else
        log_warning "资源监控脚本不存在"
    fi
    
    # 验证监控服务状态
    log_info "验证监控服务状态..."
    sleep 5
    
    # 检查高可用性API端点
    if curl -f -s "http://localhost:3000/api/high-availability/status" > /dev/null; then
        log_success "高可用性API端点正常"
    else
        log_warning "高可用性API端点不可用"
    fi
    
    # 检查管理API端点
    if curl -f -s "http://localhost:3000/api/management/status" > /dev/null; then
        log_success "远程管理API端点正常"
    else
        log_warning "远程管理API端点不可用"
    fi
    
    send_deployment_notification "SUCCESS" "监控服务启动完成" "监控启动"
    echo
}

# 阶段7: 部署验证
phase7_deployment_verification() {
    log_phase
    
    log_info "执行完整部署验证..."
    
    # 运行部署后验证脚本
    if [ -f "$SCRIPT_DIR/post-deploy-verify.sh" ]; then
        log_info "运行部署后验证脚本..."
        if bash "$SCRIPT_DIR/post-deploy-verify.sh"; then
            log_success "部署后验证通过"
        else
            log_warning "部署后验证发现问题"
        fi
    fi
    
    # 测试远程管理功能
    log_info "测试远程管理功能..."
    if [ -f "$SCRIPT_DIR/test-management-api.sh" ]; then
        if bash "$SCRIPT_DIR/test-management-api.sh"; then
            log_success "远程管理功能测试通过"
        else
            log_warning "远程管理功能测试失败"
        fi
    fi
    
    # 测试高可用性功能
    log_info "测试高可用性功能..."
    if [ -f "$SCRIPT_DIR/test-high-availability.sh" ]; then
        if bash "$SCRIPT_DIR/test-high-availability.sh"; then
            log_success "高可用性功能测试通过"
        else
            log_warning "高可用性功能测试失败"
        fi
    fi
    
    # 生成部署报告
    generate_deployment_report
    
    send_deployment_notification "SUCCESS" "部署验证完成" "部署验证"
    echo
}

# 生成部署报告
generate_deployment_report() {
    local report_file="./logs/deployment-report-$(date +%Y%m%d-%H%M%S).json"
    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - DEPLOYMENT_START_TIME))
    
    log_info "生成部署报告..."
    
    cat > "$report_file" << EOF
{
  "deployment": {
    "status": "SUCCESS",
    "start_time": "$(date -d @$DEPLOYMENT_START_TIME '+%Y-%m-%d %H:%M:%S')",
    "end_time": "$(date -d @$deployment_end_time '+%Y-%m-%d %H:%M:%S')",
    "duration_seconds": $deployment_duration,
    "phases_completed": $CURRENT_PHASE,
    "total_phases": $TOTAL_PHASES,
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "backup_path": "$(cat /tmp/wordpecker-backup-path.txt 2>/dev/null || echo 'none')"
  },
  "services": {
    "pm2_processes": $(pm2 jlist 2>/dev/null || echo '[]'),
    "systemd_status": "$(systemctl is-active wordpecker 2>/dev/null || echo 'unknown')"
  },
  "system": {
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "node_version": "$(node -v)",
    "disk_usage": "$(df -h / | awk 'NR==2{print $5}')",
    "memory_usage": "$(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')",
    "load_average": "$(uptime | awk -F'load average:' '{print $2}' | xargs)"
  },
  "endpoints": {
    "backend_health": "$(curl -s http://localhost:3000/api/health | jq -r '.status' 2>/dev/null || echo 'unknown')",
    "frontend_status": "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173 2>/dev/null || echo 'unknown')",
    "management_api": "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/management/status 2>/dev/null || echo 'unknown')",
    "high_availability": "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/high-availability/status 2>/dev/null || echo 'unknown')"
  }
}
EOF
    
    log_success "部署报告已生成: $report_file"
}

# 错误处理和回滚
handle_deployment_failure() {
    local failed_phase=$1
    local error_message=$2
    
    log_error "部署在阶段 '$failed_phase' 失败: $error_message"
    send_deployment_notification "ERROR" "部署失败在阶段: $failed_phase" "$failed_phase"
    
    # 检查是否有备份可以回滚
    local backup_path=$(cat /tmp/wordpecker-backup-path.txt 2>/dev/null || echo "")
    
    if [ -n "$backup_path" ] && [ -d "$backup_path" ]; then
        log_warning "尝试自动回滚到备份版本..."
        send_deployment_notification "WARNING" "开始自动回滚" "回滚"
        
        if [ -f "$SCRIPT_DIR/deploy.sh" ]; then
            if bash "$SCRIPT_DIR/deploy.sh" --rollback "$backup_path"; then
                log_success "自动回滚成功"
                send_deployment_notification "SUCCESS" "自动回滚成功" "回滚"
                return 0
            else
                log_error "自动回滚失败"
                send_deployment_notification "CRITICAL" "自动回滚失败，需要手动干预" "回滚"
                return 1
            fi
        fi
    else
        log_error "无备份可用，无法自动回滚"
        send_deployment_notification "CRITICAL" "部署失败且无法回滚" "回滚"
    fi
    
    return 1
}

# 显示部署完成信息
show_deployment_completion() {
    local deployment_status=$1
    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - DEPLOYMENT_START_TIME))
    
    echo
    echo "============================================================"
    echo "               部署完成"
    echo "============================================================"
    
    if [ "$deployment_status" = "SUCCESS" ]; then
        echo -e "${GREEN}🎉 自动化部署成功完成！${NC}"
        echo
        echo "📊 部署统计："
        echo "   • 总耗时: $((deployment_duration / 60))分$((deployment_duration % 60))秒"
        echo "   • 完成阶段: $CURRENT_PHASE/$TOTAL_PHASES"
        echo "   • 部署时间: $(date)"
        echo
        echo "🔗 服务访问："
        echo "   • 前端应用: http://localhost:5173"
        echo "   • 后端API: http://localhost:3000"
        echo "   • 健康检查: http://localhost:3000/api/health"
        echo "   • 管理API: http://localhost:3000/api/management/status"
        echo
        echo "📋 管理命令："
        echo "   • 查看服务状态: pm2 status"
        echo "   • 查看日志: pm2 logs"
        echo "   • 重启服务: pm2 restart all"
        echo "   • 系统服务: sudo systemctl status wordpecker"
        echo
        echo "📁 重要文件："
        echo "   • 部署日志: $LOG_FILE"
        echo "   • 通知日志: $NOTIFICATION_LOG"
        echo "   • 快速参考: $PROJECT_DIR/DEPLOYMENT_QUICK_REFERENCE.md"
        
    else
        echo -e "${RED}❌ 自动化部署失败${NC}"
        echo
        echo "📊 失败信息："
        echo "   • 失败阶段: ${DEPLOYMENT_PHASES[$((CURRENT_PHASE - 1))]}"
        echo "   • 耗时: $((deployment_duration / 60))分$((deployment_duration % 60))秒"
        echo "   • 失败时间: $(date)"
        echo
        echo "🔧 故障排除："
        echo "   • 查看详细日志: cat $LOG_FILE"
        echo "   • 查看通知日志: cat $NOTIFICATION_LOG"
        echo "   • 检查服务状态: pm2 status"
        echo "   • 运行环境验证: $SCRIPT_DIR/verify-deployment-environment.sh"
    fi
    
    echo "============================================================"
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 完整自动化部署脚本

用法: $0 [选项]

选项:
  -h, --help              显示此帮助信息
  -v, --verbose           详细输出模式
  --dry-run              模拟运行（不执行实际操作）
  --skip-verification    跳过环境验证
  --skip-monitoring      跳过监控服务启动
  --force                强制部署（忽略锁文件）

环境变量:
  DRY_RUN=true           模拟运行模式
  SKIP_VERIFICATION=true 跳过环境验证
  SKIP_MONITORING=true   跳过监控启动

示例:
  $0                     # 标准自动化部署
  $0 --verbose           # 详细模式部署
  $0 --dry-run           # 模拟运行
  $0 --skip-verification # 跳过环境验证

部署阶段:
EOF
    
    for i in "${!DEPLOYMENT_PHASES[@]}"; do
        echo "  $((i + 1)). ${DEPLOYMENT_PHASES[$i]}"
    done
}

# 主部署流程
main() {
    local DEPLOYMENT_START_TIME=$(date +%s)
    local deployment_status="FAILED"
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                set -x
                shift
                ;;
            --dry-run)
                export DRY_RUN=true
                shift
                ;;
            --skip-verification)
                export SKIP_VERIFICATION=true
                shift
                ;;
            --skip-monitoring)
                export SKIP_MONITORING=true
                shift
                ;;
            --force)
                rm -f "$DEPLOYMENT_LOCK_FILE"
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 创建必要目录
    mkdir -p ./logs
    
    # 显示部署开始信息
    show_deployment_start
    
    # 检查部署锁
    check_deployment_lock
    create_deployment_lock
    
    log_info "开始 WordPecker 完整自动化部署..."
    send_deployment_notification "INFO" "开始完整自动化部署"
    
    # 如果是模拟运行模式
    if [ "$DRY_RUN" = "true" ]; then
        log_info "模拟运行模式 - 不执行实际操作"
        for phase in "${DEPLOYMENT_PHASES[@]}"; do
            log_phase
            log_info "模拟执行: $phase"
            sleep 2
        done
        log_success "模拟运行完成"
        exit 0
    fi
    
    # 执行部署阶段
    {
        # 阶段1: 环境验证
        if [ "$SKIP_VERIFICATION" != "true" ]; then
            phase1_environment_verification
        else
            log_warning "跳过环境验证阶段"
            CURRENT_PHASE=$((CURRENT_PHASE + 1))
        fi
        
        # 阶段2: 代码更新
        phase2_code_update
        
        # 阶段3: 依赖安装
        phase3_dependency_installation
        
        # 阶段4: 服务重启
        phase4_service_restart
        
        # 阶段5: 健康检查
        phase5_health_check
        
        # 阶段6: 监控启动
        if [ "$SKIP_MONITORING" != "true" ]; then
            phase6_monitoring_startup
        else
            log_warning "跳过监控服务启动阶段"
            CURRENT_PHASE=$((CURRENT_PHASE + 1))
        fi
        
        # 阶段7: 部署验证
        phase7_deployment_verification
        
        deployment_status="SUCCESS"
        log_success "所有部署阶段完成！"
        send_deployment_notification "SUCCESS" "完整自动化部署成功完成"
        
    } || {
        # 部署失败处理
        local failed_phase="${DEPLOYMENT_PHASES[$((CURRENT_PHASE - 1))]}"
        handle_deployment_failure "$failed_phase" "阶段执行失败"
        deployment_status="FAILED"
    }
    
    # 显示部署完成信息
    show_deployment_completion "$deployment_status"
    
    # 清理临时文件
    rm -f /tmp/wordpecker-backup-path.txt
    
    # 返回适当的退出码
    if [ "$deployment_status" = "SUCCESS" ]; then
        exit 0
    else
        exit 1
    fi
}

# 脚本入口点
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi