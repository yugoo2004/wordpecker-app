#!/bin/bash

# WordPecker 部署流程监控脚本
# 监控部署过程，提供实时状态更新和错误处理

set -e

# 配置变量
PROJECT_DIR="/home/devbox/wordpecker-app"
LOG_FILE="./logs/deployment-monitor.log"
MONITOR_INTERVAL=5
MAX_MONITOR_TIME=1800  # 30分钟最大监控时间

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 部署状态
DEPLOYMENT_STATUS="unknown"
DEPLOYMENT_START_TIME=""
CURRENT_PHASE=""
PHASE_START_TIME=""

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
    echo -e "${PURPLE}[PHASE]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# 检测部署进程
detect_deployment_process() {
    local deploy_pid=""
    
    # 检查完整自动化部署进程
    if pgrep -f "complete-auto-deployment.sh" > /dev/null; then
        deploy_pid=$(pgrep -f "complete-auto-deployment.sh")
        echo "complete-auto-deployment:$deploy_pid"
        return 0
    fi
    
    # 检查标准部署进程
    if pgrep -f "deploy.sh" > /dev/null; then
        deploy_pid=$(pgrep -f "deploy.sh")
        echo "deploy:$deploy_pid"
        return 0
    fi
    
    # 检查PM2操作
    if pgrep -f "pm2.*wordpecker" > /dev/null; then
        deploy_pid=$(pgrep -f "pm2.*wordpecker")
        echo "pm2:$deploy_pid"
        return 0
    fi
    
    return 1
}

# 获取部署状态
get_deployment_status() {
    local deployment_info=$(detect_deployment_process)
    
    if [ $? -eq 0 ]; then
        local deploy_type=$(echo "$deployment_info" | cut -d':' -f1)
        local deploy_pid=$(echo "$deployment_info" | cut -d':' -f2)
        
        echo "running:$deploy_type:$deploy_pid"
    else
        echo "idle"
    fi
}

# 分析部署日志
analyze_deployment_logs() {
    local log_files=(
        "./logs/complete-auto-deployment.log"
        "./logs/deploy.log"
        "./logs/deployment-status.log"
    )
    
    local latest_log=""
    local latest_time=0
    
    # 找到最新的日志文件
    for log_file in "${log_files[@]}"; do
        if [ -f "$log_file" ]; then
            local file_time=$(stat -c %Y "$log_file" 2>/dev/null || echo 0)
            if [ "$file_time" -gt "$latest_time" ]; then
                latest_time=$file_time
                latest_log="$log_file"
            fi
        fi
    done
    
    if [ -n "$latest_log" ]; then
        # 分析最新日志的最后几行
        local recent_lines=$(tail -10 "$latest_log" 2>/dev/null || echo "")
        
        # 检测当前阶段
        local current_phase=$(echo "$recent_lines" | grep -o '\[阶段 [0-9]*/[0-9]*\].*' | tail -1 | sed 's/.*\] //')
        
        # 检测错误
        local error_count=$(echo "$recent_lines" | grep -c '\[ERROR\]' || echo 0)
        local warning_count=$(echo "$recent_lines" | grep -c '\[WARNING\]' || echo 0)
        
        # 检测成功完成
        local success_indicators=$(echo "$recent_lines" | grep -c -E '部署成功|SUCCESS.*完成|所有.*通过' || echo 0)
        
        echo "$latest_log:$current_phase:$error_count:$warning_count:$success_indicators"
    else
        echo "no_logs"
    fi
}

# 检查服务健康状态
check_service_health() {
    local backend_status="unknown"
    local frontend_status="unknown"
    local pm2_status="unknown"
    
    # 检查后端服务
    if curl -f -s --connect-timeout 3 "http://localhost:3000/api/health" > /dev/null 2>&1; then
        backend_status="healthy"
    else
        backend_status="unhealthy"
    fi
    
    # 检查前端服务
    if curl -f -s --connect-timeout 3 "http://localhost:5173" > /dev/null 2>&1; then
        frontend_status="healthy"
    else
        frontend_status="unhealthy"
    fi
    
    # 检查PM2状态
    if pm2 list 2>/dev/null | grep -q "wordpecker.*online"; then
        pm2_status="online"
    elif pm2 list 2>/dev/null | grep -q "wordpecker"; then
        pm2_status="partial"
    else
        pm2_status="offline"
    fi
    
    echo "$backend_status:$frontend_status:$pm2_status"
}

