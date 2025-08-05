#!/bin/bash

# 前端网络配置测试脚本
# 用于验证 Vite 开发服务器的网络配置

echo "🚀 开始测试前端网络配置..."

# 获取当前内网 IP
INTERNAL_IP=$(ip route get 1.1.1.1 | grep -oP 'src \K\S+')
echo "📍 当前内网 IP: $INTERNAL_IP"

# 进入前端目录
cd frontend

echo "📦 检查依赖..."
npm install --silent

echo "🔧 启动 Vite 开发服务器..."
# 在后台启动服务器
nohup npm run dev > /tmp/vite-test.log 2>&1 &
VITE_PID=$!

# 等待服务器启动
echo "⏳ 等待服务器启动..."
sleep 5

# 检查进程是否还在运行
if ! kill -0 $VITE_PID 2>/dev/null; then
    echo "❌ Vite 服务器启动失败"
    cat /tmp/vite-test.log
    exit 1
fi

echo "✅ Vite 服务器已启动 (PID: $VITE_PID)"

# 检查端口监听状态
echo "🔍 检查端口监听状态..."
if ss -tlnp | grep -q ":5173.*0.0.0.0"; then
    echo "✅ 服务器正在监听所有网络接口 (0.0.0.0:5173)"
else
    echo "❌ 服务器未正确监听所有网络接口"
    ss -tlnp | grep :5173
    kill $VITE_PID
    exit 1
fi

# 测试本地访问
echo "🧪 测试本地访问 (localhost:5173)..."
if curl -s -I http://localhost:5173/ | grep -q "HTTP/1.1 200"; then
    echo "✅ 本地访问测试通过"
else
    echo "❌ 本地访问测试失败"
    kill $VITE_PID
    exit 1
fi

# 测试内网访问
echo "🧪 测试内网访问 ($INTERNAL_IP:5173)..."
if curl -s -I http://$INTERNAL_IP:5173/ | grep -q "HTTP/1.1 200"; then
    echo "✅ 内网访问测试通过"
else
    echo "❌ 内网访问测试失败"
    kill $VITE_PID
    exit 1
fi

# 显示服务器日志
echo "📋 服务器启动日志:"
cat /tmp/vite-test.log

# 清理
echo "🧹 清理测试环境..."
kill $VITE_PID
rm -f /tmp/vite-test.log

echo "🎉 所有网络配置测试通过！"
echo "📝 配置摘要:"
echo "   - Vite 配置: host: true (等同于 0.0.0.0)"
echo "   - 启动命令: vite --host 0.0.0.0 --port 5173"
echo "   - 本地访问: http://localhost:5173/"
echo "   - 内网访问: http://$INTERNAL_IP:5173/"
echo "   - 监听接口: 0.0.0.0:5173"