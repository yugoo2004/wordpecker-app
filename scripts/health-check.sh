#!/bin/bash

# WordPecker 简化健康检查脚本
# 用于定期检查服务状态并在异常时自动重启
# 适合通过 cron 定期执行

set -e

# 配置参数
BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173"
LOG_DIR="./logs"
LOG_FILE="$LOG_DIR/health-check.log"
STATUS_FILE="$LOG_DIR/service-status.json"

# 超时设置
TIMEOUT=10

# 创建日志目录
mkdir -p "$LOG_DIR"

# 日志记录函数
log_message() {
    local level="$1"
    local message="$2"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >> "$LOG_FILE"
    
    # 如果是错误或警告，也输出到stderr
    if [ "$level" = "ERROR" ] || [ "$level" = "WARN" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >&2
    fi
}

# 检查后端服务
check_backend() {
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BACKEND_URL/api/health" 2>/dev/null || echo "000")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        # 验证响应格式
        if echo "$body" | jq -e '.status' > /dev/null 2>&1; then
            local status=$(echo "$body" | jq -r '.status')
            if [ "$status" = "healthy" ]; then
                log_message "INFO" "后端服务健康 (${response_time}ms)"
                
                # 检查高可用性管理状态
                check_ha_management
                
                return 0
            else
                log_message "WARN" "后端服务状态异常: $status (${response_time}ms)"
                return 1
            fi
        else
            log_message "ERROR" "后端服务响应格式无效 (${response_time}ms)"
            return 1
        fi
    else
        log_message "ERROR" "后端服务不可访问 (HTTP $http_code, ${response_time}ms)"
        return 1
    fi
}

# 检查高可用性管理状态
check_ha_management() {
    local ha_response=$(curl -s --max-time 5 "$BACKEND_URL/api/ha/status" 2>/dev/null || echo "")
    
    if echo "$ha_response" | jq -e '.success' > /dev/null 2>&1; then
        local is_running=$(echo "$ha_response" | jq -r '.data.isRunning // false')
        local instances=$(echo "$ha_response" | jq -r '.data.summary.totalInstances // 0')
        local healthy_services=$(echo "$ha_response" | jq -r '.data.summary.healthyServices // 0')
        local failed_services=$(echo "$ha_response" | jq -r '.data.summary.failedServices // 0')
        
        if [ "$is_running" = "true" ]; then
            log_message "INFO" "高可用性管理运行中 - 实例: $instances, 健康服务: $healthy_services, 失败服务: $failed_services"
            
            # 如果有失败的服务，记录警告
            if [ "$failed_services" -gt 0 ]; then
                log_message "WARN" "检测到 $failed_services 个失败的服务"
            fi
        else
            log_message "WARN" "高可用性管理未运行，尝试启动..."
            start_ha_management
        fi
    else
        log_message "WARN" "无法获取高可用性管理状态"
    fi
}

# 启动高可用性管理
start_ha_management() {
    local start_response=$(curl -s -X POST "$BACKEND_URL/api/ha/start" \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null || echo "")
    
    if echo "$start_response" | jq -e '.success' > /dev/null 2>&1; then
        log_message "INFO" "高可用性管理启动成功"
    else
        log_message "ERROR" "高可用性管理启动失败"
    fi
}

# 检查前端服务
check_frontend() {
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$FRONTEND_URL" 2>/dev/null || echo "000")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    local http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        log_message "INFO" "前端服务健康 (${response_time}ms)"
        return 0
    else
        log_message "ERROR" "前端服务不可访问 (HTTP $http_code, ${response_time}ms)"
        return 1
    fi
}

# 重启服务
restart_service() {
    local service_name="$1"
    local pm2_name="wordpecker-$service_name"
    
    log_message "WARN" "正在重启 $service_name 服务..."
    
    # 尝试使用 PM2 重启
    if command -v pm2 > /dev/null 2>&1; then
        if pm2 restart "$pm2_name" > /dev/null 2>&1; then
            log_message "INFO" "$service_name 服务重启成功 (PM2)"
            
            # 等待服务启动
            sleep 15
            
            # 验证重启是否成功
            if [ "$service_name" = "backend" ]; then
                if check_backend; then
                    log_message "INFO" "$service_name 服务重启后验证成功"
                    return 0
                else
                    log_message "ERROR" "$service_name 服务重启后验证失败"
                    return 1
                fi
            elif [ "$service_name" = "frontend" ]; then
                if check_frontend; then
                    log_message "INFO" "$service_name 服务重启后验证成功"
                    return 0
                else
                    log_message "ERROR" "$service_name 服务重启后验证失败"
                    return 1
                fi
            fi
        else
            log_message "ERROR" "PM2 重启 $service_name 服务失败"
        fi
    else
        log_message "ERROR" "PM2 未安装，无法重启服务"
    fi
    
    return 1
}

# 更新状态文件
update_status() {
    local backend_status="$1"
    local frontend_status="$2"
    local backend_response_time="$3"
    local frontend_response_time="$4"
    
    cat > "$STATUS_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "check_time": "$(date '+%Y-%m-%d %H:%M:%S')",
  "services": {
    "backend": {
      "status": "$backend_status",
      "response_time_ms": $backend_response_time,
      "url": "$BACKEND_URL/api/health"
    },
    "frontend": {
      "status": "$frontend_status",
      "response_time_ms": $frontend_response_time,
      "url": "$FRONTEND_URL"
    }
  }
}
EOF
}

# 读取上次状态
get_last_status() {
    local service="$1"
    if [ -f "$STATUS_FILE" ]; then
        jq -r ".services.$service.status // \"unknown\"" "$STATUS_FILE" 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# 主检查逻辑
main() {
    log_message "INFO" "开始健康检查"
    
    # 检查后端服务
    local backend_status="unhealthy"
    local backend_response_time=0
    local backend_last_status=$(get_last_status "backend")
    
    local start_time=$(date +%s%3N)
    if check_backend; then
        backend_status="healthy"
    fi
    local end_time=$(date +%s%3N)
    backend_response_time=$((end_time - start_time))
    
    # 如果后端服务异常且上次状态也异常，尝试重启
    if [ "$backend_status" = "unhealthy" ] && [ "$backend_last_status" = "unhealthy" ]; then
        log_message "WARN" "后端服务连续异常，尝试重启"
        if restart_service "backend"; then
            backend_status="healthy"
        fi
    fi
    
    # 检查前端服务
    local frontend_status="unhealthy"
    local frontend_response_time=0
    local frontend_last_status=$(get_last_status "frontend")
    
    start_time=$(date +%s%3N)
    if check_frontend; then
        frontend_status="healthy"
    fi
    end_time=$(date +%s%3N)
    frontend_response_time=$((end_time - start_time))
    
    # 如果前端服务异常且上次状态也异常，尝试重启
    if [ "$frontend_status" = "unhealthy" ] && [ "$frontend_last_status" = "unhealthy" ]; then
        log_message "WARN" "前端服务连续异常，尝试重启"
        if restart_service "frontend"; then
            frontend_status="healthy"
        fi
    fi
    
    # 更新状态文件
    update_status "$backend_status" "$frontend_status" "$backend_response_time" "$frontend_response_time"
    
    # 记录总体状态
    if [ "$backend_status" = "healthy" ] && [ "$frontend_status" = "healthy" ]; then
        log_message "INFO" "所有服务健康"
        exit 0
    else
        log_message "ERROR" "部分服务异常 - 后端: $backend_status, 前端: $frontend_status"
        exit 1
    fi
}

# 清理旧日志（保留最近1000行）
cleanup_logs() {
    if [ -f "$LOG_FILE" ] && [ $(wc -l < "$LOG_FILE") -gt 1000 ]; then
        tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 健康检查脚本

用法: $0 [选项]

选项:
  -h, --help     显示此帮助信息
  -v, --verbose  详细输出模式
  -q, --quiet    静默模式（仅记录到日志文件）
  --status       显示当前服务状态
  --cleanup      清理旧日志文件

示例:
  $0                # 执行健康检查
  $0 --status       # 显示当前状态
  $0 --cleanup      # 清理日志文件
EOF
}

# 显示当前状态
show_status() {
    if [ -f "$STATUS_FILE" ]; then
        echo "当前服务状态:"
        jq -r '
          "检查时间: " + .check_time + "\n" +
          "后端服务: " + .services.backend.status + " (" + (.services.backend.response_time_ms | tostring) + "ms)\n" +
          "前端服务: " + .services.frontend.status + " (" + (.services.frontend.response_time_ms | tostring) + "ms)"
        ' "$STATUS_FILE"
    else
        echo "状态文件不存在，请先运行健康检查"
        exit 1
    fi
}

# 处理命令行参数
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --status)
        show_status
        exit 0
        ;;
    --cleanup)
        cleanup_logs
        echo "日志清理完成"
        exit 0
        ;;
    -v|--verbose)
        # 详细模式：同时输出到控制台
        exec > >(tee -a "$LOG_FILE")
        exec 2>&1
        main
        ;;
    -q|--quiet)
        # 静默模式：仅记录到日志文件
        main > /dev/null 2>&1
        ;;
    "")
        # 默认模式
        main
        ;;
    *)
        echo "未知选项: $1"
        echo "使用 $0 --help 查看帮助信息"
        exit 1
        ;;
esac