# 获取系统资源状态
get_system_resources() {
    local cpu_usage=$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}' | tr -d ' ' || echo "0")
    local memory_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}' || echo "0")
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//' || echo "0")
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',' || echo "0")
    
    echo "$cpu_usage:$memory_usage:$disk_usage:$load_avg"
}

# 显示实时监控界面
display_monitor_dashboard() {
    clear
    
    echo "============================================================"
    echo "               WordPecker 部署监控仪表板"
    echo "============================================================"
    echo
    
    # 获取当前状态
    local deployment_status=$(get_deployment_status)
    local log_analysis=$(analyze_deployment_logs)
    local service_health=$(check_service_health)
    local system_resources=$(get_system_resources)
    
    # 解析状态信息
    local deploy_state=$(echo "$deployment_status" | cut -d':' -f1)
    local deploy_type=$(echo "$deployment_status" | cut -d':' -f2 2>/dev/null || echo "")
    local deploy_pid=$(echo "$deployment_status" | cut -d':' -f3 2>/dev/null || echo "")
    
    local log_file=$(echo "$log_analysis" | cut -d':' -f1)
    local current_phase=$(echo "$log_analysis" | cut -d':' -f2)
    local error_count=$(echo "$log_analysis" | cut -d':' -f3)
    local warning_count=$(echo "$log_analysis" | cut -d':' -f4)
    local success_count=$(echo "$log_analysis" | cut -d':' -f5)
    
    local backend_health=$(echo "$service_health" | cut -d':' -f1)
    local frontend_health=$(echo "$service_health" | cut -d':' -f2)
    local pm2_health=$(echo "$service_health" | cut -d':' -f3)
    
    local cpu_usage=$(echo "$system_resources" | cut -d':' -f1)
    local memory_usage=$(echo "$system_resources" | cut -d':' -f2)
    local disk_usage=$(echo "$system_resources" | cut -d':' -f3)
    local load_avg=$(echo "$system_resources" | cut -d':' -f4)
    
    # 显示部署状态
    echo "🚀 部署状态："
    if [ "$deploy_state" = "running" ]; then
        echo -e "   状态: ${GREEN}运行中${NC} ($deploy_type, PID: $deploy_pid)"
        if [ -n "$current_phase" ]; then
            echo -e "   当前阶段: ${BLUE}$current_phase${NC}"
        fi
    else
        echo -e "   状态: ${YELLOW}空闲${NC}"
    fi
    
    if [ "$log_file" != "no_logs" ] && [ -f "$log_file" ]; then
        echo "   活动日志: $(basename "$log_file")"
        if [ "$error_count" -gt 0 ]; then
            echo -e "   错误数: ${RED}$error_count${NC}"
        fi
        if [ "$warning_count" -gt 0 ]; then
            echo -e "   警告数: ${YELLOW}$warning_count${NC}"
        fi
        if [ "$success_count" -gt 0 ]; then
            echo -e "   成功指标: ${GREEN}$success_count${NC}"
        fi
    fi
    echo
    
    # 显示服务健康状态
    echo "💚 服务健康状态："
    echo -n "   后端服务: "
    case $backend_health in
        "healthy") echo -e "${GREEN}健康${NC}" ;;
        "unhealthy") echo -e "${RED}异常${NC}" ;;
        *) echo -e "${YELLOW}未知${NC}" ;;
    esac
    
    echo -n "   前端服务: "
    case $frontend_health in
        "healthy") echo -e "${GREEN}健康${NC}" ;;
        "unhealthy") echo -e "${RED}异常${NC}" ;;
        *) echo -e "${YELLOW}未知${NC}" ;;
    esac
    
    echo -n "   PM2进程: "
    case $pm2_health in
        "online") echo -e "${GREEN}在线${NC}" ;;
        "partial") echo -e "${YELLOW}部分在线${NC}" ;;
        "offline") echo -e "${RED}离线${NC}" ;;
        *) echo -e "${YELLOW}未知${NC}" ;;
    esac
    echo
    
    # 显示系统资源
    echo "📊 系统资源："
    echo -n "   CPU使用率: "
    if [ "$cpu_usage" -gt 80 ]; then
        echo -e "${RED}${cpu_usage}%${NC}"
    elif [ "$cpu_usage" -gt 60 ]; then
        echo -e "${YELLOW}${cpu_usage}%${NC}"
    else
        echo -e "${GREEN}${cpu_usage}%${NC}"
    fi
    
    echo -n "   内存使用率: "
    if [ "$memory_usage" -gt 80 ]; then
        echo -e "${RED}${memory_usage}%${NC}"
    elif [ "$memory_usage" -gt 60 ]; then
        echo -e "${YELLOW}${memory_usage}%${NC}"
    else
        echo -e "${GREEN}${memory_usage}%${NC}"
    fi
    
    echo -n "   磁盘使用率: "
    if [ "$disk_usage" -gt 85 ]; then
        echo -e "${RED}${disk_usage}%${NC}"
    elif [ "$disk_usage" -gt 70 ]; then
        echo -e "${YELLOW}${disk_usage}%${NC}"
    else
        echo -e "${GREEN}${disk_usage}%${NC}"
    fi
    
    echo "   系统负载: $load_avg"
    echo
    
    # 显示最新日志
    if [ "$log_file" != "no_logs" ] && [ -f "$log_file" ]; then
        echo "📝 最新日志 (最后5行)："
        echo "------------------------------------------------------------"
        tail -5 "$log_file" 2>/dev/null | while IFS= read -r line; do
            # 根据日志级别着色
            if echo "$line" | grep -q '\[ERROR\]'; then
                echo -e "${RED}$line${NC}"
            elif echo "$line" | grep -q '\[WARNING\]'; then
                echo -e "${YELLOW}$line${NC}"
            elif echo "$line" | grep -q '\[SUCCESS\]'; then
                echo -e "${GREEN}$line${NC}"
            elif echo "$line" | grep -q '\[PHASE\]'; then
                echo -e "${PURPLE}$line${NC}"
            else
                echo "$line"
            fi
        done
        echo "------------------------------------------------------------"
    fi
    
    echo
    echo "⏰ 更新时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "🔄 自动刷新间隔: ${MONITOR_INTERVAL}秒"
    echo
    echo "按 Ctrl+C 退出监控"
    echo "============================================================"
}

