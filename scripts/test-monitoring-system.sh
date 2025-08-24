#!/bin/bash
# 监控系统持续测试和报告脚本
# 综合测试整个监控体系的功能和可靠性

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/monitoring-system-test.log"
TEST_RESULTS_FILE="$PROJECT_DIR/logs/monitoring-system-test-results.json"
REPORT_FILE="$PROJECT_DIR/logs/monitoring-test-report.html"

# 创建日志目录
mkdir -p "$PROJECT_DIR/logs"

# 初始化测试结果
init_test_results() {
    cat > "$TEST_RESULTS_FILE" <<EOF
{
  "test_suite": "monitoring_system_continuous",
  "start_time": "$(date -Iseconds)",
  "tests": [],
  "metrics": {
    "system_performance": {},
    "service_availability": {},
    "response_times": {}
  },
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
    local metrics="${5:-{}}"
    
    echo "$(date): [$status] $test_name - $message" >> "$LOG_FILE"
    
    # 更新JSON结果文件
    local temp_file=$(mktemp)
    jq --arg name "$test_name" \
       --arg status "$status" \
       --arg message "$message" \
       --arg duration "$duration" \
       --argjson metrics "$metrics" \
       '.tests += [{
         "name": $name,
         "status": $status,
         "message": $message,
         "duration": $duration,
         "metrics": $metrics,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S%z")
       }] | 
       .summary.total += 1 |
       if $status == "PASSED" then .summary.passed += 1 
       elif $status == "WARNING" then .summary.warnings += 1 
       else .summary.failed += 1 end' \
       "$TEST_RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$TEST_RESULTS_FILE"
}

# 获取系统性能指标
get_system_metrics() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}' | tr -d ' ')
    local memory_info=$(free | grep Mem)
    local memory_total=$(echo "$memory_info" | awk '{print $2}')
    local memory_used=$(echo "$memory_info" | awk '{print $3}')
    local memory_percent=$(echo "scale=2; $memory_used * 100 / $memory_total" | bc)
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
    
    cat <<EOF
{
  "cpu_percent": $cpu_usage,
  "memory_percent": $memory_percent,
  "memory_used_mb": $(echo "scale=0; $memory_used / 1024" | bc),
  "memory_total_mb": $(echo "scale=0; $memory_total / 1024" | bc),
  "disk_percent": $disk_usage,
  "load_average": $load_avg,
  "timestamp": "$(date -Iseconds)"
}
EOF
}

# 获取服务性能指标
get_service_metrics() {
    local service_name="$1"
    
    if ! pm2 list | grep -q "$service_name.*online"; then
        echo '{"status": "offline", "error": "Service not running"}'
        return
    fi
    
    local pm2_info=$(pm2 jlist | jq ".[] | select(.name==\"$service_name\")")
    
    if [ -z "$pm2_info" ]; then
        echo '{"status": "not_found", "error": "Service not found in PM2"}'
        return
    fi
    
    local memory_mb=$(echo "$pm2_info" | jq -r '.monit.memory // 0' | awk '{print int($1/1024/1024)}')
    local cpu_percent=$(echo "$pm2_info" | jq -r '.monit.cpu // 0')
    local uptime=$(echo "$pm2_info" | jq -r '.pm2_env.pm_uptime // 0')
    local restart_count=$(echo "$pm2_info" | jq -r '.pm2_env.restart_time // 0')
    local status=$(echo "$pm2_info" | jq -r '.pm2_env.status // "unknown"')
    
    cat <<EOF
{
  "status": "$status",
  "memory_mb": $memory_mb,
  "cpu_percent": $cpu_percent,
  "uptime_ms": $uptime,
  "restart_count": $restart_count,
  "timestamp": "$(date -Iseconds)"
}
EOF
}

# 测试响应时间
measure_response_time() {
    local url="$1"
    local timeout="${2:-5}"
    
    local start_time=$(date +%s%3N)
    local http_code=$(curl -s -w "%{http_code}" --max-time "$timeout" "$url" -o /dev/null 2>/dev/null || echo "000")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    cat <<EOF
{
  "url": "$url",
  "http_code": "$http_code",
  "response_time_ms": $response_time,
  "success": $([ "$http_code" = "200" ] && echo "true" || echo "false"),
  "timestamp": "$(date -Iseconds)"
}
EOF
}

# 测试系统资源监控
test_system_resource_monitoring() {
    local test_name="System_Resource_Monitoring"
    local start_time=$(date +%s)
    
    echo "开始测试系统资源监控..." >> "$LOG_FILE"
    
    # 获取系统指标
    local metrics=$(get_system_metrics)
    local cpu_percent=$(echo "$metrics" | jq -r '.cpu_percent')
    local memory_percent=$(echo "$metrics" | jq -r '.memory_percent')
    local disk_percent=$(echo "$metrics" | jq -r '.disk_percent')
    
    echo "系统资源使用情况: CPU: ${cpu_percent}%, 内存: ${memory_percent}%, 磁盘: ${disk_percent}%" >> "$LOG_FILE"
    
    # 检查资源使用是否在合理范围内
    local status="PASSED"
    local message="系统资源监控正常"
    
    if (( $(echo "$cpu_percent > 90" | bc -l) )); then
        status="WARNING"
        message="CPU使用率过高: ${cpu_percent}%"
    elif (( $(echo "$memory_percent > 90" | bc -l) )); then
        status="WARNING"
        message="内存使用率过高: ${memory_percent}%"
    elif [ "$disk_percent" -gt 90 ]; then
        status="WARNING"
        message="磁盘使用率过高: ${disk_percent}%"
    fi
    
    log_test_result "$test_name" "$status" "$message" "$(($(date +%s) - start_time))" "$metrics"
}

# 测试服务性能监控
test_service_performance_monitoring() {
    local test_name="Service_Performance_Monitoring"
    local start_time=$(date +%s)
    
    echo "开始测试服务性能监控..." >> "$LOG_FILE"
    
    # 监控后端服务
    local backend_metrics=$(get_service_metrics "wordpecker-backend")
    local backend_status=$(echo "$backend_metrics" | jq -r '.status')
    local backend_memory=$(echo "$backend_metrics" | jq -r '.memory_mb')
    local backend_cpu=$(echo "$backend_metrics" | jq -r '.cpu_percent')
    
    # 监控前端服务
    local frontend_metrics=$(get_service_metrics "wordpecker-frontend")
    local frontend_status=$(echo "$frontend_metrics" | jq -r '.status')
    
    echo "后端服务状态: $backend_status, 内存: ${backend_memory}MB, CPU: ${backend_cpu}%" >> "$LOG_FILE"
    echo "前端服务状态: $frontend_status" >> "$LOG_FILE"
    
    local combined_metrics=$(jq -n \
        --argjson backend "$backend_metrics" \
        --argjson frontend "$frontend_metrics" \
        '{"backend": $backend, "frontend": $frontend}')
    
    if [ "$backend_status" = "online" ] && [ "$frontend_status" = "online" ]; then
        log_test_result "$test_name" "PASSED" "服务性能监控正常" "$(($(date +%s) - start_time))" "$combined_metrics"
    else
        log_test_result "$test_name" "FAILED" "部分服务状态异常" "$(($(date +%s) - start_time))" "$combined_metrics"
    fi
}

# 测试响应时间监控
test_response_time_monitoring() {
    local test_name="Response_Time_Monitoring"
    local start_time=$(date +%s)
    
    echo "开始测试响应时间监控..." >> "$LOG_FILE"
    
    # 测试多个端点的响应时间
    local health_response=$(measure_response_time "http://localhost:3000/api/health")
    local ready_response=$(measure_response_time "http://localhost:3000/api/ready")
    local frontend_response=$(measure_response_time "http://localhost:5173")
    
    local health_time=$(echo "$health_response" | jq -r '.response_time_ms')
    local ready_time=$(echo "$ready_response" | jq -r '.response_time_ms')
    local frontend_time=$(echo "$frontend_response" | jq -r '.response_time_ms')
    
    echo "响应时间 - Health: ${health_time}ms, Ready: ${ready_time}ms, Frontend: ${frontend_time}ms" >> "$LOG_FILE"
    
    local combined_responses=$(jq -n \
        --argjson health "$health_response" \
        --argjson ready "$ready_response" \
        --argjson frontend "$frontend_response" \
        '{"health": $health, "ready": $ready, "frontend": $frontend}')
    
    # 检查响应时间是否在可接受范围内
    local status="PASSED"
    local message="响应时间监控正常"
    
    if [ "$health_time" -gt 5000 ] || [ "$ready_time" -gt 5000 ] || [ "$frontend_time" -gt 5000 ]; then
        status="WARNING"
        message="部分端点响应时间过长"
    fi
    
    local health_success=$(echo "$health_response" | jq -r '.success')
    local ready_success=$(echo "$ready_response" | jq -r '.success')
    local frontend_success=$(echo "$frontend_response" | jq -r '.success')
    
    if [ "$health_success" != "true" ] || [ "$ready_success" != "true" ] || [ "$frontend_success" != "true" ]; then
        status="FAILED"
        message="部分端点无法访问"
    fi
    
    log_test_result "$test_name" "$status" "$message" "$(($(date +%s) - start_time))" "$combined_responses"
}

# 测试日志监控
test_log_monitoring() {
    local test_name="Log_Monitoring"
    local start_time=$(date +%s)
    
    echo "开始测试日志监控..." >> "$LOG_FILE"
    
    # 检查日志文件是否存在和可访问
    local log_files=(
        "$PROJECT_DIR/logs/pm2-backend-combined.log"
        "$PROJECT_DIR/logs/pm2-frontend-combined.log"
        "$PROJECT_DIR/backend/logs/combined.log"
        "$PROJECT_DIR/backend/logs/error.log"
    )
    
    local log_status=()
    local total_size=0
    
    for log_file in "${log_files[@]}"; do
        if [ -f "$log_file" ]; then
            local size=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo "0")
            total_size=$((total_size + size))
            log_status+=("$(basename "$log_file"): ${size} bytes")
            echo "日志文件 $(basename "$log_file"): ${size} bytes" >> "$LOG_FILE"
        else
            log_status+=("$(basename "$log_file"): 不存在")
            echo "日志文件 $(basename "$log_file"): 不存在" >> "$LOG_FILE"
        fi
    done
    
    # 检查最近的错误日志
    local recent_errors=0
    if [ -f "$PROJECT_DIR/backend/logs/error.log" ]; then
        recent_errors=$(tail -n 100 "$PROJECT_DIR/backend/logs/error.log" 2>/dev/null | wc -l || echo "0")
    fi
    
    local log_metrics=$(jq -n \
        --arg total_size "$total_size" \
        --arg recent_errors "$recent_errors" \
        --argjson files "$(printf '%s\n' "${log_status[@]}" | jq -R . | jq -s .)" \
        '{
            "total_log_size_bytes": ($total_size | tonumber),
            "recent_error_lines": ($recent_errors | tonumber),
            "log_files": $files,
            "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S%z")
        }')
    
    local status="PASSED"
    local message="日志监控正常"
    
    if [ "$total_size" -eq 0 ]; then
        status="WARNING"
        message="没有找到日志文件"
    elif [ "$recent_errors" -gt 50 ]; then
        status="WARNING"
        message="最近错误日志较多: $recent_errors 行"
    fi
    
    log_test_result "$test_name" "$status" "$message" "$(($(date +%s) - start_time))" "$log_metrics"
}

# 测试监控脚本的可用性
test_monitoring_scripts() {
    local test_name="Monitoring_Scripts_Availability"
    local start_time=$(date +%s)
    
    echo "开始测试监控脚本可用性..." >> "$LOG_FILE"
    
    local scripts=(
        "$PROJECT_DIR/scripts/health-check.sh"
        "$PROJECT_DIR/scripts/resource-monitor.sh"
        "$PROJECT_DIR/scripts/resource-protection.sh"
        "$PROJECT_DIR/scripts/test-auto-restart.sh"
        "$PROJECT_DIR/scripts/test-health-recovery.sh"
    )
    
    local script_status=()
    local available_count=0
    local executable_count=0
    
    for script in "${scripts[@]}"; do
        local script_name=$(basename "$script")
        if [ -f "$script" ]; then
            available_count=$((available_count + 1))
            if [ -x "$script" ]; then
                executable_count=$((executable_count + 1))
                script_status+=("$script_name: 可用且可执行")
                echo "监控脚本 $script_name: 可用且可执行" >> "$LOG_FILE"
            else
                script_status+=("$script_name: 可用但不可执行")
                echo "监控脚本 $script_name: 可用但不可执行" >> "$LOG_FILE"
            fi
        else
            script_status+=("$script_name: 不存在")
            echo "监控脚本 $script_name: 不存在" >> "$LOG_FILE"
        fi
    done
    
    local script_metrics=$(jq -n \
        --arg total "${#scripts[@]}" \
        --arg available "$available_count" \
        --arg executable "$executable_count" \
        --argjson status "$(printf '%s\n' "${script_status[@]}" | jq -R . | jq -s .)" \
        '{
            "total_scripts": ($total | tonumber),
            "available_scripts": ($available | tonumber),
            "executable_scripts": ($executable | tonumber),
            "script_status": $status,
            "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S%z")
        }')
    
    local status="PASSED"
    local message="监控脚本检查完成"
    
    if [ "$available_count" -lt "${#scripts[@]}" ]; then
        status="WARNING"
        message="部分监控脚本缺失 ($available_count/${#scripts[@]})"
    elif [ "$executable_count" -lt "$available_count" ]; then
        status="WARNING"
        message="部分脚本不可执行 ($executable_count/$available_count)"
    fi
    
    log_test_result "$test_name" "$status" "$message" "$(($(date +%s) - start_time))" "$script_metrics"
}

