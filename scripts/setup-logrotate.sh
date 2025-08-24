#!/bin/bash

# 设置 logrotate 配置脚本
# 用于系统级日志轮转管理

set -e

PROJECT_DIR="/home/devbox/wordpecker-app"
LOGROTATE_CONFIG="/etc/logrotate.d/wordpecker"
SERVICE_USER="devbox"

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "此脚本需要root权限运行"
    echo "请使用: sudo $0"
    exit 1
fi

echo "设置WordPecker日志轮转配置..."

# 创建logrotate配置文件
cat > "$LOGROTATE_CONFIG" << 'EOF'
# WordPecker应用日志轮转配置

# 主日志目录
/home/devbox/wordpecker-app/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 devbox devbox
    sharedscripts
    postrotate
        # 重新加载应用以使用新的日志文件
        if [ -f /home/devbox/.pm2/pm2.pid ]; then
            su - devbox -c "pm2 reloadLogs" >/dev/null 2>&1 || true
        fi
    endscript
}

# 后端日志目录
/home/devbox/wordpecker-app/backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 devbox devbox
    sharedscripts
    postrotate
        # 发送USR1信号给Node.js进程重新打开日志文件
        pkill -USR1 -f "wordpecker-backend" >/dev/null 2>&1 || true
    endscript
}

# PM2日志文件
/home/devbox/.pm2/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 devbox devbox
    sharedscripts
    postrotate
        su - devbox -c "pm2 reloadLogs" >/dev/null 2>&1 || true
    endscript
}

# 系统脚本日志
/home/devbox/wordpecker-app/logs/log-cleanup.log
/home/devbox/wordpecker-app/logs/health-check.log
/home/devbox/wordpecker-app/logs/resource-*.log {
    weekly
    missingok
    rotate 4
    compress
    delaycompress
    notifempty
    create 0644 devbox devbox
}
EOF

echo "logrotate配置文件已创建: $LOGROTATE_CONFIG"

# 测试logrotate配置
echo "测试logrotate配置..."
if logrotate -d "$LOGROTATE_CONFIG"; then
    echo "✅ logrotate配置测试通过"
else
    echo "❌ logrotate配置测试失败"
    exit 1
fi

# 创建日志目录（如果不存在）
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/backend/logs"
chown -R "$SERVICE_USER:$SERVICE_USER" "$PROJECT_DIR/logs"
chown -R "$SERVICE_USER:$SERVICE_USER" "$PROJECT_DIR/backend/logs"

# 设置适当的权限
chmod 755 "$PROJECT_DIR/logs"
chmod 755 "$PROJECT_DIR/backend/logs"

echo "✅ WordPecker日志轮转配置完成"
echo ""
echo "配置详情:"
echo "- 日志文件每天轮转"
echo "- 保留14天的日志文件"
echo "- 自动压缩旧日志文件"
echo "- PM2日志保留7天"
echo "- 系统脚本日志每周轮转，保留4周"
echo ""
echo "手动测试轮转: sudo logrotate -f $LOGROTATE_CONFIG"
echo "查看轮转状态: sudo logrotate -d $LOGROTATE_CONFIG"