# 监控部署进程
monitor_deployment() {
    local start_time=$(date +%s)
    local last_status=""
    
    log_info "开始监控部署进程..."
    
    while true; do
        local current_time=$(date +%s)
        local elapsed_time=$((current_time - start_time))
        
        # 检查最大监控时间
        if [ $elapsed_time -gt $MAX_MONITOR_TIME ]; then
            log_warning "达到最大监控时间 ($MAX_MONITOR_TIME 秒)，退出监控"
            break
        fi
        
        # 显示监控界面
        display_monitor_dashboard
        
        # 检查部署状态变化
        local current_status=$(get_deployment_status)
        
        if [ "$current_status" != "$last_status" ]; then
            log_info "部署状态变化: $last_status -> $current_status"
            last_status="$current_status"
            
            # 如果部署完成，检查结果
            if echo "$current_status" | grep -q "idle"; then
                log_info "检测到部署进程结束，分析结果..."
                analyze_deployment_result
                break
            fi
        fi
        
        # 等待下次检查
        sleep $MONITOR_INTERVAL
    done
}

# 分析部署结果
analyze_deployment_result() {
    log_info "分析部署结果..."
    
    local log_analysis=$(analyze_deployment_logs)
    local service_health=$(check_service_health)
    
    local error_count=$(echo "$log_analysis" | cut -d':' -f3)
    local success_count=$(echo "$log_analysis" | cut -d':' -f5)
    
    local backend_health=$(echo "$service_health" | cut -d':' -f1)
    local frontend_health=$(echo "$service_health" | cut -d':' -f2)
    
    echo
    echo "============================================================"
    echo "               部署结果分析"
    echo "============================================================"
    
    # 判断部署是否成功
    local deployment_successful=true
    
    if [ "$error_count" -gt 0 ]; then
        log_error "部署过程中发现 $error_count 个错误"
        deployment_successful=false
    fi
    
    if [ "$backend_health" != "healthy" ]; then
        log_error "后端服务健康检查失败"
        deployment_successful=false
    fi
    
    if [ "$frontend_health" != "healthy" ]; then
        log_error "前端服务健康检查失败"
        deployment_successful=false
    fi
    
    if [ "$deployment_successful" = "true" ]; then
        log_success "部署成功完成！"
        echo
        echo "🎉 所有服务正常运行"
        echo "🔗 访问地址："
        echo "   • 前端: http://localhost:5173"
        echo "   • 后端API: http://localhost:3000"
        echo "   • 健康检查: http://localhost:3000/api/health"
    else
        log_error "部署失败或存在问题"
        echo
        echo "❌ 需要检查的问题："
        if [ "$error_count" -gt 0 ]; then
            echo "   • 查看错误日志解决问题"
        fi
        if [ "$backend_health" != "healthy" ]; then
            echo "   • 检查后端服务状态"
        fi
        if [ "$frontend_health" != "healthy" ]; then
            echo "   • 检查前端服务状态"
        fi
    fi
    
    echo "============================================================"
}

# 启动部署并监控
start_deployment_with_monitoring() {
    local deployment_script="$1"
    local deployment_args="${@:2}"
    
    if [ ! -f "$deployment_script" ]; then
        log_error "部署脚本不存在: $deployment_script"
        return 1
    fi
    
    log_info "启动部署脚本: $deployment_script $deployment_args"
    
    # 在后台启动部署脚本
    nohup bash "$deployment_script" $deployment_args > /dev/null 2>&1 &
    local deploy_pid=$!
    
    log_info "部署进程已启动 (PID: $deploy_pid)"
    
    # 等待一下让部署脚本开始执行
    sleep 3
    
    # 开始监控
    monitor_deployment
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 部署流程监控脚本

用法: $0 [选项] [命令] [参数...]

命令:
  monitor                 监控当前部署进程
  start-and-monitor <脚本> [参数...]  启动部署脚本并监控
  analyze                 分析最近的部署结果
  dashboard               显示实时监控仪表板

选项:
  -h, --help              显示此帮助信息
  -i, --interval <秒>     设置监控刷新间隔 (默认: 5秒)
  -t, --timeout <秒>      设置最大监控时间 (默认: 1800秒)

示例:
  $0 monitor              # 监控当前部署
  $0 dashboard            # 显示监控仪表板
  $0 start-and-monitor ./scripts/complete-auto-deployment.sh
  $0 --interval 10 monitor  # 10秒刷新间隔监控

监控功能:
  • 实时显示部署进度和状态
  • 监控服务健康状态
  • 显示系统资源使用情况
  • 分析部署日志和错误
  • 自动检测部署完成并分析结果

EOF
}

# 主函数
main() {
    local command="monitor"
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -i|--interval)
                MONITOR_INTERVAL="$2"
                shift 2
                ;;
            -t|--timeout)
                MAX_MONITOR_TIME="$2"
                shift 2
                ;;
            monitor|start-and-monitor|analyze|dashboard)
                command="$1"
                shift
                break
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 创建日志目录
    mkdir -p ./logs
    
    log_info "启动部署监控器，命令: $command"
    
    # 执行相应命令
    case $command in
        monitor)
            monitor_deployment
            ;;
        start-and-monitor)
            if [ $# -eq 0 ]; then
                log_error "start-and-monitor 命令需要指定部署脚本"
                exit 1
            fi
            start_deployment_with_monitoring "$@"
            ;;
        analyze)
            analyze_deployment_result
            ;;
        dashboard)
            # 持续显示仪表板
            while true; do
                display_monitor_dashboard
                sleep $MONITOR_INTERVAL
            done
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 信号处理
trap 'echo; log_info "监控器已停止"; exit 0' INT TERM

# 脚本入口点
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi