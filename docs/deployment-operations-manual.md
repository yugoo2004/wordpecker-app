# WordPecker 部署操作手册

## 概述

本手册提供 WordPecker 应用在 Sealos devbox 环境中的完整部署操作指南，包括初始部署、日常维护、故障排除和最佳实践。

## 目录

1. [快速开始](#快速开始)
2. [部署前准备](#部署前准备)
3. [初始化部署](#初始化部署)
4. [日常操作](#日常操作)
5. [监控和维护](#监控和维护)
6. [故障排除](#故障排除)
7. [最佳实践](#最佳实践)
8. [API 参考](#api-参考)

## 快速开始

### 一键部署

```bash
# 1. 克隆项目
git clone <repository-url> /home/devbox/wordpecker-app
cd /home/devbox/wordpecker-app

# 2. 初始化环境
chmod +x scripts/*.sh
./scripts/init-deployment-environment.sh

# 3. 配置环境变量
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# 编辑 .env 文件，填入必要的配置

# 4. 执行自动化部署
./scripts/complete-auto-deployment.sh

# 5. 验证部署
curl http://localhost:3000/api/health
curl http://localhost:5173
```

### 快速状态检查

```bash
# 检查服务状态
pm2 status

# 检查健康状态
./scripts/optimized-health-check.sh --status

# 检查资源使用
./scripts/optimized-resource-monitor.sh --metrics

# 查看日志
pm2 logs --lines 50
```

## 部署前准备

### 系统要求

- **操作系统**: Ubuntu 22.04 LTS (Sealos devbox)
- **Node.js**: >= 18.0.0
- **内存**: >= 2GB 可用内存
- **磁盘**: >= 10GB 可用空间
- **网络**: 稳定的互联网连接

### 必需的环境变量

#### 后端环境变量 (backend/.env)

```bash
# 数据库配置
MONGODB_URL=mongodb://your-mongodb-url

# OpenAI API 配置
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4

# ElevenLabs API 配置 (可选)
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Pexels API 配置 (可选)
PEXELS_API_KEY=your-pexels-api-key

# 服务配置
PORT=3000
NODE_ENV=production

# 日志配置
LOG_LEVEL=info
```

#### 前端环境变量 (frontend/.env)

```bash
# API 配置
VITE_API_URL=http://localhost:3000

# 环境配置
NODE_ENV=production
```

### 依赖检查清单

- [ ] Node.js 和 npm 已安装
- [ ] PM2 全局安装 (`npm install -g pm2`)
- [ ] MongoDB 连接可用
- [ ] OpenAI API 密钥有效
- [ ] 防火墙端口 3000 和 5173 已开放
- [ ] 足够的系统资源

## 初始化部署

### 步骤 1: 环境初始化

```bash
# 运行环境初始化脚本
./scripts/init-deployment-environment.sh

# 验证初始化结果
./scripts/verify-deployment-environment.sh
```

初始化脚本会执行以下操作：
- 安装系统依赖
- 配置 PM2
- 设置 Systemd 服务
- 创建必要目录
- 配置 Cron 任务

### 步骤 2: 配置验证

```bash
# 检查环境变量
./scripts/verify-environment.sh

# 测试数据库连接
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URL)
  .then(() => console.log('数据库连接成功'))
  .catch(err => console.error('数据库连接失败:', err.message));
"

# 测试 API 密钥
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

### 步骤 3: 首次部署

```bash
# 执行完整自动化部署
./scripts/complete-auto-deployment.sh

# 或者分步执行
./scripts/pre-deploy-check.sh
./scripts/deploy.sh
./scripts/post-deploy-verify.sh
```

### 步骤 4: 服务启动

```bash
# 启动 Systemd 服务
sudo systemctl start wordpecker
sudo systemctl enable wordpecker

# 验证服务状态
sudo systemctl status wordpecker
pm2 status
```

## 日常操作

### 服务管理

#### 启动服务

```bash
# 使用 PM2
pm2 start ecosystem.config.js --env production

# 使用 Systemd
sudo systemctl start wordpecker

# 使用脚本
./scripts/start-app.sh
```

#### 停止服务

```bash
# 使用 PM2
pm2 stop all

# 使用 Systemd
sudo systemctl stop wordpecker

# 使用脚本
./scripts/stop-app.sh
```

#### 重启服务

```bash
# 热重载（推荐）
pm2 reload all --update-env

# 完全重启
pm2 restart all

# 使用脚本
./scripts/restart-app.sh
```

#### 查看状态

```bash
# PM2 状态
pm2 status
pm2 monit

# Systemd 状态
sudo systemctl status wordpecker

# 详细状态
./scripts/status-app.sh
```

### 日志管理

#### 查看实时日志

```bash
# PM2 日志
pm2 logs

# 特定服务日志
pm2 logs wordpecker-backend
pm2 logs wordpecker-frontend

# 系统日志
journalctl -u wordpecker -f
```

#### 日志文件位置

```
logs/
├── pm2-backend-combined.log     # 后端综合日志
├── pm2-backend-error.log        # 后端错误日志
├── pm2-frontend-combined.log    # 前端综合日志
├── pm2-frontend-error.log       # 前端错误日志
├── health-check-optimized.log   # 健康检查日志
├── resource-monitor-optimized.log # 资源监控日志
└── complete-auto-deployment.log # 部署日志
```

#### 日志清理

```bash
# 手动清理
./scripts/log-cleanup.sh

# 查看日志统计
du -sh logs/*

# PM2 日志清理
pm2 flush
```

### 代码更新

#### 标准更新流程

```bash
# 1. 备份当前版本
./scripts/deploy.sh --backup-only

# 2. 拉取最新代码
git fetch origin
git reset --hard origin/main

# 3. 更新依赖
cd backend && npm ci --production
cd ../frontend && npm ci && npm run build

# 4. 重启服务
pm2 reload all --update-env

# 5. 验证更新
./scripts/post-deploy-verify.sh
```

#### 自动化更新

```bash
# 完整自动化更新
./scripts/complete-auto-deployment.sh

# 仅代码更新
./scripts/deploy.sh --code-only
```

#### 回滚操作

```bash
# 查看可用备份
ls -la /home/devbox/backups/

# 回滚到指定版本
./scripts/deploy.sh --rollback /home/devbox/backups/wordpecker-20240101-120000
```

## 监控和维护

### 健康检查

#### 自动健康检查

```bash
# 查看健康检查状态
./scripts/optimized-health-check.sh --status

# 查看性能指标
./scripts/optimized-health-check.sh --metrics

# 手动执行健康检查
./scripts/optimized-health-check.sh
```

#### 健康检查端点

```bash
# 基础健康检查
curl http://localhost:3000/api/health

# 详细就绪检查
curl http://localhost:3000/api/ready

# 前端健康检查
curl http://localhost:5173
```

### 资源监控

#### 系统资源监控

```bash
# 查看资源使用情况
./scripts/optimized-resource-monitor.sh --metrics

# 执行资源监控
./scripts/optimized-resource-monitor.sh

# 手动清理资源
./scripts/optimized-resource-monitor.sh --cleanup
```

#### 监控指标

- **CPU 使用率**: 警告 65%, 严重 80%
- **内存使用率**: 警告 70%, 严重 85%
- **磁盘使用率**: 警告 75%, 严重 85%
- **响应时间**: 警告 2秒, 严重 5秒

### 远程管理

#### 管理 API 端点

```bash
# 获取服务状态
curl http://localhost:3000/api/management/status

# 重启服务
curl -X POST http://localhost:3000/api/management/restart/backend
curl -X POST http://localhost:3000/api/management/restart/frontend
curl -X POST http://localhost:3000/api/management/restart/all

# 获取日志
curl http://localhost:3000/api/management/logs/backend?lines=100
curl http://localhost:3000/api/management/logs/frontend?lines=100
```

#### 高可用性管理

```bash
# 查看高可用性状态
curl http://localhost:3000/api/high-availability/status

# 启动高可用性管理
curl -X POST http://localhost:3000/api/high-availability/start

# 停止高可用性管理
curl -X POST http://localhost:3000/api/high-availability/stop
```

### 定期维护任务

#### 每日维护

```bash
# 健康检查和资源监控（自动执行）
# Cron: */5 * * * * /home/devbox/wordpecker-app/scripts/optimized-health-check.sh
# Cron: */10 * * * * /home/devbox/wordpecker-app/scripts/optimized-resource-monitor.sh

# 日志清理（自动执行）
# Cron: 0 2 * * * /home/devbox/wordpecker-app/scripts/log-cleanup.sh
```

#### 每周维护

```bash
# 1. 检查系统更新
sudo apt update && sudo apt list --upgradable

# 2. 检查 Node.js 和 npm 更新
npm outdated -g

# 3. 清理旧备份
find /home/devbox/backups -type d -mtime +30 -exec rm -rf {} \;

# 4. 检查磁盘空间
df -h

# 5. 检查服务性能
./scripts/optimized-health-check.sh --metrics
./scripts/optimized-resource-monitor.sh --metrics
```

#### 每月维护

```bash
# 1. 更新依赖包
cd backend && npm audit && npm update
cd ../frontend && npm audit && npm update

# 2. 检查安全更新
sudo apt list --upgradable | grep -i security

# 3. 备份配置文件
tar -czf /home/devbox/backups/config-$(date +%Y%m%d).tar.gz \
  backend/.env frontend/.env ecosystem.config.js

# 4. 性能分析
pm2 monit
```

## 故障排除

### 常见问题

#### 1. 服务无法启动

**症状**: PM2 显示服务状态为 "errored" 或 "stopped"

**排查步骤**:

```bash
# 1. 查看错误日志
pm2 logs wordpecker-backend --err
pm2 logs wordpecker-frontend --err

# 2. 检查环境变量
./scripts/verify-environment.sh

# 3. 检查端口占用
netstat -tlnp | grep :3000
netstat -tlnp | grep :5173

# 4. 检查依赖
cd backend && npm ls
cd ../frontend && npm ls

# 5. 手动启动测试
cd backend && npm start
cd ../frontend && npm run preview
```

**解决方案**:

```bash
# 重新安装依赖
cd backend && rm -rf node_modules && npm ci
cd ../frontend && rm -rf node_modules && npm ci

# 重新构建
cd frontend && npm run build

# 重启服务
pm2 delete all
pm2 start ecosystem.config.js --env production
```

#### 2. 数据库连接失败

**症状**: 后端日志显示 MongoDB 连接错误

**排查步骤**:

```bash
# 1. 测试数据库连接
node -e "
const mongoose = require('mongoose');
mongoose.connect('$MONGODB_URL')
  .then(() => console.log('连接成功'))
  .catch(err => console.error('连接失败:', err));
"

# 2. 检查网络连接
ping <mongodb-host>
telnet <mongodb-host> <mongodb-port>

# 3. 检查环境变量
echo $MONGODB_URL
```

**解决方案**:

```bash
# 1. 更新数据库 URL
vim backend/.env

# 2. 重启服务
pm2 restart wordpecker-backend

# 3. 如果问题持续，检查数据库服务状态
```

#### 3. 高内存使用

**症状**: 系统内存使用率持续高于 85%

**排查步骤**:

```bash
# 1. 查看进程内存使用
ps aux --sort=-%mem | head -10

# 2. 查看 PM2 进程内存
pm2 monit

# 3. 检查内存泄漏
node --inspect backend/dist/app.js
```

**解决方案**:

```bash
# 1. 重启内存使用高的服务
pm2 restart wordpecker-backend

# 2. 清理缓存
./scripts/optimized-resource-monitor.sh --cleanup

# 3. 调整 PM2 内存限制
# 编辑 ecosystem.config.js
max_memory_restart: '400M'
```

#### 4. 响应时间过慢

**症状**: API 响应时间超过 5 秒

**排查步骤**:

```bash
# 1. 测试响应时间
time curl http://localhost:3000/api/health

# 2. 检查系统负载
top
htop
uptime

# 3. 检查网络延迟
ping localhost
```

**解决方案**:

```bash
# 1. 重启服务
pm2 reload all

# 2. 检查数据库性能
# 优化数据库查询

# 3. 增加服务实例
pm2 scale wordpecker-backend +1
```

### 错误代码参考

#### HTTP 错误代码

- **500**: 内部服务器错误 - 检查后端日志
- **502**: 网关错误 - 检查服务是否运行
- **503**: 服务不可用 - 检查服务状态
- **504**: 网关超时 - 检查响应时间

#### PM2 状态代码

- **online**: 服务正常运行
- **stopped**: 服务已停止
- **stopping**: 服务正在停止
- **errored**: 服务出现错误
- **fork**: 进程模式
- **cluster**: 集群模式

### 日志分析

#### 关键日志模式

```bash
# 错误模式
grep -i "error\|exception\|failed" logs/*.log

# 性能问题
grep -i "timeout\|slow\|memory" logs/*.log

# 数据库问题
grep -i "mongodb\|connection\|database" logs/*.log

# API 问题
grep -i "api\|request\|response" logs/*.log
```

#### 日志级别

- **ERROR**: 需要立即处理的错误
- **WARN**: 需要关注的警告
- **INFO**: 一般信息
- **DEBUG**: 调试信息

## 最佳实践

### 部署最佳实践

1. **始终备份**: 部署前创建备份
2. **分步部署**: 使用分步部署减少风险
3. **验证测试**: 部署后执行完整验证
4. **监控告警**: 设置适当的监控和告警
5. **文档更新**: 保持部署文档最新

### 安全最佳实践

1. **环境变量**: 敏感信息使用环境变量
2. **访问控制**: 限制管理 API 访问
3. **日志安全**: 避免在日志中记录敏感信息
4. **定期更新**: 定期更新依赖和系统
5. **备份加密**: 对备份文件进行加密

### 性能最佳实践

1. **资源监控**: 定期监控系统资源
2. **缓存策略**: 合理使用缓存
3. **连接池**: 优化数据库连接池
4. **负载均衡**: 使用 PM2 集群模式
5. **定期清理**: 定期清理临时文件和日志

### 维护最佳实践

1. **定期检查**: 建立定期检查制度
2. **自动化**: 尽可能自动化维护任务
3. **文档记录**: 记录所有维护操作
4. **测试环境**: 在测试环境验证变更
5. **回滚计划**: 准备回滚计划

## API 参考

### 健康检查 API

#### GET /api/health

基础健康检查端点

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 134217728,
    "heapTotal": 67108864,
    "heapUsed": 33554432
  },
  "version": "1.0.0"
}
```

#### GET /api/ready

详细就绪状态检查

**响应示例**:
```json
{
  "status": "ready",
  "database": "connected",
  "apis": {
    "openai": "configured",
    "elevenlabs": "configured",
    "pexels": "configured"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 管理 API

#### GET /api/management/status

获取服务状态

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "name": "wordpecker-backend",
      "status": "online",
      "uptime": 3600000,
      "memory": 134217728,
      "cpu": 5.2,
      "restarts": 0
    }
  ]
}
```

#### POST /api/management/restart/:service

重启指定服务

**参数**:
- `service`: 服务名称 (backend/frontend/all)

**响应示例**:
```json
{
  "success": true,
  "message": "Service backend restarted successfully",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET /api/management/logs/:service

获取服务日志

**参数**:
- `service`: 服务名称
- `lines`: 日志行数 (可选，默认 100)

**响应示例**:
```json
{
  "success": true,
  "data": "2024-01-01 12:00:00 [INFO] Server started on port 3000\n...",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 高可用性 API

#### GET /api/high-availability/status

获取高可用性状态

**响应示例**:
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "summary": {
      "totalInstances": 2,
      "healthyServices": 2,
      "failedServices": 0
    },
    "services": [
      {
        "name": "wordpecker-backend",
        "status": "healthy",
        "instances": 1
      }
    ]
  }
}
```

## 联系和支持

如果遇到本手册未涵盖的问题，请：

1. 查看项目 GitHub Issues
2. 检查日志文件获取详细错误信息
3. 使用 `./scripts/optimized-health-check.sh --metrics` 收集系统信息
4. 联系技术支持团队

---

**版本**: 1.0.0  
**最后更新**: 2024-01-01  
**维护者**: WordPecker 开发团队