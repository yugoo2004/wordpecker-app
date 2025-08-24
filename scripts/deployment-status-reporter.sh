#!/bin/bash

# WordPecker 部署状态报告器
# 实现部署流程的错误处理和状态报告功能

set -e

# 配置变量
PROJECT_DIR="/home/devbox/wordpecker-app"
LOG_FILE="./logs/deployment-status.log"
REPORT_DIR="./logs/reports"
NOTIFICATION_WEBHOOK_URL="${DEPLOYMENT_NOTIFICATION_WEBHOOK:-}"

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

# 创建报告目录
create_report_directory() {
    mkdir -p "$REPORT_DIR"
    log_info "报告目录已创建: $REPORT_DIR"
}

# 收集系统状态信息
collect_system_status() {
    local status_file="$REPORT_DIR/system-status-$(date +%Y%m%d-%H%M%S).json"
    
    log_info "收集系统状态信息..."
    
    cat > "$status_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "system": {
    "os": "$(cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '\"')",
    "kernel": "$(uname -r)",
    "uptime": "$(uptime -p)",
    "load_average": "$(uptime | awk -F'load average:' '{print $2}' | xargs)"
  },
  "resources": {
    "cpu_usage": "$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}')",
    "memory": {
      "total": "$(free -h | grep Mem | awk '{print $2}')",
      "used": "$(free -h | grep Mem | awk '{print $3}')",
      "available": "$(free -h | grep Mem | awk '{print $7}')",
      "usage_percent": "$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')"
    },
    "disk": {
      "total": "$(df -h / | awk 'NR==2{print $2}')",
      "used": "$(df -h / | awk 'NR==2{print $3}')",
      "available": "$(df -h / | awk 'NR==2{print $4}')",
      "usage_percent": "$(df -h / | awk 'NR==2{print $5}')"
    }
  },
  "network": {
    "interfaces": $(ip -j addr show | jq '[.[] | {name: .ifname, state: .operstate, addresses: [.addr_info[] | select(.family == "inet") | .local]}]'),
    "connections": {
      "established": "$(netstat -an | grep ESTABLISHED | wc -l)",
      "listening": "$(netstat -tuln | grep LISTEN | wc -l)"
    }
  }
}
EOF
    
    log_success "系统状态信息已保存: $status_file"
    echo "$status_file"
}

# 收集服务状态信息
collect_service_status() {
    local status_file="$REPORT_DIR/service-status-$(date +%Y%m%d-%H%M%S).json"
    
    log_info "收集服务状态信息..."
    
    # PM2进程状态
    local pm2_status="[]"
    if command -v pm2 &> /dev/null; then
        pm2_status=$(pm2 jlist 2>/dev/null || echo "[]")
    fi
    
    # Systemd服务状态
    local systemd_status="unknown"
    if systemctl is-active wordpecker &> /dev/null; then
        systemd_status="active"
    elif systemctl is-enabled wordpecker &> /dev/null; then
        systemd_status="inactive"
    else
        systemd_status="disabled"
    fi
    
    # 健康检查状态
    local backend_health="unknown"
    local frontend_status="unknown"
    
    if curl -f -s --connect-timeout 5 "http://localhost:3000/api/health" > /dev/null 2>&1; then
        backend_health=$(curl -s "http://localhost:3000/api/health" | jq -r '.status' 2>/dev/null || echo "unknown")
    fi
    
    if curl -f -s --connect-timeout 5 "http://localhost:5173" > /dev/null 2>&1; then
        frontend_status="healthy"
    else
        frontend_status="unhealthy"
    fi
    
    cat > "$status_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "pm2": {
    "processes": $pm2_status,
    "summary": {
      "total": $(echo "$pm2_status" | jq 'length'),
      "online": $(echo "$pm2_status" | jq '[.[] | select(.pm2_env.status == "online")] | length'),
      "stopped": $(echo "$pm2_status" | jq '[.[] | select(.pm2_env.status == "stopped")] | length'),
      "errored": $(echo "$pm2_status" | jq '[.[] | select(.pm2_env.status == "errored")] | length')
    }
  },
  "systemd": {
    "service_status": "$systemd_status",
    "enabled": "$(systemctl is-enabled wordpecker 2>/dev/null || echo 'unknown')"
  },
  "health_checks": {
    "backend": {
      "status": "$backend_health",
      "endpoint": "http://localhost:3000/api/health"
    },
    "frontend": {
      "status": "$frontend_status",
      "endpoint": "http://localhost:5173"
    }
  },
  "endpoints": {
    "management_api": "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/management/status 2>/dev/null || echo 'unknown')",
    "high_availability": "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/high-availability/status 2>/dev/null || echo 'unknown')"
  }
}
EOF
    
    log_success "服务状态信息已保存: $status_file"
    echo "$status_file"
}

# 收集部署历史信息
collect_deployment_history() {
    local history_file="$REPORT_DIR/deployment-history-$(date +%Y%m%d-%H%M%S).json"
    
    log_info "收集部署历史信息..."
    
    # Git信息
    local git_info="{}"
    if [ -d ".git" ]; then
        git_info=$(cat << EOF
{
  "current_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "current_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "last_commit_message": "$(git log -1 --pretty=format:'%s' 2>/dev/null || echo 'unknown')",
  "last_commit_author": "$(git log -1 --pretty=format:'%an' 2>/dev/null || echo 'unknown')",
  "last_commit_date": "$(git log -1 --pretty=format:'%ci' 2>/dev/null || echo 'unknown')",
  "uncommitted_changes": $(git status --porcelain 2>/dev/null | wc -l || echo 0)
}
EOF
)
    fi
    
    # 最近的部署日志
    local recent_deployments="[]"
    if [ -d "./logs" ]; then
        recent_deployments=$(find ./logs -name "deployment-report-*.json" -mtime -7 | head -10 | while read -r file; do
            if [ -f "$file" ]; then
                echo "\"$file\""
            fi
        done | jq -s '.')
    fi
    
    cat > "$history_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git": $git_info,
  "recent_deployments": $recent_deployments,
  "backup_info": {
    "backup_directory": "/home/devbox/backups",
    "available_backups": $(ls -1 /home/devbox/backups/ 2>/dev/null | grep "wordpecker-" | wc -l || echo 0),
    "latest_backup": "$(ls -t /home/devbox/backups/ 2>/dev/null | grep "wordpecker-" | head -1 || echo 'none')"
  },
  "environment": {
    "node_version": "$(node -v 2>/dev/null || echo 'unknown')",
    "npm_version": "$(npm -v 2>/dev/null || echo 'unknown')",
    "pm2_version": "$(pm2 -v 2>/dev/null || echo 'unknown')"
  }
}
EOF
    
    log_success "部署历史信息已保存: $history_file"
    echo "$history_file"
}

# 生成综合状态报告
generate_comprehensive_report() {
    local report_file="$REPORT_DIR/comprehensive-report-$(date +%Y%m%d-%H%M%S).json"
    
    log_info "生成综合状态报告..."
    
    # 收集各类状态信息
    local system_status_file=$(collect_system_status)
    local service_status_file=$(collect_service_status)
    local deployment_history_file=$(collect_deployment_history)
    
    # 合并所有信息
    cat > "$report_file" << EOF
{
  "report_metadata": {
    "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "report_type": "comprehensive_status",
    "version": "1.0",
    "generator": "deployment-status-reporter.sh"
  },
  "system_status": $(cat "$system_status_file"),
  "service_status": $(cat "$service_status_file"),
  "deployment_history": $(cat "$deployment_history_file")
}
EOF
    
    log_success "综合状态报告已生成: $report_file"
    echo "$report_file"
}

# 发送通知
send_notification() {
    local level=$1
    local title=$2
    local message=$3
    local report_file=${4:-""}
    
    log_info "发送通知: [$level] $title"
    
    # 构建通知内容
    local notification_payload=$(cat << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "level": "$level",
  "title": "$title",
  "message": "$message",
  "hostname": "$(hostname)",
  "project": "WordPecker",
  "report_file": "$report_file"
}
EOF
)
    
    # 保存到本地通知日志
    echo "$notification_payload" >> "./logs/notifications.jsonl"
    
    # 发送到外部系统（如果配置了webhook）
    if [ -n "$NOTIFICATION_WEBHOOK_URL" ]; then
        if curl -s -X POST "$NOTIFICATION_WEBHOOK_URL" \
           -H "Content-Type: application/json" \
           -d "$notification_payload" > /dev/null; then
            log_success "通知已发送到外部系统"
        else
            log_warning "发送外部通知失败"
        fi
    fi
    
    # 系统日志记录
    logger -t wordpecker-status "[$level] $title: $message"
}

