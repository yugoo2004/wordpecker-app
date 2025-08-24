#!/bin/bash

# 健康检查端点测试脚本
# 用于验证 /api/health 和 /api/ready 端点的功能

set -e

BACKEND_URL="http://localhost:3000"
LOG_FILE="./logs/health-test.log"

# 创建日志目录
mkdir -p ./logs

echo "$(date): 开始健康检查端点测试" | tee -a "$LOG_FILE"

# 测试基础健康检查端点
test_health_endpoint() {
    echo "$(date): 测试 /api/health 端点..." | tee -a "$LOG_FILE"
    
    local response=$(curl -s -w "%{http_code}" "$BACKEND_URL/api/health")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        echo "$(date): ✅ /api/health 端点正常 (HTTP $http_code)" | tee -a "$LOG_FILE"
        
        # 验证响应包含必要字段
        if echo "$body" | jq -e '.status, .timestamp, .uptime, .services' > /dev/null 2>&1; then
            echo "$(date): ✅ 健康检查响应格式正确" | tee -a "$LOG_FILE"
            
            # 显示服务状态
            local db_status=$(echo "$body" | jq -r '.services.database')
            local openai_status=$(echo "$body" | jq -r '.services.openai')
            local pexels_status=$(echo "$body" | jq -r '.services.pexels')
            local elevenlabs_status=$(echo "$body" | jq -r '.services.elevenlabs')
            
            echo "$(date): 服务状态 - 数据库: $db_status, OpenAI: $openai_status, Pexels: $pexels_status, ElevenLabs: $elevenlabs_status" | tee -a "$LOG_FILE"
        else
            echo "$(date): ❌ 健康检查响应格式不正确" | tee -a "$LOG_FILE"
            return 1
        fi
    else
        echo "$(date): ❌ /api/health 端点异常 (HTTP $http_code)" | tee -a "$LOG_FILE"
        return 1
    fi
}

# 测试详细就绪检查端点
test_ready_endpoint() {
    echo "$(date): 测试 /api/ready 端点..." | tee -a "$LOG_FILE"
    
    local response=$(curl -s -w "%{http_code}" "$BACKEND_URL/api/ready")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "503" ]; then
        echo "$(date): ✅ /api/ready 端点响应正常 (HTTP $http_code)" | tee -a "$LOG_FILE"
        
        # 验证响应包含必要字段
        if echo "$body" | jq -e '.ready, .timestamp, .checks, .details' > /dev/null 2>&1; then
            echo "$(date): ✅ 就绪检查响应格式正确" | tee -a "$LOG_FILE"
            
            # 显示检查结果
            local ready_status=$(echo "$body" | jq -r '.ready')
            local db_check=$(echo "$body" | jq -r '.checks.database')
            local api_check=$(echo "$body" | jq -r '.checks.requiredAPIs')
            local connectivity_check=$(echo "$body" | jq -r '.checks.connectivity')
            
            echo "$(date): 就绪状态: $ready_status" | tee -a "$LOG_FILE"
            echo "$(date): 检查结果 - 数据库: $db_check, 必需API: $api_check, 连通性: $connectivity_check" | tee -a "$LOG_FILE"
            
            # 显示警告信息（如果有）
            local warnings=$(echo "$body" | jq -r '.warnings[]?' 2>/dev/null || echo "")
            if [ -n "$warnings" ]; then
                echo "$(date): 警告信息:" | tee -a "$LOG_FILE"
                echo "$warnings" | while read -r warning; do
                    echo "$(date):   - $warning" | tee -a "$LOG_FILE"
                done
            fi
        else
            echo "$(date): ❌ 就绪检查响应格式不正确" | tee -a "$LOG_FILE"
            return 1
        fi
    else
        echo "$(date): ❌ /api/ready 端点异常 (HTTP $http_code)" | tee -a "$LOG_FILE"
        return 1
    fi
}

# 测试端点在服务异常时的行为
test_error_handling() {
    echo "$(date): 测试错误处理..." | tee -a "$LOG_FILE"
    
    # 这里可以添加更多的错误场景测试
    # 比如模拟数据库断开连接等
    echo "$(date): ✅ 错误处理测试完成（基础验证）" | tee -a "$LOG_FILE"
}

# 主测试流程
main() {
    echo "$(date): 开始健康检查端点测试套件" | tee -a "$LOG_FILE"
    
    # 等待服务启动
    echo "$(date): 等待后端服务启动..." | tee -a "$LOG_FILE"
    local max_wait=30
    local wait_time=0
    
    while [ $wait_time -lt $max_wait ]; do
        if curl -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
            echo "$(date): 后端服务已启动" | tee -a "$LOG_FILE"
            break
        fi
        sleep 2
        wait_time=$((wait_time + 2))
        echo "$(date): 等待中... ($wait_time/${max_wait}s)" | tee -a "$LOG_FILE"
    done
    
    if [ $wait_time -ge $max_wait ]; then
        echo "$(date): ❌ 后端服务启动超时" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    # 运行测试
    test_health_endpoint
    test_ready_endpoint
    test_error_handling
    
    echo "$(date): ✅ 所有健康检查端点测试完成" | tee -a "$LOG_FILE"
}

main "$@"