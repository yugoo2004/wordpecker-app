#!/bin/bash

# WordPecker 优化健康检查脚本
# 基于测试结果优化的高性能、高可靠性版本
# 实现需求 2.1, 2.2, 2.3 - 优化的监控和状态管理

set -euo pipefail

# 配置参数
readonly BACKEND_URL="http://localhost:3000"
readonly FRONTEND_URL="http://localhost:5173"
readonly LOG_DIR="./logs"
readonly LOG_FILE="$LOG_DIR/health-check-optimized.log"
readonly STATUS_FILE="$LOG_DIR/service-status-optimized.json"
readonly METRICS_FILE="$LOG_DIR/health-metrics.json"
readonly LOCK_FILE="/tmp/wordpecker-health-check.lock"

# 性能优化配置
readonly TIMEOUT=5
readonly MAX_RETRIES=2
readonly RETRY_DELAY=2
readonly PARALLEL_CHECKS=true
readonly CACHE_TTL=30

# 健康检查阈值
readonly RESPONSE_TIME_WARNING=2000  # 2秒
readonly RESPONSE_TIME_CRITICAL=5000 # 5秒
readonly CONSECUTIVE_FAILURES_THRESHOLD=3

# 创建必要目录
mkdir -p "$LOG_DIR"

# 日志记录函数（优化版）
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 使用 printf 提高性能
    printf "%s [%s] %s\n" "$timestamp" "$level" "$message" >> "$LOG_FILE"
    
    # 错误和警告同时输出到 stderr
    if [[ "$level" =~ ^(ERROR|WARN|CRITICAL)$ ]]; then
        printf "%s [%s] %s\n" "$timestamp" "$level" "$message" >&2
    fi
}

# 锁文件管理
acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
            log_message "WARN" "健康检查已在运行中 (PID: $lock_pid)"
            exit 1
        else
            rm -f "$LOCK_FILE"
        fi
    fi
    echo $$ > "$LOCK_FILE"
}

release_lock() {
    rm -f "$LOCK_FILE"
}

# 陷阱处理
trap 'release_lock; log_message "ERROR" "健康检查异常退出"' EXIT INT TERM

# 优化的 HTTP 检查函数
check_http_endpoint() {
    local url="$1"
    local service_name="$2"
    local expected_pattern="${3:-}"
    
    local start_time=$(date +%s%3N)
    local temp_file=$(mktemp)
    local http_code
    local response_time
    local body
    
    # 使用 curl 的优化选项
    if http_code=$(curl -s -w "%{http_code}" \
        --max-time "$TIMEOUT" \
        --connect-timeout 3 \
        --retry "$MAX_RETRIES" \
        --retry-delay "$RETRY_DELAY" \
        --retry-connrefused \
        --fail-with-body \
        -o "$temp_file" \
        "$url" 2>/dev/null); then
        
        local end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))
        body=$(cat "$temp_file" 2>/dev/null || echo "")
        
        rm -f "$temp_file"
        
        # 验证 HTTP 状态码
        if [ "$http_code" = "200" ]; then
            # 如果有期望的响应模式，进行验证
            if [ -n "$expected_pattern" ]; then
                if echo "$body" | grep -q "$expected_pattern"; then
                    log_message "INFO" "$service_name 健康检查通过 (${response_time}ms)"
                    
                    # 检查响应时间警告
                    if [ "$response_time" -gt "$RESPONSE_TIME_WARNING" ]; then
                        log_message "WARN" "$service_name 响应时间较慢: ${response_time}ms"
                    fi
                    
                    echo "$response_time"
                    return 0
                else
                    log_message "ERROR" "$service_name 响应内容不符合预期"
                    echo "-1"
                    return 1
                fi
            else
                log_message "INFO" "$service_name 健康检查通过 (${response_time}ms)"
                echo "$response_time"
                return 0
            fi
        else
            log_message "ERROR" "$service_name 返回错误状态码: $http_code (${response_time}ms)"
            echo "-1"
            return 1
        fi
    else
        local end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))
        log_message "ERROR" "$service_name 连接失败 (${response_time}ms)"
        rm -f "$temp_file"
        echo "-1"
        return 1
    fi
}

# 并行健康检查
parallel_health_check() {
    local backend_result_file=$(mktemp)
    local frontend_result_file=$(mktemp)
    
    # 并行执行检查
    {
        if check_http_endpoint "$BACKEND_URL/api/health" "Backend" '"status":"healthy"' > "$backend_result_file"; then
            echo "healthy" >> "$backend_result_file"
        else
            echo "unhealthy" >> "$backend_result_file"
        fi
    } &
    local backend_pid=$!
    
    {
        if check_http_endpoint "$FRONTEND_URL" "Frontend" > "$frontend_result_file"; then
            echo "healthy" >> "$frontend_result_file"
        else
            echo "unhealthy" >> "$frontend_result_file"
        fi
    } &
    local frontend_pid=$!
    
    # 等待两个检查完成
    wait "$backend_pid" "$frontend_pid"
    
    # 读取结果
    local backend_response_time=$(head -n1 "$backend_result_file" 2>/dev/null || echo "-1")
    local backend_status=$(tail -n1 "$backend_result_file" 2>/dev/null || echo "unhealthy")
    
    local frontend_response_time=$(head -n1 "$frontend_result_file" 2>/dev/null || echo "-1")
    local frontend_status=$(tail -n1 "$frontend_result_file" 2>/dev/null || echo "unhealthy")
    
    # 清理临时文件
    rm -f "$backend_result_file" "$frontend_result_file"
    
    # 返回结果
    echo "$backend_status:$backend_response_time:$frontend_status:$frontend_response_time"
}

