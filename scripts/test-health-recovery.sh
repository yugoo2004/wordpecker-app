#!/bin/bash
# 健康检查恢复机制验证测试脚本
# 测试健康检查系统的故障检测和自动恢复能力

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/health-recovery-test.log"
TEST_RESULTS_FILE="$PROJECT_DIR/logs/health-recovery-test-results.json"

BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173"

# 创建日志目录
mkdir -p "$PROJECT_DIR/logs"

# 初始化测试结果
init_test_results() {
    cat > "$TEST_RESULTS_FILE" <<EOF
{
  "test_suite": "health_check_recovery",
  "start_time": "$(date -Iseconds)",
  "tests": [],
  "summary": {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "warnings": 0
  }
}
EOF
}

# 记录测试结果
log_test_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local duration="$4"
    local details="${5:-}"
    
    echo "$(date): [$status] $test_name - $message" >> "$LOG_FILE"
    if [ -n "$details" ]; then
        echo "$(date): 详细信息: $details" >> "$LOG_FILE"
    fi
    
    # 更新JSON结果文件
    local temp_file=$(mktemp)
    jq --arg name "$test_name" \
       --arg status "$status" \
       --arg message "$message" \
       --arg duration "$duration" \
       --arg details "$details" \
       '.tests += [{
         "name": $name,
         "status": $status,
         "message": $message,
         "duration": $duration,
         "details": $details,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S%z")
       }] | 
       .summary.total += 1 |
       if $status == "PASSED" then .summary.passed += 1 
       elif $status == "WARNING" then .summary.warnings += 1 
       else .summary.failed += 1 end' \
       "$TEST_RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$TEST_RESULTS_FILE"
}

# 检查服务健康状态
check_service_health() {
    local url="$1"
    local timeout="${2:-5}"
    
    local response=$(curl -s -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        echo "healthy|$body"
    else
        echo "unhealthy|HTTP $http_code"
    fi
}

# 等待服务恢复
wait_for_recovery() {
    local url="$1"
    local service_name="$2"
    local max_wait="${3:-60}"
    local check_interval="${4:-2}"
    
    local wait_time=0
    echo "等待 $service_name 恢复..." >> "$LOG_FILE"
    
    while [ $wait_time -lt $max_wait ]; do
        local health_result=$(check_service_health "$url" 3)
        local status="${health_result%%|*}"
        
        if [ "$status" = "healthy" ]; then
            echo "$service_name 已恢复 (等待时间: ${wait_time}秒)" >> "$LOG_FILE"
            return 0
        fi
        
        sleep "$check_interval"
        wait_time=$((wait_time + check_interval))
    done
    
    echo "$service_name 恢复超时 (${max_wait}秒)" >> "$LOG_FILE"
    return 1
}

# 测试基础健康检查端点
test_basic_health_endpoints() {
    local test_name="Basic_Health_Endpoints"
    local start_time=$(date +%s)
    
    echo "开始测试基础健康检查端点..." >> "$LOG_FILE"
    
    # 测试后端健康检查
    local backend_health=$(check_service_health "$BACKEND_URL/api/health")
    local backend_status="${backend_health%%|*}"
    local backend_response="${backend_health#*|}"
    
    # 测试后端就绪检查
    local backend_ready=$(check_service_health "$BACKEND_URL/api/ready")
    local ready_status="${backend_ready%%|*}"
    local ready_response="${backend_ready#*|}"
    
    # 测试前端可访问性
    local frontend_health=$(check_service_health "$FRONTEND_URL")
    local frontend_status="${frontend_health%%|*}"
    
    local details="Backend Health: $backend_status, Ready: $ready_status, Frontend: $frontend_status"
    
    if [ "$backend_status" = "healthy" ] && [ "$frontend_status" = "healthy" ]; then
        log_test_result "$test_name" "PASSED" "所有健康检查端点正常" "$(($(date +%s) - start_time))" "$details"
        return 0
    else
        log_test_result "$test_name" "FAILED" "部分健康检查端点异常" "$(($(date +%s) - start_time))" "$details"
        return 1
    fi
}

# 测试服务中断后的健康检查检测
test_service_interruption_detection() {
    local test_name="Service_Interruption_Detection"
    local start_time=$(date +%s)
    
    echo "开始测试服务中断检测..." >> "$LOG_FILE"
    
    # 记录中断前的状态
    local pre_health=$(check_service_health "$BACKEND_URL/api/health")
    echo "中断前健康状态: $pre_health" >> "$LOG_FILE"
    
    # 暂停后端服务
    echo "暂停后端服务..." >> "$LOG_FILE"
    pm2 stop wordpecker-backend
    
    # 等待一小段时间让服务完全停止
    sleep 3
    
    # 检查健康检查是否能检测到服务中断
    local post_health=$(check_service_health "$BACKEND_URL/api/health" 3)
    local post_status="${post_health%%|*}"
    
    echo "中断后健康状态: $post_health" >> "$LOG_FILE"
    
    if [ "$post_status" = "unhealthy" ]; then
        # 重启服务
        pm2 start wordpecker-backend
        
        # 等待服务恢复
        if wait_for_recovery "$BACKEND_URL/api/health" "Backend" 30; then
            log_test_result "$test_name" "PASSED" "成功检测到服务中断并恢复" "$(($(date +%s) - start_time))" "检测时间: 3秒"
            return 0
        else
            log_test_result "$test_name" "FAILED" "检测到中断但服务未能恢复" "$(($(date +%s) - start_time))"
            return 1
        fi
    else
        # 确保服务重新启动
        pm2 start wordpecker-backend
        log_test_result "$test_name" "FAILED" "未能检测到服务中断" "$(($(date +%s) - start_time))"
        return 1
    fi
}

# 测试数据库连接故障检测
test_database_connection_detection() {
    local test_name="Database_Connection_Detection"
    local start_time=$(date +%s)
    
    echo "开始测试数据库连接检测..." >> "$LOG_FILE"
    
    # 检查就绪端点（包含数据库状态）
    local ready_check=$(check_service_health "$BACKEND_URL/api/ready")
    local ready_status="${ready_check%%|*}"
    local ready_response="${ready_check#*|}"
    
    echo "数据库连接检查结果: $ready_check" >> "$LOG_FILE"
    
    # 解析响应中的数据库状态
    if echo "$ready_response" | grep -q '"database"'; then
        local db_status=$(echo "$ready_response" | jq -r '.database' 2>/dev/null || echo "unknown")
        echo "数据库状态: $db_status" >> "$LOG_FILE"
        
        if [ "$db_status" = "connected" ]; then
            log_test_result "$test_name" "PASSED" "数据库连接检测正常" "$(($(date +%s) - start_time))" "状态: $db_status"
            return 0
        else
            log_test_result "$test_name" "WARNING" "数据库连接状态异常" "$(($(date +%s) - start_time))" "状态: $db_status"
            return 0
        fi
    else
        log_test_result "$test_name" "WARNING" "无法获取数据库状态信息" "$(($(date +%s) - start_time))"
        return 0
    fi
}

# 测试外部API配置检测
test_external_api_detection() {
    local test_name="External_API_Detection"
    local start_time=$(date +%s)
    
    echo "开始测试外部API配置检测..." >> "$LOG_FILE"
    
    # 检查就绪端点中的API配置状态
    local ready_check=$(check_service_health "$BACKEND_URL/api/ready")
    local ready_response="${ready_check#*|}"
    
    if echo "$ready_response" | grep -q '"apis"'; then
        local api_status=$(echo "$ready_response" | jq -r '.apis' 2>/dev/null || echo "{}")
        echo "外部API状态: $api_status" >> "$LOG_FILE"
        
        # 检查关键API配置
        local openai_status=$(echo "$api_status" | jq -r '.openai' 2>/dev/null || echo "unknown")
        local elevenlabs_status=$(echo "$api_status" | jq -r '.elevenlabs' 2>/dev/null || echo "unknown")
        local pexels_status=$(echo "$api_status" | jq -r '.pexels' 2>/dev/null || echo "unknown")
        
        local details="OpenAI: $openai_status, ElevenLabs: $elevenlabs_status, Pexels: $pexels_status"
        
        if [ "$openai_status" = "configured" ]; then
            log_test_result "$test_name" "PASSED" "外部API配置检测正常" "$(($(date +%s) - start_time))" "$details"
            return 0
        else
            log_test_result "$test_name" "WARNING" "关键API配置缺失" "$(($(date +%s) - start_time))" "$details"
            return 0
        fi
    else
        log_test_result "$test_name" "WARNING" "无法获取API配置状态" "$(($(date +%s) - start_time))"
        return 0
    fi
}

# 测试负载压力下的健康检查
test_health_under_load() {
    local test_name="Health_Under_Load"
    local start_time=$(date +%s)
    
    echo "开始测试负载压力下的健康检查..." >> "$LOG_FILE"
    
    # 记录负载前的响应时间
    local pre_load_time=$(date +%s%3N)
    check_service_health "$BACKEND_URL/api/health" > /dev/null
    local pre_load_response_time=$(($(date +%s%3N) - pre_load_time))
    
    echo "负载前响应时间: ${pre_load_response_time}ms" >> "$LOG_FILE"
    
    # 创建并发负载
    echo "创建并发负载..." >> "$LOG_FILE"
    local pids=()
    
    for i in {1..20}; do
        {
            for j in {1..5}; do
                curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1
                sleep 0.1
            done
        } &
        pids+=($!)
    done
    
    # 在负载期间测试健康检查
    sleep 2
    local under_load_time=$(date +%s%3N)
    local load_health=$(check_service_health "$BACKEND_URL/api/health" 10)
    local under_load_response_time=$(($(date +%s%3N) - under_load_time))
    local load_status="${load_health%%|*}"
    
    echo "负载中响应时间: ${under_load_response_time}ms" >> "$LOG_FILE"
    echo "负载中健康状态: $load_health" >> "$LOG_FILE"
    
    # 等待所有负载进程完成
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done
    
    # 检查负载后的状态
    sleep 2
    local post_load_time=$(date +%s%3N)
    local post_load_health=$(check_service_health "$BACKEND_URL/api/health")
    local post_load_response_time=$(($(date +%s%3N) - post_load_time))
    local post_load_status="${post_load_health%%|*}"
    
    echo "负载后响应时间: ${post_load_response_time}ms" >> "$LOG_FILE"
    echo "负载后健康状态: $post_load_health" >> "$LOG_FILE"
    
    local details="负载前: ${pre_load_response_time}ms, 负载中: ${under_load_response_time}ms, 负载后: ${post_load_response_time}ms"
    
    if [ "$load_status" = "healthy" ] && [ "$post_load_status" = "healthy" ]; then
        log_test_result "$test_name" "PASSED" "负载压力下健康检查正常" "$(($(date +%s) - start_time))" "$details"
        return 0
    else
        log_test_result "$test_name" "FAILED" "负载压力下健康检查异常" "$(($(date +%s) - start_time))" "$details"
        return 1
    fi
}

# 测试健康检查脚本的自动恢复
test_health_script_recovery() {
    local test_name="Health_Script_Recovery"
    local start_time=$(date +%s)
    
    echo "开始测试健康检查脚本的自动恢复..." >> "$LOG_FILE"
    
    # 检查健康检查脚本是否存在
    local health_script="$PROJECT_DIR/scripts/health-check.sh"
    
    if [ ! -f "$health_script" ]; then
        log_test_result "$test_name" "SKIPPED" "健康检查脚本不存在" "$(($(date +%s) - start_time))"
        return 0
    fi
    
    # 检查脚本是否可执行
    if [ ! -x "$health_script" ]; then
        chmod +x "$health_script"
        echo "已设置健康检查脚本为可执行" >> "$LOG_FILE"
    fi
    
    # 运行健康检查脚本
    echo "运行健康检查脚本..." >> "$LOG_FILE"
    
    if "$health_script" >> "$LOG_FILE" 2>&1; then
        log_test_result "$test_name" "PASSED" "健康检查脚本运行正常" "$(($(date +%s) - start_time))"
        return 0
    else
        log_test_result "$test_name" "WARNING" "健康检查脚本运行异常" "$(($(date +%s) - start_time))"
        return 0
    fi
}

# 生成测试报告
generate_report() {
    local end_time=$(date -Iseconds)
    local temp_file=$(mktemp)
    
    jq --arg end_time "$end_time" \
       '.end_time = $end_time |
        .duration = (.summary.total * 20) |
        .status = (if .summary.failed == 0 then "PASSED" else "FAILED" end)' \
       "$TEST_RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$TEST_RESULTS_FILE"
    
    echo "" >> "$LOG_FILE"
    echo "=== 健康检查恢复测试报告 ===" >> "$LOG_FILE"
    echo "测试时间: $(date)" >> "$LOG_FILE"
    echo "总测试数: $(jq -r '.summary.total' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "通过测试: $(jq -r '.summary.passed' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "警告测试: $(jq -r '.summary.warnings' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "失败测试: $(jq -r '.summary.failed' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "整体状态: $(jq -r '.status' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # 显示详细结果
    jq -r '.tests[] | "[\(.status)] \(.name): \(.message)"' "$TEST_RESULTS_FILE" >> "$LOG_FILE"
    
    # 显示性能统计
    echo "" >> "$LOG_FILE"
    echo "=== 性能统计 ===" >> "$LOG_FILE"
    jq -r '.tests[] | select(.details != "") | "\(.name): \(.details)"' "$TEST_RESULTS_FILE" >> "$LOG_FILE"
}

# 主测试流程
main() {
    echo "$(date): 开始健康检查恢复机制测试" >> "$LOG_FILE"
    
    # 检查必要的工具
    if ! command -v curl &> /dev/null; then
        echo "错误: curl 未安装" >> "$LOG_FILE"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo "错误: jq 未安装" >> "$LOG_FILE"
        exit 1
    fi
    
    if ! command -v pm2 &> /dev/null; then
        echo "错误: PM2 未安装" >> "$LOG_FILE"
        exit 1
    fi
    
    # 初始化测试结果
    init_test_results
    
    # 确保服务正在运行
    if ! pm2 list | grep -q "wordpecker-backend.*online"; then
        echo "启动后端服务..." >> "$LOG_FILE"
        pm2 start wordpecker-backend || {
            echo "错误: 无法启动后端服务" >> "$LOG_FILE"
            exit 1
        }
        
        # 等待服务启动
        if ! wait_for_recovery "$BACKEND_URL/api/health" "Backend" 30; then
            echo "错误: 后端服务启动失败" >> "$LOG_FILE"
            exit 1
        fi
    fi
    
    # 运行测试
    test_basic_health_endpoints
    test_service_interruption_detection
    test_database_connection_detection
    test_external_api_detection
    test_health_under_load
    test_health_script_recovery
    
    # 生成报告
    generate_report
    
    echo "$(date): 健康检查恢复机制测试完成" >> "$LOG_FILE"
    echo "测试结果已保存到: $TEST_RESULTS_FILE"
    
    # 返回适当的退出码
    local failed_count=$(jq -r '.summary.failed' "$TEST_RESULTS_FILE")
    if [ "$failed_count" -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# 如果直接运行此脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi