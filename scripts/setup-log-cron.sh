#!/bin/bash

# 设置日志管理定时任务脚本

set -e

PROJECT_DIR="/home/devbox/wordpecker-app"
SERVICE_USER="devbox"

echo "设置WordPecker日志管理定时任务..."

# 检查是否以正确用户运行
if [ "$(whoami)" != "$SERVICE_USER" ]; then
    echo "此脚本应该以 $SERVICE_USER 用户运行"
    echo "请使用: sudo -u $SERVICE_USER $0"
    exit 1
fi

# 备份现有的crontab
echo "备份现有crontab..."
crontab -l > /tmp/wordpecker-crontab-backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || echo "# 新的crontab" > /tmp/wordpecker-crontab-backup-$(date +%Y%m%d-%H%M%S)

# 创建新的crontab条目
cat > /tmp/wordpecker-log-cron << 'EOF'
# WordPecker 日志管理定时任务

# 每小时执行日志清理和压缩 (每小时的第5分钟)
5 * * * * /home/devbox/wordpecker-app/scripts/log-manager.sh cleanup >> /home/devbox/wordpecker-app/logs/cron.log 2>&1

# 每6小时检查日志目录大小 (每天的 0:10, 6:10, 12:10, 18:10)
10 */6 * * * /home/devbox/wordpecker-app/scripts/log-manager.sh check-size >> /home/devbox/wordpecker-app/logs/cron.log 2>&1

# 每天凌晨2点执行完整的日志管理 (清理、压缩、统计)
0 2 * * * /home/devbox/wordpecker-app/scripts/log-manager.sh all >> /home/devbox/wordpecker-app/logs/cron.log 2>&1

# 每天凌晨3点清理PM2日志
0 3 * * * /home/devbox/wordpecker-app/scripts/log-manager.sh pm2 >> /home/devbox/wordpecker-app/logs/cron.log 2>&1

# 每周日凌晨4点生成详细统计报告
0 4 * * 0 /home/devbox/wordpecker-app/scripts/log-manager.sh stats >> /home/devbox/wordpecker-app/logs/cron.log 2>&1

# 每5分钟执行一次日志监控 (检查错误率、性能等)
*/5 * * * * /home/devbox/wordpecker-app/scripts/log-monitor.sh once >> /home/devbox/wordpecker-app/logs/monitor-cron.log 2>&1

# 每天凌晨1点清理旧的监控报告和统计文件 (保留7天)
0 1 * * * find /home/devbox/wordpecker-app/logs -name "monitor-report-*.json" -mtime +7 -delete >> /home/devbox/wordpecker-app/logs/cron.log 2>&1
0 1 * * * find /home/devbox/wordpecker-app/logs -name "log-stats-*.json" -mtime +7 -delete >> /home/devbox/wordpecker-app/logs/cron.log 2>&1

# 每月第一天清理旧的备份文件 (保留30天)
0 5 1 * * find /home/devbox/backups -name "wordpecker-*" -mtime +30 -exec rm -rf {} \; >> /home/devbox/wordpecker-app/logs/cron.log 2>&1

EOF

# 获取现有crontab并添加新任务
echo "添加日志管理定时任务..."
(crontab -l 2>/dev/null || echo ""; echo ""; cat /tmp/wordpecker-log-cron) | crontab -

# 验证crontab设置
echo "验证crontab设置..."
if crontab -l | grep -q "WordPecker 日志管理"; then
    echo "✅ 定时任务设置成功"
else
    echo "❌ 定时任务设置失败"
    exit 1
fi

# 创建日志目录
mkdir -p "$PROJECT_DIR/logs"

# 创建cron日志文件
touch "$PROJECT_DIR/logs/cron.log"
touch "$PROJECT_DIR/logs/monitor-cron.log"

# 设置权限
chmod 644 "$PROJECT_DIR/logs/cron.log"
chmod 644 "$PROJECT_DIR/logs/monitor-cron.log"

# 清理临时文件
rm -f /tmp/wordpecker-log-cron

echo ""
echo "✅ WordPecker日志管理定时任务配置完成"
echo ""
echo "已配置的定时任务:"
echo "- 每小时清理日志 (xx:05)"
echo "- 每6小时检查日志大小 (0:10, 6:10, 12:10, 18:10)"
echo "- 每天完整日志管理 (2:00)"
echo "- 每天清理PM2日志 (3:00)"
echo "- 每周生成统计报告 (周日 4:00)"
echo "- 每5分钟监控日志 (xx:00, xx:05, xx:10...)"
echo "- 每天清理旧报告 (1:00)"
echo "- 每月清理旧备份 (1号 5:00)"
echo ""
echo "日志文件:"
echo "- 定时任务日志: $PROJECT_DIR/logs/cron.log"
echo "- 监控任务日志: $PROJECT_DIR/logs/monitor-cron.log"
echo ""
echo "查看当前crontab: crontab -l"
echo "查看cron日志: tail -f $PROJECT_DIR/logs/cron.log"
echo "手动执行日志管理: $PROJECT_DIR/scripts/log-manager.sh"