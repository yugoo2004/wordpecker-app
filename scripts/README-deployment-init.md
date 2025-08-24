# WordPecker 部署初始化脚本说明

## 概述

本目录包含了 WordPecker 应用在 Sealos devbox 环境中进行完整部署初始化的脚本集合。这些脚本实现了一键环境初始化、系统服务配置和部署环境验证。

## 🚀 快速开始

### 一键完整初始化

```bash
# 运行完整初始化脚本（推荐）
./scripts/init-complete-deployment.sh
```

这个脚本会自动执行所有初始化步骤，包括：
- 环境初始化和依赖安装
- Systemd 服务配置
- 定时任务设置
- 部署环境验证

### 分步执行

如果需要分步执行或调试特定步骤，可以单独运行各个脚本：

```bash
# 1. 环境初始化
./scripts/init-deployment-environment.sh

# 2. Systemd 服务配置
./scripts/setup-systemd-service.sh

# 3. 定时任务设置
./scripts/setup-cron-tasks.sh

# 4. 环境验证
./scripts/verify-deployment-environment.sh
```

## 📋 脚本详细说明

### 1. init-complete-deployment.sh
**主初始化脚本** - 一键完成所有初始化操作

**功能：**
- 整合所有初始化步骤
- 提供友好的用户界面
- 生成完整的初始化报告
- 创建快速参考文档

**使用场景：**
- 首次部署 WordPecker 应用
- 重新初始化部署环境
- 自动化部署流程

### 2. init-deployment-environment.sh
**环境初始化脚本** - 安装依赖和配置基础环境

**功能：**
- 检查系统要求（内存、磁盘、CPU）
- 安装系统依赖（curl, git, jq, bc 等）
- 安装和配置 Node.js 18.x
- 安装和配置 PM2 进程管理器
- 创建项目目录结构
- 安装项目依赖
- 生成环境变量模板

**检查项：**
- ✅ 操作系统兼容性
- ✅ 系统资源充足性
- ✅ 必要软件安装
- ✅ 项目依赖完整性

### 3. setup-systemd-service.sh
**系统服务配置脚本** - 配置开机自启动和系统级服务管理

**功能：**
- 创建 Systemd 服务文件
- 配置 PM2 启动脚本
- 启用服务自动启动
- 创建服务管理脚本
- 验证服务配置

**生成的管理脚本：**
- `service-start.sh` - 启动服务
- `service-stop.sh` - 停止服务
- `service-restart.sh` - 重启服务
- `service-status.sh` - 查看状态

### 4. verify-deployment-environment.sh
**环境验证脚本** - 全面验证部署环境的完整性

**验证项目：**
- 🔍 系统要求（内存、磁盘、CPU）
- 🔍 软件依赖（Node.js, npm, PM2）
- 🔍 项目结构完整性
- 🔍 项目依赖安装状态
- 🔍 环境变量配置
- 🔍 Systemd 服务配置
- 🔍 定时任务配置
- 🔍 网络连接状态
- 🔍 数据库连接
- 🔍 服务端口可用性

**输出：**
- 详细的验证报告
- 通过率统计
- 问题修复建议

### 5. log-cleanup.sh
**日志清理脚本** - 定期清理过期日志和缓存文件

**清理内容：**
- 应用日志文件（保留7天）
- PM2 日志文件
- 音频缓存文件（保留24小时）
- 备份文件（保留30天）
- 系统临时文件

**特性：**
- 智能磁盘空间检查
- 强制清理机制
- 详细清理报告

## 📁 生成的文件和目录

初始化完成后，会创建以下结构：

```
wordpecker-app/
├── logs/                          # 日志目录
│   ├── init-deployment.log        # 初始化日志
│   ├── systemd-setup.log         # Systemd 配置日志
│   ├── environment-verification.log # 验证日志
│   └── cron/                      # 定时任务日志
├── scripts/                       # 脚本目录
│   ├── service-*.sh              # 服务管理脚本
│   └── ...
├── .env                          # 环境变量文件
├── DEPLOYMENT_QUICK_REFERENCE.md # 快速参考
└── /etc/systemd/system/wordpecker.service # 系统服务文件
```

## ⚙️ 配置说明

### 环境变量配置

初始化后需要编辑 `.env` 文件：

```bash
# 编辑环境变量
nano .env
```

**必需配置：**
- `MONGODB_URL` - MongoDB 连接字符串
- `OPENAI_API_KEY` - OpenAI API 密钥

**可选配置：**
- `ELEVENLABS_API_KEY` - ElevenLabs API 密钥
- `PEXELS_API_KEY` - Pexels API 密钥

### 定时任务配置

自动配置的定时任务：

```bash
# 健康检查 - 每分钟
* * * * * /path/to/health-check.sh

# 资源监控 - 每5分钟
*/5 * * * * /path/to/resource-monitor.sh

# 日志清理 - 每天凌晨2点
0 2 * * * /path/to/log-cleanup.sh

# 缓存清理 - 每天凌晨3点
0 3 * * * find /path/to/audio-cache -mtime +1 -delete

# PM2日志轮转 - 每周日凌晨4点
0 4 * * 0 pm2 flush
```

## 🔧 故障排除

### 常见问题

1. **权限错误**
   ```bash
   # 修复脚本权限
   chmod +x scripts/*.sh
   
   # 修复目录权限
   sudo chown -R devbox:devbox /home/devbox/wordpecker-app
   ```

2. **依赖安装失败**
   ```bash
   # 更新包管理器
   sudo apt update
   
   # 重新运行环境初始化
   ./scripts/init-deployment-environment.sh
   ```

3. **服务配置失败**
   ```bash
   # 检查 sudo 权限
   sudo -v
   
   # 重新配置服务
   ./scripts/setup-systemd-service.sh
   ```

4. **环境验证失败**
   ```bash
   # 查看详细验证报告
   cat logs/environment-verification-*.log
   
   # 根据报告修复问题后重新验证
   ./scripts/verify-deployment-environment.sh
   ```

### 日志查看

```bash
# 查看初始化日志
tail -f logs/complete-deployment-init.log

# 查看系统服务日志
sudo journalctl -u wordpecker -f

# 查看 PM2 日志
pm2 logs

# 查看定时任务日志
tail -f logs/cron/*.log
```

## 📊 验证检查清单

初始化完成后，确保以下项目都正常：

- [ ] Node.js 版本 ≥ 16.0.0
- [ ] PM2 已安装并配置
- [ ] 项目依赖已安装
- [ ] 环境变量已配置
- [ ] Systemd 服务已启用
- [ ] 定时任务已设置
- [ ] 数据库连接正常
- [ ] 网络连接正常
- [ ] 服务端口可用

## 🚀 下一步操作

初始化完成后：

1. **配置环境变量**
   ```bash
   nano .env
   ```

2. **运行部署**
   ```bash
   ./scripts/deploy.sh
   ```

3. **启动服务**
   ```bash
   ./scripts/service-start.sh
   ```

4. **验证服务**
   ```bash
   ./scripts/service-status.sh
   curl http://localhost:3000/api/health
   ```

## 📞 支持

如果遇到问题：

1. 查看相关日志文件
2. 运行环境验证脚本
3. 检查快速参考文档
4. 查看详细的验证报告

---

**注意：** 这些脚本专为 Sealos devbox 环境设计，在其他环境中使用可能需要调整。