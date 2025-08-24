#!/bin/bash
# WordPecker 部署后验证脚本
# 功能：服务状态验证、功能测试、性能检查

set -e

# 配置变量
BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173"
LOG_FILE="./logs/post-deploy-verify.log"
VERIFY_RESULTS_FILE="./logs/verify-results.json"
MAX_WAIT_TIME=120  # 最大等待时间（秒）

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 验证结果统计
TOTAL_VERIFICATIONS=0
PASSED_VERIFICATIONS=0
FAILED_VERIFICATIONS=0
WARNING_VERIFICATIONS=0

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
    PASSED_VERIFICATIONS=$((PASSED_VERIFICATIONS + 1))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
    WARNING_VERIFICATIONS=$((WARNING_VERIFICATIONS + 1))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
    FAILED_VERIFICATIONS=$((FAILED_VERIFICATIONS + 1))
}

# 增加验证计数
increment_verification() {
    TOTAL_VERIFICATIONS=$((TOTAL_VERIFICATIONS + 1))
}

# 等待服务启动
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_wait=${3:-$MAX_WAIT_TIME}
    local wait_time=0
    local check_interval=5
    
    log_info "等待 $service_name 服务启动..."
    log_info "检查URL: $url"
    log_info "最大等待时间: ${max_wait}秒"
    
    while [ $wait_time -lt $max_wait ]; do
        if curl -f -s --connect-timeout 5 --max-time 10 "$url" > /dev/null 2>&1; then
            log_success "$service_name 服务已启动 (等待时间: ${wait_time}秒)"
            return 0
        fi
        
        sleep $check_interval
        wait_time=$((wait_time + check_interval))
        
        # 每30秒输出一次等待状态
        if [ $((wait_time % 30)) -eq 0 ]; then
            log_info "仍在等待 $service_name 启动... (${wait_time}/${max_wait}秒)"
        fi
    done
    
    log_error "$service_name 服务启动超时 (${max_wait}秒)"
    return 1
}

# 验证PM2进程状态
verify_pm2_processes() {
    log_info "验证PM2进程状态"
    
    increment_verification
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2未安装"
        return 1
    fi
    
    # 获取PM2进程列表
    local pm2_list=$(pm2 jlist 2>/dev/null)
    
    if [ -z "$pm2_list" ] || [ "$pm2_list" = "[]" ]; then
        log_error "未找到PM2进程"
        return 1
    fi
    
    # 检查WordPecker相关进程
    local backend_status=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-backend") | .pm2_env.status' 2>/dev/null || echo "not_found")
    local frontend_status=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-frontend") | .pm2_env.status' 2>/dev/null || echo "not_found")
    
    # 验证后端进程
    increment_verification
    if [ "$backend_status" = "online" ]; then
        log_success "后端PM2进程: 运行中"
        
        # 获取进程详细信息
        local backend_uptime=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-backend") | .pm2_env.pm_uptime' 2>/dev/null)
        local backend_memory=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-backend") | .monit.memory' 2>/dev/null)
        local backend_cpu=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-backend") | .monit.cpu' 2>/dev/null)
        
        log_info "后端进程 - 启动时间: $(date -d @$((backend_uptime/1000)) '+%Y-%m-%d %H:%M:%S'), 内存: $((backend_memory/1024/1024))MB, CPU: ${backend_cpu}%"
    else
        log_error "后端PM2进程: $backend_status"
    fi
    
    # 验证前端进程
    increment_verification
    if [ "$frontend_status" = "online" ]; then
        log_success "前端PM2进程: 运行中"
        
        local frontend_uptime=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-frontend") | .pm2_env.pm_uptime' 2>/dev/null)
        local frontend_memory=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-frontend") | .monit.memory' 2>/dev/null)
        local frontend_cpu=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-frontend") | .monit.cpu' 2>/dev/null)
        
        log_info "前端进程 - 启动时间: $(date -d @$((frontend_uptime/1000)) '+%Y-%m-%d %H:%M:%S'), 内存: $((frontend_memory/1024/1024))MB, CPU: ${frontend_cpu}%"
    else
        log_error "前端PM2进程: $frontend_status"
    fi
    
    # 检查重启次数
    local backend_restarts=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-backend") | .pm2_env.restart_time' 2>/dev/null || echo "0")
    local frontend_restarts=$(echo "$pm2_list" | jq -r '.[] | select(.name=="wordpecker-frontend") | .pm2_env.restart_time' 2>/dev/null || echo "0")
    
    increment_verification
    if [ "$backend_restarts" -eq 0 ] && [ "$frontend_restarts" -eq 0 ]; then
        log_success "进程稳定性: 无异常重启"
    elif [ "$backend_restarts" -lt 3 ] && [ "$frontend_restarts" -lt 3 ]; then
        log_warning "进程稳定性: 少量重启 (后端: $backend_restarts, 前端: $frontend_restarts)"
    else
        log_error "进程稳定性: 频繁重启 (后端: $backend_restarts, 前端: $frontend_restarts)"
    fi
}

# 验证服务可访问性
verify_service_accessibility() {
    log_info "验证服务可访问性"
    
    # 等待后端服务
    increment_verification
    if wait_for_service "$BACKEND_URL/api/health" "后端" 60; then
        log_success "后端服务: 可访问"
    else
        log_error "后端服务: 不可访问"
        return 1
    fi
    
    # 等待前端服务
    increment_verification
    if wait_for_service "$FRONTEND_URL" "前端" 60; then
        log_success "前端服务: 可访问"
    else
        log_error "前端服务: 不可访问"
        return 1
    fi
}

# 验证API端点功能
verify_api_endpoints() {
    log_info "验证API端点功能"
    
    # 健康检查端点
    increment_verification
    log_info "测试健康检查端点: $BACKEND_URL/api/health"
    local health_response=$(curl -s --connect-timeout 10 --max-time 15 "$BACKEND_URL/api/health" 2>/dev/null)
    
    if [ -n "$health_response" ] && echo "$health_response" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
        log_success "健康检查端点: 正常"
        
        # 解析健康检查响应
        local uptime=$(echo "$health_response" | jq -r '.uptime // "unknown"')
        local memory_used=$(echo "$health_response" | jq -r '.memory.heapUsed // "unknown"')
        local memory_total=$(echo "$health_response" | jq -r '.memory.heapTotal // "unknown"')
        
        log_info "服务运行时间: ${uptime}秒"
        log_info "内存使用: ${memory_used}/${memory_total} 字节"
    else
        log_error "健康检查端点: 异常响应"
        log_info "响应内容: $health_response"
    fi
    
    # 就绪检查端点
    increment_verification
    log_info "测试就绪检查端点: $BACKEND_URL/api/ready"
    local ready_response=$(curl -s --connect-timeout 10 --max-time 15 "$BACKEND_URL/api/ready" 2>/dev/null)
    
    if [ -n "$ready_response" ]; then
        local ready_status=$(echo "$ready_response" | jq -r '.status // "unknown"')
        
        if [ "$ready_status" = "ready" ]; then
            log_success "就绪检查端点: 服务就绪"
            
            # 检查数据库状态
            local db_status=$(echo "$ready_response" | jq -r '.database // "unknown"')
            log_info "数据库状态: $db_status"
            
            # 检查API配置
            local openai_status=$(echo "$ready_response" | jq -r '.apis.openai // "unknown"')
            local elevenlabs_status=$(echo "$ready_response" | jq -r '.apis.elevenlabs // "unknown"')
            local pexels_status=$(echo "$ready_response" | jq -r '.apis.pexels // "unknown"')
            
            log_info "OpenAI API: $openai_status"
            log_info "ElevenLabs API: $elevenlabs_status"
            log_info "Pexels API: $pexels_status"
            
        elif [ "$ready_status" = "not_ready" ]; then
            log_warning "就绪检查端点: 服务未完全就绪"
        else
            log_error "就绪检查端点: 状态异常 ($ready_status)"
        fi
    else
        log_error "就绪检查端点: 无响应"
    fi
    
    # 测试其他关键API端点
    local test_endpoints=(
        "/api/vocabulary"
        "/api/lists"
        "/api/templates"
    )
    
    for endpoint in "${test_endpoints[@]}"; do
        increment_verification
        log_info "测试端点: $BACKEND_URL$endpoint"
        
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$BACKEND_URL$endpoint" 2>/dev/null)
        
        if [ "$response_code" = "200" ] || [ "$response_code" = "401" ] || [ "$response_code" = "404" ]; then
            log_success "API端点 $endpoint: 响应正常 (HTTP $response_code)"
        else
            log_warning "API端点 $endpoint: 响应异常 (HTTP $response_code)"
        fi
    done
}

