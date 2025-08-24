#!/bin/bash

# WordPecker 自动化健康检查和监控脚本
# 功能：定期检查前后端服务状态，异常时自动重启，记录详细日志

set -e

# 配置参数
BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173"
LOG_DIR="./logs"
HEALTH_LOG="$LOG_DIR/health-monitor.log"
STATUS_LOG="$LOG_DIR/service-status.log"
ERROR_LOG="$LOG_DIR/health-errors.log"

# 检查间隔（秒）
CHECK_INTERVAL=60
# 连续失败次数阈值
MAX_FAILURES=3
# 重启冷却时间（秒）
RESTART_COOLDOWN=300

# 服务状态跟踪
BACKEND_FAILURE_COUNT=0
FRONTEND_FAILURE_COUNT=0
LAST_BACKEND_RESTART=0
LAST_FRONTEND_RESTART=0

# 创建必要的目录和文件
setup_logging() {
    mkdir -p "$LOG_DIR"
    touch "$HEALTH_LOG" "$STATUS_LOG" "$ERROR_LOG"
    
    # 设置日志轮转（保留最近1000行）
    if [ $(wc -l < "$HEALTH_LOG") -gt 1000 ]; then
        tail -n 500 "$HEALTH_LOG" > "$HEALTH_LOG.tmp"
        mv "$HEALTH_LOG.tmp" "$HEALTH_LOG"
    fi
}

# 记录日志的辅助函数
log_info() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $message" | tee -a "$HEALTH_LOG"
}

log_warn() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] $message" | tee -a "$HEALTH_LOG" | tee -a "$ERROR_LOG"
}

log_error() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $message" | tee -a "$HEALTH_LOG" | tee -a "$ERROR_LOG"
}

# 检查服务是否在冷却期内
is_in_cooldown() {
    local service_name="$1"
    local current_time=$(date +%s)
    local last_restart_var="LAST_${service_name^^}_RESTART"
    local last_restart=${!last_restart_var}
    
    if [ $((current_time - last_restart)) -lt $RESTART_COOLDOWN ]; then
        return 0  # 在冷却期内
    else
        return 1  # 不在冷却期内
    fi
}

# 更新重启时间
update_restart_time() {
    local service_name="$1"
    local current_time=$(date +%s)
    
    if [ "$service_name" = "backend" ]; then
        LAST_BACKEND_RESTART=$current_time
    elif [ "$service_name" = "frontend" ]; then
        LAST_FRONTEND_RESTART=$current_time
    fi
}

# 检查后端服务健康状态
check_backend_health() {
    local health_status="unknown"
    local response_time=0
    local error_message=""
    
    # 记录检查开始时间
    local start_time=$(date +%s%3N)
    
    # 检查基础健康端点
    local health_response=$(curl -s -w "%{http_code}" --max-time 10 "$BACKEND_URL/api/health" 2>/dev/null || echo "000")
    local health_code="${health_response: -3}"
    local health_body="${health_response%???}"
    
    # 计算响应时间
    local end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))
    
    if [ "$health_code" = "200" ]; then
        # 验证响应格式
        if echo "$health_body" | jq -e '.status' > /dev/null 2>&1; then
            local status=$(echo "$health_body" | jq -r '.status')
            if [ "$status" = "healthy" ]; then
                health_status="healthy"
                
                # 检查数据库连接状态
                local db_status=$(echo "$health_body" | jq -r '.services.database // "unknown"')
                if [ "$db_status" != "connected" ]; then
                    health_status="degraded"
                    error_message="数据库连接状态: $db_status"
                fi
            else
                health_status="unhealthy"
                error_message="服务状态: $status"
            fi
        else
            health_status="unhealthy"
            error_message="健康检查响应格式无效"
        fi
    elif [ "$health_code" = "503" ]; then
        health_status="unhealthy"
        error_message="服务不可用 (HTTP 503)"
    elif [ "$health_code" = "000" ]; then
        health_status="unreachable"
        error_message="无法连接到后端服务"
    else
        health_status="unhealthy"
        error_message="HTTP错误码: $health_code"
    fi
    
    # 记录状态到状态日志
    echo "$(date '+%Y-%m-%d %H:%M:%S'),backend,$health_status,$response_time,$error_message" >> "$STATUS_LOG"
    
    # 返回状态
    echo "$health_status|$response_time|$error_message"
}

# 检查前端服务健康状态
check_frontend_health() {
    local health_status="unknown"
    local response_time=0
    local error_message=""
    
    # 记录检查开始时间
    local start_time=$(date +%s%3N)
    
    # 检查前端页面
    local response=$(curl -s -w "%{http_code}" --max-time 10 "$FRONTEND_URL" 2>/dev/null || echo "000")
    local http_code="${response: -3}"
    
    # 计算响应时间
    local end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))
    
    if [ "$http_code" = "200" ]; then
        health_status="healthy"
    elif [ "$http_code" = "000" ]; then
        health_status="unreachable"
        error_message="无法连接到前端服务"
    else
        health_status="unhealthy"
        error_message="HTTP错误码: $http_code"
    fi
    
    # 记录状态到状态日志
    echo "$(date '+%Y-%m-%d %H:%M:%S'),frontend,$health_status,$response_time,$error_message" >> "$STATUS_LOG"
    
    # 返回状态
    echo "$health_status|$response_time|$error_message"
}

# 重启后端服务
restart_backend() {
    log_warn "正在重启后端服务..."
    
    if command -v pm2 > /dev/null 2>&1; then
        # 使用 PM2 重启
        if pm2 restart wordpecker-backend > /dev/null 2>&1; then
            log_info "后端服务重启成功 (PM2)"
            update_restart_time "backend"
            return 0
        else
            log_error "PM2 重启后端服务失败"
        fi
    fi
    
    # 备用重启方法：直接重启脚本
    if [ -f "./scripts/restart-app.sh" ]; then
        if ./scripts/restart-app.sh > /dev/null 2>&1; then
            log_info "后端服务重启成功 (脚本)"
            update_restart_time "backend"
            return 0
        else
            log_error "脚本重启后端服务失败"
        fi
    fi
    
    log_error "所有重启方法都失败了"
    return 1
}

# 重启前端服务
restart_frontend() {
    log_warn "正在重启前端服务..."
    
    if command -v pm2 > /dev/null 2>&1; then
        # 使用 PM2 重启
        if pm2 restart wordpecker-frontend > /dev/null 2>&1; then
            log_info "前端服务重启成功 (PM2)"
            update_restart_time "frontend"
            return 0
        else
            log_error "PM2 重启前端服务失败"
        fi
    fi
    
    # 备用重启方法：直接重启脚本
    if [ -f "./scripts/restart-app.sh" ]; then
        if ./scripts/restart-app.sh > /dev/null 2>&1; then
            log_info "前端服务重启成功 (脚本)"
            update_restart_time "frontend"
            return 0
        else
            log_error "脚本重启前端服务失败"
        fi
    fi
    
    log_error "所有重启方法都失败了"
    return 1
}

# 处理后端服务状态
handle_backend_status() {
    local status_info="$1"
    local status=$(echo "$status_info" | cut -d'|' -f1)
    local response_time=$(echo "$status_info" | cut -d'|' -f2)
    local error_message=$(echo "$status_info" | cut -d'|' -f3)
    
    case "$status" in
        "healthy")
            if [ $BACKEND_FAILURE_COUNT -gt 0 ]; then
                log_info "后端服务已恢复正常 (响应时间: ${response_time}ms)"
                BACKEND_FAILURE_COUNT=0
            fi
            ;;
        "degraded")
            log_warn "后端服务状态降级: $error_message (响应时间: ${response_time}ms)"
            BACKEND_FAILURE_COUNT=$((BACKEND_FAILURE_COUNT + 1))
            ;;
        "unhealthy"|"unreachable")
            log_error "后端服务异常: $error_message (响应时间: ${response_time}ms)"
            BACKEND_FAILURE_COUNT=$((BACKEND_FAILURE_COUNT + 1))
            
            # 检查是否需要重启
            if [ $BACKEND_FAILURE_COUNT -ge $MAX_FAILURES ]; then
                if ! is_in_cooldown "backend"; then
                    log_warn "后端服务连续失败 $BACKEND_FAILURE_COUNT 次，尝试重启"
                    if restart_backend; then
                        BACKEND_FAILURE_COUNT=0
                        # 等待服务启动
                        sleep 10
                    fi
                else
                    log_warn "后端服务在冷却期内，跳过重启"
                fi
            fi
            ;;
    esac
}

