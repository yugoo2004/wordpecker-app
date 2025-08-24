#!/bin/bash

# 资源监控功能测试脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_LOG="$PROJECT_DIR/logs/resource-monitoring-test.log"

# 创建测试日志
mkdir -p "$PROJECT_DIR/logs"
echo "=== WordPecker 资源监控功能测试 ===" > "$TEST_LOG"
echo "测试时间: $(date)" >> "$TEST_LOG"
echo "" >> "$TEST_LOG"

# 测试结果统计
TESTS_PASSED=0
TESTS_FAILED=0

# 测试函数
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo "测试: $test_name"
    echo "测试: $test_name" >> "$TEST_LOG"
    
    if eval "$test_command" >> "$TEST_LOG" 2>&1; then
        echo "✅ 通过"
        echo "✅ 通过" >> "$TEST_LOG"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "❌ 失败"
        echo "❌ 失败" >> "$TEST_LOG"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo "" >> "$TEST_LOG"
}

echo "开始测试 WordPecker 资源监控功能..."
echo ""

# 测试1: 检查脚本文件存在性
run_test "检查系统资源监控脚本" "[ -f '$SCRIPT_DIR/system-resource-monitor.sh' ] && [ -x '$SCRIPT_DIR/system-resource-monitor.sh' ]"

run_test "检查资源保护脚本" "[ -f '$SCRIPT_DIR/resource-protection.sh' ] && [ -x '$SCRIPT_DIR/resource-protection.sh' ]"

run_test "检查自动清理脚本" "[ -f '$SCRIPT_DIR/auto-cleanup.sh' ] && [ -x '$SCRIPT_DIR/auto-cleanup.sh' ]"

run_test "检查资源管理器脚本" "[ -f '$SCRIPT_DIR/resource-manager.sh' ] && [ -x '$SCRIPT_DIR/resource-manager.sh' ]"

# 测试2: 检查脚本语法
run_test "系统资源监控脚本语法检查" "bash -n '$SCRIPT_DIR/system-resource-monitor.sh'"

run_test "资源保护脚本语法检查" "bash -n '$SCRIPT_DIR/resource-protection.sh'"

run_test "自动清理脚本语法检查" "bash -n '$SCRIPT_DIR/auto-cleanup.sh'"

run_test "资源管理器脚本语法检查" "bash -n '$SCRIPT_DIR/resource-manager.sh'"

# 测试3: 测试基本功能
run_test "资源管理器状态检查" "'$SCRIPT_DIR/resource-manager.sh' status"

run_test "资源保护检查功能" "'$SCRIPT_DIR/resource-protection.sh' check"

run_test "自动清理干运行模式" "'$SCRIPT_DIR/auto-cleanup.sh' dry-run"

run_test "自动清理配置显示" "'$SCRIPT_DIR/auto-cleanup.sh' config"

# 测试4: 测试配置文件创建
run_test "资源保护配置文件创建" "[ -f '$PROJECT_DIR/config/resource-protection.conf' ]"

run_test "自动清理配置文件创建" "[ -f '$PROJECT_DIR/config/cleanup.conf' ]"

# 测试5: 测试日志功能
run_test "资源监控日志文件创建" "[ -f '$PROJECT_DIR/logs/resource-manager.log' ]"

run_test "资源保护日志文件创建" "[ -f '$PROJECT_DIR/logs/resource-protection.log' ]"

run_test "自动清理日志文件创建" "[ -f '$PROJECT_DIR/logs/cleanup.log' ]"

# 测试6: 测试依赖检查
run_test "bc命令可用性" "command -v bc"

run_test "jq命令可用性" "command -v jq"

run_test "curl命令可用性" "command -v curl"

# 测试7: 测试系统资源获取
run_test "CPU使用率获取" "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | grep -E '[0-9]+'"

run_test "内存使用率获取" "free | grep Mem | awk '{printf(\"%.1f\", \$3/\$2 * 100.0)}' | grep -E '[0-9]+'"

run_test "磁盘使用率获取" "df -h / | awk 'NR==2{print \$5}' | grep -E '[0-9]+%'"

run_test "系统负载获取" "uptime | awk -F'load average:' '{print \$2}' | awk '{print \$1}' | grep -E '[0-9]+'"

# 测试8: 测试清理功能（安全模式）
run_test "缓存清理功能测试" "'$SCRIPT_DIR/auto-cleanup.sh' cache"

run_test "临时文件清理功能测试" "'$SCRIPT_DIR/auto-cleanup.sh' temp"

# 测试9: 测试PM2集成
if command -v pm2 &> /dev/null; then
    run_test "PM2状态获取" "pm2 list --no-color"
    run_test "PM2日志刷新" "pm2 flush"
else
    echo "⚠️  PM2未安装，跳过PM2相关测试"
    echo "⚠️  PM2未安装，跳过PM2相关测试" >> "$TEST_LOG"
fi

# 测试10: 测试目录结构
run_test "日志目录存在" "[ -d '$PROJECT_DIR/logs' ]"

run_test "配置目录存在" "[ -d '$PROJECT_DIR/config' ]"

run_test "备份目录创建" "[ -d '$PROJECT_DIR/backups' ]"

# 输出测试结果
echo ""
echo "=== 测试结果汇总 ==="
echo "通过测试: $TESTS_PASSED"
echo "失败测试: $TESTS_FAILED"
echo "总计测试: $((TESTS_PASSED + TESTS_FAILED))"

echo "" >> "$TEST_LOG"
echo "=== 测试结果汇总 ===" >> "$TEST_LOG"
echo "通过测试: $TESTS_PASSED" >> "$TEST_LOG"
echo "失败测试: $TESTS_FAILED" >> "$TEST_LOG"
echo "总计测试: $((TESTS_PASSED + TESTS_FAILED))" >> "$TEST_LOG"

if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 所有测试通过！资源监控功能正常工作。"
    echo "🎉 所有测试通过！资源监控功能正常工作。" >> "$TEST_LOG"
    exit 0
else
    echo "⚠️  有 $TESTS_FAILED 个测试失败，请检查测试日志: $TEST_LOG"
    echo "⚠️  有 $TESTS_FAILED 个测试失败。" >> "$TEST_LOG"
    exit 1
fi