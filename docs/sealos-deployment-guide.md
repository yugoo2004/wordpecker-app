# WordPecker Sealos 部署指南

## 概述

本指南详细介绍如何在 Sealos 云平台上部署 WordPecker 应用。WordPecker 是一个基于 Node.js 和 React 的全栈应用，包含后端 API 服务和前端 Web 界面。

## 目录

1. [环境要求](#环境要求)
2. [Sealos 环境准备](#sealos-环境准备)
3. [数据库配置](#数据库配置)
4. [应用部署](#应用部署)
5. [服务管理](#服务管理)
6. [监控和日志](#监控和日志)
7. [故障排查](#故障排查)
8. [成本优化](#成本优化)
9. [维护指南](#维护指南)

## 环境要求

### 系统要求
- **操作系统**: Linux (Ubuntu 20.04+ 推荐)
- **Node.js**: 18.x 或更高版本
- **npm**: 8.x 或更高版本
- **内存**: 最少 1GB，推荐 2GB
- **存储**: 最少 5GB 可用空间
- **网络**: 稳定的互联网连接

### Sealos 资源要求
- **CPU**: 1 核心 (推荐 2 核心)
- **内存**: 1GB (推荐 2GB)
- **存储**: 10GB
- **网络**: 公网访问能力

## Sealos 环境准备

### 1. 创建 Sealos 账户
1. 访问 [Sealos 官网](https://sealos.io)
2. 注册账户并完成实名认证
3. 充值足够的余额用于资源消费

### 2. 创建 Devbox 实例
1. 登录 Sealos 控制台
2. 选择 "Devbox" 服务
3. 创建新的开发环境：
   - **镜像**: Ubuntu 20.04
   - **CPU**: 2 核心
   - **内存**: 2GB
   - **存储**: 20GB
   - **网络**: 启用公网访问

### 3. 配置开发环境
```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y curl wget git vim htop

# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

## 数据库配置

### 1. 创建 MongoDB 实例
1. 在 Sealos 控制台选择 "数据库" 服务
2. 创建 MongoDB 实例：
   - **版本**: MongoDB 5.0+
   - **CPU**: 1 核心
   - **内存**: 1GB
   - **存储**: 10GB
   - **网络**: 内网访问

### 2. 获取数据库连接信息
```bash
# 数据库连接字符串示例
MONGODB_URI=mongodb://username:password@mongodb-host:27017/wordpecker
```

### 3. 配置数据库访问
```bash
# 在 Devbox 中测试数据库连接
mongo "mongodb://username:password@mongodb-host:27017/wordpecker"
```

## 应用部署

### 1. 克隆项目代码
```bash
# 进入工作目录
cd /home/devbox

# 克隆项目（替换为实际的仓库地址）
git clone https://github.com/your-username/wordpecker.git project
cd project
```

### 2. 配置环境变量

#### 后端环境配置
```bash
# 创建后端环境变量文件
cp backend/.env.example backend/.env

# 编辑后端配置
vim backend/.env
```

**后端环境变量配置 (backend/.env)**:
```env
# 服务配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 数据库配置
MONGODB_URI=mongodb://username:password@mongodb-host:27017/wordpecker
DB_NAME=wordpecker

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# CORS 配置
CORS_ORIGIN=http://101.126.5.123:5173,http://localhost:5173

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log

# 其他配置
API_PREFIX=/api
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### 前端环境配置
```bash
# 创建前端环境变量文件
cp frontend/.env.example frontend/.env

# 编辑前端配置
vim frontend/.env
```

**前端环境变量配置 (frontend/.env)**:
```env
# API 配置
VITE_API_URL=http://101.126.5.123:3000
VITE_API_PREFIX=/api

# 应用配置
VITE_APP_TITLE=WordPecker
VITE_APP_VERSION=1.0.0

# 开发配置
VITE_DEV_SERVER_HOST=0.0.0.0
VITE_DEV_SERVER_PORT=5173
```

### 3. 安装依赖和构建

#### 后端部署
```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 构建项目
npm run build

# 测试数据库连接
npx ts-node src/scripts/testMongoConnection.ts

# 返回项目根目录
cd ..
```

#### 前端部署
```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 构建生产版本（可选）
npm run build

# 返回项目根目录
cd ..
```

### 4. 启动应用

#### 方式一：使用启动脚本（推荐）
```bash
# 使用完整应用启动脚本
./scripts/start-app.sh

# 选择启动选项：
# 1. 启动完整应用 (后端 + 前端)
# 4. 后台启动完整应用
```

#### 方式二：使用 PM2 进程管理
```bash
# 安装 PM2
npm install -g pm2

# 使用 PM2 启动
./scripts/pm2-start.sh

# 选择启动选项：
# 1. 启动完整应用 (后端 + 前端开发模式)
# 4. 后台重启完整应用
```

#### 方式三：使用 systemd 服务
```bash
# 配置 systemd 服务
./scripts/setup-systemd.sh

# 管理 systemd 服务
./scripts/systemd-manage.sh
```

### 5. 验证部署
```bash
# 检查服务状态
./scripts/status-app.sh

# 测试后端 API
curl http://localhost:3000/api/health

# 测试前端访问
curl http://localhost:5173
```

## 服务管理

### 启动脚本使用

#### 基本启动脚本
```bash
# 启动后端服务
./scripts/start-backend.sh

# 启动前端服务
./scripts/start-frontend.sh

# 启动完整应用
./scripts/start-app.sh

# 停止所有服务
./scripts/stop-app.sh

# 重启应用
./scripts/restart-app.sh

# 查看服务状态
./scripts/status-app.sh
```

#### PM2 进程管理
```bash
# PM2 启动
./scripts/pm2-start.sh

# PM2 停止
./scripts/pm2-stop.sh

# 查看 PM2 状态
pm2 list

# 查看 PM2 日志
pm2 logs

# PM2 监控面板
pm2 monit
```

#### systemd 服务管理
```bash
# systemd 管理
./scripts/systemd-manage.sh

# 手动 systemd 命令
systemctl --user start wordpecker-backend.service
systemctl --user start wordpecker-frontend.service
systemctl --user status wordpecker-backend.service
```

### 网络访问配置

#### 内网访问
- **后端**: `http://10.108.38.66:3000`
- **前端**: `http://10.108.38.66:5173`

#### 公网访问
- **后端**: `http://101.126.5.123:3000`
- **前端**: `http://101.126.5.123:5173`

#### 本地访问
- **后端**: `http://localhost:3000`
- **前端**: `http://localhost:5173`

## 监控和日志

### 日志管理

#### 应用日志位置
```bash
# 应用日志目录
ls -la logs/

# 主要日志文件
logs/backend.log          # 后端应用日志
logs/frontend.log         # 前端应用日志
logs/pm2-backend-*.log    # PM2 后端日志
logs/pm2-frontend-*.log   # PM2 前端日志
logs/systemd-*.log        # systemd 服务日志
```

#### 日志查看命令
```bash
# 查看实时日志
tail -f logs/backend.log
tail -f logs/frontend.log

# 查看 PM2 日志
pm2 logs
pm2 logs wordpecker-backend

# 查看 systemd 日志
journalctl --user -u wordpecker-backend.service -f
```

#### 日志轮转配置
```bash
# 设置日志轮转
./scripts/setup-logrotate.sh

# 测试日志轮转
./scripts/test-logrotate.sh

# 管理 PM2 日志
./scripts/pm2-logs.sh
```

### 系统监控

#### 监控脚本
```bash
# 系统监控
./scripts/monitor.sh

# 持续监控模式
./scripts/monitor.sh --watch
```

#### 资源监控
```bash
# CPU 和内存使用
htop

# 磁盘使用
df -h

# 网络连接
netstat -tulpn | grep :3000
netstat -tulpn | grep :5173

# 进程监控
ps aux | grep node
```

### 健康检查

#### 自动健康检查
```bash
# 后端健康检查
curl http://localhost:3000/api/health

# 前端健康检查
curl http://localhost:5173

# 数据库连接检查
cd backend && npx ts-node src/scripts/testMongoConnection.ts
```

## 故障排查

### 常见问题及解决方案

#### 1. 服务无法启动

**问题**: 后端服务启动失败
```bash
# 检查端口占用
lsof -i :3000

# 检查日志
tail -f logs/backend.log

# 检查环境变量
cat backend/.env

# 检查数据库连接
cd backend && npx ts-node src/scripts/testMongoConnection.ts
```

**解决方案**:
- 确保端口未被占用
- 检查环境变量配置
- 验证数据库连接
- 检查依赖安装

#### 2. 前端无法访问后端

**问题**: 前端无法连接到后端 API
```bash
# 检查后端服务状态
curl http://localhost:3000/api/health

# 检查 CORS 配置
grep CORS_ORIGIN backend/.env

# 检查前端 API 配置
grep VITE_API_URL frontend/.env
```

**解决方案**:
- 确保后端服务正在运行
- 检查 CORS 配置
- 验证 API URL 配置
- 检查网络连接

#### 3. 数据库连接问题

**问题**: 无法连接到 MongoDB
```bash
# 测试数据库连接
mongo "mongodb://username:password@mongodb-host:27017/wordpecker"

# 检查数据库服务状态（在 Sealos 控制台）
# 检查网络连接
ping mongodb-host
```

**解决方案**:
- 验证数据库服务状态
- 检查连接字符串
- 确认网络访问权限
- 检查用户名密码

#### 4. 内存不足

**问题**: 应用因内存不足而崩溃
```bash
# 检查内存使用
free -h

# 检查进程内存使用
ps aux --sort=-%mem | head

# 检查 PM2 内存限制
pm2 show wordpecker-backend
```

**解决方案**:
- 增加 Sealos 实例内存
- 配置 PM2 内存限制
- 优化应用内存使用
- 启用内存监控

#### 5. 磁盘空间不足

**问题**: 磁盘空间不足
```bash
# 检查磁盘使用
df -h

# 检查大文件
du -sh * | sort -hr

# 清理日志文件
find logs/ -name "*.log" -mtime +7 -delete
```

**解决方案**:
- 清理旧日志文件
- 配置日志轮转
- 增加存储空间
- 定期清理临时文件

### 调试工具

#### 日志分析
```bash
# 搜索错误日志
grep -i error logs/*.log

# 搜索特定时间的日志
grep "2024-01-01" logs/backend.log

# 统计错误数量
grep -c "ERROR" logs/backend.log
```

#### 性能分析
```bash
# CPU 使用分析
top -p $(pgrep -f "node.*backend")

# 内存使用分析
pmap $(pgrep -f "node.*backend")

# 网络连接分析
ss -tulpn | grep :3000
```

## 成本优化

### 资源优化建议

#### 1. CPU 优化
- **开发环境**: 1 核心足够
- **生产环境**: 2 核心推荐
- **高负载**: 根据实际需求扩展

#### 2. 内存优化
- **最小配置**: 1GB
- **推荐配置**: 2GB
- **优化策略**: 
  - 配置 PM2 内存限制
  - 启用内存监控
  - 定期重启服务

#### 3. 存储优化
- **基础存储**: 10GB
- **日志管理**: 配置日志轮转
- **清理策略**: 定期清理临时文件

#### 4. 网络优化
- **内网通信**: 优先使用内网地址
- **CDN**: 考虑使用 CDN 加速静态资源
- **压缩**: 启用 gzip 压缩

### 成本监控

#### 1. 资源使用监控
```bash
# 定期检查资源使用
./scripts/monitor.sh

# 设置资源告警
# 在 Sealos 控制台配置资源告警
```

#### 2. 成本分析
- 定期查看 Sealos 账单
- 分析资源使用趋势
- 优化资源配置

#### 3. 自动化管理
```bash
# 设置定时任务清理日志
crontab -e
# 添加: 0 2 * * * find /home/devbox/project/logs -name "*.log" -mtime +7 -delete
```

## 维护指南

### 日常维护任务

#### 1. 系统更新
```bash
# 每周执行系统更新
sudo apt update && sudo apt upgrade -y

# 更新 Node.js 依赖
cd backend && npm update
cd frontend && npm update
```

#### 2. 日志管理
```bash
# 每日检查日志大小
du -sh logs/*

# 清理旧日志
find logs/ -name "*.log" -mtime +30 -delete

# 压缩日志文件
gzip logs/*.log.1
```

#### 3. 数据库维护
```bash
# 数据库备份（在 Sealos 控制台操作）
# 定期检查数据库性能
# 清理过期数据
```

#### 4. 安全更新
```bash
# 检查安全更新
sudo apt list --upgradable | grep security

# 更新应用依赖
npm audit
npm audit fix
```

### 备份策略

#### 1. 代码备份
```bash
# Git 仓库备份
git push origin main

# 创建代码快照
tar -czf wordpecker-backup-$(date +%Y%m%d).tar.gz project/
```

#### 2. 配置备份
```bash
# 备份环境配置
cp backend/.env backend/.env.backup
cp frontend/.env frontend/.env.backup

# 备份服务配置
cp ecosystem.config.js ecosystem.config.js.backup
```

#### 3. 数据库备份
- 使用 Sealos 数据库自动备份功能
- 定期导出重要数据
- 测试备份恢复流程

### 监控告警

#### 1. 服务监控
```bash
# 设置服务健康检查
# 配置告警通知
# 监控关键指标
```

#### 2. 资源监控
- CPU 使用率 > 80%
- 内存使用率 > 85%
- 磁盘使用率 > 90%
- 网络异常

#### 3. 应用监控
- API 响应时间
- 错误率
- 用户访问量
- 数据库连接状态

### 升级指南

#### 1. 应用升级
```bash
# 拉取最新代码
git pull origin main

# 安装新依赖
npm install

# 构建新版本
npm run build

# 重启服务
./scripts/restart-app.sh
```

#### 2. 系统升级
```bash
# 升级系统包
sudo apt update && sudo apt upgrade -y

# 升级 Node.js
# 根据需要升级到新版本

# 重启服务
sudo reboot
```

## 总结

本指南涵盖了 WordPecker 应用在 Sealos 平台上的完整部署流程，包括环境准备、应用部署、服务管理、监控维护等各个方面。

### 关键要点
1. **环境配置**: 正确配置 Sealos 环境和依赖
2. **服务管理**: 使用多种方式管理应用服务
3. **监控维护**: 建立完善的监控和维护机制
4. **故障排查**: 掌握常见问题的解决方法
5. **成本优化**: 合理配置资源以控制成本

### 支持资源
- **脚本工具**: 项目提供了完整的管理脚本
- **配置模板**: 包含各种配置文件模板
- **监控工具**: 内置监控和日志管理工具
- **文档支持**: 详细的操作文档和故障排查指南

如有问题，请参考故障排查章节或联系技术支持。