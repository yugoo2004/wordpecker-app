# WordPecker Sealos 成本优化指南

## 概述

本文档提供了在 Sealos 平台上运行 WordPecker 应用的成本优化策略和建议，帮助在保证应用性能的前提下最大化成本效益。

## 目录

1. [成本分析](#成本分析)
2. [资源优化策略](#资源优化策略)
3. [配置优化](#配置优化)
4. [监控和告警](#监控和告警)
5. [自动化管理](#自动化管理)
6. [最佳实践](#最佳实践)

## 成本分析

### 1. Sealos 资源成本构成

#### 计算资源成本
| 资源类型 | 规格 | 小时价格 | 月成本估算 | 适用场景 |
|----------|------|----------|------------|----------|
| CPU | 1 核心 | ¥0.05 | ¥36 | 开发/测试环境 |
| CPU | 2 核心 | ¥0.10 | ¥72 | 生产环境 |
| 内存 | 1GB | ¥0.02 | ¥14.4 | 基础配置 |
| 内存 | 2GB | ¥0.04 | ¥28.8 | 推荐配置 |
| 存储 | 10GB | ¥0.001 | ¥0.72 | 基础存储 |
| 存储 | 20GB | ¥0.002 | ¥1.44 | 扩展存储 |

#### 数据库成本
| 配置 | 规格 | 月成本估算 | 适用场景 |
|------|------|------------|----------|
| MongoDB 基础版 | 1核1GB | ¥50 | 开发环境 |
| MongoDB 标准版 | 2核2GB | ¥100 | 生产环境 |
| MongoDB 高可用版 | 2核4GB | ¥200 | 高可用需求 |

#### 网络成本
| 类型 | 价格 | 说明 |
|------|------|------|
| 内网流量 | 免费 | Sealos 内部通信 |
| 公网流量 | ¥0.8/GB | 出站流量计费 |
| 公网 IP | ¥20/月 | 固定公网 IP |

### 2. 成本计算器

```bash
#!/bin/bash
# scripts/cost-calculator.sh

echo "=== WordPecker Sealos 成本计算器 ==="

# 配置参数
CPU_CORES=${1:-2}
MEMORY_GB=${2:-2}
STORAGE_GB=${3:-20}
HOURS_PER_MONTH=720

# 价格配置 (单位: 元/小时)
CPU_PRICE_PER_CORE=0.10
MEMORY_PRICE_PER_GB=0.02
STORAGE_PRICE_PER_GB=0.001

# 计算月成本
CPU_COST=$(echo "$CPU_CORES * $CPU_PRICE_PER_CORE * $HOURS_PER_MONTH" | bc -l)
MEMORY_COST=$(echo "$MEMORY_GB * $MEMORY_PRICE_PER_GB * $HOURS_PER_MONTH" | bc -l)
STORAGE_COST=$(echo "$STORAGE_GB * $STORAGE_PRICE_PER_GB * $HOURS_PER_MONTH" | bc -l)

TOTAL_COMPUTE_COST=$(echo "$CPU_COST + $MEMORY_COST + $STORAGE_COST" | bc -l)

# 数据库成本 (估算)
DATABASE_COST=100

# 网络成本 (估算)
NETWORK_COST=20

# 总成本
TOTAL_COST=$(echo "$TOTAL_COMPUTE_COST + $DATABASE_COST + $NETWORK_COST" | bc -l)

echo "配置: ${CPU_CORES}核 ${MEMORY_GB}GB内存 ${STORAGE_GB}GB存储"
echo ""
echo "成本明细:"
printf "CPU 成本: ¥%.2f/月\n" $CPU_COST
printf "内存成本: ¥%.2f/月\n" $MEMORY_COST
printf "存储成本: ¥%.2f/月\n" $STORAGE_COST
printf "数据库成本: ¥%.2f/月\n" $DATABASE_COST
printf "网络成本: ¥%.2f/月\n" $NETWORK_COST
echo "------------------------"
printf "总成本: ¥%.2f/月\n" $TOTAL_COST

# 成本优化建议
echo ""
echo "成本优化建议:"
if (( $(echo "$CPU_CORES > 1" | bc -l) )); then
    echo "- 考虑在低峰期降低 CPU 配置"
fi
if (( $(echo "$MEMORY_GB > 2" | bc -l) )); then
    echo "- 监控内存使用率，考虑优化内存配置"
fi
if (( $(echo "$STORAGE_GB > 20" | bc -l) )); then
    echo "- 定期清理日志和临时文件"
fi
```

## 资源优化策略

### 1. CPU 优化

#### 动态 CPU 调整
```bash
#!/bin/bash
# scripts/cpu-optimizer.sh

echo "=== CPU 使用优化 ==="

# 获取当前 CPU 使用率
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')

echo "当前 CPU 使用率: $CPU_USAGE%"

# CPU 使用率阈值
LOW_THRESHOLD=20
HIGH_THRESHOLD=80

if (( $(echo "$CPU_USAGE < $LOW_THRESHOLD" | bc -l) )); then
    echo "建议: CPU 使用率较低，可以考虑降低配置"
    echo "- 当前配置可能过高"
    echo "- 考虑使用 1 核心配置"
elif (( $(echo "$CPU_USAGE > $HIGH_THRESHOLD" | bc -l) )); then
    echo "警告: CPU 使用率过高，建议升级配置"
    echo "- 考虑升级到更高配置"
    echo "- 或优化应用性能"
else
    echo "CPU 使用率正常"
fi

# PM2 进程优化
echo ""
echo "PM2 进程优化建议:"
pm2 list | grep -E "(cpu|memory)" || echo "请安装 PM2 以获取详细信息"
```

#### CPU 配置建议
```bash
# 开发环境配置
DEVELOPMENT_CONFIG="1核1GB"  # 成本: ~¥50/月

# 生产环境配置
PRODUCTION_CONFIG="2核2GB"   # 成本: ~¥100/月

# 高负载配置
HIGH_LOAD_CONFIG="4核4GB"    # 成本: ~¥200/月
```

### 2. 内存优化

#### 内存使用监控
```bash
#!/bin/bash
# scripts/memory-optimizer.sh

echo "=== 内存使用优化 ==="

# 获取内存使用情况
MEMORY_INFO=$(free -h)
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')

echo "内存使用情况:"
echo "$MEMORY_INFO"
echo ""
echo "内存使用率: $MEMORY_USAGE%"

# 内存优化建议
if [ $MEMORY_USAGE -lt 50 ]; then
    echo "建议: 内存使用率较低，可以考虑降低配置"
    echo "- 当前配置: 可能过高"
    echo "- 建议配置: 1GB 内存"
    echo "- 节省成本: ~¥14.4/月"
elif [ $MEMORY_USAGE -gt 85 ]; then
    echo "警告: 内存使用率过高，建议升级配置"
    echo "- 当前风险: 可能出现 OOM"
    echo "- 建议配置: 增加 1GB 内存"
    echo "- 额外成本: ~¥14.4/月"
else
    echo "内存使用率正常"
fi

# 内存清理建议
echo ""
echo "内存清理建议:"
echo "1. 清理系统缓存: sync && echo 3 > /proc/sys/vm/drop_caches"
echo "2. 重启服务释放内存: ./scripts/restart-app.sh"
echo "3. 配置 PM2 内存限制: max_memory_restart: '300M'"

# 检查内存泄漏
echo ""
echo "内存泄漏检查:"
ps aux --sort=-%mem | head -5 | awk '{printf "PID: %s, MEM: %s%%, CMD: %s\n", $2, $4, $11}'
```

#### 内存配置优化
```javascript
// ecosystem.config.js - 内存优化配置
module.exports = {
  apps: [{
    name: 'wordpecker-backend',
    script: 'npm',
    args: 'start',
    cwd: './backend',
    
    // 内存限制配置
    max_memory_restart: '400M',  // 内存超过 400MB 时重启
    
    // Node.js 内存优化
    node_args: [
      '--max-old-space-size=512',  // 限制 V8 堆内存为 512MB
      '--optimize-for-size'        // 优化内存使用
    ],
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=512'
    }
  }]
};
```

### 3. 存储优化

#### 存储清理脚本
```bash
#!/bin/bash
# scripts/storage-optimizer.sh

echo "=== 存储优化 ==="

# 当前存储使用情况
echo "当前存储使用:"
df -h .

# 分析目录大小
echo ""
echo "目录大小分析:"
du -sh * | sort -hr | head -10

# 日志文件清理
echo ""
echo "日志文件清理:"
LOG_SIZE=$(du -sh logs/ | cut -f1)
echo "日志目录大小: $LOG_SIZE"

# 清理策略
echo ""
echo "清理建议:"

# 1. 清理旧日志
OLD_LOGS=$(find logs/ -name "*.log" -mtime +7 | wc -l)
if [ $OLD_LOGS -gt 0 ]; then
    echo "1. 清理 7 天前的日志文件 ($OLD_LOGS 个文件)"
    echo "   命令: find logs/ -name '*.log' -mtime +7 -delete"
fi

# 2. 压缩日志
LARGE_LOGS=$(find logs/ -name "*.log" -size +10M | wc -l)
if [ $LARGE_LOGS -gt 0 ]; then
    echo "2. 压缩大于 10MB 的日志文件 ($LARGE_LOGS 个文件)"
    echo "   命令: find logs/ -name '*.log' -size +10M -exec gzip {} \;"
fi

# 3. 清理缓存
CACHE_SIZE=$(du -sh backend/node_modules/.cache frontend/node_modules/.cache 2>/dev/null | awk '{sum+=$1} END {print sum}')
if [ -n "$CACHE_SIZE" ]; then
    echo "3. 清理 npm 缓存"
    echo "   命令: rm -rf backend/node_modules/.cache frontend/node_modules/.cache"
fi

# 4. 清理构建文件
BUILD_SIZE=$(du -sh backend/dist frontend/dist 2>/dev/null | awk '{sum+=$1} END {print sum}')
if [ -n "$BUILD_SIZE" ]; then
    echo "4. 清理构建文件 (可重新构建)"
    echo "   命令: rm -rf backend/dist frontend/dist"
fi

# 自动清理选项
echo ""
read -p "是否执行自动清理? (y/N): " AUTO_CLEAN
if [[ $AUTO_CLEAN == [yY] ]]; then
    echo "执行自动清理..."
    
    # 清理旧日志
    find logs/ -name "*.log" -mtime +7 -delete
    echo "✓ 已清理旧日志文件"
    
    # 压缩大日志
    find logs/ -name "*.log" -size +10M -exec gzip {} \;
    echo "✓ 已压缩大日志文件"
    
    # 清理缓存
    rm -rf backend/node_modules/.cache frontend/node_modules/.cache 2>/dev/null
    echo "✓ 已清理缓存文件"
    
    echo ""
    echo "清理后存储使用:"
    df -h .
fi
```

#### 自动存储管理
```bash
#!/bin/bash
# scripts/auto-storage-cleanup.sh

# 设置存储使用阈值
STORAGE_THRESHOLD=80

# 获取当前存储使用率
STORAGE_USAGE=$(df . | awk 'NR==2{print $5}' | sed 's/%//')

echo "当前存储使用率: $STORAGE_USAGE%"

if [ $STORAGE_USAGE -gt $STORAGE_THRESHOLD ]; then
    echo "存储使用率超过阈值，开始自动清理..."
    
    # 1. 清理 7 天前的日志
    find logs/ -name "*.log" -mtime +7 -delete
    
    # 2. 压缩 1 天前的日志
    find logs/ -name "*.log" -mtime +1 -exec gzip {} \;
    
    # 3. 清理临时文件
    rm -rf /tmp/* 2>/dev/null
    
    # 4. 清理 npm 缓存
    npm cache clean --force
    
    echo "自动清理完成"
    
    # 检查清理后的使用率
    NEW_USAGE=$(df . | awk 'NR==2{print $5}' | sed 's/%//')
    echo "清理后存储使用率: $NEW_USAGE%"
    
    if [ $NEW_USAGE -gt $STORAGE_THRESHOLD ]; then
        echo "警告: 清理后存储使用率仍然过高，建议扩容"
    fi
else
    echo "存储使用率正常"
fi
```

## 配置优化

### 1. 应用配置优化

#### 后端配置优化
```javascript
// backend/src/config/optimization.ts
export const optimizationConfig = {
  // 数据库连接池优化
  database: {
    maxPoolSize: 5,        // 降低连接池大小
    minPoolSize: 1,        // 最小连接数
    maxIdleTimeMS: 30000,  // 连接空闲时间
    serverSelectionTimeoutMS: 5000
  },
  
  // 内存优化
  memory: {
    maxOldSpaceSize: 512,  // 限制 V8 堆内存
    maxSemiSpaceSize: 64   // 限制新生代内存
  },
  
  // 日志优化
  logging: {
    level: 'warn',         // 生产环境只记录警告和错误
    maxFiles: 3,           // 最多保留 3 个日志文件
    maxSize: '10m'         // 单个日志文件最大 10MB
  },
  
  // 缓存优化
  cache: {
    ttl: 300,              // 缓存 5 分钟
    maxSize: 100           // 最多缓存 100 个条目
  }
};
```

#### 前端配置优化
```javascript
// frontend/vite.config.ts
export default defineConfig({
  build: {
    // 构建优化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,    // 移除 console
        drop_debugger: true    // 移除 debugger
      }
    },
    
    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['lodash', 'axios']
        }
      }
    },
    
    // 资源优化
    assetsInlineLimit: 4096,  // 小于 4KB 的资源内联
    chunkSizeWarningLimit: 500
  },
  
  // 开发服务器优化
  server: {
    hmr: {
      overlay: false  // 禁用错误覆盖层以节省内存
    }
  }
});
```

### 2. PM2 配置优化

```javascript
// ecosystem.config.js - 成本优化版本
module.exports = {
  apps: [
    {
      name: 'wordpecker-backend',
      script: 'npm',
      args: 'start',
      cwd: './backend',
      instances: 1,  // 单实例以节省内存
      exec_mode: 'fork',
      
      // 资源限制
      max_memory_restart: '300M',
      max_restarts: 5,
      min_uptime: '10s',
      
      // 日志优化
      log_file: './logs/pm2-combined.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      
      // 环境优化
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=256'
      }
    },
    
    {
      name: 'wordpecker-frontend',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 5173',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      
      // 资源限制
      max_memory_restart: '200M',
      
      // 环境优化
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### 3. 系统配置优化

#### 系统参数调优
```bash
#!/bin/bash
# scripts/system-optimization.sh

echo "=== 系统优化配置 ==="

# 1. 内存优化
echo "配置内存优化参数..."

# 减少 swap 使用
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# 优化内存回收
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf

# 2. 网络优化
echo "配置网络优化参数..."

# TCP 连接优化
echo 'net.core.somaxconn=1024' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv4.tcp_max_syn_backlog=1024' | sudo tee -a /etc/sysctl.conf

# 3. 文件系统优化
echo "配置文件系统优化..."

# 增加文件描述符限制
echo '* soft nofile 65536' | sudo tee -a /etc/security/limits.conf
echo '* hard nofile 65536' | sudo tee -a /etc/security/limits.conf

# 应用配置
sudo sysctl -p

echo "系统优化配置完成"
```

## 监控和告警

### 1. 成本监控脚本

```bash
#!/bin/bash
# scripts/cost-monitor.sh

echo "=== 成本监控报告 ==="
echo "监控时间: $(date)"

# 资源使用统计
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
DISK_USAGE=$(df . | awk 'NR==2{print $5}' | sed 's/%//')

echo ""
echo "资源使用情况:"
echo "CPU 使用率: $CPU_USAGE%"
echo "内存使用率: $MEMORY_USAGE%"
echo "磁盘使用率: $DISK_USAGE%"

# 成本效率分析
echo ""
echo "成本效率分析:"

# CPU 效率
if (( $(echo "$CPU_USAGE < 30" | bc -l) )); then
    echo "⚠ CPU 利用率较低 ($CPU_USAGE%)，考虑降低配置"
    POTENTIAL_SAVINGS=$(echo "0.05 * 720" | bc -l)
    printf "潜在节省: ¥%.2f/月\n" $POTENTIAL_SAVINGS
elif (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "⚠ CPU 利用率过高 ($CPU_USAGE%)，考虑升级配置"
else
    echo "✓ CPU 利用率正常 ($CPU_USAGE%)"
fi

# 内存效率
if [ $MEMORY_USAGE -lt 40 ]; then
    echo "⚠ 内存利用率较低 ($MEMORY_USAGE%)，考虑降低配置"
    POTENTIAL_SAVINGS=$(echo "0.02 * 720" | bc -l)
    printf "潜在节省: ¥%.2f/月\n" $POTENTIAL_SAVINGS
elif [ $MEMORY_USAGE -gt 85 ]; then
    echo "⚠ 内存利用率过高 ($MEMORY_USAGE%)，考虑升级配置"
else
    echo "✓ 内存利用率正常 ($MEMORY_USAGE%)"
fi

# 存储效率
if [ $DISK_USAGE -lt 30 ]; then
    echo "⚠ 存储利用率较低 ($DISK_USAGE%)，考虑降低配置"
elif [ $DISK_USAGE -gt 80 ]; then
    echo "⚠ 存储利用率过高 ($DISK_USAGE%)，需要清理或扩容"
else
    echo "✓ 存储利用率正常 ($DISK_USAGE%)"
fi

# 服务运行时间统计
echo ""
echo "服务运行时间:"
if command -v pm2 &> /dev/null; then
    pm2 list | grep -E "(uptime|restart)"
fi

# 成本优化建议
echo ""
echo "成本优化建议:"
echo "1. 定期检查资源使用率"
echo "2. 在低峰期降低资源配置"
echo "3. 使用自动化脚本清理存储"
echo "4. 监控数据库连接数"
echo "5. 优化应用性能以降低资源需求"
```

### 2. 自动告警系统

```bash
#!/bin/bash
# scripts/cost-alert.sh

# 告警阈值配置
CPU_LOW_THRESHOLD=20
CPU_HIGH_THRESHOLD=80
MEMORY_LOW_THRESHOLD=30
MEMORY_HIGH_THRESHOLD=85
DISK_HIGH_THRESHOLD=80

# 获取当前资源使用
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
DISK_USAGE=$(df . | awk 'NR==2{print $5}' | sed 's/%//')

# 告警日志文件
ALERT_LOG="logs/cost-alerts.log"

# 记录告警函数
log_alert() {
    echo "$(date): $1" >> $ALERT_LOG
    echo "ALERT: $1"
}

# CPU 告警
if (( $(echo "$CPU_USAGE < $CPU_LOW_THRESHOLD" | bc -l) )); then
    log_alert "CPU 利用率过低: $CPU_USAGE% (建议降低配置)"
elif (( $(echo "$CPU_USAGE > $CPU_HIGH_THRESHOLD" | bc -l) )); then
    log_alert "CPU 利用率过高: $CPU_USAGE% (建议升级配置)"
fi

# 内存告警
if [ $MEMORY_USAGE -lt $MEMORY_LOW_THRESHOLD ]; then
    log_alert "内存利用率过低: $MEMORY_USAGE% (建议降低配置)"
elif [ $MEMORY_USAGE -gt $MEMORY_HIGH_THRESHOLD ]; then
    log_alert "内存利用率过高: $MEMORY_USAGE% (建议升级配置)"
fi

# 存储告警
if [ $DISK_USAGE -gt $DISK_HIGH_THRESHOLD ]; then
    log_alert "存储使用率过高: $DISK_USAGE% (需要清理或扩容)"
fi

# 成本异常检测
DAILY_COST_LIMIT=10  # 每日成本限制 (元)
# 这里可以集成 Sealos API 获取实际成本数据

echo "成本监控完成，详细信息请查看: $ALERT_LOG"
```

## 自动化管理

### 1. 自动扩缩容脚本

```bash
#!/bin/bash
# scripts/auto-scaling.sh

echo "=== 自动扩缩容管理 ==="

# 配置参数
SCALE_UP_CPU_THRESHOLD=80
SCALE_DOWN_CPU_THRESHOLD=30
SCALE_UP_MEMORY_THRESHOLD=85
SCALE_DOWN_MEMORY_THRESHOLD=40

# 获取当前资源使用
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')

echo "当前资源使用:"
echo "CPU: $CPU_USAGE%"
echo "内存: $MEMORY_USAGE%"

# 扩容决策
SCALE_ACTION="none"

if (( $(echo "$CPU_USAGE > $SCALE_UP_CPU_THRESHOLD" | bc -l) )) || [ $MEMORY_USAGE -gt $SCALE_UP_MEMORY_THRESHOLD ]; then
    SCALE_ACTION="up"
    echo "建议: 扩容资源"
    echo "原因: CPU 或内存使用率过高"
elif (( $(echo "$CPU_USAGE < $SCALE_DOWN_CPU_THRESHOLD" | bc -l) )) && [ $MEMORY_USAGE -lt $SCALE_DOWN_MEMORY_THRESHOLD ]; then
    SCALE_ACTION="down"
    echo "建议: 缩容资源"
    echo "原因: CPU 和内存使用率都较低"
else
    echo "当前资源配置合适"
fi

# 执行扩缩容 (需要集成 Sealos API)
if [ "$SCALE_ACTION" != "none" ]; then
    echo ""
    echo "扩缩容操作需要在 Sealos 控制台手动执行"
    echo "或集成 Sealos API 进行自动化操作"
    
    # 记录扩缩容建议
    echo "$(date): 建议 $SCALE_ACTION 扩缩容 - CPU: $CPU_USAGE%, Memory: $MEMORY_USAGE%" >> logs/scaling.log
fi
```

### 2. 定时成本优化

```bash
#!/bin/bash
# scripts/scheduled-optimization.sh

echo "=== 定时成本优化 ==="

# 获取当前时间
CURRENT_HOUR=$(date +%H)
CURRENT_DAY=$(date +%u)  # 1=Monday, 7=Sunday

echo "当前时间: $(date)"

# 低峰期优化 (晚上 22:00 - 早上 8:00)
if [ $CURRENT_HOUR -ge 22 ] || [ $CURRENT_HOUR -le 8 ]; then
    echo "当前为低峰期，执行成本优化..."
    
    # 1. 降低 PM2 实例数
    if command -v pm2 &> /dev/null; then
        echo "优化 PM2 配置..."
        pm2 scale wordpecker-backend 1
        pm2 scale wordpecker-frontend 1
    fi
    
    # 2. 清理系统缓存
    echo "清理系统缓存..."
    sync && echo 1 > /proc/sys/vm/drop_caches
    
    # 3. 压缩日志文件
    echo "压缩日志文件..."
    find logs/ -name "*.log" -size +5M -exec gzip {} \;
    
    echo "低峰期优化完成"
    
# 高峰期准备 (早上 8:00 - 晚上 22:00)
else
    echo "当前为高峰期，确保服务正常运行..."
    
    # 检查服务状态
    ./scripts/status-app.sh
    
    # 如果服务异常，自动重启
    if ! curl -s http://localhost:3000/api/health > /dev/null; then
        echo "后端服务异常，自动重启..."
        ./scripts/restart-app.sh 2
    fi
    
    if ! curl -s http://localhost:5173 > /dev/null; then
        echo "前端服务异常，自动重启..."
        ./scripts/restart-app.sh 3
    fi
fi

# 周末深度优化
if [ $CURRENT_DAY -eq 7 ] && [ $CURRENT_HOUR -eq 2 ]; then
    echo "执行周末深度优化..."
    
    # 1. 完整重启服务
    ./scripts/restart-app.sh
    
    # 2. 清理所有缓存
    rm -rf backend/node_modules/.cache
    rm -rf frontend/node_modules/.cache
    npm cache clean --force
    
    # 3. 数据库优化 (如果有权限)
    # 这里可以添加数据库维护脚本
    
    echo "周末深度优化完成"
fi
```

## 最佳实践

### 1. 成本控制检查清单

#### 日常检查 (每日)
- [ ] 检查资源使用率 (CPU < 80%, Memory < 85%)
- [ ] 清理当日产生的大日志文件 (> 10MB)
- [ ] 验证服务健康状态
- [ ] 检查异常进程和内存泄漏

#### 周度检查 (每周)
- [ ] 分析一周的资源使用趋势
- [ ] 清理 7 天前的日志文件
- [ ] 检查依赖包更新和安全漏洞
- [ ] 评估配置优化效果

#### 月度检查 (每月)
- [ ] 分析月度成本报告
- [ ] 评估资源配置合理性
- [ ] 制定下月成本优化计划
- [ ] 备份重要配置和数据

### 2. 成本优化策略

#### 短期优化 (立即执行)
1. **清理存储空间**
   ```bash
   # 清理日志文件
   find logs/ -name "*.log" -mtime +7 -delete
   
   # 压缩大文件
   find logs/ -name "*.log" -size +10M -exec gzip {} \;
   
   # 清理缓存
   npm cache clean --force
   ```

2. **优化内存使用**
   ```bash
   # 配置 PM2 内存限制
   vim ecosystem.config.js
   # 设置: max_memory_restart: '300M'
   
   # 重启服务释放内存
   ./scripts/restart-app.sh
   ```

3. **调整资源配置**
   - 监控资源使用率
   - 在 Sealos 控制台调整配置
   - 验证调整效果

#### 中期优化 (1-2 周内)
1. **应用性能优化**
   - 优化数据库查询
   - 实现缓存机制
   - 压缩静态资源

2. **自动化管理**
   - 设置定时清理任务
   - 配置资源监控告警
   - 实现自动重启机制

3. **配置调优**
   - 优化 PM2 配置
   - 调整系统参数
   - 优化网络配置

#### 长期优化 (1 个月以上)
1. **架构优化**
   - 考虑微服务拆分
   - 实现负载均衡
   - 使用 CDN 加速

2. **成本管理**
   - 建立成本预算机制
   - 实现成本告警系统
   - 定期评估 ROI

3. **技术升级**
   - 升级到更高效的技术栈
   - 使用更优化的部署方案
   - 考虑容器化部署

### 3. 成本优化工具集

```bash
#!/bin/bash
# scripts/cost-optimization-toolkit.sh

echo "=== WordPecker 成本优化工具集 ==="

echo "可用工具:"
echo "1. 成本计算器 - ./scripts/cost-calculator.sh"
echo "2. 资源监控 - ./scripts/cost-monitor.sh"
echo "3. 存储优化 - ./scripts/storage-optimizer.sh"
echo "4. 内存优化 - ./scripts/memory-optimizer.sh"
echo "5. CPU 优化 - ./scripts/cpu-optimizer.sh"
echo "6. 自动清理 - ./scripts/auto-storage-cleanup.sh"
echo "7. 定时优化 - ./scripts/scheduled-optimization.sh"
echo "8. 成本告警 - ./scripts/cost-alert.sh"

read -p "选择要执行的工具 (1-8): " TOOL_CHOICE

case $TOOL_CHOICE in
    1) ./scripts/cost-calculator.sh ;;
    2) ./scripts/cost-monitor.sh ;;
    3) ./scripts/storage-optimizer.sh ;;
    4) ./scripts/memory-optimizer.sh ;;
    5) ./scripts/cpu-optimizer.sh ;;
    6) ./scripts/auto-storage-cleanup.sh ;;
    7) ./scripts/scheduled-optimization.sh ;;
    8) ./scripts/cost-alert.sh ;;
    *) echo "无效选项" ;;
esac
```

## 总结

### 成本优化要点

1. **资源配置优化**
   - 根据实际使用情况调整 CPU、内存配置
   - 避免资源过度配置
   - 定期评估和调整

2. **存储管理**
   - 定期清理日志和临时文件
   - 实现日志轮转和压缩
   - 监控存储使用趋势

3. **应用优化**
   - 优化代码性能
   - 实现缓存机制
   - 减少资源消耗

4. **自动化管理**
   - 设置自动清理任务
   - 实现资源监控告警
   - 建立成本控制机制

5. **持续监控**
   - 定期分析成本报告
   - 监控资源使用趋势
   - 及时调整优化策略

通过实施这些成本优化策略，可以在保证 WordPecker 应用性能的前提下，显著降低 Sealos 平台的运行成本。建议定期执行成本分析和优化，以实现最佳的成本效益比。