# 验证前端功能
verify_frontend_functionality() {
    log_info "验证前端功能"
    
    # 主页面访问
    increment_verification
    log_info "测试前端主页: $FRONTEND_URL"
    local frontend_response=$(curl -s --connect-timeout 10 --max-time 15 "$FRONTEND_URL" 2>/dev/null)
    
    if [ -n "$frontend_response" ] && echo "$frontend_response" | grep -q "WordPecker\|<!DOCTYPE html>" > /dev/null 2>&1; then
        log_success "前端主页: 正常加载"
        
        # 检查关键资源
        if echo "$frontend_response" | grep -q "script\|link.*css" > /dev/null 2>&1; then
            log_success "前端资源: 包含必要的脚本和样式"
        else
            log_warning "前端资源: 可能缺少关键资源"
        fi
    else
        log_error "前端主页: 加载失败"
    fi
    
    # 静态资源检查
    local static_resources=(
        "/assets"
        "/vite.svg"
    )
    
    for resource in "${static_resources[@]}"; do
        increment_verification
        local resource_url="$FRONTEND_URL$resource"
        local resource_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$resource_url" 2>/dev/null)
        
        if [ "$resource_code" = "200" ] || [ "$resource_code" = "404" ]; then
            log_success "静态资源 $resource: 服务器响应正常"
        else
            log_warning "静态资源 $resource: 响应异常 (HTTP $resource_code)"
        fi
    done
}

# 验证数据库连接
verify_database_connection() {
    log_info "验证数据库连接"
    
    increment_verification
    if [ -z "$MONGODB_URL" ]; then
        log_warning "数据库连接: MONGODB_URL未设置，跳过验证"
        return
    fi
    
    # 通过后端API验证数据库连接
    local ready_response=$(curl -s --connect-timeout 10 --max-time 15 "$BACKEND_URL/api/ready" 2>/dev/null)
    
    if [ -n "$ready_response" ]; then
        local db_status=$(echo "$ready_response" | jq -r '.database // "unknown"')
        
        if [ "$db_status" = "connected" ]; then
            log_success "数据库连接: 正常"
        else
            log_error "数据库连接: 异常 ($db_status)"
        fi
    else
        log_warning "数据库连接: 无法通过API验证"
    fi
}

# 性能基准测试
perform_performance_tests() {
    log_info "执行性能基准测试"
    
    # API响应时间测试
    increment_verification
    log_info "测试API响应时间"
    
    local start_time=$(date +%s%N)
    local health_response=$(curl -s --connect-timeout 5 --max-time 10 "$BACKEND_URL/api/health" 2>/dev/null)
    local end_time=$(date +%s%N)
    
    if [ -n "$health_response" ]; then
        local response_time=$(( (end_time - start_time) / 1000000 ))  # 转换为毫秒
        
        log_info "API响应时间: ${response_time}ms"
        
        if [ "$response_time" -lt 500 ]; then
            log_success "API性能: 优秀 (${response_time}ms)"
        elif [ "$response_time" -lt 1000 ]; then
            log_success "API性能: 良好 (${response_time}ms)"
        elif [ "$response_time" -lt 2000 ]; then
            log_warning "API性能: 一般 (${response_time}ms)"
        else
            log_warning "API性能: 较慢 (${response_time}ms)"
        fi
    else
        log_error "API性能测试: 请求失败"
    fi
    
    # 前端加载时间测试
    increment_verification
    log_info "测试前端加载时间"
    
    start_time=$(date +%s%N)
    local frontend_response=$(curl -s --connect-timeout 10 --max-time 15 "$FRONTEND_URL" 2>/dev/null)
    end_time=$(date +%s%N)
    
    if [ -n "$frontend_response" ]; then
        local load_time=$(( (end_time - start_time) / 1000000 ))
        
        log_info "前端加载时间: ${load_time}ms"
        
        if [ "$load_time" -lt 1000 ]; then
            log_success "前端性能: 优秀 (${load_time}ms)"
        elif [ "$load_time" -lt 2000 ]; then
            log_success "前端性能: 良好 (${load_time}ms)"
        elif [ "$load_time" -lt 3000 ]; then
            log_warning "前端性能: 一般 (${load_time}ms)"
        else
            log_warning "前端性能: 较慢 (${load_time}ms)"
        fi
    else
        log_error "前端性能测试: 加载失败"
    fi
    
    # 并发请求测试
    increment_verification
    log_info "测试并发处理能力"
    
    local concurrent_requests=5
    local success_count=0
    
    for i in $(seq 1 $concurrent_requests); do
        if curl -s -f --connect-timeout 5 --max-time 10 "$BACKEND_URL/api/health" > /dev/null 2>&1 &; then
            success_count=$((success_count + 1))
        fi
    done
    
    wait  # 等待所有后台进程完成
    
    log_info "并发请求结果: $success_count/$concurrent_requests 成功"
    
    if [ "$success_count" -eq "$concurrent_requests" ]; then
        log_success "并发处理: 优秀 (${success_count}/${concurrent_requests})"
    elif [ "$success_count" -ge $((concurrent_requests * 80 / 100)) ]; then
        log_success "并发处理: 良好 (${success_count}/${concurrent_requests})"
    else
        log_warning "并发处理: 需要优化 (${success_count}/${concurrent_requests})"
    fi
}

# 验证日志记录
verify_logging() {
    log_info "验证日志记录"
    
    # 检查PM2日志
    increment_verification
    if [ -d "$HOME/.pm2/logs" ]; then
        local log_files=$(find "$HOME/.pm2/logs" -name "*wordpecker*" -type f 2>/dev/null | wc -l)
        
        if [ "$log_files" -gt 0 ]; then
            log_success "PM2日志: 正常记录 ($log_files 个日志文件)"
            
            # 检查最新日志
            local latest_log=$(find "$HOME/.pm2/logs" -name "*wordpecker*" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            
            if [ -n "$latest_log" ] && [ -f "$latest_log" ]; then
                local log_size=$(stat -f%z "$latest_log" 2>/dev/null || stat -c%s "$latest_log" 2>/dev/null || echo "0")
                log_info "最新日志文件: $latest_log (大小: $log_size 字节)"
                
                # 检查日志内容
                if [ "$log_size" -gt 0 ]; then
                    local recent_entries=$(tail -10 "$latest_log" 2>/dev/null | wc -l)
                    log_info "最近日志条目: $recent_entries 条"
                fi
            fi
        else
            log_warning "PM2日志: 未找到日志文件"
        fi
    else
        log_warning "PM2日志: 日志目录不存在"
    fi
    
    # 检查应用日志
    increment_verification
    if [ -d "./logs" ]; then
        local app_logs=$(find "./logs" -name "*.log" -type f 2>/dev/null | wc -l)
        
        if [ "$app_logs" -gt 0 ]; then
            log_success "应用日志: 正常记录 ($app_logs 个日志文件)"
        else
            log_warning "应用日志: 未找到日志文件"
        fi
    else
        log_warning "应用日志: 日志目录不存在"
    fi
}

# 生成验证报告
generate_verification_report() {
    local end_time=$(date +%s)
    local start_time=${1:-$end_time}
    local duration=$((end_time - start_time))
    
    # 计算成功率
    local success_rate=0
    if [ "$TOTAL_VERIFICATIONS" -gt 0 ]; then
        success_rate=$(echo "scale=2; $PASSED_VERIFICATIONS * 100 / $TOTAL_VERIFICATIONS" | bc)
    fi
    
    # 获取系统信息
    local pm2_status=$(pm2 jlist 2>/dev/null || echo '[]')
    local system_load=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    local memory_usage=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    local disk_usage=$(df -h / | awk 'NR==2{print $5}')
    
    # 生成JSON报告
    cat > "$VERIFY_RESULTS_FILE" << EOF
{
  "verification_summary": {
    "timestamp": "$(date -d @$end_time '+%Y-%m-%d %H:%M:%S')",
    "duration_seconds": $duration,
    "total_verifications": $TOTAL_VERIFICATIONS,
    "passed_verifications": $PASSED_VERIFICATIONS,
    "failed_verifications": $FAILED_VERIFICATIONS,
    "warning_verifications": $WARNING_VERIFICATIONS,
    "success_rate": $success_rate
  },
  "service_status": {
    "backend_url": "$BACKEND_URL",
    "frontend_url": "$FRONTEND_URL",
    "pm2_processes": $pm2_status
  },
  "system_metrics": {
    "load_average": "$system_load",
    "memory_usage": "${memory_usage}%",
    "disk_usage": "$disk_usage",
    "hostname": "$(hostname)",
    "user": "$(whoami)"
  },
  "deployment_health": "$([ "$FAILED_VERIFICATIONS" -eq 0 ] && echo "healthy" || echo "unhealthy")"
}
EOF
    
    log_info "验证报告已生成: $VERIFY_RESULTS_FILE"
}

# 显示验证结果摘要
show_verification_summary() {
    echo
    log_info "=========================================="
    log_info "部署后验证完成"
    log_info "=========================================="
    log_info "总验证项目: $TOTAL_VERIFICATIONS"
    log_success "通过: $PASSED_VERIFICATIONS"
    log_warning "警告: $WARNING_VERIFICATIONS"
    log_error "失败: $FAILED_VERIFICATIONS"
    
    local success_rate=0
    if [ "$TOTAL_VERIFICATIONS" -gt 0 ]; then
        success_rate=$(echo "scale=1; $PASSED_VERIFICATIONS * 100 / $TOTAL_VERIFICATIONS" | bc)
    fi
    log_info "成功率: ${success_rate}%"
    
    echo
    if [ "$FAILED_VERIFICATIONS" -eq 0 ]; then
        log_success "✅ 部署验证成功，服务运行正常"
        echo
        log_info "服务访问地址:"
        log_info "  前端: $FRONTEND_URL"
        log_info "  后端API: $BACKEND_URL/api"
        log_info "  健康检查: $BACKEND_URL/api/health"
        return 0
    else
        log_error "❌ 部署验证失败，发现 $FAILED_VERIFICATIONS 个问题"
        log_error "建议检查失败的验证项目并进行修复"
        return 1
    fi
}

# 主验证流程
main() {
    local start_time=$(date +%s)
    
    # 创建日志目录
    mkdir -p "./logs"
    
    log_info "=========================================="
    log_info "WordPecker 部署后验证开始"
    log_info "时间: $(date)"
    log_info "=========================================="
    
    # 执行各项验证
    verify_pm2_processes
    verify_service_accessibility
    verify_api_endpoints
    verify_frontend_functionality
    verify_database_connection
    perform_performance_tests
    verify_logging
    
    # 生成报告
    generate_verification_report "$start_time"
    
    # 显示摘要
    show_verification_summary
}

# 脚本入口点
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi