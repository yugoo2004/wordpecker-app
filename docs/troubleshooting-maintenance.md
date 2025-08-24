# WordPecker 故障排查和维护文档

## 概述

本文档提供了 WordPecker 应用在 Sealos 环境中的详细故障排查指南和日常维护操作，帮助快速定位和解决常见问题。

## 目录

1. [故障排查流程](#故障排查流程)
2. [常见问题及解决方案](#常见问题及解决方案)
3. [日志分析](#日志分析)
4. [性能监控](#性能监控)
5. [日常维护](#日常维护)
6. [应急处理](#应急处理)
7. [预防措施](#预防措施)

## 故障排查流程

### 1. 问题分类

#### 服务类问题
- 服务无法启动
- 服务异常停止
- 服务响应缓慢
- 服务无响应

#### 连接类问题
- 前端无法访问后端
- 数据库连接失败
- 网络连接异常
- CORS 跨域问题

#### 资源类问题
- 内存不足
- 磁盘空间不足
- CPU 使用率过高
- 网络带宽不足

#### 配置类问题
- 环境变量错误
- 配置文件格式错误
- 权限问题
- 端口冲突

### 2. 诊断工具

#### 快速诊断脚本
```bash
#!/bin/bash
# scripts/quick-diagnosis.sh

echo "=== WordPecker 快速诊断 ==="
echo "诊断时间: $(date)"
echo ""

# 1. 检查服务状态
echo "1. 服务状态检查:"
./scripts/status-app.sh

echo ""
echo "2. 端口占用检查:"
echo "后端端口 3000:"
lsof -i :3000 || echo "端口 3000 未被占用"
echo "前端端口 5173:"
lsof -i :5173 || echo "端口 5173 未被占用"

echo ""
echo "3. 系统资源检查:"
echo "内存使用:"
free -h
echo "磁盘使用:"
df -h .
echo "CPU 负载:"
uptime

echo ""
echo "4. 日志错误检查:"
echo "最近的错误日志:"
find logs/ -name "*.log" -exec grep -l "ERROR\|error\|Error" {} \; 2>/dev/null | head -3

echo ""
echo "5. 网络连接检查:"
echo "后端健康检查:"
curl -s http://localhost:3000/api/health || echo "后端服务无响应"
echo "前端访问检查:"
curl -s http://localhost:5173 > /dev/null && echo "前端服务正常" || echo "前端服务无响应"

echo ""
echo "=== 诊断完成 ==="
```

#### 详细诊断脚本
```bash
#!/bin/bash
# scripts/detailed-diagnosis.sh

echo "=== WordPecker 详细诊断 ==="

# 环境信息
echo "环境信息:"
echo "Node.js 版本: $(node --version)"
echo "npm 版本: $(npm --version)"
echo "操作系统: $(uname -a)"
echo "当前用户: $(whoami)"
echo "工作目录: $(pwd)"

# 进程信息
echo ""
echo "相关进程:"
ps aux | grep -E "(node|npm|pm2)" | grep -v grep

# 网络信息
echo ""
echo "网络监听:"
netstat -tulpn | grep -E ":(3000|5173)"

# 文件权限
echo ""
echo "关键文件权限:"
ls -la backend/.env frontend/.env 2>/dev/null || echo "环境文件不存在"
ls -la scripts/*.sh | head -5

# 磁盘空间详情
echo ""
echo "磁盘空间详情:"
du -sh * | sort -hr | head -10

echo ""
echo "=== 详细诊断完成 ==="
```

## 常见问题及解决方案

### 1. 服务启动问题

#### 问题：后端服务无法启动

**症状**:
- 运行启动脚本后服务立即退出
- 日志显示端口被占用
- 数据库连接错误

**诊断步骤**:
```bash
# 1. 检查端口占用
lsof -i :3000

# 2. 检查日志
tail -f logs/backend.log

# 3. 检查环境变量
cat backend/.env

# 4. 测试数据库连接
cd backend && npx ts-node src/scripts/testMongoConnection.ts
```

**解决方案**:
```bash
# 解决端口占用
kill $(lsof -ti :3000)

# 修复环境变量
cp backend/.env.example backend/.env
vim backend/.env

# 重新安装依赖
cd backend
rm -rf node_modules package-lock.json
npm install

# 重新构建
npm run build

# 重新启动
cd ..
./scripts/start-backend.sh
```

#### 问题：前端服务无法启动

**症状**:
- Vite 开发服务器启动失败
- 端口冲突错误
- 依赖安装失败

**诊断步骤**:
```bash
# 1. 检查端口占用
lsof -i :5173

# 2. 检查前端日志
tail -f logs/frontend.log

# 3. 检查依赖
cd frontend && npm ls

# 4. 检查配置
cat frontend/.env
```

**解决方案**:
```bash
# 清理端口
kill $(lsof -ti :5173)

# 清理依赖
cd frontend
rm -rf node_modules package-lock.json
npm install

# 检查配置
cp .env.example .env
vim .env

# 重新启动
cd ..
./scripts/start-frontend.sh
```

### 2. 连接问题

#### 问题：前端无法连接后端 API

**症状**:
- 前端页面显示网络错误
- 浏览器控制台显示 CORS 错误
- API 请求超时

**诊断步骤**:
```bash
# 1. 检查后端服务状态
curl http://localhost:3000/api/health

# 2. 检查 CORS 配置
grep CORS_ORIGIN backend/.env

# 3. 检查前端 API 配置
grep VITE_API_URL frontend/.env

# 4. 检查网络连接
ping localhost
telnet localhost 3000
```

**解决方案**:
```bash
# 1. 修复 CORS 配置
vim backend/.env
# 添加或修改: CORS_ORIGIN=http://localhost:5173,http://101.126.5.123:5173

# 2. 修复前端 API 配置
vim frontend/.env
# 修改: VITE_API_URL=http://localhost:3000

# 3. 重启服务
./scripts/restart-app.sh

# 4. 验证连接
curl http://localhost:3000/api/health
```

#### 问题：数据库连接失败

**症状**:
- 后端日志显示数据库连接错误
- MongoDB 连接超时
- 认证失败

**诊断步骤**:
```bash
# 1. 检查数据库连接字符串
echo $MONGODB_URI

# 2. 测试数据库连接
mongo "$MONGODB_URI"

# 3. 检查网络连接
ping mongodb-host

# 4. 检查数据库服务状态（在 Sealos 控制台）
```

**解决方案**:
```bash
# 1. 修复连接字符串
vim backend/.env
# 修改: MONGODB_URI=mongodb://correct_user:correct_password@correct_host:27017/wordpecker

# 2. 重启后端服务
./scripts/restart-app.sh 2

# 3. 验证连接
cd backend && npx ts-node src/scripts/testMongoConnection.ts
```

### 3. 性能问题

#### 问题：应用响应缓慢

**症状**:
- API 响应时间过长
- 页面加载缓慢
- 用户操作延迟

**诊断步骤**:
```bash
# 1. 检查系统资源
htop
free -h
df -h

# 2. 检查进程资源使用
ps aux --sort=-%cpu | head -10
ps aux --sort=-%mem | head -10

# 3. 检查网络连接
netstat -i
ss -tuln

# 4. 分析日志
grep -i "slow\|timeout\|error" logs/*.log
```

**解决方案**:
```bash
# 1. 重启服务释放资源
./scripts/restart-app.sh

# 2. 清理日志文件
find logs/ -name "*.log" -mtime +7 -delete

# 3. 优化 PM2 配置
vim ecosystem.config.js
# 调整 max_memory_restart 和 instances

# 4. 监控资源使用
./scripts/monitor.sh --watch
```

#### 问题：内存不足

**症状**:
- 系统内存使用率过高
- 进程被 OOM Killer 终止
- 服务频繁重启

**诊断步骤**:
```bash
# 1. 检查内存使用
free -h
cat /proc/meminfo

# 2. 检查进程内存使用
ps aux --sort=-%mem | head -10

# 3. 检查系统日志
dmesg | grep -i "killed\|oom"

# 4. 检查 PM2 内存限制
pm2 show wordpecker-backend
```

**解决方案**:
```bash
# 1. 立即释放内存
sync && echo 3 > /proc/sys/vm/drop_caches

# 2. 重启服务
./scripts/restart-app.sh

# 3. 调整 PM2 内存限制
vim ecosystem.config.js
# 修改: max_memory_restart: '300M'

# 4. 升级 Sealos 实例内存
# 在 Sealos 控制台调整资源配置
```

### 4. 配置问题

#### 问题：环境变量配置错误

**症状**:
- 服务启动时报配置错误
- 功能异常或无法使用
- 连接失败

**诊断步骤**:
```bash
# 1. 检查环境变量文件
cat backend/.env
cat frontend/.env

# 2. 验证必需变量
./scripts/validate-backend-env.sh
./scripts/validate-frontend-env.sh

# 3. 检查文件权限
ls -la backend/.env frontend/.env

# 4. 检查语法错误
node -pe "require('dotenv').config({path: 'backend/.env'})"
```

**解决方案**:
```bash
# 1. 修复配置文件
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. 编辑配置
vim backend/.env
vim frontend/.env

# 3. 设置正确权限
chmod 600 backend/.env frontend/.env

# 4. 验证配置
./scripts/validate-backend-env.sh
./scripts/validate-frontend-env.sh

# 5. 重启服务
./scripts/restart-app.sh
```

## 日志分析

### 1. 日志文件位置

```bash
# 应用日志
logs/backend.log          # 后端应用日志
logs/frontend.log         # 前端应用日志
logs/app.log              # 通用应用日志

# PM2 日志
logs/pm2-backend-*.log    # PM2 后端日志
logs/pm2-frontend-*.log   # PM2 前端日志

# systemd 日志
journalctl --user -u wordpecker-backend.service
journalctl --user -u wordpecker-frontend.service

# 系统日志
/var/log/syslog
/var/log/messages
```

### 2. 日志分析工具

#### 错误日志分析
```bash
#!/bin/bash
# scripts/analyze-errors.sh

echo "=== 错误日志分析 ==="

# 统计错误类型
echo "错误统计:"
grep -i error logs/*.log | cut -d: -f2 | sort | uniq -c | sort -nr

# 最近的错误
echo ""
echo "最近 24 小时的错误:"
find logs/ -name "*.log" -mtime -1 -exec grep -l "ERROR\|error" {} \;

# 高频错误
echo ""
echo "高频错误模式:"
grep -i error logs/*.log | awk '{print $NF}' | sort | uniq -c | sort -nr | head -10

# 时间分布
echo ""
echo "错误时间分布:"
grep -i error logs/*.log | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}' | sort | uniq -c
```

#### 性能日志分析
```bash
#!/bin/bash
# scripts/analyze-performance.sh

echo "=== 性能日志分析 ==="

# 响应时间分析
echo "API 响应时间分析:"
grep -o "took [0-9]*ms" logs/backend.log | grep -o "[0-9]*" | sort -n | tail -10

# 慢查询分析
echo ""
echo "慢查询分析:"
grep -i "slow" logs/*.log | head -10

# 内存使用趋势
echo ""
echo "内存使用趋势:"
grep -o "Memory usage: [0-9]*MB" logs/*.log | tail -10
```

### 3. 实时日志监控

```bash
# 监控所有日志
tail -f logs/*.log

# 监控错误日志
tail -f logs/*.log | grep -i error

# 监控特定服务
pm2 logs wordpecker-backend
journalctl --user -u wordpecker-backend.service -f

# 过滤关键信息
tail -f logs/backend.log | grep -E "(ERROR|WARN|started|stopped)"
```

## 性能监控

### 1. 系统监控脚本

```bash
#!/bin/bash
# scripts/performance-monitor.sh

echo "=== 性能监控报告 ==="
echo "监控时间: $(date)"

# CPU 使用率
echo ""
echo "CPU 使用率:"
top -bn1 | grep "Cpu(s)" | awk '{print "用户: " $2 ", 系统: " $4 ", 空闲: " $8}'

# 内存使用
echo ""
echo "内存使用:"
free -h | awk 'NR==2{printf "已使用: %s/%s (%.2f%%)\n", $3,$2,$3*100/$2 }'

# 磁盘 I/O
echo ""
echo "磁盘使用:"
df -h . | awk 'NR==2{printf "已使用: %s/%s (%s)\n", $3,$2,$5}'

# 网络连接
echo ""
echo "网络连接:"
ss -tuln | grep -E ":(3000|5173)" | wc -l | awk '{print "活跃连接数: " $1}'

# 进程资源使用
echo ""
echo "WordPecker 进程资源使用:"
ps aux | grep -E "(node.*backend|node.*frontend)" | grep -v grep | \
awk '{printf "PID: %s, CPU: %s%%, MEM: %s%%, CMD: %s\n", $2, $3, $4, $11}'
```

### 2. 性能基准测试

```bash
#!/bin/bash
# scripts/benchmark.sh

echo "=== WordPecker 性能基准测试 ==="

# API 响应时间测试
echo "API 响应时间测试:"
for i in {1..10}; do
    time curl -s http://localhost:3000/api/health > /dev/null
done

# 并发测试（需要安装 ab）
if command -v ab &> /dev/null; then
    echo ""
    echo "并发测试 (100 请求, 10 并发):"
    ab -n 100 -c 10 http://localhost:3000/api/health
fi

# 内存泄漏检测
echo ""
echo "内存使用监控 (60秒):"
for i in {1..12}; do
    ps aux | grep "node.*backend" | grep -v grep | awk '{print "时间: " i*5 "s, 内存: " $4 "%"}'
    sleep 5
done
```

## 日常维护

### 1. 每日维护任务

```bash
#!/bin/bash
# scripts/daily-maintenance.sh

echo "=== 每日维护任务 ==="
echo "执行时间: $(date)"

# 1. 检查服务状态
echo "1. 检查服务状态..."
./scripts/status-app.sh

# 2. 清理旧日志
echo ""
echo "2. 清理旧日志..."
find logs/ -name "*.log" -mtime +7 -delete
echo "已清理 7 天前的日志文件"

# 3. 检查磁盘空间
echo ""
echo "3. 检查磁盘空间..."
df -h . | awk 'NR==2 && $5+0 > 80 {print "警告: 磁盘使用率超过 80%: " $5}'

# 4. 检查内存使用
echo ""
echo "4. 检查内存使用..."
free | awk 'NR==2 && $3/$2*100 > 85 {print "警告: 内存使用率超过 85%"}'

# 5. 备份配置文件
echo ""
echo "5. 备份配置文件..."
cp backend/.env backend/.env.backup.$(date +%Y%m%d)
cp frontend/.env frontend/.env.backup.$(date +%Y%m%d)
echo "配置文件备份完成"

# 6. 检查错误日志
echo ""
echo "6. 检查错误日志..."
error_count=$(grep -c -i error logs/*.log 2>/dev/null || echo 0)
if [ $error_count -gt 10 ]; then
    echo "警告: 发现 $error_count 个错误，请检查日志"
else
    echo "错误数量正常: $error_count"
fi

echo ""
echo "=== 每日维护完成 ==="
```

### 2. 每周维护任务

```bash
#!/bin/bash
# scripts/weekly-maintenance.sh

echo "=== 每周维护任务 ==="

# 1. 系统更新
echo "1. 检查系统更新..."
sudo apt update
sudo apt list --upgradable

# 2. 依赖更新
echo ""
echo "2. 检查依赖更新..."
cd backend && npm outdated
cd ../frontend && npm outdated
cd ..

# 3. 安全检查
echo ""
echo "3. 安全检查..."
cd backend && npm audit
cd ../frontend && npm audit
cd ..

# 4. 性能分析
echo ""
echo "4. 性能分析..."
./scripts/performance-monitor.sh

# 5. 数据库维护
echo ""
echo "5. 数据库维护..."
# 在 Sealos 控制台执行数据库维护操作

# 6. 日志轮转
echo ""
echo "6. 日志轮转..."
./scripts/setup-logrotate.sh 3

echo ""
echo "=== 每周维护完成 ==="
```

### 3. 自动化维护

#### 设置 crontab
```bash
# 编辑 crontab
crontab -e

# 添加维护任务
# 每日凌晨 2 点执行日常维护
0 2 * * * /home/devbox/project/scripts/daily-maintenance.sh >> /home/devbox/project/logs/maintenance.log 2>&1

# 每周日凌晨 3 点执行周维护
0 3 * * 0 /home/devbox/project/scripts/weekly-maintenance.sh >> /home/devbox/project/logs/maintenance.log 2>&1

# 每小时检查服务状态
0 * * * * /home/devbox/project/scripts/health-check.sh >> /home/devbox/project/logs/health.log 2>&1
```

#### 健康检查脚本
```bash
#!/bin/bash
# scripts/health-check.sh

# 检查后端服务
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "$(date): 后端服务异常，尝试重启"
    ./scripts/restart-app.sh 2
fi

# 检查前端服务
if ! curl -s http://localhost:5173 > /dev/null; then
    echo "$(date): 前端服务异常，尝试重启"
    ./scripts/restart-app.sh 3
fi

# 检查资源使用
memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $memory_usage -gt 90 ]; then
    echo "$(date): 内存使用率过高 ($memory_usage%)，重启服务"
    ./scripts/restart-app.sh
fi
```

## 应急处理

### 1. 服务完全宕机

#### 应急恢复步骤
```bash
# 1. 立即诊断
./scripts/quick-diagnosis.sh

# 2. 强制停止所有服务
./scripts/stop-app.sh
pkill -f "node.*wordpecker"

# 3. 清理端口
kill $(lsof -ti :3000) 2>/dev/null || true
kill $(lsof -ti :5173) 2>/dev/null || true

# 4. 检查系统资源
free -h
df -h

# 5. 重启服务
./scripts/start-app.sh 4

# 6. 验证恢复
sleep 10
./scripts/status-app.sh
```

### 2. 数据库连接丢失

#### 应急处理
```bash
# 1. 检查数据库服务状态（Sealos 控制台）

# 2. 测试连接
cd backend && npx ts-node src/scripts/testMongoConnection.ts

# 3. 重启后端服务
./scripts/restart-app.sh 2

# 4. 如果仍然失败，检查网络
ping mongodb-host
telnet mongodb-host 27017
```

### 3. 内存耗尽

#### 应急处理
```bash
# 1. 立即释放内存
sync && echo 3 > /proc/sys/vm/drop_caches

# 2. 终止高内存进程
ps aux --sort=-%mem | head -5
# 根据需要终止进程

# 3. 重启服务
./scripts/restart-app.sh

# 4. 监控恢复
./scripts/monitor.sh --watch
```

### 4. 磁盘空间不足

#### 应急处理
```bash
# 1. 清理日志文件
find logs/ -name "*.log" -mtime +1 -delete

# 2. 清理临时文件
rm -rf /tmp/*
rm -rf backend/node_modules/.cache
rm -rf frontend/node_modules/.cache

# 3. 清理构建文件
rm -rf backend/dist
rm -rf frontend/dist

# 4. 重新构建（如果需要）
cd backend && npm run build
cd ../frontend && npm run build
```

## 预防措施

### 1. 监控告警

#### 设置资源告警
```bash
#!/bin/bash
# scripts/alert-monitor.sh

# 内存告警阈值 (85%)
MEMORY_THRESHOLD=85

# 磁盘告警阈值 (90%)
DISK_THRESHOLD=90

# CPU 告警阈值 (80%)
CPU_THRESHOLD=80

# 检查内存使用
memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $memory_usage -gt $MEMORY_THRESHOLD ]; then
    echo "ALERT: 内存使用率过高: $memory_usage%"
    # 发送告警通知
fi

# 检查磁盘使用
disk_usage=$(df . | awk 'NR==2{print $5}' | sed 's/%//')
if [ $disk_usage -gt $DISK_THRESHOLD ]; then
    echo "ALERT: 磁盘使用率过高: $disk_usage%"
    # 发送告警通知
fi

# 检查 CPU 使用
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
if (( $(echo "$cpu_usage > $CPU_THRESHOLD" | bc -l) )); then
    echo "ALERT: CPU 使用率过高: $cpu_usage%"
    # 发送告警通知
fi
```

### 2. 自动备份

#### 配置文件备份
```bash
#!/bin/bash
# scripts/backup-config.sh

BACKUP_DIR="backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# 备份配置文件
cp backend/.env $BACKUP_DIR/backend.env
cp frontend/.env $BACKUP_DIR/frontend.env
cp ecosystem.config.js $BACKUP_DIR/

# 备份脚本
cp -r scripts/ $BACKUP_DIR/

# 创建备份清单
echo "备份时间: $(date)" > $BACKUP_DIR/backup.info
echo "Git 提交: $(git rev-parse HEAD)" >> $BACKUP_DIR/backup.info

# 清理旧备份（保留 30 天）
find backups/ -type d -mtime +30 -exec rm -rf {} \;
```

### 3. 容量规划

#### 资源使用趋势分析
```bash
#!/bin/bash
# scripts/capacity-planning.sh

echo "=== 容量规划分析 ==="

# 内存使用趋势
echo "内存使用趋势 (最近 7 天):"
for i in {7..1}; do
    date_str=$(date -d "$i days ago" +%Y-%m-%d)
    memory_avg=$(grep "$date_str" logs/monitor.log | grep "Memory" | awk '{sum+=$3; count++} END {if(count>0) print sum/count; else print 0}')
    echo "$date_str: ${memory_avg}MB"
done

# 磁盘使用趋势
echo ""
echo "磁盘使用趋势:"
du -sh logs/ backend/node_modules frontend/node_modules

# 预测资源需求
echo ""
echo "资源需求预测:"
echo "建议内存: $(echo "$(free -m | awk 'NR==2{print $3}') * 1.5" | bc)MB"
echo "建议磁盘: $(echo "$(du -sm . | awk '{print $1}') * 1.2" | bc)MB"
```

## 总结

### 故障排查检查清单

- [ ] 检查服务状态和端口占用
- [ ] 分析错误日志和系统日志
- [ ] 验证配置文件和环境变量
- [ ] 检查系统资源使用情况
- [ ] 测试网络连接和数据库连接
- [ ] 验证文件权限和依赖安装
- [ ] 检查进程状态和资源限制

### 维护检查清单

- [ ] 定期清理日志文件
- [ ] 监控系统资源使用
- [ ] 更新系统和依赖包
- [ ] 备份配置文件和重要数据
- [ ] 检查安全更新和漏洞
- [ ] 验证服务健康状态
- [ ] 分析性能指标和趋势

### 应急响应检查清单

- [ ] 快速诊断问题类型
- [ ] 执行应急恢复步骤
- [ ] 记录问题和解决过程
- [ ] 验证服务恢复状态
- [ ] 分析根本原因
- [ ] 制定预防措施
- [ ] 更新文档和流程

通过遵循本文档的指导，可以有效地维护 WordPecker 应用的稳定运行，快速解决常见问题，并建立完善的监控和预防机制。