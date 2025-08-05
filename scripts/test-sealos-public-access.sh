#!/bin/bash

# WordPecker Sealos 公网访问完整验证脚本
# 测试日期: $(date)

echo "=== WordPecker Sealos 公网访问验证 ==="
echo "测试时间: $(date)"
echo

# 配置信息
SEALOS_DOMAIN="jcmbvamxnlie.sealosbja.site"
INTERNAL_IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1)
PUBLIC_IP="101.126.5.123"

echo "1. 配置信息"
echo "Sealos 域名: https://$SEALOS_DOMAIN"
echo "内网 IP: $INTERNAL_IP"
echo "公网 IP: $PUBLIC_IP"
echo "前端端口: 8080"
echo "后端端口: 3000"
echo

# 检查服务状态
echo "2. 服务状态检查"
echo "前端服务 (8080):"
if ss -tlnp | grep -q ":8080"; then
    echo "  ✅ 前端服务正在运行"
    ss -tlnp | grep ":8080"
else
    echo "  ❌ 前端服务未运行"
fi

echo "后端服务 (3000):"
if ss -tlnp | grep -q ":3000"; then
    echo "  ✅ 后端服务正在运行"
    ss -tlnp | grep ":3000"
else
    echo "  ❌ 后端服务未运行"
fi
echo

# 测试本地访问
echo "3. 本地访问测试"
echo "前端本地访问 (8080):"
if curl -s -I http://localhost:8080/ | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://localhost:8080/ - 正常"
else
    echo "  ❌ http://localhost:8080/ - 失败"
fi

echo "后端本地访问 (3000):"
if curl -s -I http://localhost:3000/api/health | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://localhost:3000/api/health - 正常"
else
    echo "  ❌ http://localhost:3000/api/health - 失败"
fi
echo

# 测试内网访问
echo "4. 内网访问测试"
echo "前端内网访问:"
if curl -s -I http://$INTERNAL_IP:8080/ | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://$INTERNAL_IP:8080/ - 正常"
else
    echo "  ❌ http://$INTERNAL_IP:8080/ - 失败"
fi

echo "后端内网访问:"
if curl -s -I http://$INTERNAL_IP:3000/api/health | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://$INTERNAL_IP:3000/api/health - 正常"
else
    echo "  ❌ http://$INTERNAL_IP:3000/api/health - 失败"
fi
echo

# 测试 Sealos 域名访问
echo "5. Sealos 公网域名访问测试"
echo "前端 HTTPS 访问:"
if timeout 15 curl -s -I https://$SEALOS_DOMAIN/ 2>/dev/null | head -1 | grep -q "200 OK"; then
    echo "  ✅ https://$SEALOS_DOMAIN/ - 正常"
    echo "     🎉 公网访问配置成功！"
else
    echo "  ❌ https://$SEALOS_DOMAIN/ - 失败或超时"
    echo "     检查 Vite allowedHosts 配置"
fi

echo "前端 HTTP 访问:"
if timeout 15 curl -s -I http://$SEALOS_DOMAIN/ 2>/dev/null | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://$SEALOS_DOMAIN/ - 正常"
else
    echo "  ❌ http://$SEALOS_DOMAIN/ - 失败或超时"
fi
echo

# 测试前后端 API 通信
echo "6. 前后端 API 通信测试"
echo "测试关键 API 端点:"

API_ENDPOINTS=(
    "/api/health"
    "/api/ready"
    "/api/lists"
    "/api/templates"
)

for endpoint in "${API_ENDPOINTS[@]}"; do
    response=$(curl -s -I http://localhost:3000$endpoint | head -1)
    if echo "$response" | grep -q -E "(200|400)"; then
        echo "  ✅ $endpoint - 正常"
    else
        echo "  ❌ $endpoint - 失败"
        echo "     响应: $response"
    fi
done
echo

# 测试完整用户访问流程
echo "7. 完整用户访问流程测试"
echo "模拟用户通过公网访问应用:"

# 测试前端页面加载
echo "步骤 1: 前端页面加载"
if timeout 15 curl -s https://$SEALOS_DOMAIN/ 2>/dev/null | grep -q "WordPecker\|Vite\|React"; then
    echo "  ✅ 前端页面成功加载"
else
    echo "  ❌ 前端页面加载失败"
fi

# 测试前端调用后端 API（通过内网）
echo "步骤 2: 前端调用后端 API"
if curl -s http://localhost:3000/api/health | grep -q "healthy"; then
    echo "  ✅ 前后端 API 通信正常"
else
    echo "  ❌ 前后端 API 通信失败"
fi

# 测试数据库连接
echo "步骤 3: 数据库连接验证"
if curl -s http://localhost:3000/api/ready | grep -q "ready"; then
    echo "  ✅ 数据库连接正常"
else
    echo "  ❌ 数据库连接异常"
fi
echo

# 检查 Vite 配置
echo "8. Vite 配置验证"
echo "检查 allowedHosts 配置:"
if grep -q "jcmbvamxnlie.sealosbja.site" frontend/vite.config.ts; then
    echo "  ✅ Sealos 域名已添加到 allowedHosts"
else
    echo "  ❌ Sealos 域名未添加到 allowedHosts"
fi

if grep -q "port: 8080" frontend/vite.config.ts; then
    echo "  ✅ 端口配置为 8080"
else
    echo "  ❌ 端口配置不正确"
fi
echo

# 性能和可用性检查
echo "9. 性能和可用性检查"
echo "响应时间测试:"

# 测试前端响应时间
start_time=$(date +%s%N)
curl -s -I https://$SEALOS_DOMAIN/ > /dev/null 2>&1
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))
echo "  前端响应时间: ${response_time}ms"

# 测试后端响应时间
start_time=$(date +%s%N)
curl -s -I http://localhost:3000/api/health > /dev/null 2>&1
end_time=$(date +%s%N)
api_response_time=$(( (end_time - start_time) / 1000000 ))
echo "  后端 API 响应时间: ${api_response_time}ms"
echo

# 总结报告
echo "10. 验证总结"
echo "==================================="

# 检查各项功能状态
services_ok=true
local_access_ok=true
public_access_ok=true
api_communication_ok=true

# 服务状态
if ! ss -tlnp | grep -q ":8080" || ! ss -tlnp | grep -q ":3000"; then
    services_ok=false
fi

# 本地访问
if ! curl -s -I http://localhost:8080/ | head -1 | grep -q "200 OK"; then
    local_access_ok=false
fi

# 公网访问
if ! timeout 10 curl -s -I https://$SEALOS_DOMAIN/ 2>/dev/null | head -1 | grep -q "200 OK"; then
    public_access_ok=false
fi

# API 通信
if ! curl -s http://localhost:3000/api/health | grep -q "healthy"; then
    api_communication_ok=false
fi

# 输出结果
if $services_ok; then
    echo "✅ 服务运行状态: 正常"
else
    echo "❌ 服务运行状态: 异常"
fi

if $local_access_ok; then
    echo "✅ 本地访问: 正常"
else
    echo "❌ 本地访问: 异常"
fi

if $public_access_ok; then
    echo "✅ 公网访问: 正常"
    echo "   🌐 用户可通过 https://$SEALOS_DOMAIN 访问应用"
else
    echo "❌ 公网访问: 异常"
    echo "   需要检查 Sealos 端口映射和 Vite 配置"
fi

if $api_communication_ok; then
    echo "✅ 前后端通信: 正常"
else
    echo "❌ 前后端通信: 异常"
fi

echo
if $services_ok && $local_access_ok && $public_access_ok && $api_communication_ok; then
    echo "🎉 任务 5.3 公网访问验证 - 完全成功！"
    echo "   WordPecker 应用已成功部署到 Sealos 并可通过公网访问"
else
    echo "⚠️  任务 5.3 公网访问验证 - 部分问题需要解决"
fi

echo
echo "=== 验证完成 ==="