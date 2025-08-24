# WordPecker 系统资源监控使用指南

## 概述

WordPecker 系统资源监控是一套完整的资源管理解决方案，包含系统资源监控、自动保护机制和智能清理策略，确保应用在 Sealos devbox 环境中稳定运行。

## 功能特性

### 🔍 系统资源监控
- **实时监控**: CPU、内存、磁盘使用率和系统负载
- **进程监控**: PM2 进程状态和资源使用情况
- **智能告警**: 可配置的阈值告警机制
- **自动记录**: 详细的监控日志和状态记录

### 🛡️ 自动保护机制
- **CPU保护**: 高CPU使用时自动重启进程和降低优先级
- **内存保护**: 内存不足时自动清理缓存和重启高内存进程
- **磁盘保护**: 磁盘空间不足时自动清理文件
- **负载保护**: 系统负载过高时限制并发连接

### 🧹 智能清理策略
- **日志管理**: 自动清理过期日志文件和压缩大文件
- **缓存清理**: 按时间和大小限制清理音频缓存
- **临时文件**: 定期清理临时文件和构建文件
- **PM2日志**: 自动管理PM2日志文件

## 快速开始

### 1. 检查系统状态
```bash
# 查看资源监控状态
./scripts/resource-manager.sh status

# 执行资源保护检查
./scripts/resource-manager.sh check
```

### 2. 启动资源监控
```bash
# 启动完整监控服务
./scripts/resource-manager.sh start

# 检查启动状态
./scripts/resource-manager.sh status
```

### 3. 执行清理操作
```bash
# 完整清理（推荐）
./scripts/resource-manager.sh cleanup

# 仅清理缓存
./scripts/resource-manager.sh cleanup cache

# 仅清理日志
./scripts/resource-manager.sh cleanup logs
```

## 详细使用说明

### 资源管理器 (resource-manager.sh)

主要的资源管理入口，提供统一的管理界面。

```bash
# 基本命令
./scripts/resource-manager.sh {start|stop|restart|status|check|cleanup|report|install|uninstall}

# 命令说明
start     - 启动资源监控服务
stop      - 停止资源监控服务  
restart   - 重启资源监控服务
status    - 查看监控状态和资源使用情况
check     - 执行资源保护检查
cleanup   - 执行清理操作 [full|logs|cache|temp]
report    - 生成综合资源报告
install   - 安装为系统服务（需要sudo权限）
uninstall - 卸载系统服务（需要sudo权限）
```

### 系统资源监控 (system-resource-monitor.sh)

持续监控系统资源使用情况。

```bash
# 启动监控（后台运行）
./scripts/system-resource-monitor.sh start

# 停止监控
./scripts/system-resource-monitor.sh stop

# 查看监控状态
./scripts/system-resource-monitor.sh status

# 手动清理
./scripts/system-resource-monitor.sh cleanup
```

**监控指标:**
- CPU使用率 (默认告警阈值: 80%, 临界阈值: 95%)
- 内存使用率 (默认告警阈值: 85%, 临界阈值: 95%)
- 磁盘使用率 (默认告警阈值: 90%, 临界阈值: 95%)
- 系统负载 (基于CPU核心数)

### 资源保护 (resource-protection.sh)

智能的资源保护和告警机制。

```bash
# 执行保护检查
./scripts/resource-protection.sh check

# 生成资源报告
./scripts/resource-protection.sh report

# 手动清理
./scripts/resource-protection.sh cleanup

# 紧急清理
./scripts/resource-protection.sh emergency-cleanup

# 查看配置
./scripts/resource-protection.sh config
```

**保护措施:**
- **CPU保护**: 重启进程、降低优先级、清理临时文件
- **内存保护**: 清理缓存、重启高内存进程、强制垃圾回收
- **磁盘保护**: 清理日志、缓存、临时文件、PM2日志
- **负载保护**: 限制并发连接、缩减服务实例

### 自动清理 (auto-cleanup.sh)

智能的文件清理和空间管理。

```bash
# 完整清理
./scripts/auto-cleanup.sh full

# 分类清理
./scripts/auto-cleanup.sh logs    # 仅清理日志
./scripts/auto-cleanup.sh cache   # 仅清理缓存
./scripts/auto-cleanup.sh temp    # 仅清理临时文件

# 设置定时任务
./scripts/auto-cleanup.sh setup-cron

# 干运行模式（仅显示操作）
./scripts/auto-cleanup.sh dry-run

# 查看配置
./scripts/auto-cleanup.sh config
```

**清理策略:**
- **日志文件**: 保留7天，单文件限制100MB，总大小限制1GB
- **音频缓存**: 保留24小时，总大小限制500MB
- **临时文件**: 保留6小时
- **PM2日志**: 保留3天，自动刷新缓冲区

## 配置文件

### 资源保护配置 (config/resource-protection.conf)

```bash
# CPU使用率阈值（%）
CPU_WARNING_THRESHOLD=75
CPU_CRITICAL_THRESHOLD=90

# 内存使用率阈值（%）
MEMORY_WARNING_THRESHOLD=80
MEMORY_CRITICAL_THRESHOLD=90

# 磁盘使用率阈值（%）
DISK_WARNING_THRESHOLD=85
DISK_CRITICAL_THRESHOLD=95

# 保护措施配置
ENABLE_AUTO_RESTART=true
ENABLE_AUTO_CLEANUP=true
ENABLE_PROCESS_THROTTLING=true

# 通知配置
ENABLE_EMAIL_ALERTS=false
EMAIL_RECIPIENT=""
ENABLE_WEBHOOK_ALERTS=false
WEBHOOK_URL=""
```

### 自动清理配置 (config/cleanup.conf)

```bash
# 日志文件清理策略
LOG_RETENTION_DAYS=7
LOG_SIZE_LIMIT_MB=100
TOTAL_LOG_SIZE_LIMIT_MB=1000
COMPRESS_OLD_LOGS=true
COMPRESS_THRESHOLD_DAYS=3

# 缓存文件清理策略
CACHE_RETENTION_HOURS=24
AUDIO_CACHE_SIZE_LIMIT_MB=500
AUTO_CLEANUP_CACHE=true

# 临时文件清理策略
TEMP_RETENTION_HOURS=6
CLEANUP_NODE_MODULES_CACHE=true
CLEANUP_NPM_CACHE=false

# 清理调度
ENABLE_SCHEDULED_CLEANUP=true
DAILY_CLEANUP_HOUR=2
HOURLY_CACHE_CLEANUP=true
```

## 系统服务安装

### 安装为系统服务

```bash
# 安装服务（需要sudo权限）
sudo ./scripts/resource-manager.sh install

# 启动服务
sudo systemctl start wordpecker-resource-manager

# 查看服务状态
sudo systemctl status wordpecker-resource-manager

# 查看服务日志
sudo journalctl -u wordpecker-resource-manager -f
```

### 卸载系统服务

```bash
# 停止服务
sudo systemctl stop wordpecker-resource-manager

# 卸载服务
sudo ./scripts/resource-manager.sh uninstall
```

## 定时任务设置

### 自动设置定时任务

```bash
# 设置定时清理任务
./scripts/auto-cleanup.sh setup-cron

# 查看当前定时任务
crontab -l
```

### 手动设置定时任务

```bash
# 编辑定时任务
crontab -e

# 添加以下内容：
# 每日凌晨2点完整清理
0 2 * * * /path/to/wordpecker/scripts/auto-cleanup.sh full

# 每小时缓存清理
0 * * * * /path/to/wordpecker/scripts/auto-cleanup.sh cache

# 每5分钟资源检查
*/5 * * * * /path/to/wordpecker/scripts/resource-protection.sh check
```

## 日志文件说明

### 主要日志文件

- `logs/resource-manager.log` - 资源管理器主日志
- `logs/resource-monitor.log` - 系统资源监控日志
- `logs/resource-protection.log` - 资源保护日志
- `logs/resource-alerts.log` - 告警日志
- `logs/cleanup.log` - 清理操作日志

### 日志查看命令

```bash
# 查看实时监控日志
tail -f logs/resource-monitor.log

# 查看告警日志
tail -f logs/resource-alerts.log

# 查看清理日志
tail -f logs/cleanup.log

# 查看最近的告警
grep "WARNING\|CRITICAL" logs/resource-alerts.log | tail -10
```

## 故障排除

### 常见问题

**1. 监控服务无法启动**
```bash
# 检查依赖
./scripts/test-resource-monitoring.sh

# 检查权限
ls -la scripts/

# 手动启动测试
./scripts/system-resource-monitor.sh start
```

**2. 清理功能不工作**
```bash
# 测试清理功能
./scripts/auto-cleanup.sh dry-run

# 检查配置
./scripts/auto-cleanup.sh config

# 手动执行清理
./scripts/auto-cleanup.sh full
```

**3. 告警不生效**
```bash
# 检查配置
./scripts/resource-protection.sh config

# 手动触发检查
./scripts/resource-protection.sh check

# 查看告警日志
tail logs/resource-alerts.log
```

**4. PM2集成问题**
```bash
# 检查PM2状态
pm2 status

# 重启PM2
pm2 restart all

# 检查PM2日志
pm2 logs
```

### 性能调优

**1. 调整监控频率**
```bash
# 编辑监控脚本
vim scripts/system-resource-monitor.sh

# 修改监控间隔（默认60秒）
MONITOR_INTERVAL=30
```

**2. 调整告警阈值**
```bash
# 编辑保护配置
vim config/resource-protection.conf

# 根据实际情况调整阈值
CPU_WARNING_THRESHOLD=85
MEMORY_WARNING_THRESHOLD=90
```

**3. 优化清理策略**
```bash
# 编辑清理配置
vim config/cleanup.conf

# 调整保留时间
LOG_RETENTION_DAYS=3
CACHE_RETENTION_HOURS=12
```

## 最佳实践

### 1. 监控策略
- 在生产环境中启用系统服务模式
- 设置合适的告警阈值避免误报
- 定期查看监控日志了解系统状态

### 2. 清理策略
- 启用定时清理任务
- 根据磁盘空间调整保留策略
- 在清理前启用备份功能

### 3. 告警处理
- 配置邮件或Webhook告警通知
- 建立告警响应流程
- 定期检查告警日志

### 4. 性能优化
- 根据系统负载调整监控频率
- 优化清理策略减少I/O开销
- 监控脚本本身的资源使用

## 技术支持

如果遇到问题，请：

1. 运行测试脚本: `./scripts/test-resource-monitoring.sh`
2. 查看相关日志文件
3. 检查配置文件设置
4. 确认系统依赖完整

更多技术细节请参考源代码注释和设计文档。