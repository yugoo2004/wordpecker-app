#!/bin/bash

# WordPecker 远程管理API集成脚本
# 集成远程管理API到部署流程中，实现远程控制和监控

set -e

# 配置变量
PROJECT_DIR="/home/devbox/wordpecker-app"
LOG_FILE="./logs/remote-management.log"
API_BASE_URL="http://localhost:3000/api"
MANAGEMENT_API_URL="$API_BASE_URL/management"
HA_API_URL="$API_BASE_URL/high-availability"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# API调用函数
api_call() {
    local method=$1
    local endpoint=$2
    local data=${3:-""}
    local timeout=${4:-10}
    
    local curl_opts=(-s -w "%{http_code}" --connect-timeout "$timeout")
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl_opts+=(-X POST -H "Content-Type: application/json" -d "$data")
    elif [ "$method" = "DELETE" ]; then
        curl_opts+=(-X DELETE)
    fi
    
    local response=$(curl "${curl_opts[@]}" "$endpoint")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "$body"
        return 0
    else
        log_error "API调用失败: $method $endpoint (HTTP $http_code)"
        echo "$body" >&2
        return 1
    fi
}

# 检查API可用性
check_api_availability() {
    log_info "检查远程管理API可用性..."
    
    # 检查管理API
    if api_call "GET" "$MANAGEMENT_API_URL/status" > /dev/null; then
        log_success "管理API可用"
    else
        log_error "管理API不可用"
        return 1
    fi
    
    # 检查高可用性API
    if api_call "GET" "$HA_API_URL/status" > /dev/null; then
        log_success "高可用性API可用"
    else
        log_warning "高可用性API不可用"
    fi
    
    return 0
}

# 获取服务状态
get_service_status() {
    log_info "获取服务状态..."
    
    local status_response=$(api_call "GET" "$MANAGEMENT_API_URL/status")
    if [ $? -eq 0 ]; then
        echo "$status_response" | jq '.'
        log_success "服务状态获取成功"
        return 0
    else
        log_error "获取服务状态失败"
        return 1
    fi
}

# 获取系统指标
get_system_metrics() {
    log_info "获取系统指标..."
    
    local metrics_response=$(api_call "GET" "$MANAGEMENT_API_URL/metrics")
    if [ $? -eq 0 ]; then
        echo "$metrics_response" | jq '.'
        log_success "系统指标获取成功"
        return 0
    else
        log_error "获取系统指标失败"
        return 1
    fi
}

# 远程重启服务
remote_restart_service() {
    local service_name=${1:-"all"}
    
    log_info "远程重启服务: $service_name"
    
    local restart_data="{\"service\": \"$service_name\"}"
    local restart_response=$(api_call "POST" "$MANAGEMENT_API_URL/restart" "$restart_data")
    
    if [ $? -eq 0 ]; then
        log_success "服务重启成功: $service_name"
        echo "$restart_response" | jq '.'
        return 0
    else
        log_error "服务重启失败: $service_name"
        return 1
    fi
}

# 远程停止服务
remote_stop_service() {
    local service_name=${1:-"all"}
    
    log_info "远程停止服务: $service_name"
    
    local stop_data="{\"service\": \"$service_name\"}"
    local stop_response=$(api_call "POST" "$MANAGEMENT_API_URL/stop" "$stop_data")
    
    if [ $? -eq 0 ]; then
        log_success "服务停止成功: $service_name"
        echo "$stop_response" | jq '.'
        return 0
    else
        log_error "服务停止失败: $service_name"
        return 1
    fi
}

# 远程启动服务
remote_start_service() {
    local service_name=${1:-"all"}
    
    log_info "远程启动服务: $service_name"
    
    local start_data="{\"service\": \"$service_name\"}"
    local start_response=$(api_call "POST" "$MANAGEMENT_API_URL/start" "$start_data")
    
    if [ $? -eq 0 ]; then
        log_success "服务启动成功: $service_name"
        echo "$start_response" | jq '.'
        return 0
    else
        log_error "服务启动失败: $service_name"
        return 1
    fi
}

