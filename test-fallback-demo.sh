#!/bin/bash

# AI降级机制控制使用示例
# 用于排查火山引擎端点问题

echo "🚀 AI降级机制控制使用示例"
echo "================================"

# 服务器地址
SERVER_URL="http://localhost:3000"

# 函数：发送API请求并显示结果
send_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local description="$4"
    
    echo
    echo "📡 $description"
    echo "请求: $method $url"
    
    if [ -n "$data" ]; then
        echo "数据: $data"
        response=$(curl -s -X "$method" "$SERVER_URL$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -X "$method" "$SERVER_URL$url")
    fi
    
    # 检查响应是否为有效JSON
    if echo "$response" | jq . >/dev/null 2>&1; then
        echo "响应:"
        echo "$response" | jq .
    else
        echo "响应: $response"
    fi
}

# 函数：等待用户按键
wait_for_key() {
    echo
    echo "按回车键继续..."
    read -r
}

# 1. 查看当前降级状态
send_request "GET" "/api/management/ai/fallback-status" "" "查看当前降级状态"
wait_for_key

# 2. 禁用降级机制，强制使用豆包
send_request "POST" "/api/management/ai/disable-fallback" \
    '{"provider":"doubao","logErrors":true}' \
    "禁用降级机制，强制使用豆包"
wait_for_key

# 3. 再次查看状态确认
send_request "GET" "/api/management/ai/fallback-status" "" "确认降级已禁用"
wait_for_key

# 4. 测试火山引擎连接
send_request "POST" "/api/management/ai/test-volcengine" "" \
    "测试火山引擎连接（专用诊断端点）"
wait_for_key

# 5. 测试正常的词汇生成API（使用强制的豆包服务）
send_request "POST" "/api/vocabulary/generate" \
    '{"theme":"测试","count":1,"language":"en","baseLanguage":"zh"}' \
    "测试词汇生成API（应使用豆包服务）"
wait_for_key

# 6. 启用调试模式获取更多信息
send_request "POST" "/api/management/ai/debug-mode" \
    '{"enabled":true}' \
    "启用调试模式"
wait_for_key

# 7. 再次测试以查看调试信息
send_request "POST" "/api/vocabulary/generate" \
    '{"theme":"调试测试","count":1,"language":"en","baseLanguage":"zh"}' \
    "调试模式下的词汇生成测试"
wait_for_key

# 8. 切换到GLM进行对比测试
send_request "POST" "/api/management/ai/disable-fallback" \
    '{"provider":"glm","logErrors":true}' \
    "切换到GLM服务进行对比"
wait_for_key

# 9. 测试GLM服务
send_request "POST" "/api/vocabulary/generate" \
    '{"theme":"GLM测试","count":1,"language":"en","baseLanguage":"zh"}' \
    "测试GLM服务"
wait_for_key

# 10. 恢复降级机制
send_request "POST" "/api/management/ai/enable-fallback" "" \
    "恢复降级机制"
wait_for_key

# 11. 关闭调试模式
send_request "POST" "/api/management/ai/debug-mode" \
    '{"enabled":false}' \
    "关闭调试模式"
wait_for_key

# 12. 最终状态确认
send_request "GET" "/api/management/ai/fallback-status" "" "最终状态确认"

echo
echo "✅ 演示完成！"
echo
echo "💡 使用提示："
echo "1. 查看后端日志: tail -f logs/backend.log"
echo "2. 查看详细错误: cat logs/ai-service-errors.json"
echo "3. 运行测试脚本: cd backend && npx ts-node scripts/test-fallback-control.ts"
echo
echo "🔧 环境变量方式（推荐用于持续调试）："
echo "echo 'AI_FALLBACK_ENABLED=false' >> .env"
echo "echo 'AI_FORCED_PROVIDER=doubao' >> .env"
echo "echo 'AI_LOG_DETAILED_ERRORS=true' >> .env"
echo "npm run dev  # 重启服务"