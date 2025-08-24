#!/bin/bash

# WordPecker Systemd 服务测试脚本
# 用于测试系统级服务的启动、停止和重启功能

set -e

# 配置变量
SERVICE_NAME="wordpecker"
PROJECT_DIR="/home/devbox/wordpecker-app"
TEST_LOG="./logs/systemd-test.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 创建日志目录
mkdir -p ./logs

# 日志函数
log_info() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
    echo -e "${GREEN}$msg${NC}"
    echo "$msg" >> "$TEST_LOG"
}

log_warn() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1"
    echo -e "${YELLOW}$msg${NC}"
    echo "$msg" >> "$TEST_LOG"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1"
    echo -e "${RED}$msg${NC}"
    echo "$msg" >> "$TEST_LOG"
}

log_test() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [TEST] $1"
    echo -e "${BLUE}$msg${NC}"
    echo "$msg" >> "$TEST_LOG"
}

# 检查是否以root权限运行
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
}

# 检查服务是否存在
check_service_exists() {
    if ! systemctl list-unit-files | grep -q "$SERVICE_NAME.service"; then
        log_error "服务 $SERVICE_NAME 不存在，请先运行 setup-systemd.sh"
        exit 1
    fi
    log_info "服务 $SERVICE_NAME 已安装"
}# 等待服务状态变化

wait_for_service_state() {
    local expected_state=$1
    local timeout=${2:-30}
    local count=0
    
    log_info "等待服务状态变为: $expected_state (超时: ${timeout}秒)"
    
    while [ $count -lt $timeout ]; do
        if systemctl is-$expected_state --quiet "$SERVICE_NAME"; then
            log_info "服务状态已变为: $expected_state"
            return 0
        fi
        sleep 1
        ((count++))
    done
    
    log_error "等待服务状态超时: $expected_state"
    return 1
}

# 检查应用端点
check_application_endpoints() {
    local backend_url="http://localhost:3000/api/health"
    local frontend_url="http://localhost:5173"
    local timeout=60
    local count=0
    
    log_info "检查应用端点可用性..."
    
    # 检查后端健康端点
    while [ $count -lt $timeout ]; do
        if curl -f -s "$backend_url" > /dev/null 2>&1; then
            log_info "✓ 后端服务可用: $backend_url"
            break
        fi
        sleep 2
        ((count+=2))
    done
    
    if [ $count -ge $timeout ]; then
        log_warn "后端服务检查超时"
        return 1
    fi
    
    # 检查前端服务
    count=0
    while [ $count -lt $timeout ]; do
        if curl -f -s "$frontend_url" > /dev/null 2>&1; then
            log_info "✓ 前端服务可用: $frontend_url"
            return 0
        fi
        sleep 2
        ((count+=2))
    done
    
    log_warn "前端服务检查超时"
    return 1
}

# 测试服务启动
test_service_start() {
    log_test "测试服务启动功能..."
    
    # 确保服务已停止
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "停止现有服务..."
        systemctl stop "$SERVICE_NAME"
        wait_for_service_state "inactive" 15
    fi
    
    # 启动服务
    log_info "启动服务..."
    systemctl start "$SERVICE_NAME"
    
    # 等待服务激活
    if wait_for_service_state "active" 30; then
        log_info "✓ 服务启动测试通过"
        return 0
    else
        log_error "✗ 服务启动测试失败"
        systemctl status "$SERVICE_NAME" --no-pager
        return 1
    fi
}#
 测试服务停止
test_service_stop() {
    log_test "测试服务停止功能..."
    
    # 确保服务正在运行
    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "启动服务以进行停止测试..."
        systemctl start "$SERVICE_NAME"
        wait_for_service_state "active" 30
    fi
    
    # 停止服务
    log_info "停止服务..."
    systemctl stop "$SERVICE_NAME"
    
    # 等待服务停止
    if wait_for_service_state "inactive" 30; then
        log_info "✓ 服务停止测试通过"
        return 0
    else
        log_error "✗ 服务停止测试失败"
        systemctl status "$SERVICE_NAME" --no-pager
        return 1
    fi
}