# 远程扩缩容服务
remote_scale_service() {
    local service_name=$1
    local instances=$2
    
    if [ -z "$service_name" ] || [ -z "$instances" ]; then
        log_error "扩缩容需要指定服务名和实例数"
        return 1
    fi
    
    log_info "远程扩缩容服务: $service_name 到 $instances 个实例"
    
    local scale_data="{\"service\": \"$service_name\", \"instances\": $instances}"
    local scale_response=$(api_call "POST" "$MANAGEMENT_API_URL/scale" "$scale_data")
    
    if [ $? -eq 0 ]; then
        log_success "服务扩缩容成功: $service_name"
        echo "$scale_response" | jq '.'
        return 0
    else
        log_error "服务扩缩容失败: $service_name"
        return 1
    fi
}

# 获取PM2日志
get_pm2_logs() {
    local service_name=${1:-"all"}
    local lines=${2:-100}
    
    log_info "获取PM2日志: $service_name (最近 $lines 行)"
    
    local logs_response=$(api_call "GET" "$MANAGEMENT_API_URL/logs/pm2?service=$service_name&lines=$lines")
    
    if [ $? -eq 0 ]; then
        echo "$logs_response" | jq -r '.data.logs'
        log_success "PM2日志获取成功"
        return 0
    else
        log_error "获取PM2日志失败"
        return 1
    fi
}

# 获取日志文件列表
get_log_files() {
    log_info "获取日志文件列表..."
    
    local files_response=$(api_call "GET" "$MANAGEMENT_API_URL/logs/files")
    
    if [ $? -eq 0 ]; then
        echo "$files_response" | jq '.data'
        log_success "日志文件列表获取成功"
        return 0
    else
        log_error "获取日志文件列表失败"
        return 1
    fi
}

# 查看日志文件内容
view_log_file() {
    local filename=$1
    local lines=${2:-100}
    
    if [ -z "$filename" ]; then
        log_error "需要指定日志文件名"
        return 1
    fi
    
    log_info "查看日志文件: $filename (最近 $lines 行)"
    
    local content_response=$(api_call "GET" "$MANAGEMENT_API_URL/logs/view/$filename?lines=$lines")
    
    if [ $? -eq 0 ]; then
        echo "$content_response" | jq -r '.data.content'
        log_success "日志文件内容获取成功"
        return 0
    else
        log_error "获取日志文件内容失败"
        return 1
    fi
}

# 下载日志文件
download_log_file() {
    local filename=$1
    local output_path=${2:-"./logs/downloaded-$filename"}
    
    if [ -z "$filename" ]; then
        log_error "需要指定日志文件名"
        return 1
    fi
    
    log_info "下载日志文件: $filename 到 $output_path"
    
    if curl -s -o "$output_path" "$MANAGEMENT_API_URL/logs/download/$filename"; then
        log_success "日志文件下载成功: $output_path"
        return 0
    else
        log_error "日志文件下载失败"
        return 1
    fi
}

# 清理日志文件
cleanup_logs() {
    local days=${1:-7}
    
    log_info "清理 $days 天前的日志文件..."
    
    local cleanup_data="{\"days\": $days}"
    local cleanup_response=$(api_call "DELETE" "$MANAGEMENT_API_URL/logs/cleanup" "$cleanup_data")
    
    if [ $? -eq 0 ]; then
        log_success "日志清理成功"
        echo "$cleanup_response" | jq '.'
        return 0
    else
        log_error "日志清理失败"
        return 1
    fi
}

# 获取高可用性状态
get_ha_status() {
    log_info "获取高可用性状态..."
    
    local ha_response=$(api_call "GET" "$HA_API_URL/status")
    
    if [ $? -eq 0 ]; then
        echo "$ha_response" | jq '.'
        log_success "高可用性状态获取成功"
        return 0
    else
        log_error "获取高可用性状态失败"
        return 1
    fi
}

# 启动高可用性管理
start_ha_management() {
    log_info "启动高可用性管理..."
    
    local start_response=$(api_call "POST" "$HA_API_URL/start")
    
    if [ $? -eq 0 ]; then
        log_success "高可用性管理启动成功"
        echo "$start_response" | jq '.'
        return 0
    else
        log_error "高可用性管理启动失败"
        return 1
    fi
}

# 停止高可用性管理
stop_ha_management() {
    log_info "停止高可用性管理..."
    
    local stop_response=$(api_call "POST" "$HA_API_URL/stop")
    
    if [ $? -eq 0 ]; then
        log_success "高可用性管理停止成功"
        echo "$stop_response" | jq '.'
        return 0
    else
        log_error "高可用性管理停止失败"
        return 1
    fi
}

# 手动触发扩容
trigger_scale_up() {
    local target_instances=${1:-""}
    
    log_info "手动触发扩容..."
    
    local scale_data="{}"
    if [ -n "$target_instances" ]; then
        scale_data="{\"targetInstances\": $target_instances}"
    fi
    
    local scale_response=$(api_call "POST" "$HA_API_URL/scale-up" "$scale_data")
    
    if [ $? -eq 0 ]; then
        log_success "扩容触发成功"
        echo "$scale_response" | jq '.'
        return 0
    else
        log_error "扩容触发失败"
        return 1
    fi
}

# 手动触发缩容
trigger_scale_down() {
    local target_instances=${1:-""}
    
    log_info "手动触发缩容..."
    
    local scale_data="{}"
    if [ -n "$target_instances" ]; then
        scale_data="{\"targetInstances\": $target_instances}"
    fi
    
    local scale_response=$(api_call "POST" "$HA_API_URL/scale-down" "$scale_data")
    
    if [ $? -eq 0 ]; then
        log_success "缩容触发成功"
        echo "$scale_response" | jq '.'
        return 0
    else
        log_error "缩容触发失败"
        return 1
    fi
}

# 手动触发故障切换
trigger_failover() {
    local service_name=$1
    local reason=${2:-"Manual trigger"}
    
    if [ -z "$service_name" ]; then
        log_error "需要指定服务名"
        return 1
    fi
    
    log_info "手动触发故障切换: $service_name"
    
    local failover_data="{\"serviceName\": \"$service_name\", \"reason\": \"$reason\"}"
    local failover_response=$(api_call "POST" "$HA_API_URL/failover" "$failover_data")
    
    if [ $? -eq 0 ]; then
        log_success "故障切换触发成功"
        echo "$failover_response" | jq '.'
        return 0
    else
        log_error "故障切换触发失败"
        return 1
    fi
}

# 执行健康检查
perform_health_check() {
    log_info "执行健康检查..."
    
    local health_response=$(api_call "GET" "$HA_API_URL/health")
    
    if [ $? -eq 0 ]; then
        echo "$health_response" | jq '.'
        
        local is_healthy=$(echo "$health_response" | jq -r '.data.isHealthy')
        if [ "$is_healthy" = "true" ]; then
            log_success "系统健康检查通过"
            return 0
        else
            log_warning "系统健康检查发现问题"
            return 1
        fi
    else
        log_error "健康检查失败"
        return 1
    fi
}

# 获取性能指标
get_performance_metrics() {
    log_info "获取性能指标..."
    
    local metrics_response=$(api_call "GET" "$HA_API_URL/metrics")
    
    if [ $? -eq 0 ]; then
        echo "$metrics_response" | jq '.'
        log_success "性能指标获取成功"
        return 0
    else
        log_error "获取性能指标失败"
        return 1
    fi
}

# 部署后集成检查
post_deployment_integration_check() {
    log_info "执行部署后集成检查..."
    
    local all_passed=true
    
    # 检查API可用性
    if ! check_api_availability; then
        all_passed=false
    fi
    
    # 获取服务状态
    log_info "检查服务状态..."
    if get_service_status > /dev/null; then
        log_success "服务状态检查通过"
    else
        log_error "服务状态检查失败"
        all_passed=false
    fi
    
    # 执行健康检查
    if perform_health_check > /dev/null; then
        log_success "健康检查通过"
    else
        log_warning "健康检查发现问题"
    fi
    
    # 检查高可用性状态
    if get_ha_status > /dev/null; then
        log_success "高可用性状态检查通过"
    else
        log_warning "高可用性状态检查失败"
    fi
    
    if [ "$all_passed" = "true" ]; then
        log_success "部署后集成检查全部通过"
        return 0
    else
        log_error "部署后集成检查发现问题"
        return 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 远程管理API集成脚本

用法: $0 [选项] <命令> [参数...]

服务管理命令:
  status                  获取服务状态
  metrics                 获取系统指标
  restart [服务名]        重启服务 (默认: all)
  stop [服务名]           停止服务 (默认: all)
  start [服务名]          启动服务 (默认: all)
  scale <服务名> <实例数> 扩缩容服务

日志管理命令:
  logs [服务名] [行数]    获取PM2日志 (默认: all, 100行)
  log-files              获取日志文件列表
  view-log <文件名> [行数] 查看日志文件内容
  download-log <文件名> [输出路径] 下载日志文件
  cleanup-logs [天数]     清理旧日志 (默认: 7天)

高可用性管理命令:
  ha-status              获取高可用性状态
  ha-start               启动高可用性管理
  ha-stop                停止高可用性管理
  scale-up [目标实例数]   手动触发扩容
  scale-down [目标实例数] 手动触发缩容
  failover <服务名> [原因] 手动触发故障切换
  health-check           执行健康检查
  performance            获取性能指标

集成命令:
  check-api              检查API可用性
  post-deploy-check      部署后集成检查

选项:
  -h, --help             显示此帮助信息
  -v, --verbose          详细输出模式
  --api-url URL          指定API基础URL (默认: http://localhost:3000/api)

示例:
  $0 status              # 获取服务状态
  $0 restart wordpecker-backend  # 重启后端服务
  $0 logs wordpecker-backend 50  # 获取后端日志最近50行
  $0 scale wordpecker-backend 3  # 扩容后端到3个实例
  $0 failover wordpecker-backend "Performance issue"  # 触发故障切换
  $0 post-deploy-check   # 执行部署后检查

EOF
}

# 主函数
main() {
    local command=""
    local verbose=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                set -x
                shift
                ;;
            --api-url)
                API_BASE_URL="$2"
                MANAGEMENT_API_URL="$API_BASE_URL/management"
                HA_API_URL="$API_BASE_URL/high-availability"
                shift 2
                ;;
            *)
                if [ -z "$command" ]; then
                    command="$1"
                    shift
                    break
                else
                    shift
                fi
                ;;
        esac
    done
    
    if [ -z "$command" ]; then
        log_error "需要指定命令"
        show_help
        exit 1
    fi
    
    # 创建日志目录
    mkdir -p ./logs
    
    log_info "执行远程管理命令: $command"
    
    # 执行相应命令
    case $command in
        status)
            get_service_status
            ;;
        metrics)
            get_system_metrics
            ;;
        restart)
            remote_restart_service "$1"
            ;;
        stop)
            remote_stop_service "$1"
            ;;
        start)
            remote_start_service "$1"
            ;;
        scale)
            remote_scale_service "$1" "$2"
            ;;
        logs)
            get_pm2_logs "$1" "$2"
            ;;
        log-files)
            get_log_files
            ;;
        view-log)
            view_log_file "$1" "$2"
            ;;
        download-log)
            download_log_file "$1" "$2"
            ;;
        cleanup-logs)
            cleanup_logs "$1"
            ;;
        ha-status)
            get_ha_status
            ;;
        ha-start)
            start_ha_management
            ;;
        ha-stop)
            stop_ha_management
            ;;
        scale-up)
            trigger_scale_up "$1"
            ;;
        scale-down)
            trigger_scale_down "$1"
            ;;
        failover)
            trigger_failover "$1" "$2"
            ;;
        health-check)
            perform_health_check
            ;;
        performance)
            get_performance_metrics
            ;;
        check-api)
            check_api_availability
            ;;
        post-deploy-check)
            post_deployment_integration_check
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 脚本入口点
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi