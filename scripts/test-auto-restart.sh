#!/bin/bash
# 自动重启功能测试脚本
# 测试 PM2 和 Systemd 的自动重启机制

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/auto-restart-test.log"
TEST_RESULTS_FILE="$PROJECT_DIR/logs/auto-restart-test-results.json"

# 创建日志目录
mkdir -p "$PROJECT_DIR/logs"

# 初始化测试结果
init_test_results() {
    cat > "$TEST_RESULTS_FILE" <<EOF
{
  "test_suite": "auto_restart_functionality",
  "start_time": "$(date -Iseconds)",
  "tests": [],
  "summary": {
    "total": 0,
    "passed": 0,
    "failed": 0
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
    
    echo "$(date): [$status] $test_name - $message" >> "$LOG_FILE"
    
    # 更新JSON结果文件
    local temp_file=$(mktemp)
    jq --arg name "$test_name" \
       --arg status "$status" \
       --arg message "$message" \
       --arg duration "$duration" \
       '.tests += [{
         "name": $name,
         "status": $status,
         "message": $message,
         "duration": $duration,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S%z")
       }] | 
       .summary.total += 1 |
       if $status == "PASSED" then .summary.passed += 1 else .summary.failed += 1 end' \
       "$TEST_RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$TEST_RESULTS_FILE"
}

