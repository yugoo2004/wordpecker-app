#!/bin/bash

# WordPecker 公网访问验证脚本
# 测试日期: $(date)

echo "=== WordPecker 公网访问验证测试 ==="
echo "测试时间: $(date)"
echo

# 获取当前网络信息
echo "1. 网络配置信息"
echo "内网 IP: $(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1)"
echo "公网 IP: 101.126.5.123 (预期)"
echo

# 检查服务状态
echo "2. 服务状态检查"
echo "前端服务 (5173):"
if ss -tlnp | grep -q ":5173"; then
    echo "  ✅ 前端服务正在运行"
    ss -tlnp | grep ":5173"
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
echo "前端本地访问:"
if curl -s -I http://localhost:5173/ | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://localhost:5173/ - 正常"
else
    echo "  ❌ http://localhost:5173/ - 失败"
fi

echo "后端本地访问:"
if curl -s -I http://localhost:3000/api/health | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://localhost:3000/api/health - 正常"
else
    echo "  ❌ http://localhost:3000/api/health - 失败"
fi
echo

# 测试内网访问
INTERNAL_IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1)
echo "4. 内网访问测试"
echo "前端内网访问:"
if curl -s -I http://$INTERNAL_IP:5173/ | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://$INTERNAL_IP:5173/ - 正常"
else
    echo "  ❌ http://$INTERNAL_IP:5173/ - 失败"
fi

echo "后端内网访问:"
if curl -s -I http://$INTERNAL_IP:3000/api/health | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://$INTERNAL_IP:3000/api/health - 正常"
else
    echo "  ❌ http://$INTERNAL_IP:3000/api/health - 失败"
fi
echo

# 测试公网访问
PUBLIC_IP="101.126.5.123"
echo "5. 公网访问测试"
echo "前端公网访问:"
if timeout 10 curl -s -I http://$PUBLIC_IP:5173/ 2>/dev/null | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://$PUBLIC_IP:5173/ - 正常"
else
    echo "  ❌ http://$PUBLIC_IP:5173/ - 失败或超时"
    echo "     可能需要配置 Sealos 端口转发"
fi

echo "后端公网访问:"
if timeout 10 curl -s -I http://$PUBLIC_IP:3000/api/health 2>/dev/null | head -1 | grep -q "200 OK"; then
    echo "  ✅ http://$PUBLIC_IP:3000/api/health - 正常"
else
    echo "  ❌ http://$PUBLIC_IP:3000/api/health - 失败或超时"
    echo "     可能需要配置 Sealos 端口转发"
fi
echo

# 测试前后端通信
echo "6. 前后端 API 通信测试"
echo "测试前端调用后端 API:"

# 模拟前端调用后端的请求
API_ENDPOINTS=(
    "/api/health"
    "/api/ready"
    "/api/lists"
    "/api/templates"
)

for endpoint in "${API_ENDPOINTS[@]}"; do
    if curl -s -I http://localhost:3000$endpoint | head -1 | grep -q -E "(200|400)"; then
        echo "  ✅ $endpoint - 正常"
    else
        echo "  ❌ $endpoint - 失败"
    fi
done
echo

# 检查防火墙和网络配置
echo "7. 网络配置检查"
echo "监听的端口:"
ss -tlnp | grep -E ":(3000|5173|80|443|8080)" | while read line; do
    echo "  $line"
done
echo

# 检查是否有反向代理
echo "8. 反向代理检查"
if pgrep -f "nginx\|apache\|caddy\|traefik" > /dev/null; then
    echo "  发现反向代理进程:"
    pgrep -f "nginx\|apache\|caddy\|traefik" | while read pid; do
        ps -p $pid -o pid,cmd --no-headers
    done
else
    echo "  未发现反向代理进程"
fi
echo

# 总结和建议
echo "9. 总结和建议"
echo "基于测试结果："

if ss -tlnp | grep -q ":5173" && ss -tlnp | grep -q ":3000"; then
    echo "  ✅ 服务运行正常"
else
    echo "  ❌ 服务运行异常"
fi

if curl -s -I http://localhost:5173/ | head -1 | grep -q "200 OK"; then
    echo "  ✅ 本地访问正常"
else
    echo "  ❌ 本地访问异常"
fi

if timeout 5 curl -s -I http://$PUBLIC_IP:5173/ 2>/dev/null | head -1 | grep -q "200 OK"; then
    echo "  ✅ 公网访问已配置"
else
    echo "  ⚠️  公网访问需要配置"
    echo "     建议："
    echo "     1. 检查 Sealos 端口转发配置"
    echo "     2. 确认防火墙规则"
    echo "     3. 验证公网 IP 映射"
fi

echo
echo "=== 测试完成 ==="