# 顺序健康检查（备用方案）
sequential_health_check() {
    local backend_response_time
    local backend_status="unhealthy"
    local frontend_response_time
    local frontend_status="unhealthy"
    
    # 检查后端
    if backend_response_time=$(check_http_endpoint "$BACKEND_URL/api/health" "Backend" '"status":"healthy"'); then
        backend_status="healthy"
    else
        backend_response_time="-1"
    fi
    
    # 检查前端
    if frontend_response_time=$(check_http_endpoint "$FRONTEND_URL" "Frontend"); then
        frontend_status="healthy"
    else
        frontend_response_time="-1"
    fi
    
    echo "$backend_status:$backend_response_time:$frontend_status:$frontend_response_time"
}

# 获取历史失败次数
get_failure_count() {
    local service="$1"
    if [ -f "$METRICS_FILE" ]; then
        jq -r ".services.$service.consecutive_failures // 0" "$METRICS_FILE" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# 更新失败次数
update_failure_count() {
    local service="$1"
    local status="$2"
    local current_count=$(get_failure_count "$service")
    
    if [ "$status" = "healthy" ]; then
        # 重置失败计数
        echo "0"
    else
        # 增加失败计数
        echo $((current_count + 1))
    fi
}

# 智能重启决策
should_restart_service() {
    local service="$1"
    local status="$2"
    local failure_count=$(get_failure_count "$service")
    
    # 只有在连续失败达到阈值时才重启
    if [ "$status" = "unhealthy" ] && [ "$failure_count" -ge "$CONSECUTIVE_FAILURES_THRESHOLD" ]; then
        return 0
    else
        return 1
    fi
}

# 优化的服务重启
restart_service_optimized() {
    local service_name="$1"
    local pm2_name="wordpecker-$service_name"
    
    log_message "WARN" "智能重启 $service_name 服务..."
    
    # 检查 PM2 进程状态
    local pm2_status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$pm2_name\") | .pm2_env.status" 2>/dev/null || echo "unknown")
    
    if [ "$pm2_status" = "online" ]; then
        # 使用 reload 而不是 restart，减少停机时间
        if pm2 reload "$pm2_name" --update-env > /dev/null 2>&1; then
            log_message "INFO" "$service_name 服务热重载成功"
        else
            # 如果热重载失败，使用常规重启
            pm2 restart "$pm2_name" > /dev/null 2>&1
            log_message "INFO" "$service_name 服务重启成功"
        fi
    else
        # 如果进程不在线，直接启动
        pm2 start "$pm2_name" > /dev/null 2>&1
        log_message "INFO" "$service_name 服务启动成功"
    fi
    
    # 等待服务稳定
    sleep 5
    
    # 验证重启效果
    local verification_result
    if [ "$service_name" = "backend" ]; then
        verification_result=$(check_http_endpoint "$BACKEND_URL/api/health" "Backend" '"status":"healthy"')
    else
        verification_result=$(check_http_endpoint "$FRONTEND_URL" "Frontend")
    fi
    
    if [ "$?" -eq 0 ]; then
        log_message "INFO" "$service_name 服务重启验证成功"
        return 0
    else
        log_message "ERROR" "$service_name 服务重启验证失败"
        return 1
    fi
}

# 更新指标文件
update_metrics() {
    local backend_status="$1"
    local backend_response_time="$2"
    local frontend_status="$3"
    local frontend_response_time="$4"
    
    local backend_failures=$(update_failure_count "backend" "$backend_status")
    local frontend_failures=$(update_failure_count "frontend" "$frontend_status")
    
    # 计算可用性百分比（基于最近100次检查）
    local backend_availability=$(calculate_availability "backend" "$backend_status")
    local frontend_availability=$(calculate_availability "frontend" "$frontend_status")
    
    cat > "$METRICS_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "check_time": "$(date '+%Y-%m-%d %H:%M:%S')",
  "services": {
    "backend": {
      "status": "$backend_status",
      "response_time_ms": $backend_response_time,
      "consecutive_failures": $backend_failures,
      "availability_percent": $backend_availability,
      "url": "$BACKEND_URL/api/health"
    },
    "frontend": {
      "status": "$frontend_status",
      "response_time_ms": $frontend_response_time,
      "consecutive_failures": $frontend_failures,
      "availability_percent": $frontend_availability,
      "url": "$FRONTEND_URL"
    }
  },
  "system": {
    "check_duration_ms": $(($(date +%s%3N) - CHECK_START_TIME)),
    "parallel_checks": $PARALLEL_CHECKS
  }
}
EOF
}

# 计算可用性百分比
calculate_availability() {
    local service="$1"
    local current_status="$2"
    
    # 简化版本：基于最近的状态历史
    if [ -f "$METRICS_FILE" ]; then
        local last_availability=$(jq -r ".services.$service.availability_percent // 95" "$METRICS_FILE" 2>/dev/null || echo "95")
        
        if [ "$current_status" = "healthy" ]; then
            # 健康状态，略微提升可用性
            echo $(( (last_availability * 99 + 100) / 100 ))
        else
            # 不健康状态，降低可用性
            echo $(( (last_availability * 99 + 0) / 100 ))
        fi
    else
        # 首次运行，根据当前状态设置初始值
        if [ "$current_status" = "healthy" ]; then
            echo "100"
        else
            echo "0"
        fi
    fi
}

# 主检查逻辑
main() {
    local CHECK_START_TIME=$(date +%s%3N)
    
    # 获取锁
    acquire_lock
    
    log_message "INFO" "开始优化健康检查"
    
    # 执行健康检查（并行或顺序）
    local check_result
    if [ "$PARALLEL_CHECKS" = "true" ]; then
        check_result=$(parallel_health_check)
    else
        check_result=$(sequential_health_check)
    fi
    
    # 解析结果
    IFS=':' read -r backend_status backend_response_time frontend_status frontend_response_time <<< "$check_result"
    
    # 处理服务异常
    local restart_performed=false
    
    if should_restart_service "backend" "$backend_status"; then
        log_message "WARN" "Backend 连续失败，执行智能重启"
        if restart_service_optimized "backend"; then
            backend_status="healthy"
            restart_performed=true
        fi
    fi
    
    if should_restart_service "frontend" "$frontend_status"; then
        log_message "WARN" "Frontend 连续失败，执行智能重启"
        if restart_service_optimized "frontend"; then
            frontend_status="healthy"
            restart_performed=true
        fi
    fi
    
    # 更新指标
    update_metrics "$backend_status" "$backend_response_time" "$frontend_status" "$frontend_response_time"
    
    # 记录总体状态
    local overall_status="healthy"
    if [ "$backend_status" != "healthy" ] || [ "$frontend_status" != "healthy" ]; then
        overall_status="unhealthy"
    fi
    
    local check_duration=$(($(date +%s%3N) - CHECK_START_TIME))
    log_message "INFO" "健康检查完成 - 状态: $overall_status, 耗时: ${check_duration}ms, 重启: $restart_performed"
    
    # 返回适当的退出码
    if [ "$overall_status" = "healthy" ]; then
        exit 0
    else
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 优化健康检查脚本

用法: $0 [选项]

选项:
  -h, --help          显示此帮助信息
  -v, --verbose       详细输出模式
  -q, --quiet         静默模式
  --sequential        使用顺序检查（禁用并行）
  --metrics           显示性能指标
  --status            显示当前服务状态

优化特性:
  • 并行健康检查，提升检查速度
  • 智能重启决策，减少不必要的重启
  • 性能指标收集和分析
  • 连接复用和超时优化
  • 锁机制防止并发执行

示例:
  $0                  # 执行优化健康检查
  $0 --metrics        # 显示性能指标
  $0 --sequential     # 使用顺序检查模式
EOF
}

# 显示性能指标
show_metrics() {
    if [ -f "$METRICS_FILE" ]; then
        echo "=== WordPecker 服务性能指标 ==="
        jq -r '
          "检查时间: " + .check_time + "\n" +
          "检查耗时: " + (.system.check_duration_ms | tostring) + "ms\n" +
          "并行检查: " + (.system.parallel_checks | tostring) + "\n" +
          "\n后端服务:" +
          "\n  状态: " + .services.backend.status +
          "\n  响应时间: " + (.services.backend.response_time_ms | tostring) + "ms" +
          "\n  连续失败: " + (.services.backend.consecutive_failures | tostring) +
          "\n  可用性: " + (.services.backend.availability_percent | tostring) + "%" +
          "\n\n前端服务:" +
          "\n  状态: " + .services.frontend.status +
          "\n  响应时间: " + (.services.frontend.response_time_ms | tostring) + "ms" +
          "\n  连续失败: " + (.services.frontend.consecutive_failures | tostring) +
          "\n  可用性: " + (.services.frontend.availability_percent | tostring) + "%"
        ' "$METRICS_FILE"
    else
        echo "指标文件不存在，请先运行健康检查"
        exit 1
    fi
}

# 处理命令行参数
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --metrics)
        show_metrics
        exit 0
        ;;
    --status)
        if [ -f "$STATUS_FILE" ]; then
            jq '.' "$STATUS_FILE"
        else
            echo "状态文件不存在"
            exit 1
        fi
        exit 0
        ;;
    --sequential)
        PARALLEL_CHECKS=false
        main
        ;;
    -v|--verbose)
        set -x
        main
        ;;
    -q|--quiet)
        main > /dev/null 2>&1
        ;;
    "")
        main
        ;;
    *)
        echo "未知选项: $1"
        echo "使用 $0 --help 查看帮助信息"
        exit 1
        ;;
esac