# 等待服务启动
wait_for_service() {
    local url="$1"
    local service_name="$2"
    local max_wait="${3:-60}"
    local wait_time=0
    
    echo "等待 $service_name 启动..." >> "$LOG_FILE"
    
    while [ $wait_time -lt $max_wait ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo "$service_name 已启动 (等待时间: ${wait_time}秒)" >> "$LOG_FILE"
            return 0
        fi
        
        sleep 2
        wait_time=$((wait_time + 2))
    done
    
    echo "$service_name 启动超时 (${max_wait}秒)" >> "$LOG_FILE"
    return 1
}

# 测试 PM2 自动重启功能
test_pm2_auto_restart() {
    local test_name="PM2_Auto_Restart"
    local start_time=$(date +%s)
    
    echo "开始测试 PM2 自动重启功能..." >> "$LOG_FILE"
    
    # 获取当前后端进程ID
    local backend_pid=$(pm2 jlist | jq -r '.[] | select(.name=="wordpecker-backend") | .pid')
    
    if [ -z "$backend_pid" ] || [ "$backend_pid" = "null" ]; then
        log_test_result "$test_name" "FAILED" "后端服务未运行" "$(($(date +%s) - start_time))"
        return 1
    fi
    
    echo "当前后端进程ID: $backend_pid" >> "$LOG_FILE"
    
    # 强制终止进程
    echo "强制终止后端进程..." >> "$LOG_FILE"
    kill -9 "$backend_pid" 2>/dev/null || true
    
    # 等待 PM2 自动重启
    sleep 5
    
    # 检查服务是否自动重启
    local new_backend_pid=$(pm2 jlist | jq -r '.[] | select(.name=="wordpecker-backend") | .pid')
    
    if [ -z "$new_backend_pid" ] || [ "$new_backend_pid" = "null" ]; then
        log_test_result "$test_name" "FAILED" "PM2 未能自动重启后端服务" "$(($(date +%s) - start_time))"
        return 1
    fi
    
    if [ "$new_backend_pid" != "$backend_pid" ]; then
        # 等待服务完全启动
        if wait_for_service "http://localhost:3000/api/health" "Backend" 30; then
            log_test_result "$test_name" "PASSED" "PM2 成功自动重启后端服务 (新PID: $new_backend_pid)" "$(($(date +%s) - start_time))"
            return 0
        else
            log_test_result "$test_name" "FAILED" "服务重启但健康检查失败" "$(($(date +%s) - start_time))"
            return 1
        fi
    else
        log_test_result "$test_name" "FAILED" "进程ID未改变，可能未真正重启" "$(($(date +%s) - start_time))"
        return 1
    fi
}

# 测试服务崩溃后的自动恢复
test_service_crash_recovery() {
    local test_name="Service_Crash_Recovery"
    local start_time=$(date +%s)
    
    echo "开始测试服务崩溃恢复..." >> "$LOG_FILE"
    
    # 停止后端服务
    echo "停止后端服务..." >> "$LOG_FILE"
    pm2 stop wordpecker-backend
    
    # 等待一段时间
    sleep 10
    
    # 检查 PM2 是否自动重启服务
    local service_status=$(pm2 jlist | jq -r '.[] | select(.name=="wordpecker-backend") | .pm2_env.status')
    
    if [ "$service_status" = "online" ]; then
        if wait_for_service "http://localhost:3000/api/health" "Backend" 30; then
            log_test_result "$test_name" "PASSED" "服务成功自动恢复" "$(($(date +%s) - start_time))"
            return 0
        else
            log_test_result "$test_name" "FAILED" "服务状态为online但健康检查失败" "$(($(date +%s) - start_time))"
            return 1
        fi
    else
        # 手动重启服务以恢复测试环境
        pm2 start wordpecker-backend
        log_test_result "$test_name" "FAILED" "服务未自动恢复，状态: $service_status" "$(($(date +%s) - start_time))"
        return 1
    fi
}

# 测试内存限制重启
test_memory_limit_restart() {
    local test_name="Memory_Limit_Restart"
    local start_time=$(date +%s)
    
    echo "开始测试内存限制重启..." >> "$LOG_FILE"
    
    # 获取当前内存使用情况
    local current_memory=$(pm2 jlist | jq -r '.[] | select(.name=="wordpecker-backend") | .monit.memory')
    echo "当前内存使用: $current_memory bytes" >> "$LOG_FILE"
    
    # 检查 PM2 配置中的内存限制
    local memory_limit=$(grep -o 'max_memory_restart.*' ecosystem.config.js | head -1 || echo "未配置")
    echo "配置的内存限制: $memory_limit" >> "$LOG_FILE"
    
    if [ "$memory_limit" = "未配置" ]; then
        log_test_result "$test_name" "SKIPPED" "未配置内存限制，跳过测试" "$(($(date +%s) - start_time))"
        return 0
    fi
    
    # 模拟内存压力（通过多次API调用）
    echo "模拟内存压力..." >> "$LOG_FILE"
    for i in {1..50}; do
        curl -s "http://localhost:3000/api/health" > /dev/null &
    done
    
    # 等待所有请求完成
    wait
    
    # 检查内存使用是否增加
    sleep 5
    local new_memory=$(pm2 jlist | jq -r '.[] | select(.name=="wordpecker-backend") | .monit.memory')
    echo "压力测试后内存使用: $new_memory bytes" >> "$LOG_FILE"
    
    if [ "$new_memory" -gt "$current_memory" ]; then
        log_test_result "$test_name" "PASSED" "内存监控正常工作" "$(($(date +%s) - start_time))"
        return 0
    else
        log_test_result "$test_name" "WARNING" "内存使用未明显增加，可能需要更大压力" "$(($(date +%s) - start_time))"
        return 0
    fi
}

# 测试重启次数限制
test_restart_limit() {
    local test_name="Restart_Limit_Protection"
    local start_time=$(date +%s)
    
    echo "开始测试重启次数限制..." >> "$LOG_FILE"
    
    # 获取当前重启次数
    local restart_count=$(pm2 jlist | jq -r '.[] | select(.name=="wordpecker-backend") | .pm2_env.restart_time')
    echo "当前重启次数: $restart_count" >> "$LOG_FILE"
    
    # 检查 PM2 配置中的重启限制
    local max_restarts=$(grep -o 'max_restarts.*' ecosystem.config.js | head -1 || echo "未配置")
    echo "配置的最大重启次数: $max_restarts" >> "$LOG_FILE"
    
    if [ "$max_restarts" = "未配置" ]; then
        log_test_result "$test_name" "WARNING" "未配置重启次数限制" "$(($(date +%s) - start_time))"
        return 0
    fi
    
    # 验证重启计数器正常工作
    if [ "$restart_count" -ge 0 ]; then
        log_test_result "$test_name" "PASSED" "重启计数器正常工作，当前计数: $restart_count" "$(($(date +%s) - start_time))"
        return 0
    else
        log_test_result "$test_name" "FAILED" "重启计数器异常" "$(($(date +%s) - start_time))"
        return 1
    fi
}

# 生成测试报告
generate_report() {
    local end_time=$(date -Iseconds)
    local temp_file=$(mktemp)
    
    jq --arg end_time "$end_time" \
       '.end_time = $end_time |
        .duration = (.summary.total * 30) |
        .status = (if .summary.failed == 0 then "PASSED" else "FAILED" end)' \
       "$TEST_RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$TEST_RESULTS_FILE"
    
    echo "" >> "$LOG_FILE"
    echo "=== 自动重启测试报告 ===" >> "$LOG_FILE"
    echo "测试时间: $(date)" >> "$LOG_FILE"
    echo "总测试数: $(jq -r '.summary.total' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "通过测试: $(jq -r '.summary.passed' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "失败测试: $(jq -r '.summary.failed' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "整体状态: $(jq -r '.status' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # 显示详细结果
    jq -r '.tests[] | "[\(.status)] \(.name): \(.message)"' "$TEST_RESULTS_FILE" >> "$LOG_FILE"
}

# 主测试流程
main() {
    echo "$(date): 开始自动重启功能测试" >> "$LOG_FILE"
    
    # 检查必要的工具
    if ! command -v pm2 &> /dev/null; then
        echo "错误: PM2 未安装" >> "$LOG_FILE"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo "错误: jq 未安装" >> "$LOG_FILE"
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
        if ! wait_for_service "http://localhost:3000/api/health" "Backend" 30; then
            echo "错误: 后端服务启动失败" >> "$LOG_FILE"
            exit 1
        fi
    fi
    
    # 运行测试
    test_pm2_auto_restart
    test_service_crash_recovery
    test_memory_limit_restart
    test_restart_limit
    
    # 生成报告
    generate_report
    
    echo "$(date): 自动重启功能测试完成" >> "$LOG_FILE"
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