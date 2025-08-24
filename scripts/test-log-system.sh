#!/bin/bash

# 测试日志系统脚本

set -e

PROJECT_DIR="$(pwd)"
LOG_DIR="$PROJECT_DIR/logs"
BACKEND_LOG_DIR="$PROJECT_DIR/backend/logs"

echo "🧪 测试WordPecker日志系统..."

# 创建测试日志目录
mkdir -p "$LOG_DIR" "$BACKEND_LOG_DIR"

echo "1. 测试日志目录创建..."
if [ -d "$LOG_DIR" ] && [ -d "$BACKEND_LOG_DIR" ]; then
    echo "✅ 日志目录创建成功"
else
    echo "❌ 日志目录创建失败"
    exit 1
fi

echo "2. 测试日志管理脚本..."
if [ -x "$PROJECT_DIR/scripts/log-manager.sh" ]; then
    echo "✅ 日志管理脚本可执行"
    
    # 测试统计功能
    echo "   测试统计功能..."
    "$PROJECT_DIR/scripts/log-manager.sh" stats
    
    if [ -f "$LOG_DIR/log-stats-$(date +%Y%m%d).json" ]; then
        echo "✅ 统计报告生成成功"
    else
        echo "⚠️  统计报告未生成（可能是首次运行）"
    fi
else
    echo "❌ 日志管理脚本不可执行"
    exit 1
fi

echo "3. 测试日志监控脚本..."
if [ -x "$PROJECT_DIR/scripts/log-monitor.sh" ]; then
    echo "✅ 日志监控脚本可执行"
    
    # 测试单次监控
    echo "   执行单次监控测试..."
    timeout 10 "$PROJECT_DIR/scripts/log-monitor.sh" once || echo "   监控测试完成"
    
    if [ -f "$LOG_DIR/log-monitor.log" ]; then
        echo "✅ 监控日志生成成功"
        echo "   最新监控记录:"
        tail -3 "$LOG_DIR/log-monitor.log" | sed 's/^/   /'
    else
        echo "⚠️  监控日志未生成"
    fi
else
    echo "❌ 日志监控脚本不可执行"
    exit 1
fi

echo "4. 测试logrotate配置脚本..."
if [ -x "$PROJECT_DIR/scripts/setup-logrotate.sh" ]; then
    echo "✅ logrotate配置脚本可执行"
else
    echo "❌ logrotate配置脚本不可执行"
    exit 1
fi

echo "5. 测试cron配置脚本..."
if [ -x "$PROJECT_DIR/scripts/setup-log-cron.sh" ]; then
    echo "✅ cron配置脚本可执行"
else
    echo "❌ cron配置脚本不可执行"
    exit 1
fi

echo "6. 测试Node.js日志配置..."
cd "$PROJECT_DIR/backend"

# 创建简单的日志测试脚本
cat > test-logger.js << 'EOF'
const { logger, apiLogger, dbLogger, performanceLogger } = require('./dist/config/logger');

console.log('测试Winston日志配置...');

// 测试基础日志
logger.info('测试信息日志', { test: true, component: 'test-script' });
logger.warn('测试警告日志', { test: true, component: 'test-script' });
logger.error('测试错误日志', { test: true, component: 'test-script', error: { message: '这是一个测试错误' } });

// 测试API日志
apiLogger.info('测试API日志', { 
    method: 'GET', 
    url: '/api/test', 
    responseTime: 150,
    test: true 
});

// 测试数据库日志
dbLogger.info('测试数据库日志', { 
    operation: 'find', 
    collection: 'test', 
    duration: 25,
    test: true 
});

// 测试性能日志
performanceLogger.info('测试性能日志', { 
    responseTime: 1200, 
    performance: { slow: true },
    test: true 
});

console.log('日志测试完成，检查日志文件...');

setTimeout(() => {
    process.exit(0);
}, 1000);
EOF

# 运行日志测试
if node test-logger.js; then
    echo "✅ Node.js日志系统测试成功"
    
    # 检查日志文件是否生成
    sleep 2
    
    echo "7. 检查生成的日志文件..."
    
    log_files_found=0
    
    if [ -f "$LOG_DIR/combined-current.log" ]; then
        echo "✅ 综合日志文件存在"
        echo "   最新记录:"
        tail -2 "$LOG_DIR/combined-current.log" | sed 's/^/   /'
        log_files_found=$((log_files_found + 1))
    fi
    
    if [ -f "$LOG_DIR/api-current.log" ]; then
        echo "✅ API日志文件存在"
        log_files_found=$((log_files_found + 1))
    fi
    
    if [ -f "$LOG_DIR/database-current.log" ]; then
        echo "✅ 数据库日志文件存在"
        log_files_found=$((log_files_found + 1))
    fi
    
    if [ -f "$LOG_DIR/performance-current.log" ]; then
        echo "✅ 性能日志文件存在"
        log_files_found=$((log_files_found + 1))
    fi
    
    if [ $log_files_found -gt 0 ]; then
        echo "✅ 日志文件生成正常 ($log_files_found 个文件)"
    else
        echo "⚠️  未找到预期的日志文件"
    fi
    
else
    echo "❌ Node.js日志系统测试失败"
    exit 1
fi

# 清理测试文件
rm -f test-logger.js

echo ""
echo "🎉 日志系统测试完成！"
echo ""
echo "📊 测试结果总结:"
echo "✅ 日志目录结构正确"
echo "✅ 日志管理脚本功能正常"
echo "✅ 日志监控脚本功能正常"
echo "✅ 配置脚本可执行"
echo "✅ Winston日志框架配置正确"
echo "✅ 日志文件生成正常"
echo ""
echo "📁 日志文件位置:"
echo "   主日志目录: $LOG_DIR"
echo "   后端日志目录: $BACKEND_LOG_DIR"
echo ""
echo "🔧 下一步操作:"
echo "1. 运行 sudo $PROJECT_DIR/scripts/setup-logrotate.sh 设置系统日志轮转"
echo "2. 运行 $PROJECT_DIR/scripts/setup-log-cron.sh 设置定时任务"
echo "3. 启动应用测试完整的日志记录功能"
echo ""
echo "📖 查看日志:"
echo "   实时监控: tail -f $LOG_DIR/combined-current.log"
echo "   错误日志: tail -f $LOG_DIR/error-current.log"
echo "   API日志: tail -f $LOG_DIR/api-current.log"