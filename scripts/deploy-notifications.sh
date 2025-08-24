#!/bin/bash
# WordPecker 部署通知脚本
# 功能：发送部署状态通知和告警

set -e

# 配置变量
NOTIFICATION_LOG="./logs/deploy-notifications.log"
WEBHOOK_URL="${DEPLOY_WEBHOOK_URL:-}"
EMAIL_RECIPIENT="${DEPLOY_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

# 通知级别
LEVEL_INFO="INFO"
LEVEL_SUCCESS="SUCCESS"
LEVEL_WARNING="WARNING"
LEVEL_ERROR="ERROR"
LEVEL_CRITICAL="CRITICAL"

# 颜色配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_notification() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$level] $timestamp - $message" >> "$NOTIFICATION_LOG"
}

# 获取系统信息
get_system_info() {
    cat << EOF
{
  "hostname": "$(hostname)",
  "user": "$(whoami)",
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "uptime": "$(uptime -p 2>/dev/null || uptime)",
  "load_average": "$(uptime | awk -F'load average:' '{print $2}' | xargs)",
  "memory_usage": "$(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')",
  "disk_usage": "$(df -h / | awk 'NR==2{print $5}')"
}
EOF
}

# 获取服务状态
get_service_status() {
    local pm2_status="[]"
    
    if command -v pm2 &> /dev/null; then
        pm2_status=$(pm2 jlist 2>/dev/null || echo '[]')
    fi
    
    cat << EOF
{
  "pm2_processes": $pm2_status,
  "backend_health": "$(curl -s -f http://localhost:3000/api/health > /dev/null && echo 'healthy' || echo 'unhealthy')",
  "frontend_status": "$(curl -s -f http://localhost:5173 > /dev/null && echo 'accessible' || echo 'inaccessible')"
}
EOF
}

# 发送系统日志通知
send_system_log() {
    local level=$1
    local message=$2
    
    logger -t "wordpecker-deploy" "[$level] $message"
    log_notification "$level" "$message"
}

# 发送邮件通知
send_email_notification() {
    local level=$1
    local subject=$2
    local message=$3
    
    if [ -z "$EMAIL_RECIPIENT" ]; then
        return 0
    fi
    
    if ! command -v mail &> /dev/null && ! command -v sendmail &> /dev/null; then
        log_notification "WARNING" "邮件发送工具未安装，跳过邮件通知"
        return 0
    fi
    
    local email_body=$(cat << EOF
WordPecker 部署通知

级别: $level
时间: $(date)
主机: $(hostname)
用户: $(whoami)

消息: $message

系统信息:
$(get_system_info | jq -r 'to_entries[] | "\(.key): \(.value)"' 2>/dev/null || get_system_info)

服务状态:
$(get_service_status | jq -r 'to_entries[] | "\(.key): \(.value)"' 2>/dev/null || get_service_status)

---
此邮件由 WordPecker 自动部署系统发送
EOF
)
    
    if command -v mail &> /dev/null; then
        echo "$email_body" | mail -s "$subject" "$EMAIL_RECIPIENT"
    elif command -v sendmail &> /dev/null; then
        {
            echo "To: $EMAIL_RECIPIENT"
            echo "Subject: $subject"
            echo "Content-Type: text/plain; charset=UTF-8"
            echo ""
            echo "$email_body"
        } | sendmail "$EMAIL_RECIPIENT"
    fi
    
    log_notification "$level" "邮件通知已发送到: $EMAIL_RECIPIENT"
}

# 发送Slack通知
send_slack_notification() {
    local level=$1
    local message=$2
    
    if [ -z "$SLACK_WEBHOOK" ]; then
        return 0
    fi
    
    # 根据级别设置颜色
    local color="good"
    local emoji="✅"
    
    case "$level" in
        "SUCCESS")
            color="good"
            emoji="✅"
            ;;
        "WARNING")
            color="warning"
            emoji="⚠️"
            ;;
        "ERROR"|"CRITICAL")
            color="danger"
            emoji="❌"
            ;;
        *)
            color="#36a64f"
            emoji="ℹ️"
            ;;
    esac
    
    local payload=$(cat << EOF
{
  "username": "WordPecker Deploy Bot",
  "icon_emoji": ":rocket:",
  "attachments": [
    {
      "color": "$color",
      "title": "$emoji WordPecker 部署通知",
      "fields": [
        {
          "title": "级别",
          "value": "$level",
          "short": true
        },
        {
          "title": "主机",
          "value": "$(hostname)",
          "short": true
        },
        {
          "title": "时间",
          "value": "$(date '+%Y-%m-%d %H:%M:%S')",
          "short": true
        },
        {
          "title": "用户",
          "value": "$(whoami)",
          "short": true
        },
        {
          "title": "消息",
          "value": "$message",
          "short": false
        }
      ],
      "footer": "WordPecker Auto Deploy",
      "ts": $(date +%s)
    }
  ]
}
EOF
)
    
    if curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK" > /dev/null; then
        log_notification "$level" "Slack通知发送成功"
    else
        log_notification "ERROR" "Slack通知发送失败"
    fi
}

# 发送Webhook通知
send_webhook_notification() {
    local level=$1
    local message=$2
    
    if [ -z "$WEBHOOK_URL" ]; then
        return 0
    fi
    
    local payload=$(cat << EOF
{
  "event": "deployment_notification",
  "level": "$level",
  "message": "$message",
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "system": $(get_system_info),
  "services": $(get_service_status)
}
EOF
)
    
    if curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "User-Agent: WordPecker-Deploy/1.0" \
        --data "$payload" \
        --connect-timeout 10 \
        --max-time 30 \
        "$WEBHOOK_URL" > /dev/null; then
        log_notification "$level" "Webhook通知发送成功"
    else
        log_notification "ERROR" "Webhook通知发送失败"
    fi
}

# 发送桌面通知（如果支持）
send_desktop_notification() {
    local level=$1
    local message=$2
    
    if ! command -v notify-send &> /dev/null; then
        return 0
    fi
    
    local icon="dialog-information"
    local urgency="normal"
    
    case "$level" in
        "SUCCESS")
            icon="dialog-information"
            urgency="normal"
            ;;
        "WARNING")
            icon="dialog-warning"
            urgency="normal"
            ;;
        "ERROR"|"CRITICAL")
            icon="dialog-error"
            urgency="critical"
            ;;
    esac
    
    notify-send \
        --icon="$icon" \
        --urgency="$urgency" \
        "WordPecker 部署通知" \
        "$message" 2>/dev/null || true
    
    log_notification "$level" "桌面通知已发送"
}

# 主通知函数
send_notification() {
    local level=$1
    local message=$2
    local title="${3:-WordPecker 部署通知}"
    
    # 创建日志目录
    mkdir -p "$(dirname "$NOTIFICATION_LOG")"
    
    # 记录到系统日志
    send_system_log "$level" "$message"
    
    # 根据级别决定发送哪些通知
    case "$level" in
        "SUCCESS")
            send_slack_notification "$level" "$message"
            send_desktop_notification "$level" "$message"
            ;;
        "WARNING")
            send_slack_notification "$level" "$message"
            send_desktop_notification "$level" "$message"
            ;;
        "ERROR")
            send_email_notification "$level" "$title - 错误" "$message"
            send_slack_notification "$level" "$message"
            send_webhook_notification "$level" "$message"
            send_desktop_notification "$level" "$message"
            ;;
        "CRITICAL")
            send_email_notification "$level" "$title - 严重错误" "$message"
            send_slack_notification "$level" "$message"
            send_webhook_notification "$level" "$message"
            send_desktop_notification "$level" "$message"
            ;;
        *)
            send_system_log "$level" "$message"
            ;;
    esac
}

# 发送部署开始通知
notify_deployment_start() {
    local deployment_type="${1:-standard}"
    send_notification "$LEVEL_INFO" "开始执行 $deployment_type 部署" "WordPecker 部署开始"
}

# 发送部署成功通知
notify_deployment_success() {
    local duration="${1:-unknown}"
    send_notification "$LEVEL_SUCCESS" "部署成功完成，耗时: $duration" "WordPecker 部署成功"
}

# 发送部署失败通知
notify_deployment_failure() {
    local error_message="${1:-未知错误}"
    local failed_step="${2:-unknown}"
    send_notification "$LEVEL_ERROR" "部署失败: $error_message (失败步骤: $failed_step)" "WordPecker 部署失败"
}

# 发送回滚通知
notify_rollback() {
    local reason="${1:-部署失败}"
    send_notification "$LEVEL_WARNING" "执行回滚操作，原因: $reason" "WordPecker 回滚通知"
}

# 发送健康检查告警
notify_health_alert() {
    local service="${1:-unknown}"
    local status="${2:-unhealthy}"
    send_notification "$LEVEL_ERROR" "服务健康检查失败: $service ($status)" "WordPecker 健康告警"
}

# 发送资源告警
notify_resource_alert() {
    local resource="${1:-unknown}"
    local usage="${2:-unknown}"
    local threshold="${3:-unknown}"
    send_notification "$LEVEL_WARNING" "资源使用率告警: $resource 使用率 $usage，超过阈值 $threshold" "WordPecker 资源告警"
}

# 测试通知功能
test_notifications() {
    echo "测试通知功能..."
    
    send_notification "$LEVEL_INFO" "这是一条测试信息通知"
    send_notification "$LEVEL_SUCCESS" "这是一条测试成功通知"
    send_notification "$LEVEL_WARNING" "这是一条测试警告通知"
    send_notification "$LEVEL_ERROR" "这是一条测试错误通知"
    
    echo "通知测试完成，请检查各个通知渠道"
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 部署通知脚本

用法: $0 <命令> [参数...]

命令:
  send <级别> <消息> [标题]     发送通知
  start [部署类型]             发送部署开始通知
  success [耗时]               发送部署成功通知
  failure <错误> [步骤]        发送部署失败通知
  rollback [原因]              发送回滚通知
  health <服务> [状态]         发送健康告警
  resource <资源> <使用率> <阈值>  发送资源告警
  test                         测试通知功能

级别: INFO, SUCCESS, WARNING, ERROR, CRITICAL

环境变量:
  DEPLOY_WEBHOOK_URL          Webhook URL
  DEPLOY_EMAIL               邮件接收地址
  SLACK_WEBHOOK_URL          Slack Webhook URL

示例:
  $0 send SUCCESS "部署完成"
  $0 start "快速部署"
  $0 failure "数据库连接失败" "部署验证"
  $0 test
EOF
}

# 主函数
main() {
    case "${1:-help}" in
        "send")
            if [ $# -lt 3 ]; then
                echo "错误: send 命令需要级别和消息参数"
                show_help
                exit 1
            fi
            send_notification "$2" "$3" "$4"
            ;;
        "start")
            notify_deployment_start "$2"
            ;;
        "success")
            notify_deployment_success "$2"
            ;;
        "failure")
            if [ $# -lt 2 ]; then
                echo "错误: failure 命令需要错误消息参数"
                exit 1
            fi
            notify_deployment_failure "$2" "$3"
            ;;
        "rollback")
            notify_rollback "$2"
            ;;
        "health")
            if [ $# -lt 2 ]; then
                echo "错误: health 命令需要服务名参数"
                exit 1
            fi
            notify_health_alert "$2" "$3"
            ;;
        "resource")
            if [ $# -lt 4 ]; then
                echo "错误: resource 命令需要资源、使用率、阈值参数"
                exit 1
            fi
            notify_resource_alert "$2" "$3" "$4"
            ;;
        "test")
            test_notifications
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# 脚本入口点
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi