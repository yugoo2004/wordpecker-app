#!/bin/bash

# 远程管理API测试脚本
# 用于验证所有管理API端点的功能

set -e

API_BASE="http://localhost:3000/api/management"
LOG_FILE="./logs/management-api-test.log"

# 创建日志目录
mkdir -p ./logs

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo "$(date): $1" >> "$LOG_FILE"
    echo -e "${BLUE}[$(date)]${NC} $1"
}

success() {
    echo "$(date): SUCCESS - $1" >> "$LOG_FILE"
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo "$(date): ERROR - $1" >> "$LOG_FILE"
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo "$(date): WARNING - $1" >> "$LOG_FILE"
    echo -e "${YELLOW}⚠${NC} $1"
}

# 检查服务是否运行
check_service() {
    if curl -f "$API_BASE/../health" > /dev/null 2>&1; then
        success "后端服务正在运行"
        return 0
    else
        error "后端服务未运行，请先启动服务"
        return 1
    fi
}

# 测试服务状态查询
test_service_status() {
    log "测试服务状态查询..."
    
    local response=$(curl -s "$API_BASE/status")
    local success_field=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success_field" = "true" ]; then
        local service_count=$(echo "$response" | jq '.data | length')
        success "服务状态查询成功，发现 $service_count 个服务"
        
        # 显示服务详情
        echo "$response" | jq -r '.data[] | "  - \(.name): \(.status) (CPU: \(.cpu)%, Memory: \(.memory)MB)"'
    else
        error "服务状态查询失败"
        echo "$response" | jq '.'
        return 1
    fi
}

# 测试系统指标获取
test_system_metrics() {
    log "测试系统指标获取..."
    
    local response=$(curl -s "$API_BASE/metrics")
    local success_field=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success_field" = "true" ]; then
        success "系统指标获取成功"
        
        # 显示关键指标
        local cpu_usage=$(echo "$response" | jq -r '.data.cpu.usage')
        local memory_percentage=$(echo "$response" | jq -r '.data.memory.percentage')
        local disk_percentage=$(echo "$response" | jq -r '.data.disk.percentage')
        
        echo "  - CPU使用率: ${cpu_usage}%"
        echo "  - 内存使用率: ${memory_percentage}%"
        echo "  - 磁盘使用率: ${disk_percentage}"
    else
        error "系统指标获取失败"
        echo "$response" | jq '.'
        return 1
    fi
}

# 测试PM2日志获取
test_pm2_logs() {
    log "测试PM2日志获取..."
    
    local response=$(curl -s "$API_BASE/logs/pm2?lines=10")
    local success_field=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success_field" = "true" ]; then
        success "PM2日志获取成功"
        
        local log_lines=$(echo "$response" | jq -r '.data.logs' | wc -l)
        echo "  - 获取到 $log_lines 行日志"
    else
        error "PM2日志获取失败"
        echo "$response" | jq '.'
        return 1
    fi
}

# 测试日志文件列表
test_log_files() {
    log "测试日志文件列表获取..."
    
    local response=$(curl -s "$API_BASE/logs/files")
    local success_field=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success_field" = "true" ]; then
        local file_count=$(echo "$response" | jq '.data | length')
        success "日志文件列表获取成功，发现 $file_count 个日志文件"
        
        # 显示前5个文件
        echo "$response" | jq -r '.data[:5][] | "  - \(.name) (\(.size) bytes, \(.modified))"'
    else
        warning "日志文件列表获取失败（可能是日志目录不存在）"
        echo "$response" | jq '.'
    fi
}

# 测试服务重启（谨慎操作）
test_service_restart() {
    log "测试服务重启功能..."
    
    # 只测试单个服务的重启，避免影响整个系统
    local response=$(curl -s -X POST "$API_BASE/restart" \
        -H "Content-Type: application/json" \
        -d '{"service": "wordpecker-backend"}')
    
    local success_field=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success_field" = "true" ]; then
        success "服务重启命令执行成功"
        
        # 等待服务重启
        log "等待服务重启完成..."
        sleep 10
        
        # 验证服务是否正常运行
        if curl -f "$API_BASE/../health" > /dev/null 2>&1; then
            success "服务重启后运行正常"
        else
            error "服务重启后无法访问"
            return 1
        fi
    else
        error "服务重启失败"
        echo "$response" | jq '.'
        return 1
    fi
}

# 测试日志清理（使用较短的保留期进行测试）
test_log_cleanup() {
    log "测试日志清理功能..."
    
    local response=$(curl -s -X DELETE "$API_BASE/logs/cleanup" \
        -H "Content-Type: application/json" \
        -d '{"days": 30}')
    
    local success_field=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success_field" = "true" ]; then
        success "日志清理命令执行成功"
    else
        warning "日志清理失败（可能是权限问题）"
        echo "$response" | jq '.'
    fi
}

# 测试实时日志流（简单测试）
test_log_streaming() {
    log "测试实时日志流功能..."
    
    # 启动日志流并在5秒后停止
    timeout 5s curl -s "$API_BASE/logs/tail/wordpecker-backend" > /tmp/log_stream_test.txt 2>/dev/null || true
    
    if [ -s /tmp/log_stream_test.txt ]; then
        local line_count=$(wc -l < /tmp/log_stream_test.txt)
        success "实时日志流测试成功，接收到 $line_count 行数据"
        rm -f /tmp/log_stream_test.txt
    else
        warning "实时日志流测试未接收到数据"
    fi
}

# 性能测试
test_api_performance() {
    log "测试API性能..."
    
    local start_time=$(date +%s%N)
    curl -s "$API_BASE/status" > /dev/null
    local end_time=$(date +%s%N)
    
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    if [ $duration -lt 1000 ]; then
        success "API响应时间: ${duration}ms (优秀)"
    elif [ $duration -lt 3000 ]; then
        success "API响应时间: ${duration}ms (良好)"
    else
        warning "API响应时间: ${duration}ms (需要优化)"
    fi
}

# 主测试流程
main() {
    log "开始远程管理API测试"
    echo "========================================"
    echo "       远程管理API功能测试"
    echo "========================================"
    
    # 检查服务状态
    if ! check_service; then
        exit 1
    fi
    
    local failed_tests=0
    
    # 执行各项测试
    echo
    echo "1. 服务状态和指标测试"
    echo "----------------------------------------"
    test_service_status || ((failed_tests++))
    echo
    test_system_metrics || ((failed_tests++))
    echo
    test_api_performance || ((failed_tests++))
    
    echo
    echo "2. 日志管理测试"
    echo "----------------------------------------"
    test_pm2_logs || ((failed_tests++))
    echo
    test_log_files || ((failed_tests++))
    echo
    test_log_streaming || ((failed_tests++))
    
    echo
    echo "3. 服务控制测试"
    echo "----------------------------------------"
    
    # 询问是否执行服务重启测试
    read -p "是否执行服务重启测试？这会重启后端服务 (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        test_service_restart || ((failed_tests++))
    else
        warning "跳过服务重启测试"
    fi
    
    echo
    echo "4. 维护功能测试"
    echo "----------------------------------------"
    test_log_cleanup || ((failed_tests++))
    
    # 测试总结
    echo
    echo "========================================"
    echo "           测试结果总结"
    echo "========================================"
    
    if [ $failed_tests -eq 0 ]; then
        success "所有测试通过！远程管理API功能正常"
        log "测试完成：所有测试通过"
    else
        error "有 $failed_tests 个测试失败"
        log "测试完成：$failed_tests 个测试失败"
        exit 1
    fi
    
    echo
    echo "API端点列表："
    echo "  - GET  /api/management/status        - 获取服务状态"
    echo "  - GET  /api/management/metrics       - 获取系统指标"
    echo "  - POST /api/management/restart       - 重启服务"
    echo "  - POST /api/management/stop          - 停止服务"
    echo "  - POST /api/management/start         - 启动服务"
    echo "  - POST /api/management/scale         - 扩缩容服务"
    echo "  - GET  /api/management/logs/pm2      - 获取PM2日志"
    echo "  - GET  /api/management/logs/files    - 获取日志文件列表"
    echo "  - GET  /api/management/logs/view/:filename - 查看日志文件"
    echo "  - GET  /api/management/logs/download/:filename - 下载日志文件"
    echo "  - GET  /api/management/logs/tail/:service - 实时日志流"
    echo "  - DELETE /api/management/logs/cleanup - 清理日志文件"
    echo
    echo "详细日志请查看: $LOG_FILE"
}

# 执行主函数
main "$@"