# 测试服务重启
test_service_restart() {
    log_test "测试服务重启功能..."
    
    # 确保服务正在运行
    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "启动服务以进行重启测试..."
        systemctl start "$SERVICE_NAME"
        wait_for_service_state "active" 30
    fi
    
    # 记录重启前的PID
    local old_pid=$(systemctl show "$SERVICE_NAME" --property=MainPID --value 2>/dev/null || echo "0")
    log_info "重启前PID: $old_pid"
    
    # 重启服务
    log_info "重启服务..."
    systemctl restart "$SERVICE_NAME"
    
    # 等待服务重新激活
    if wait_for_service_state "active" 30; then
        local new_pid=$(systemctl show "$SERVICE_NAME" --property=MainPID --value 2>/dev/null || echo "0")
        log_info "重启后PID: $new_pid"
        
        if [ "$old_pid" != "$new_pid" ] && [ "$new_pid" != "0" ]; then
            log_info "✓ 服务重启测试通过 (PID已更改)"
        else
            log_warn "服务重启但PID未更改或获取失败"
        fi
        
        return 0
    else
        log_error "✗ 服务重启测试失败"
        systemctl status "$SERVICE_NAME" --no-pager
        return 1
    fi
}

# 测试开机自启动配置
test_service_enable() {
    log_test "测试开机自启动配置..."
    
    if systemctl is-enabled --quiet "$SERVICE_NAME"; then
        log_info "✓ 服务已启用开机自启动"
        return 0
    else
        log_error "✗ 服务未启用开机自启动"
        return 1
    fi
}# 测试
服务依赖关系
test_service_dependencies() {
    log_test "测试服务依赖关系..."
    
    # 检查服务依赖
    local deps=$(systemctl list-dependencies "$SERVICE_NAME" --plain 2>/dev/null | grep -v "$SERVICE_NAME" || echo "")
    log_info "服务依赖关系:"
    if [ -n "$deps" ]; then
        echo "$deps" | while read -r dep; do
            if [ -n "$dep" ]; then
                log_info "  - $dep"
            fi
        done
    else
        log_info "  - 无特殊依赖"
    fi
    
    # 检查网络依赖
    if systemctl list-dependencies "$SERVICE_NAME" 2>/dev/null | grep -q "network"; then
        log_info "✓ 网络依赖配置正确"
    else
        log_warn "网络依赖可能未正确配置"
    fi
    
    return 0
}

# 生成测试报告
generate_test_report() {
    local total_tests=$1
    local passed_tests=$2
    local failed_tests=$((total_tests - passed_tests))
    
    log_info "========== 测试报告 =========="
    log_info "总测试数: $total_tests"
    log_info "通过测试: $passed_tests"
    log_info "失败测试: $failed_tests"
    log_info "成功率: $(( passed_tests * 100 / total_tests ))%"
    log_info "详细日志: $TEST_LOG"
    log_info "=============================="
    
    if [ $failed_tests -eq 0 ]; then
        log_info "🎉 所有测试通过！"
        return 0
    else
        log_error "❌ 有测试失败，请检查日志"
        return 1
    fi
}

# 主测试函数
main() {
    log_info "开始WordPecker Systemd服务测试..."
    echo "测试开始时间: $(date)" > "$TEST_LOG"
    
    check_root
    check_service_exists
    
    local total_tests=5
    local passed_tests=0
    
    # 执行测试
    if test_service_start; then ((passed_tests++)); fi
    if test_service_stop; then ((passed_tests++)); fi
    if test_service_restart; then ((passed_tests++)); fi
    if test_service_enable; then ((passed_tests++)); fi
    if test_service_dependencies; then ((passed_tests++)); fi
    
    # 生成报告
    generate_test_report $total_tests $passed_tests
}

# 错误处理
trap 'log_error "测试脚本执行失败"; exit 1' ERR

# 执行主函数
main "$@"