# 检查部署状态并报告
check_and_report_deployment_status() {
    log_info "检查当前部署状态..."
    
    local issues=()
    local warnings=()
    local status="healthy"
    
    # 检查PM2进程
    if ! pm2 list | grep -q "wordpecker.*online"; then
        issues+=("PM2进程未正常运行")
        status="unhealthy"
    fi
    
    # 检查后端健康状态
    if ! curl -f -s --connect-timeout 5 "http://localhost:3000/api/health" > /dev/null; then
        issues+=("后端服务健康检查失败")
        status="unhealthy"
    fi
    
    # 检查前端服务
    if ! curl -f -s --connect-timeout 5 "http://localhost:5173" > /dev/null; then
        issues+=("前端服务不可访问")
        status="unhealthy"
    fi
    
    # 检查系统资源
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    local memory_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
    
    if [ "$disk_usage" -gt 90 ]; then
        issues+=("磁盘使用率过高: ${disk_usage}%")
        status="unhealthy"
    elif [ "$disk_usage" -gt 80 ]; then
        warnings+=("磁盘使用率较高: ${disk_usage}%")
    fi
    
    if [ "$memory_usage" -gt 90 ]; then
        issues+=("内存使用率过高: ${memory_usage}%")
        status="unhealthy"
    elif [ "$memory_usage" -gt 80 ]; then
        warnings+=("内存使用率较高: ${memory_usage}%")
    fi
    
    # 生成状态报告
    local report_file=$(generate_comprehensive_report)
    
    # 发送通知
    if [ "$status" = "unhealthy" ]; then
        local issue_list=$(printf "%s; " "${issues[@]}")
        send_notification "ERROR" "部署状态异常" "发现问题: ${issue_list}" "$report_file"
        log_error "部署状态检查发现问题: ${issue_list}"
    elif [ ${#warnings[@]} -gt 0 ]; then
        local warning_list=$(printf "%s; " "${warnings[@]}")
        send_notification "WARNING" "部署状态警告" "发现警告: ${warning_list}" "$report_file"
        log_warning "部署状态检查发现警告: ${warning_list}"
    else
        send_notification "INFO" "部署状态正常" "所有检查项均正常" "$report_file"
        log_success "部署状态检查通过"
    fi
    
    return $([ "$status" = "healthy" ] && echo 0 || echo 1)
}

# 清理旧报告
cleanup_old_reports() {
    local retention_days=${1:-7}
    
    log_info "清理 $retention_days 天前的旧报告..."
    
    if [ -d "$REPORT_DIR" ]; then
        find "$REPORT_DIR" -name "*.json" -mtime +$retention_days -delete
        local cleaned_count=$(find "$REPORT_DIR" -name "*.json" -mtime +$retention_days | wc -l)
        log_info "已清理 $cleaned_count 个旧报告文件"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 部署状态报告器

用法: $0 [选项] [命令]

命令:
  check                   检查当前部署状态并生成报告
  system                  生成系统状态报告
  service                 生成服务状态报告
  history                 生成部署历史报告
  comprehensive           生成综合状态报告
  cleanup [天数]          清理旧报告文件（默认7天）

选项:
  -h, --help              显示此帮助信息
  -v, --verbose           详细输出模式
  --webhook URL           设置通知webhook URL

环境变量:
  DEPLOYMENT_NOTIFICATION_WEBHOOK  通知webhook URL

示例:
  $0 check                # 检查部署状态
  $0 comprehensive        # 生成综合报告
  $0 cleanup 3            # 清理3天前的报告
  $0 --webhook https://hooks.slack.com/... check

EOF
}

# 主函数
main() {
    local command="check"
    local webhook_url=""
    
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
            --webhook)
                webhook_url="$2"
                export DEPLOYMENT_NOTIFICATION_WEBHOOK="$webhook_url"
                shift 2
                ;;
            check|system|service|history|comprehensive|cleanup)
                command="$1"
                shift
                ;;
            *)
                if [[ "$1" =~ ^[0-9]+$ ]] && [ "$command" = "cleanup" ]; then
                    # 数字参数用于cleanup命令
                    shift
                else
                    log_error "未知选项: $1"
                    show_help
                    exit 1
                fi
                ;;
        esac
    done
    
    # 创建必要目录
    mkdir -p ./logs
    create_report_directory
    
    log_info "执行命令: $command"
    
    # 执行相应命令
    case $command in
        check)
            check_and_report_deployment_status
            ;;
        system)
            collect_system_status
            ;;
        service)
            collect_service_status
            ;;
        history)
            collect_deployment_history
            ;;
        comprehensive)
            generate_comprehensive_report
            ;;
        cleanup)
            cleanup_old_reports "$1"
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