# 处理前端服务状态
handle_frontend_status() {
    local status_info="$1"
    local status=$(echo "$status_info" | cut -d'|' -f1)
    local response_time=$(echo "$status_info" | cut -d'|' -f2)
    local error_message=$(echo "$status_info" | cut -d'|' -f3)
    
    case "$status" in
        "healthy")
            if [ $FRONTEND_FAILURE_COUNT -gt 0 ]; then
                log_info "前端服务已恢复正常 (响应时间: ${response_time}ms)"
                FRONTEND_FAILURE_COUNT=0
            fi
            ;;
        "unhealthy"|"unreachable")
            log_error "前端服务异常: $error_message (响应时间: ${response_time}ms)"
            FRONTEND_FAILURE_COUNT=$((FRONTEND_FAILURE_COUNT + 1))
            
            # 检查是否需要重启
            if [ $FRONTEND_FAILURE_COUNT -ge $MAX_FAILURES ]; then
                if ! is_in_cooldown "frontend"; then
                    log_warn "前端服务连续失败 $FRONTEND_FAILURE_COUNT 次，尝试重启"
                    if restart_frontend; then
                        FRONTEND_FAILURE_COUNT=0
                        # 等待服务启动
                        sleep 10
                    fi
                else
                    log_warn "前端服务在冷却期内，跳过重启"
                fi
            fi
            ;;
    esac
}

# 生成状态报告
generate_status_report() {
    local report_file="$LOG_DIR/health-report-$(date +%Y%m%d).json"
    
    # 获取最近的状态记录
    local backend_status="unknown"
    local frontend_status="unknown"
    local backend_response_time=0
    local frontend_response_time=0
    
    if [ -f "$STATUS_LOG" ]; then
        # 获取最近的后端状态
        local backend_line=$(grep ",backend," "$STATUS_LOG" | tail -n 1)
        if [ -n "$backend_line" ]; then
            backend_status=$(echo "$backend_line" | cut -d',' -f3)
            backend_response_time=$(echo "$backend_line" | cut -d',' -f4)
        fi
        
        # 获取最近的前端状态
        local frontend_line=$(grep ",frontend," "$STATUS_LOG" | tail -n 1)
        if [ -n "$frontend_line" ]; then
            frontend_status=$(echo "$frontend_line" | cut -d',' -f3)
            frontend_response_time=$(echo "$frontend_line" | cut -d',' -f4)
        fi
    fi
    
    # 生成JSON报告
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "services": {
    "backend": {
      "status": "$backend_status",
      "response_time_ms": $backend_response_time,
      "failure_count": $BACKEND_FAILURE_COUNT,
      "last_restart": $LAST_BACKEND_RESTART
    },
    "frontend": {
      "status": "$frontend_status",
      "response_time_ms": $frontend_response_time,
      "failure_count": $FRONTEND_FAILURE_COUNT,
      "last_restart": $LAST_FRONTEND_RESTART
    }
  },
  "monitoring": {
    "check_interval": $CHECK_INTERVAL,
    "max_failures": $MAX_FAILURES,
    "restart_cooldown": $RESTART_COOLDOWN
  }
}
EOF
    
    log_info "状态报告已生成: $report_file"
}

# 清理旧日志文件
cleanup_logs() {
    # 清理7天前的状态日志
    if [ -f "$STATUS_LOG" ] && [ $(wc -l < "$STATUS_LOG") -gt 10000 ]; then
        tail -n 5000 "$STATUS_LOG" > "$STATUS_LOG.tmp"
        mv "$STATUS_LOG.tmp" "$STATUS_LOG"
        log_info "状态日志已清理"
    fi
    
    # 清理旧的报告文件（保留7天）
    find "$LOG_DIR" -name "health-report-*.json" -mtime +7 -delete 2>/dev/null || true
}

# 信号处理函数
cleanup_and_exit() {
    log_info "收到退出信号，正在清理..."
    generate_status_report
    log_info "健康监控服务已停止"
    exit 0
}

# 设置信号处理
trap cleanup_and_exit SIGTERM SIGINT

# 主监控循环
main() {
    setup_logging
    log_info "WordPecker 健康监控服务启动"
    log_info "配置: 检查间隔=${CHECK_INTERVAL}s, 最大失败次数=${MAX_FAILURES}, 重启冷却=${RESTART_COOLDOWN}s"
    
    # 初始状态报告
    generate_status_report
    
    local check_count=0
    
    while true; do
        check_count=$((check_count + 1))
        
        # 每10次检查生成一次状态报告
        if [ $((check_count % 10)) -eq 0 ]; then
            generate_status_report
            cleanup_logs
        fi
        
        # 检查后端服务
        local backend_result=$(check_backend_health)
        handle_backend_status "$backend_result"
        
        # 检查前端服务
        local frontend_result=$(check_frontend_health)
        handle_frontend_status "$frontend_result"
        
        # 等待下次检查
        sleep $CHECK_INTERVAL
    done
}

# 如果直接运行脚本，启动主循环
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi