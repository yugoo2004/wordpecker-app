# WordPecker Systemd 服务管理

本目录包含用于管理 WordPecker 应用系统级服务的脚本和配置文件。

## 文件说明

### 配置文件
- `wordpecker.service` - Systemd 服务配置文件
- `README-systemd.md` - 本说明文档

### 脚本文件
- `setup-systemd.sh` - 服务安装和配置脚本
- `test-systemd-service.sh` - 服务功能测试脚本
- `manage-systemd-service.sh` - 服务管理便捷工具

## 快速开始

### 1. 安装服务
```bash
# 安装 Systemd 服务
sudo ./scripts/setup-systemd.sh
```

### 2. 管理服务
```bash
# 使用管理工具
sudo ./scripts/manage-systemd-service.sh start    # 启动服务
sudo ./scripts/manage-systemd-service.sh stop     # 停止服务
sudo ./scripts/manage-systemd-service.sh restart  # 重启服务
sudo ./scripts/manage-systemd-service.sh status   # 查看状态

# 或直接使用 systemctl
sudo systemctl start wordpecker
sudo systemctl stop wordpecker
sudo systemctl restart wordpecker
sudo systemctl status wordpecker
```

### 3. 测试服务
```bash
# 运行完整测试套件
sudo ./scripts/test-systemd-service.sh
```

## 服务特性

### 自动重启策略
- 服务异常退出时自动重启
- 最大重启次数限制：5次/5分钟
- 重启延迟：10秒

### 依赖管理
- 依赖网络服务启动
- 确保在网络可用后启动

### 安全配置
- 以非特权用户运行
- 限制文件系统访问
- 资源使用限制

### 日志管理
- 系统日志：`journalctl -u wordpecker`
- 应用日志：`/home/devbox/wordpecker-app/logs/`

## 故障排除

### 服务启动失败
```bash
# 查看详细状态
sudo systemctl status wordpecker -l

# 查看日志
sudo journalctl -u wordpecker -f

# 检查配置文件
sudo systemctl cat wordpecker
```

### 权限问题
```bash
# 检查文件权限
ls -la /etc/systemd/system/wordpecker.service
ls -la /home/devbox/wordpecker-app/

# 修复权限
sudo chown -R devbox:devbox /home/devbox/wordpecker-app/
```

### PM2 相关问题
```bash
# 检查 PM2 状态
sudo -u devbox pm2 list

# 重置 PM2
sudo -u devbox pm2 kill
sudo -u devbox pm2 start ecosystem.config.js --env production
```

## 卸载服务

```bash
# 使用管理工具卸载
sudo ./scripts/manage-systemd-service.sh uninstall

# 或手动卸载
sudo systemctl stop wordpecker
sudo systemctl disable wordpecker
sudo rm /etc/systemd/system/wordpecker.service
sudo systemctl daemon-reload
```

## 注意事项

1. **权限要求**: 所有服务管理操作需要 root 权限
2. **用户配置**: 服务配置为以 `devbox` 用户运行
3. **路径依赖**: 项目路径固定为 `/home/devbox/wordpecker-app`
4. **PM2 依赖**: 需要预先安装和配置 PM2

## 监控和维护

### 定期检查
```bash
# 检查服务状态
sudo systemctl is-active wordpecker
sudo systemctl is-enabled wordpecker

# 查看资源使用
sudo systemctl show wordpecker --property=MemoryCurrent
sudo systemctl show wordpecker --property=CPUUsageNSec
```

### 日志轮转
系统日志会自动轮转，应用日志需要配置 logrotate 或使用 PM2 的日志管理功能。

### 更新服务
修改服务配置后需要重新加载：
```bash
sudo systemctl daemon-reload
sudo systemctl restart wordpecker
```