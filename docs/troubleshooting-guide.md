# WordPecker 故障排除指南

## 概述

本指南提供 WordPecker 应用常见问题的诊断和解决方案，帮助快速定位和修复部署、运行时和性能问题。

## 目录

1. [快速诊断](#快速诊断)
2. [服务启动问题](#服务启动问题)
3. [连接和网络问题](#连接和网络问题)
4. [性能问题](#性能问题)
5. [资源问题](#资源问题)
6. [数据库问题](#数据库问题)
7. [API 问题](#api-问题)
8. [部署问题](#部署问题)
9. [监控和日志问题](#监控和日志问题)
10. [紧急恢复程序](#紧急恢复程序)

## 快速诊断

### 一键诊断脚本

```bash
#!/bin/bash
# 快速诊断脚本

echo "=== WordPecker 快速诊断 ==="
echo "时间: $(date)"
echo

# 1. 服务状态
echo "1. 服务状态:"
pm2 status 2>/dev/null || echo "PM2 未运行"
systemctl is-active wordpecker 2>/dev/null || echo "Systemd 服务未激活"
echo

# 2. 端口检查
echo "2. 端口状态:"
netstat -tlnp | grep -E ":3000|:5173" || echo "服务端口未监听"
echo

# 3. 健康检查
echo "3. 健康检查:"
curl -s http://localhost:3000/api/health | jq -r '.status // "不可访问"' 2>/dev/null || echo "后端不可访问"
curl -s -o /dev/null -w "前端状态: %{http_code}\n" http://localhost:5173 2>/dev/null || echo "前端不可访问"
echo

# 4. 资源使用
echo "4. 资源使用:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%"
echo "内存: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "磁盘: $(df -h / | awk 'NR==2{print $5}')"
echo

# 5. 最近错误
echo "5. 最近错误:"
tail -n 5 logs/pm2-backend-error.log 2>/dev/null || echo "无后端错误日志"
tail -n 5 logs/pm2-frontend-error.log 2>/dev/null || echo "无前端错误日志"
```

### 诊断检查清单

**立即检查项目**:
- [ ] PM2 进程状态 (`pm2 status`)
- [ ] 系统服务状态 (`systemctl status wordpecker`)
- [ ] 端口监听状态 (`netstat -tlnp | grep -E ":3000|:5173"`)
- [ ] 健康检查端点 (`curl http://localhost:3000/api/health`)
- [ ] 系统资源使用 (`top`, `free`, `df -h`)
- [ ] 最近的错误日志 (`pm2 logs --err`)

**深入检查项目**:
- [ ] 环境变量配置
- [ ] 数据库连接状态
- [ ] 外部 API 连接
- [ ] 网络连接性
- [ ] 文件权限
- [ ] 磁盘空间

## 服务启动问题

### 问题 1: PM2 进程无法启动

**症状**:
- `pm2 status` 显示服务状态为 "errored"
- 服务启动后立即退出

**诊断步骤**:

```bash
# 1. 查看详细错误信息
pm2 logs wordpecker-backend --err --lines 50
pm2 logs wordpecker-frontend --err --lines 50

# 2. 检查 PM2 配置
cat ecosystem.config.js

# 3. 手动启动测试
cd backend && npm start
cd ../frontend && npm run preview

# 4. 检查 Node.js 版本
node --version
npm --version
```

**常见原因和解决方案**:

1. **依赖缺失**:
```bash
# 重新安装依赖
cd backend && rm -rf node_modules package-lock.json && npm install
cd ../frontend && rm -rf node_modules package-lock.json && npm install
```

2. **环境变量缺失**:
```bash
# 检查环境变量
./scripts/verify-environment.sh

# 复制示例配置
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# 编辑配置文件
```

3. **端口被占用**:
```bash
# 查找占用进程
lsof -i :3000
lsof -i :5173

# 终止占用进程
kill -9 <PID>
```

4. **权限问题**:
```bash
# 修复权限
sudo chown -R devbox:devbox /home/devbox/wordpecker-app
chmod +x scripts/*.sh
```

### 问题 2: Systemd 服务启动失败

**症状**:
- `systemctl start wordpecker` 失败
- `systemctl status wordpecker` 显示 "failed"

**诊断步骤**:

```bash
# 1. 查看服务状态
systemctl status wordpecker -l

# 2. 查看系统日志
journalctl -u wordpecker -n 50

# 3. 检查服务配置
cat /etc/systemd/system/wordpecker.service

# 4. 验证 PM2 路径
which pm2
```

**解决方案**:

```bash
# 1. 重新创建服务文件
sudo ./scripts/setup-systemd-service.sh

# 2. 重新加载 systemd
sudo systemctl daemon-reload

# 3. 重新启用服务
sudo systemctl enable wordpecker
sudo systemctl start wordpecker
```

### 问题 3: 服务启动缓慢

**症状**:
- 服务启动时间超过 30 秒
- 健康检查超时

**诊断步骤**:

```bash
# 1. 监控启动过程
pm2 logs --timestamp

# 2. 检查系统负载
uptime
top

# 3. 检查磁盘 I/O
iostat -x 1 5

# 4. 检查网络连接
ping 8.8.8.8
```

**优化方案**:

```bash
# 1. 优化 PM2 配置
# 在 ecosystem.config.js 中调整:
listen_timeout: 10000,
kill_timeout: 5000,

# 2. 预热数据库连接
# 在应用启动时建立连接池

# 3. 清理系统资源
./scripts/optimized-resource-monitor.sh --cleanup
```

## 连接和网络问题

### 问题 1: 无法访问前端页面

**症状**:
- 浏览器显示 "连接被拒绝"
- `curl http://localhost:5173` 失败

**诊断步骤**:

```bash
# 1. 检查前端服务状态
pm2 list | grep frontend

# 2. 检查端口监听
netstat -tlnp | grep :5173

# 3. 检查防火墙
sudo ufw status

# 4. 测试本地连接
curl -v http://localhost:5173
```

**解决方案**:

```bash
# 1. 重启前端服务
pm2 restart wordpecker-frontend

# 2. 检查绑定地址
# 确保前端服务绑定到 0.0.0.0:5173

# 3. 开放防火墙端口
sudo ufw allow 5173

# 4. 检查 Vite 配置
cat frontend/vite.config.ts
```

### 问题 2: API 请求失败

**症状**:
- 前端无法连接后端 API
- CORS 错误
- 502 Bad Gateway

**诊断步骤**:

```bash
# 1. 测试 API 连接
curl -v http://localhost:3000/api/health

# 2. 检查后端服务
pm2 list | grep backend

# 3. 检查 API 配置
grep -r "VITE_API_URL" frontend/

# 4. 检查 CORS 配置
grep -r "cors" backend/src/
```

**解决方案**:

```bash
# 1. 修复 API URL 配置
# 在 frontend/.env 中设置:
VITE_API_URL=http://localhost:3000

# 2. 重新构建前端
cd frontend && npm run build

# 3. 重启服务
pm2 reload all
```

### 问题 3: 数据库连接超时

**症状**:
- 后端日志显示 "MongoTimeoutError"
- API 响应缓慢

**诊断步骤**:

```bash
# 1. 测试数据库连接
node -e "
const mongoose = require('mongoose');
console.time('连接时间');
mongoose.connect(process.env.MONGODB_URL, {
  serverSelectionTimeoutMS: 5000
}).then(() => {
  console.timeEnd('连接时间');
  console.log('连接成功');
  process.exit(0);
}).catch(err => {
  console.timeEnd('连接时间');
  console.error('连接失败:', err.message);
  process.exit(1);
});
"

# 2. 检查网络延迟
ping <mongodb-host>

# 3. 检查连接池配置
grep -r "maxPoolSize\|serverSelectionTimeoutMS" backend/
```

**解决方案**:

```bash
# 1. 优化连接配置
# 在数据库配置中设置:
maxPoolSize: 10,
serverSelectionTimeoutMS: 5000,
socketTimeoutMS: 45000,
bufferMaxEntries: 0,
useNewUrlParser: true,
useUnifiedTopology: true

# 2. 实现连接重试
# 添加指数退避重试逻辑

# 3. 监控连接状态
# 添加连接事件监听器
```

## 性能问题

### 问题 1: API 响应时间过长

**症状**:
- API 响应时间超过 5 秒
- 前端页面加载缓慢

**诊断步骤**:

```bash
# 1. 测量响应时间
time curl http://localhost:3000/api/health

# 2. 分析慢查询
# 检查数据库查询性能

# 3. 检查系统负载
top -p $(pgrep -f wordpecker-backend)

# 4. 分析内存使用
ps aux --sort=-%mem | grep wordpecker
```

**性能优化**:

```bash
# 1. 启用 PM2 集群模式
pm2 delete wordpecker-backend
pm2 start ecosystem.config.js --env production

# 2. 优化数据库查询
# 添加适当的索引
# 使用查询优化

# 3. 启用缓存
# 实现 Redis 缓存
# 启用 HTTP 缓存头

# 4. 监控性能
pm2 monit
```

### 问题 2: 内存泄漏

**症状**:
- 内存使用持续增长
- 服务定期崩溃

**诊断步骤**:

```bash
# 1. 监控内存使用
pm2 monit

# 2. 生成堆转储
node --inspect backend/dist/app.js
# 在 Chrome DevTools 中分析

# 3. 检查事件监听器
# 查找未清理的事件监听器

# 4. 分析对象引用
# 使用内存分析工具
```

**解决方案**:

```bash
# 1. 设置内存限制
# 在 ecosystem.config.js 中:
max_memory_restart: '400M'

# 2. 优化代码
# 清理事件监听器
# 避免全局变量
# 正确关闭数据库连接

# 3. 定期重启
# 设置定期重启策略
```

### 问题 3: CPU 使用率过高

**症状**:
- CPU 使用率持续超过 80%
- 系统响应缓慢

**诊断步骤**:

```bash
# 1. 查看 CPU 使用情况
top -p $(pgrep -f wordpecker)

# 2. 分析 CPU 热点
# 使用 Node.js 性能分析工具

# 3. 检查无限循环
# 查看代码逻辑

# 4. 监控系统负载
uptime
```

**优化方案**:

```bash
# 1. 优化算法
# 减少计算复杂度
# 使用异步处理

# 2. 负载均衡
pm2 scale wordpecker-backend +1

# 3. 缓存计算结果
# 避免重复计算

# 4. 限制并发
# 实现请求限流
```

## 资源问题

### 问题 1: 磁盘空间不足

**症状**:
- 磁盘使用率超过 90%
- 应用无法写入日志

**诊断步骤**:

```bash
# 1. 检查磁盘使用
df -h
du -sh /home/devbox/wordpecker-app/*

# 2. 查找大文件
find /home/devbox/wordpecker-app -type f -size +100M

# 3. 分析日志大小
du -sh logs/*

# 4. 检查音频缓存
du -sh audio-cache/*
```

**清理方案**:

```bash
# 1. 自动清理
./scripts/optimized-resource-monitor.sh --cleanup

# 2. 手动清理日志
find logs/ -name "*.log" -mtime +7 -delete

# 3. 清理音频缓存
find audio-cache/ -type f -mtime +1 -delete

# 4. 清理 PM2 日志
pm2 flush

# 5. 清理系统临时文件
sudo find /tmp -type f -mtime +1 -delete
```

### 问题 2: 内存不足

**症状**:
- 系统内存使用率超过 90%
- OOM Killer 终止进程

**诊断步骤**:

```bash
# 1. 检查内存使用
free -h
ps aux --sort=-%mem | head -10

# 2. 检查交换空间
swapon -s

# 3. 查看系统日志
dmesg | grep -i "killed process"

# 4. 分析内存分配
cat /proc/meminfo
```

**解决方案**:

```bash
# 1. 重启高内存进程
pm2 restart wordpecker-backend

# 2. 清理系统缓存
sync
echo 3 > /proc/sys/vm/drop_caches

# 3. 调整 PM2 配置
# 降低 max_memory_restart 值

# 4. 优化应用代码
# 减少内存使用
# 实现对象池
```

### 问题 3: 文件描述符不足

**症状**:
- "Too many open files" 错误
- 连接被拒绝

**诊断步骤**:

```bash
# 1. 检查当前限制
ulimit -n

# 2. 查看进程文件描述符使用
lsof -p $(pgrep -f wordpecker-backend) | wc -l

# 3. 检查系统限制
cat /proc/sys/fs/file-max

# 4. 查看未关闭的文件
lsof | grep wordpecker
```

**解决方案**:

```bash
# 1. 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 2. 重新登录或重启

# 3. 修复代码中的文件泄漏
# 确保正确关闭文件和连接

# 4. 监控文件描述符使用
watch "lsof -p $(pgrep -f wordpecker-backend) | wc -l"
```

## 数据库问题

### 问题 1: MongoDB 连接失败

**症状**:
- "MongoNetworkError" 错误
- 应用启动失败

**诊断步骤**:

```bash
# 1. 测试连接
mongo "$MONGODB_URL" --eval "db.runCommand('ping')"

# 2. 检查网络连接
telnet <mongodb-host> <mongodb-port>

# 3. 验证认证信息
echo $MONGODB_URL

# 4. 检查防火墙
ping <mongodb-host>
```

**解决方案**:

```bash
# 1. 验证连接字符串
# 确保 URL 格式正确
mongodb://username:password@host:port/database

# 2. 检查网络配置
# 确保可以访问 MongoDB 服务器

# 3. 更新连接配置
# 添加连接选项:
?retryWrites=true&w=majority

# 4. 实现重连逻辑
# 添加自动重连机制
```

### 问题 2: 数据库查询缓慢

**症状**:
- API 响应时间长
- 数据库 CPU 使用率高

**诊断步骤**:

```bash
# 1. 启用慢查询日志
# 在 MongoDB 中启用 profiler

# 2. 分析查询计划
# 使用 explain() 方法

# 3. 检查索引使用
# 查看索引统计信息

# 4. 监控数据库性能
# 使用 MongoDB 监控工具
```

**优化方案**:

```bash
# 1. 添加适当索引
# 为常用查询字段创建索引

# 2. 优化查询语句
# 减少查询复杂度
# 使用投影限制返回字段

# 3. 实现查询缓存
# 缓存频繁查询的结果

# 4. 分页查询
# 避免一次性加载大量数据
```

### 问题 3: 数据库连接池耗尽

**症状**:
- "MongoServerSelectionError" 错误
- 连接超时

**诊断步骤**:

```bash
# 1. 检查连接池配置
grep -r "maxPoolSize" backend/

# 2. 监控连接数
# 在 MongoDB 中查看当前连接

# 3. 检查连接泄漏
# 查找未关闭的连接

# 4. 分析连接使用模式
# 监控连接创建和销毁
```

**解决方案**:

```bash
# 1. 调整连接池大小
maxPoolSize: 20,
minPoolSize: 5,

# 2. 设置连接超时
serverSelectionTimeoutMS: 5000,
socketTimeoutMS: 45000,

# 3. 修复连接泄漏
# 确保正确关闭数据库连接

# 4. 实现连接监控
# 添加连接池监控
```

## API 问题

### 问题 1: OpenAI API 调用失败

**症状**:
- "Invalid API key" 错误
- API 调用超时

**诊断步骤**:

```bash
# 1. 验证 API 密钥
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# 2. 检查网络连接
curl -I https://api.openai.com

# 3. 查看错误日志
grep -i "openai\|api" logs/pm2-backend-error.log

# 4. 测试 API 调用
node -e "
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
client.models.list().then(console.log).catch(console.error);
"
```

**解决方案**:

```bash
# 1. 更新 API 密钥
# 在 backend/.env 中设置正确的密钥

# 2. 实现重试机制
# 添加指数退避重试

# 3. 设置超时配置
# 配置合适的超时时间

# 4. 添加错误处理
# 实现优雅的错误处理
```

### 问题 2: API 限流

**症状**:
- "Rate limit exceeded" 错误
- 429 状态码

**诊断步骤**:

```bash
# 1. 检查 API 使用情况
# 查看 API 调用频率

# 2. 分析错误模式
grep "429\|rate limit" logs/*.log

# 3. 检查并发请求
# 监控同时进行的 API 调用

# 4. 查看 API 配额
# 检查 API 服务商的限制
```

**解决方案**:

```bash
# 1. 实现请求队列
# 控制 API 调用频率

# 2. 添加缓存机制
# 缓存 API 响应结果

# 3. 实现退避策略
# 在限流时等待重试

# 4. 优化 API 使用
# 减少不必要的 API 调用
```

### 问题 3: API 响应格式错误

**症状**:
- JSON 解析错误
- 意外的响应格式

**诊断步骤**:

```bash
# 1. 检查 API 响应
curl -v http://localhost:3000/api/health

# 2. 验证 JSON 格式
echo '{"test": "data"}' | jq .

# 3. 查看响应头
curl -I http://localhost:3000/api/health

# 4. 检查中间件
grep -r "json\|parser" backend/src/middleware/
```

**解决方案**:

```bash
# 1. 修复 JSON 序列化
# 确保正确的 JSON 格式

# 2. 添加响应验证
# 验证 API 响应格式

# 3. 设置正确的 Content-Type
# 确保响应头正确

# 4. 实现错误处理
# 处理格式错误的响应
```

## 部署问题

### 问题 1: 部署脚本失败

**症状**:
- 部署脚本中途退出
- 服务未正确更新

**诊断步骤**:

```bash
# 1. 查看部署日志
cat logs/complete-auto-deployment.log

# 2. 检查脚本权限
ls -la scripts/*.sh

# 3. 手动执行步骤
./scripts/pre-deploy-check.sh
./scripts/deploy.sh
./scripts/post-deploy-verify.sh

# 4. 检查环境变量
./scripts/verify-environment.sh
```

**解决方案**:

```bash
# 1. 修复权限问题
chmod +x scripts/*.sh

# 2. 检查依赖
./scripts/verify-deployment-environment.sh

# 3. 分步执行部署
# 逐步执行每个部署阶段

# 4. 回滚到备份
./scripts/deploy.sh --rollback <backup-path>
```

### 问题 2: 构建失败

**症状**:
- npm build 命令失败
- 依赖安装错误

**诊断步骤**:

```bash
# 1. 检查 Node.js 版本
node --version
npm --version

# 2. 清理缓存
npm cache clean --force

# 3. 检查依赖
cd backend && npm ls
cd ../frontend && npm ls

# 4. 查看构建日志
cd frontend && npm run build
```

**解决方案**:

```bash
# 1. 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 2. 更新 Node.js
# 升级到支持的版本

# 3. 修复依赖冲突
npm audit fix

# 4. 使用 CI 模式安装
npm ci
```

### 问题 3: 环境配置错误

**症状**:
- 环境变量未生效
- 配置文件缺失

**诊断步骤**:

```bash
# 1. 检查环境变量
printenv | grep -E "MONGODB|OPENAI|NODE_ENV"

# 2. 验证配置文件
ls -la backend/.env frontend/.env

# 3. 检查配置加载
node -e "console.log(process.env.MONGODB_URL)"

# 4. 验证配置格式
cat backend/.env | grep -v "^#" | grep "="
```

**解决方案**:

```bash
# 1. 创建配置文件
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. 设置正确的值
# 编辑 .env 文件

# 3. 重启服务
pm2 restart all --update-env

# 4. 验证配置
./scripts/verify-environment.sh
```

## 监控和日志问题

### 问题 1: 日志文件过大

**症状**:
- 磁盘空间不足
- 日志文件超过 GB 级别

**诊断步骤**:

```bash
# 1. 检查日志大小
du -sh logs/*

# 2. 查看日志增长速度
ls -lah logs/*.log

# 3. 分析日志内容
tail -n 100 logs/pm2-backend-combined.log

# 4. 检查日志轮转配置
cat /etc/logrotate.d/wordpecker 2>/dev/null || echo "未配置日志轮转"
```

**解决方案**:

```bash
# 1. 立即清理日志
./scripts/log-cleanup.sh

# 2. 配置日志轮转
sudo ./scripts/setup-logrotate.sh

# 3. 调整日志级别
# 在生产环境使用 'warn' 或 'error' 级别

# 4. 设置 PM2 日志限制
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
```

### 问题 2: 监控脚本不工作

**症状**:
- 健康检查未执行
- 资源监控无数据

**诊断步骤**:

```bash
# 1. 检查 Cron 任务
crontab -l

# 2. 查看 Cron 日志
grep CRON /var/log/syslog

# 3. 手动执行监控脚本
./scripts/optimized-health-check.sh
./scripts/optimized-resource-monitor.sh

# 4. 检查脚本权限
ls -la scripts/optimized-*.sh
```

**解决方案**:

```bash
# 1. 重新设置 Cron 任务
./scripts/setup-cron-tasks.sh

# 2. 修复脚本权限
chmod +x scripts/optimized-*.sh

# 3. 检查脚本路径
# 在 Cron 中使用绝对路径

# 4. 添加日志输出
# 在 Cron 任务中重定向输出
```

### 问题 3: 告警不工作

**症状**:
- 系统异常但无告警
- 告警邮件未发送

**诊断步骤**:

```bash
# 1. 测试告警系统
./scripts/optimized-resource-monitor.sh --test-alerts

# 2. 检查告警配置
grep -r "alert\|notification" scripts/

# 3. 查看告警日志
cat logs/resource-alerts-optimized.log

# 4. 测试通知渠道
# 测试邮件或其他通知方式
```

**解决方案**:

```bash
# 1. 配置通知渠道
# 设置邮件或 Slack 通知

# 2. 调整告警阈值
# 根据实际情况调整阈值

# 3. 测试告警功能
# 模拟异常情况测试告警

# 4. 添加多种通知方式
# 实现多渠道告警
```

## 紧急恢复程序

### 完全服务中断

**立即行动**:

```bash
# 1. 快速诊断
./scripts/optimized-health-check.sh --status
pm2 status
systemctl status wordpecker

# 2. 尝试重启服务
pm2 restart all
# 或
sudo systemctl restart wordpecker

# 3. 如果重启失败，检查资源
df -h
free -h
top

# 4. 清理资源
./scripts/optimized-resource-monitor.sh --cleanup

# 5. 重新部署
./scripts/complete-auto-deployment.sh
```

### 数据库连接中断

**恢复步骤**:

```bash
# 1. 测试数据库连接
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URL)
  .then(() => console.log('连接成功'))
  .catch(err => console.error('连接失败:', err));
"

# 2. 检查网络连接
ping <mongodb-host>

# 3. 重启后端服务
pm2 restart wordpecker-backend

# 4. 如果问题持续，联系数据库服务提供商
```

### 磁盘空间耗尽

**紧急清理**:

```bash
# 1. 立即清理日志
find logs/ -name "*.log" -mtime +1 -delete

# 2. 清理音频缓存
rm -rf audio-cache/*

# 3. 清理 PM2 日志
pm2 flush

# 4. 清理系统临时文件
sudo find /tmp -type f -mtime +0 -delete

# 5. 清理 APT 缓存
sudo apt-get clean

# 6. 重启服务
pm2 restart all
```

### 内存耗尽

**紧急处理**:

```bash
# 1. 立即重启高内存进程
pm2 restart wordpecker-backend

# 2. 清理系统缓存
sync
echo 3 > /proc/sys/vm/drop_caches

# 3. 终止非必要进程
# 谨慎终止其他进程

# 4. 监控内存使用
watch "free -h"

# 5. 如果问题持续，重启系统
sudo reboot
```

### 回滚到上一个版本

**回滚步骤**:

```bash
# 1. 查看可用备份
ls -la /home/devbox/backups/

# 2. 选择最近的稳定备份
BACKUP_PATH="/home/devbox/backups/wordpecker-YYYYMMDD-HHMMSS"

# 3. 执行回滚
./scripts/deploy.sh --rollback "$BACKUP_PATH"

# 4. 验证回滚结果
./scripts/post-deploy-verify.sh

# 5. 如果回滚失败，手动恢复
sudo systemctl stop wordpecker
rm -rf /home/devbox/wordpecker-app
cp -r "$BACKUP_PATH" /home/devbox/wordpecker-app
sudo systemctl start wordpecker
```

## 联系支持

当遇到本指南无法解决的问题时：

1. **收集诊断信息**:
```bash
# 生成诊断报告
./scripts/generate-diagnostic-report.sh > diagnostic-report.txt
```

2. **包含以下信息**:
   - 问题描述和重现步骤
   - 错误日志和堆栈跟踪
   - 系统环境信息
   - 最近的变更记录

3. **紧急联系方式**:
   - 技术支持邮箱: support@wordpecker.com
   - 紧急热线: +86-xxx-xxxx-xxxx
   - GitHub Issues: https://github.com/wordpecker/issues

---

**版本**: 1.0.0  
**最后更新**: 2024-01-01  
**维护者**: WordPecker 技术支持团队