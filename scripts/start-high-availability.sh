#!/bin/bash

# 高可用性管理启动脚本
# 用于在系统启动时自动启动高可用性管理功能

set -e

PROJECT_DIR="/home/devbox/wordpecker-app"
LOG_FILE="$PROJECT_DIR/logs/ha-startup.log"
BACKEND_URL="http://localhost:3000"
MAX_WAIT=60  # 最大等待时间（秒）

# 创建日志目录
mkdir -p "$PROJECT_DIR/logs"

# 记录启动日志
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
    echo "$1"
}

log_message "Starting High Availability Management initialization..."

# 等待后端服务启动
wait_for_backend() {
    local wait_time=0
    
    log_message "Waiting for backend service to be ready..."
    
    while [ $wait_time -lt $MAX_WAIT ]; do
        if curl -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
            log_message "Backend service is ready!"
            return 0
        fi
        
        sleep 2
        wait_time=$((wait_time + 2))
        log_message "Waiting for backend... ($wait_time/${MAX_WAIT}s)"
    done
    
    log_message "ERROR: Backend service failed to start within ${MAX_WAIT}s"
    return 1
}

# 启动高可用性管理
start_ha_management() {
    log_message "Starting High Availability Management..."
    
    # 发送启动请求到HA API
    local response=$(curl -s -X POST "$BACKEND_URL/api/ha/start" \
        -H "Content-Type: application/json" \
        -w "%{http_code}")
    
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        log_message "High Availability Management started successfully"
        log_message "Response: $body"
        return 0
    else
        log_message "ERROR: Failed to start HA Management (HTTP $http_code)"
        log_message "Response: $body"
        return 1
    fi
}

# 验证HA管理状态
verify_ha_status() {
    log_message "Verifying High Availability Management status..."
    
    local response=$(curl -s "$BACKEND_URL/api/ha/status")
    
    if echo "$response" | grep -q '"success":true'; then
        log_message "High Availability Management is running correctly"
        
        # 提取并显示关键状态信息
        local is_running=$(echo "$response" | grep -o '"isRunning":[^,]*' | cut -d':' -f2)
        local instances=$(echo "$response" | grep -o '"totalInstances":[^,]*' | cut -d':' -f2)
        local healthy_services=$(echo "$response" | grep -o '"healthyServices":[^,]*' | cut -d':' -f2)
        
        log_message "Status: Running=$is_running, Instances=$instances, Healthy Services=$healthy_services"
        return 0
    else
        log_message "ERROR: High Availability Management status check failed"
        log_message "Response: $response"
        return 1
    fi
}

# 设置定时健康检查
setup_health_monitoring() {
    log_message "Setting up continuous health monitoring..."
    
    # 创建健康检查脚本
    cat > "$PROJECT_DIR/scripts/ha-health-check.sh" << 'EOF'
#!/bin/bash

# 高可用性健康检查脚本
BACKEND_URL="http://localhost:3000"
LOG_FILE="/home/devbox/wordpecker-app/logs/ha-health.log"

# 执行健康检查
check_ha_health() {
    local response=$(curl -s "$BACKEND_URL/api/ha/health" -w "%{http_code}")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        echo "$(date): HA Health Check PASSED" >> "$LOG_FILE"
    else
        echo "$(date): HA Health Check FAILED (HTTP $http_code)" >> "$LOG_FILE"
        echo "$(date): Response: $body" >> "$LOG_FILE"
        
        # 尝试重启HA管理
        echo "$(date): Attempting to restart HA Management..." >> "$LOG_FILE"
        curl -s -X POST "$BACKEND_URL/api/ha/start" >> "$LOG_FILE" 2>&1
    fi
}

check_ha_health
EOF

    chmod +x "$PROJECT_DIR/scripts/ha-health-check.sh"
    
    # 添加到crontab（每5分钟检查一次）
    (crontab -l 2>/dev/null; echo "*/5 * * * * $PROJECT_DIR/scripts/ha-health-check.sh") | crontab -
    
    log_message "Health monitoring cron job configured (every 5 minutes)"
}

# 主执行流程
main() {
    log_message "=== High Availability Management Startup ==="
    
    # 等待后端服务就绪
    if ! wait_for_backend; then
        log_message "FATAL: Backend service not available, cannot start HA Management"
        exit 1
    fi
    
    # 启动HA管理
    if ! start_ha_management; then
        log_message "FATAL: Failed to start High Availability Management"
        exit 1
    fi
    
    # 等待一段时间让HA管理完全初始化
    sleep 10
    
    # 验证HA状态
    if ! verify_ha_status; then
        log_message "WARNING: HA Management status verification failed"
        # 不退出，继续设置监控
    fi
    
    # 设置持续监控
    setup_health_monitoring
    
    log_message "=== High Availability Management startup completed ==="
    log_message "HA Management is now active and monitoring services"
    
    # 显示访问信息
    log_message "HA Management API endpoints:"
    log_message "  Status: $BACKEND_URL/api/ha/status"
    log_message "  Health: $BACKEND_URL/api/ha/health"
    log_message "  Metrics: $BACKEND_URL/api/ha/metrics"
}

# 错误处理
trap 'log_message "ERROR: Script interrupted"; exit 1' INT TERM

# 执行主流程
main "$@"