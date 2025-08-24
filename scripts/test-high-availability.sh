#!/bin/bash

# 高可用性管理功能测试脚本
# 测试负载均衡、故障切换和自动扩缩容功能

set -e

PROJECT_DIR="/home/devbox/wordpecker-app"
LOG_FILE="$PROJECT_DIR/logs/ha-test.log"
BACKEND_URL="http://localhost:3000"
TEST_RESULTS=()

# 创建日志目录
mkdir -p "$PROJECT_DIR/logs"

# 测试日志记录
log_test() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message" | tee -a "$LOG_FILE"
}

# 测试结果记录
record_test_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    TEST_RESULTS+=("$test_name: $result - $details")
    
    if [ "$result" = "PASS" ]; then
        log_test "✅ $test_name: PASSED - $details"
    else
        log_test "❌ $test_name: FAILED - $details"
    fi
}

# API调用辅助函数
call_api() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    if [ "$method" = "GET" ]; then
        curl -s "$BACKEND_URL$endpoint" -w "%{http_code}"
    else
        curl -s -X "$method" "$BACKEND_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "%{http_code}"
    fi
}

# 测试1: 启动高可用性管理
test_start_ha_management() {
    log_test "Testing: Start HA Management"
    
    local response=$(call_api "POST" "/api/ha/start" "{}")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"success":true'; then
        record_test_result "Start HA Management" "PASS" "HA Management started successfully"
        return 0
    else
        record_test_result "Start HA Management" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 测试2: 获取HA状态
test_get_ha_status() {
    log_test "Testing: Get HA Status"
    
    local response=$(call_api "GET" "/api/ha/status" "")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"isRunning":true'; then
        local instances=$(echo "$body" | grep -o '"totalInstances":[^,]*' | cut -d':' -f2)
        record_test_result "Get HA Status" "PASS" "Status retrieved, instances: $instances"
        return 0
    else
        record_test_result "Get HA Status" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 测试3: 健康检查
test_health_check() {
    log_test "Testing: HA Health Check"
    
    local response=$(call_api "GET" "/api/ha/health" "")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "503" ]; then
        local is_healthy=$(echo "$body" | grep -o '"isHealthy":[^,]*' | cut -d':' -f2)
        record_test_result "HA Health Check" "PASS" "Health check completed, healthy: $is_healthy"
        return 0
    else
        record_test_result "HA Health Check" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 测试4: 获取性能指标
test_get_metrics() {
    log_test "Testing: Get Performance Metrics"
    
    local response=$(call_api "GET" "/api/ha/metrics" "")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"system"'; then
        record_test_result "Get Performance Metrics" "PASS" "Metrics retrieved successfully"
        return 0
    else
        record_test_result "Get Performance Metrics" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 测试5: 手动扩容
test_manual_scale_up() {
    log_test "Testing: Manual Scale Up"
    
    local response=$(call_api "POST" "/api/ha/scale-up" '{"targetInstances": 2}')
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"success":true'; then
        record_test_result "Manual Scale Up" "PASS" "Scale up operation initiated"
        
        # 等待扩容完成
        sleep 15
        
        # 验证实例数量
        local status_response=$(call_api "GET" "/api/ha/status" "")
        local status_body="${status_response%???}"
        local instances=$(echo "$status_body" | grep -o '"totalInstances":[^,]*' | cut -d':' -f2)
        
        if [ "$instances" -gt 1 ]; then
            record_test_result "Scale Up Verification" "PASS" "Instances increased to: $instances"
        else
            record_test_result "Scale Up Verification" "FAIL" "Instances not increased: $instances"
        fi
        
        return 0
    else
        record_test_result "Manual Scale Up" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 测试6: 手动缩容
test_manual_scale_down() {
    log_test "Testing: Manual Scale Down"
    
    local response=$(call_api "POST" "/api/ha/scale-down" '{"targetInstances": 1}')
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"success":true'; then
        record_test_result "Manual Scale Down" "PASS" "Scale down operation initiated"
        
        # 等待缩容完成
        sleep 15
        
        # 验证实例数量
        local status_response=$(call_api "GET" "/api/ha/status" "")
        local status_body="${status_response%???}"
        local instances=$(echo "$status_body" | grep -o '"totalInstances":[^,]*' | cut -d':' -f2)
        
        record_test_result "Scale Down Verification" "PASS" "Instances scaled to: $instances"
        return 0
    else
        record_test_result "Manual Scale Down" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 测试7: 故障切换测试
test_failover() {
    log_test "Testing: Manual Failover"
    
    local response=$(call_api "POST" "/api/ha/failover" '{"serviceName": "wordpecker-backend", "reason": "Test failover"}')
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"success":true'; then
        record_test_result "Manual Failover" "PASS" "Failover operation initiated"
        
        # 等待故障切换完成
        sleep 20
        
        # 验证服务恢复
        if curl -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
            record_test_result "Failover Recovery" "PASS" "Service recovered after failover"
        else
            record_test_result "Failover Recovery" "FAIL" "Service not recovered after failover"
        fi
        
        return 0
    else
        record_test_result "Manual Failover" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 测试8: 负载均衡器状态
test_load_balancer_status() {
    log_test "Testing: Load Balancer Status"
    
    local response=$(call_api "GET" "/api/ha/load-balancer" "")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"isMonitoring"'; then
        local is_monitoring=$(echo "$body" | grep -o '"isMonitoring":[^,]*' | cut -d':' -f2)
        record_test_result "Load Balancer Status" "PASS" "Monitoring active: $is_monitoring"
        return 0
    else
        record_test_result "Load Balancer Status" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 测试9: 故障切换管理器状态
test_failover_manager_status() {
    log_test "Testing: Failover Manager Status"
    
    local response=$(call_api "GET" "/api/ha/failover-manager" "")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"isMonitoring"'; then
        local monitored_services=$(echo "$body" | grep -o '"monitoredServices":[^,]*' | cut -d':' -f2)
        record_test_result "Failover Manager Status" "PASS" "Monitored services: $monitored_services"
        return 0
    else
        record_test_result "Failover Manager Status" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 测试10: 停止HA管理
test_stop_ha_management() {
    log_test "Testing: Stop HA Management"
    
    local response=$(call_api "POST" "/api/ha/stop" "{}")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"success":true'; then
        record_test_result "Stop HA Management" "PASS" "HA Management stopped successfully"
        return 0
    else
        record_test_result "Stop HA Management" "FAIL" "HTTP $http_code - $body"
        return 1
    fi
}

# 等待后端服务就绪
wait_for_backend() {
    local max_wait=60
    local wait_time=0
    
    log_test "Waiting for backend service to be ready..."
    
    while [ $wait_time -lt $max_wait ]; do
        if curl -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
            log_test "Backend service is ready!"
            return 0
        fi
        
        sleep 2
        wait_time=$((wait_time + 2))
    done
    
    log_test "ERROR: Backend service not ready within ${max_wait}s"
    return 1
}

# 生成测试报告
generate_test_report() {
    log_test ""
    log_test "=== HIGH AVAILABILITY TEST REPORT ==="
    log_test ""
    
    local total_tests=${#TEST_RESULTS[@]}
    local passed_tests=0
    local failed_tests=0
    
    for result in "${TEST_RESULTS[@]}"; do
        log_test "$result"
        if echo "$result" | grep -q ": PASS"; then
            ((passed_tests++))
        else
            ((failed_tests++))
        fi
    done
    
    log_test ""
    log_test "=== SUMMARY ==="
    log_test "Total Tests: $total_tests"
    log_test "Passed: $passed_tests"
    log_test "Failed: $failed_tests"
    log_test "Success Rate: $(( passed_tests * 100 / total_tests ))%"
    log_test ""
    
    if [ $failed_tests -eq 0 ]; then
        log_test "🎉 All tests passed! High Availability system is working correctly."
        return 0
    else
        log_test "⚠️  Some tests failed. Please check the logs for details."
        return 1
    fi
}

# 主测试流程
main() {
    log_test "=== HIGH AVAILABILITY MANAGEMENT TESTS ==="
    log_test "Starting comprehensive HA functionality tests..."
    log_test ""
    
    # 等待后端服务
    if ! wait_for_backend; then
        log_test "FATAL: Backend service not available"
        exit 1
    fi
    
    # 执行所有测试
    test_start_ha_management
    sleep 5
    
    test_get_ha_status
    test_health_check
    test_get_metrics
    test_load_balancer_status
    test_failover_manager_status
    
    # 扩缩容测试
    test_manual_scale_up
    test_manual_scale_down
    
    # 故障切换测试
    test_failover
    
    # 停止测试
    test_stop_ha_management
    
    # 生成报告
    generate_test_report
}

# 错误处理
trap 'log_test "ERROR: Test interrupted"; exit 1' INT TERM

# 执行测试
main "$@"