# 持续监控测试（运行指定时间）
run_continuous_monitoring() {
    local duration="${1:-300}"  # 默认5分钟
    local interval="${2:-30}"   # 默认30秒间隔
    
    local test_name="Continuous_Monitoring_${duration}s"
    local start_time=$(date +%s)
    
    echo "开始持续监控测试，持续时间: ${duration}秒，间隔: ${interval}秒" >> "$LOG_FILE"
    
    local samples=()
    local end_time=$((start_time + duration))
    
    while [ $(date +%s) -lt $end_time ]; do
        local sample_time=$(date +%s)
        local system_metrics=$(get_system_metrics)
        local backend_metrics=$(get_service_metrics "wordpecker-backend")
        local health_response=$(measure_response_time "http://localhost:3000/api/health")
        
        local sample=$(jq -n \
            --argjson system "$system_metrics" \
            --argjson backend "$backend_metrics" \
            --argjson health "$health_response" \
            --arg sample_time "$sample_time" \
            '{
                "sample_time": ($sample_time | tonumber),
                "system": $system,
                "backend": $backend,
                "health": $health
            }')
        
        samples+=("$sample")
        
        echo "监控样本 $(date): CPU: $(echo "$system_metrics" | jq -r '.cpu_percent')%, 内存: $(echo "$system_metrics" | jq -r '.memory_percent')%, 响应时间: $(echo "$health_response" | jq -r '.response_time_ms')ms" >> "$LOG_FILE"
        
        sleep "$interval"
    done
    
    # 分析持续监控数据
    local sample_count=${#samples[@]}
    local avg_cpu=0
    local avg_memory=0
    local avg_response_time=0
    local max_response_time=0
    local failed_requests=0
    
    for sample in "${samples[@]}"; do
        local cpu=$(echo "$sample" | jq -r '.system.cpu_percent // 0')
        local memory=$(echo "$sample" | jq -r '.system.memory_percent // 0')
        local response_time=$(echo "$sample" | jq -r '.health.response_time_ms // 0')
        local success=$(echo "$sample" | jq -r '.health.success // false')
        
        avg_cpu=$(echo "scale=2; $avg_cpu + $cpu" | bc)
        avg_memory=$(echo "scale=2; $avg_memory + $memory" | bc)
        avg_response_time=$(echo "scale=2; $avg_response_time + $response_time" | bc)
        
        if [ "$response_time" -gt "$max_response_time" ]; then
            max_response_time=$response_time
        fi
        
        if [ "$success" != "true" ]; then
            failed_requests=$((failed_requests + 1))
        fi
    done
    
    if [ "$sample_count" -gt 0 ]; then
        avg_cpu=$(echo "scale=2; $avg_cpu / $sample_count" | bc)
        avg_memory=$(echo "scale=2; $avg_memory / $sample_count" | bc)
        avg_response_time=$(echo "scale=2; $avg_response_time / $sample_count" | bc)
    fi
    
    local continuous_metrics=$(jq -n \
        --arg duration "$duration" \
        --arg interval "$interval" \
        --arg sample_count "$sample_count" \
        --arg avg_cpu "$avg_cpu" \
        --arg avg_memory "$avg_memory" \
        --arg avg_response_time "$avg_response_time" \
        --arg max_response_time "$max_response_time" \
        --arg failed_requests "$failed_requests" \
        '{
            "duration_seconds": ($duration | tonumber),
            "interval_seconds": ($interval | tonumber),
            "sample_count": ($sample_count | tonumber),
            "avg_cpu_percent": ($avg_cpu | tonumber),
            "avg_memory_percent": ($avg_memory | tonumber),
            "avg_response_time_ms": ($avg_response_time | tonumber),
            "max_response_time_ms": ($max_response_time | tonumber),
            "failed_requests": ($failed_requests | tonumber),
            "success_rate": (($sample_count - ($failed_requests | tonumber)) * 100 / ($sample_count | tonumber))
        }')
    
    local status="PASSED"
    local message="持续监控测试完成"
    local success_rate=$(echo "$continuous_metrics" | jq -r '.success_rate')
    
    if [ "$failed_requests" -gt 0 ]; then
        status="WARNING"
        message="持续监控期间有 $failed_requests 次失败请求"
    fi
    
    if (( $(echo "$success_rate < 95" | bc -l) )); then
        status="FAILED"
        message="成功率过低: ${success_rate}%"
    fi
    
    log_test_result "$test_name" "$status" "$message" "$(($(date +%s) - start_time))" "$continuous_metrics"
}

# 生成HTML报告
generate_html_report() {
    local test_data=$(cat "$TEST_RESULTS_FILE")
    
    cat > "$REPORT_FILE" <<EOF
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>监控系统测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .number { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .warning { color: #ffc107; }
        .test-results { margin-bottom: 30px; }
        .test-item { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 6px; border-left: 4px solid #ddd; }
        .test-item.passed { border-left-color: #28a745; }
        .test-item.failed { border-left-color: #dc3545; }
        .test-item.warning { border-left-color: #ffc107; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .test-name { font-weight: bold; }
        .test-status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status-passed { background-color: #28a745; }
        .status-failed { background-color: #dc3545; }
        .status-warning { background-color: #ffc107; }
        .metrics { background: #e9ecef; padding: 10px; border-radius: 4px; margin-top: 10px; font-family: monospace; font-size: 0.9em; }
        .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
        .chart { background: #f8f9fa; padding: 15px; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>监控系统测试报告</h1>
            <p>生成时间: $(date)</p>
            <p>测试套件: $(echo "$test_data" | jq -r '.test_suite')</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>总测试数</h3>
                <div class="number">$(echo "$test_data" | jq -r '.summary.total')</div>
            </div>
            <div class="summary-card">
                <h3>通过测试</h3>
                <div class="number passed">$(echo "$test_data" | jq -r '.summary.passed')</div>
            </div>
            <div class="summary-card">
                <h3>警告测试</h3>
                <div class="number warning">$(echo "$test_data" | jq -r '.summary.warnings')</div>
            </div>
            <div class="summary-card">
                <h3>失败测试</h3>
                <div class="number failed">$(echo "$test_data" | jq -r '.summary.failed')</div>
            </div>
        </div>
        
        <div class="test-results">
            <h2>测试结果详情</h2>
EOF

    # 添加每个测试的详细结果
    echo "$test_data" | jq -r '.tests[] | @base64' | while read -r test; do
        local test_info=$(echo "$test" | base64 -d)
        local name=$(echo "$test_info" | jq -r '.name')
        local status=$(echo "$test_info" | jq -r '.status')
        local message=$(echo "$test_info" | jq -r '.message')
        local duration=$(echo "$test_info" | jq -r '.duration')
        local timestamp=$(echo "$test_info" | jq -r '.timestamp')
        local metrics=$(echo "$test_info" | jq -r '.metrics // {}')
        
        local status_class=$(echo "$status" | tr '[:upper:]' '[:lower:]')
        
        cat >> "$REPORT_FILE" <<EOF
            <div class="test-item $status_class">
                <div class="test-header">
                    <span class="test-name">$name</span>
                    <span class="test-status status-$status_class">$status</span>
                </div>
                <div class="test-message">$message</div>
                <div class="test-meta">
                    <small>执行时间: ${duration}秒 | 时间戳: $timestamp</small>
                </div>
EOF
        
        if [ "$metrics" != "{}" ] && [ "$metrics" != "null" ]; then
            cat >> "$REPORT_FILE" <<EOF
                <div class="metrics">
                    <strong>性能指标:</strong><br>
                    <pre>$(echo "$metrics" | jq .)</pre>
                </div>
EOF
        fi
        
        cat >> "$REPORT_FILE" <<EOF
            </div>
EOF
    done

    cat >> "$REPORT_FILE" <<EOF
        </div>
        
        <div class="charts">
            <div class="chart">
                <h3>测试执行时间分布</h3>
                <p>各测试项目的执行时间统计</p>
            </div>
            <div class="chart">
                <h3>系统性能趋势</h3>
                <p>监控期间的系统资源使用情况</p>
            </div>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
            <p>WordPecker 持续服务部署 - 监控系统测试报告</p>
        </div>
    </div>
</body>
</html>
EOF
}

# 生成测试报告
generate_report() {
    local end_time=$(date -Iseconds)
    local temp_file=$(mktemp)
    
    jq --arg end_time "$end_time" \
       '.end_time = $end_time |
        .duration = (.summary.total * 45) |
        .status = (if .summary.failed == 0 then "PASSED" else "FAILED" end)' \
       "$TEST_RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$TEST_RESULTS_FILE"
    
    echo "" >> "$LOG_FILE"
    echo "=== 监控系统测试报告 ===" >> "$LOG_FILE"
    echo "测试时间: $(date)" >> "$LOG_FILE"
    echo "总测试数: $(jq -r '.summary.total' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "通过测试: $(jq -r '.summary.passed' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "警告测试: $(jq -r '.summary.warnings' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "失败测试: $(jq -r '.summary.failed' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "整体状态: $(jq -r '.status' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # 显示详细结果
    jq -r '.tests[] | "[\(.status)] \(.name): \(.message)"' "$TEST_RESULTS_FILE" >> "$LOG_FILE"
    
    # 生成HTML报告
    generate_html_report
    
    echo "" >> "$LOG_FILE"
    echo "HTML报告已生成: $REPORT_FILE" >> "$LOG_FILE"
}

# 主测试流程
main() {
    local continuous_duration="${1:-60}"  # 默认1分钟持续监控
    
    echo "$(date): 开始监控系统持续测试" >> "$LOG_FILE"
    
    # 检查必要的工具
    for tool in curl jq pm2 bc; do
        if ! command -v "$tool" &> /dev/null; then
            echo "错误: $tool 未安装" >> "$LOG_FILE"
            exit 1
        fi
    done
    
    # 初始化测试结果
    init_test_results
    
    # 确保服务正在运行
    if ! pm2 list | grep -q "wordpecker-backend.*online"; then
        echo "启动后端服务..." >> "$LOG_FILE"
        pm2 start wordpecker-backend || {
            echo "错误: 无法启动后端服务" >> "$LOG_FILE"
            exit 1
        }
        sleep 10
    fi
    
    # 运行监控测试
    test_system_resource_monitoring
    test_service_performance_monitoring
    test_response_time_monitoring
    test_log_monitoring
    test_monitoring_scripts
    
    # 运行持续监控测试
    if [ "$continuous_duration" -gt 0 ]; then
        run_continuous_monitoring "$continuous_duration" 10
    fi
    
    # 生成报告
    generate_report
    
    echo "$(date): 监控系统持续测试完成" >> "$LOG_FILE"
    echo "测试结果已保存到: $TEST_RESULTS_FILE"
    echo "HTML报告已生成: $REPORT_FILE"
    
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
fi{ background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 6px; border-left: 4px solid #ddd; }
        .test-item.passed { border-left-color: #28a745; }
        .test-item.failed { border-left-color: #dc3545; }
        .test-item.warning { border-left-color: #ffc107; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .test-name { font-weight: bold; }
        .test-status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status-passed { background-color: #28a745; }
        .status-failed { background-color: #dc3545; }
        .status-warning { background-color: #ffc107; }
        .metrics-section { margin-top: 30px; }
        .chart-container { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>WordPecker 监控系统测试报告</h1>
            <p>生成时间: $(date)</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>总测试数</h3>
                <div class="number">$(echo "$test_data" | jq -r '.summary.total')</div>
            </div>
            <div class="summary-card">
                <h3>通过测试</h3>
                <div class="number passed">$(echo "$test_data" | jq -r '.summary.passed')</div>
            </div>
            <div class="summary-card">
                <h3>警告测试</h3>
                <div class="number warning">$(echo "$test_data" | jq -r '.summary.warnings')</div>
            </div>
            <div class="summary-card">
                <h3>失败测试</h3>
                <div class="number failed">$(echo "$test_data" | jq -r '.summary.failed')</div>
            </div>
        </div>
        
        <div class="test-results">
            <h2>测试结果详情</h2>
EOF

    # 添加测试结果
    echo "$test_data" | jq -r '.tests[] | @base64' | while read -r test; do
        local test_info=$(echo "$test" | base64 -d)
        local name=$(echo "$test_info" | jq -r '.name')
        local status=$(echo "$test_info" | jq -r '.status')
        local message=$(echo "$test_info" | jq -r '.message')
        local duration=$(echo "$test_info" | jq -r '.duration')
        local timestamp=$(echo "$test_info" | jq -r '.timestamp')
        
        local status_class=$(echo "$status" | tr '[:upper:]' '[:lower:]')
        
        cat >> "$REPORT_FILE" <<EOF
            <div class="test-item $status_class">
                <div class="test-header">
                    <span class="test-name">$name</span>
                    <span class="test-status status-$status_class">$status</span>
                </div>
                <div class="test-message">$message</div>
                <div class="test-meta">
                    <small>执行时间: ${duration}秒 | 时间戳: $timestamp</small>
                </div>
            </div>
EOF
    done

    cat >> "$REPORT_FILE" <<EOF
        </div>
        
        <div class="metrics-section">
            <h2>系统性能指标</h2>
            <div class="chart-container">
                <h3>系统资源使用情况</h3>
                <div class="metric-grid">
EOF

    # 添加性能指标摘要
    local avg_cpu=$(echo "$test_data" | jq -r '[.metrics.system_performance[].system.cpu_usage] | add / length' 2>/dev/null || echo "N/A")
    local avg_memory=$(echo "$test_data" | jq -r '[.metrics.system_performance[].system.memory_usage] | add / length' 2>/dev/null || echo "N/A")
    local avg_disk=$(echo "$test_data" | jq -r '[.metrics.system_performance[].system.disk_usage] | add / length' 2>/dev/null || echo "N/A")

    cat >> "$REPORT_FILE" <<EOF
                    <div>
                        <h4>平均 CPU 使用率</h4>
                        <div class="number">$avg_cpu%</div>
                    </div>
                    <div>
                        <h4>平均内存使用率</h4>
                        <div class="number">$avg_memory%</div>
                    </div>
                    <div>
                        <h4>平均磁盘使用率</h4>
                        <div class="number">$avg_disk%</div>
                    </div>
                </div>
            </div>
            
            <div class="chart-container">
                <h3>服务可用性统计</h3>
                <div class="metric-grid">
EOF

    # 添加可用性统计
    local total_checks=$(echo "$test_data" | jq -r '.metrics.service_availability | length' 2>/dev/null || echo "0")
    local backend_available=$(echo "$test_data" | jq -r '[.metrics.service_availability[] | select(.backend.available == true)] | length' 2>/dev/null || echo "0")
    local frontend_available=$(echo "$test_data" | jq -r '[.metrics.service_availability[] | select(.frontend.available == true)] | length' 2>/dev/null || echo "0")

    local backend_rate="N/A"
    local frontend_rate="N/A"
    
    if [ "$total_checks" -gt 0 ]; then
        backend_rate=$(echo "scale=2; ($backend_available * 100) / $total_checks" | bc)
        frontend_rate=$(echo "scale=2; ($frontend_available * 100) / $total_checks" | bc)
    fi

    cat >> "$REPORT_FILE" <<EOF
                    <div>
                        <h4>后端服务可用率</h4>
                        <div class="number">$backend_rate%</div>
                    </div>
                    <div>
                        <h4>前端服务可用率</h4>
                        <div class="number">$frontend_rate%</div>
                    </div>
                    <div>
                        <h4>总检查次数</h4>
                        <div class="number">$total_checks</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p><small>报告由 WordPecker 监控测试系统自动生成</small></p>
        </div>
    </div>
</body>
</html>
EOF
}

# 生成测试报告
generate_report() {
    local end_time=$(date -Iseconds)
    local temp_file=$(mktemp)
    
    jq --arg end_time "$end_time" \
       '.end_time = $end_time |
        .total_duration = (now - (.start_time | fromdateiso8601)) |
        .status = (if .summary.failed == 0 then "PASSED" else "FAILED" end)' \
       "$TEST_RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$TEST_RESULTS_FILE"
    
    echo "" >> "$LOG_FILE"
    echo "=== 监控系统综合测试报告 ===" >> "$LOG_FILE"
    echo "测试时间: $(date)" >> "$LOG_FILE"
    echo "总测试数: $(jq -r '.summary.total' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "通过测试: $(jq -r '.summary.passed' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "警告测试: $(jq -r '.summary.warnings' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "失败测试: $(jq -r '.summary.failed' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "整体状态: $(jq -r '.status' "$TEST_RESULTS_FILE")" >> "$LOG_FILE"
    echo "总持续时间: $(jq -r '.total_duration' "$TEST_RESULTS_FILE")秒" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # 显示详细结果
    jq -r '.tests[] | "[\(.status)] \(.name): \(.message)"' "$TEST_RESULTS_FILE" >> "$LOG_FILE"
    
    # 生成HTML报告
    generate_html_report
    
    echo "" >> "$LOG_FILE"
    echo "HTML报告已生成: $REPORT_FILE" >> "$LOG_FILE"
}

# 主测试流程
main() {
    echo "$(date): 开始监控系统综合测试" >> "$LOG_FILE"
    
    # 检查必要的工具
    local required_tools=("curl" "jq" "pm2" "bc")
    for tool in 