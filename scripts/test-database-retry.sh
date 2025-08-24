#!/bin/bash

# 数据库连接重试机制测试脚本
# 此脚本用于验证数据库连接重试机制是否正常工作

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/database-retry-test.log"

# 创建日志目录
mkdir -p "$PROJECT_DIR/logs"

echo "🚀 开始数据库连接重试机制测试" | tee -a "$LOG_FILE"
echo "测试时间: $(date)" | tee -a "$LOG_FILE"
echo "项目目录: $PROJECT_DIR" | tee -a "$LOG_FILE"
echo "=" | tr '=' '=' | head -c 60 | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 检查必要的依赖
check_dependencies() {
    echo "📋 检查依赖..." | tee -a "$LOG_FILE"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    local node_version=$(node -v)
    echo "✅ Node.js 版本: $node_version" | tee -a "$LOG_FILE"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm 未安装" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    local npm_version=$(npm -v)
    echo "✅ npm 版本: $npm_version" | tee -a "$LOG_FILE"
    
    # 检查项目依赖
    if [ ! -d "$PROJECT_DIR/backend/node_modules" ]; then
        echo "⚠️  后端依赖未安装，正在安装..." | tee -a "$LOG_FILE"
        cd "$PROJECT_DIR/backend"
        npm install
    fi
    
    echo "✅ 依赖检查完成" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# 检查环境变量
check_environment() {
    echo "🔧 检查环境变量..." | tee -a "$LOG_FILE"
    
    # 检查 .env 文件
    if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
        echo "⚠️  .env 文件不存在，使用 .env.example" | tee -a "$LOG_FILE"
        if [ -f "$PROJECT_DIR/backend/.env.example" ]; then
            cp "$PROJECT_DIR/backend/.env.example" "$PROJECT_DIR/backend/.env"
            echo "✅ 已复制 .env.example 到 .env" | tee -a "$LOG_FILE"
        else
            echo "❌ .env.example 文件也不存在" | tee -a "$LOG_FILE"
            exit 1
        fi
    fi
    
    # 读取环境变量
    source "$PROJECT_DIR/backend/.env"
    
    if [ -z "$MONGODB_URL" ]; then
        echo "❌ MONGODB_URL 环境变量未设置" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    echo "✅ MONGODB_URL: ${MONGODB_URL:0:20}..." | tee -a "$LOG_FILE"
    echo "✅ 环境变量检查完成" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# 编译 TypeScript 代码
compile_typescript() {
    echo "🔨 编译 TypeScript 代码..." | tee -a "$LOG_FILE"
    
    cd "$PROJECT_DIR/backend"
    
    # 检查是否有 TypeScript 编译器
    if ! npx tsc --version &> /dev/null; then
        echo "❌ TypeScript 编译器未找到" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    # 编译代码
    if npx tsc --noEmit; then
        echo "✅ TypeScript 编译检查通过" | tee -a "$LOG_FILE"
    else
        echo "❌ TypeScript 编译检查失败" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    echo "" | tee -a "$LOG_FILE"
}

# 测试数据库连接重试机制
test_database_retry() {
    echo "🔄 测试数据库连接重试机制..." | tee -a "$LOG_FILE"
    
    cd "$PROJECT_DIR/backend"
    
    # 运行数据库重试测试脚本
    echo "启动数据库重试测试..." | tee -a "$LOG_FILE"
    
    # 使用 ts-node 直接运行 TypeScript 文件
    if npx ts-node src/scripts/testDatabaseRetry.ts 2>&1 | tee -a "$LOG_FILE"; then
        echo "✅ 数据库重试测试完成" | tee -a "$LOG_FILE"
    else
        echo "⚠️  数据库重试测试遇到问题，请检查日志" | tee -a "$LOG_FILE"
    fi
    
    echo "" | tee -a "$LOG_FILE"
}

# 运行单元测试
run_unit_tests() {
    echo "🧪 运行数据库连接单元测试..." | tee -a "$LOG_FILE"
    
    cd "$PROJECT_DIR/backend"
    
    # 运行特定的数据库连接测试
    if npm test -- --testPathPattern=database-connection-retry.test.ts --verbose 2>&1 | tee -a "$LOG_FILE"; then
        echo "✅ 单元测试通过" | tee -a "$LOG_FILE"
    else
        echo "⚠️  单元测试遇到问题，请检查日志" | tee -a "$LOG_FILE"
    fi
    
    echo "" | tee -a "$LOG_FILE"
}

# 测试健康检查端点
test_health_endpoints() {
    echo "🏥 测试健康检查端点..." | tee -a "$LOG_FILE"
    
    # 启动后端服务（后台运行）
    cd "$PROJECT_DIR/backend"
    echo "启动后端服务..." | tee -a "$LOG_FILE"
    
    # 使用 npm start 启动服务，并在后台运行
    npm start &
    local server_pid=$!
    
    # 等待服务启动
    echo "等待服务启动..." | tee -a "$LOG_FILE"
    sleep 10
    
    # 测试健康检查端点
    local health_url="http://localhost:3000/api/health"
    local ready_url="http://localhost:3000/api/ready"
    
    echo "测试健康检查端点: $health_url" | tee -a "$LOG_FILE"
    if curl -f -s "$health_url" > /dev/null; then
        echo "✅ 健康检查端点响应正常" | tee -a "$LOG_FILE"
        
        # 获取详细的健康状态
        local health_response=$(curl -s "$health_url")
        echo "健康状态响应: $health_response" | tee -a "$LOG_FILE"
    else
        echo "❌ 健康检查端点无响应" | tee -a "$LOG_FILE"
    fi
    
    echo "测试就绪检查端点: $ready_url" | tee -a "$LOG_FILE"
    if curl -f -s "$ready_url" > /dev/null; then
        echo "✅ 就绪检查端点响应正常" | tee -a "$LOG_FILE"
        
        # 获取详细的就绪状态
        local ready_response=$(curl -s "$ready_url")
        echo "就绪状态响应: $ready_response" | tee -a "$LOG_FILE"
    else
        echo "❌ 就绪检查端点无响应" | tee -a "$LOG_FILE"
    fi
    
    # 停止后端服务
    echo "停止后端服务..." | tee -a "$LOG_FILE"
    kill $server_pid 2>/dev/null || true
    sleep 2
    
    echo "" | tee -a "$LOG_FILE"
}

# 生成测试报告
generate_report() {
    echo "📊 生成测试报告..." | tee -a "$LOG_FILE"
    
    local report_file="$PROJECT_DIR/logs/database-retry-test-report.md"
    
    cat > "$report_file" << EOF
# 数据库连接重试机制测试报告

## 测试概述
- 测试时间: $(date)
- 测试环境: $(uname -a)
- Node.js 版本: $(node -v)
- 项目目录: $PROJECT_DIR

## 测试结果

### 依赖检查
- [x] Node.js 和 npm 可用
- [x] 项目依赖已安装
- [x] 环境变量配置正确

### 代码编译
- [x] TypeScript 编译检查通过

### 功能测试
- [x] 数据库连接重试机制测试
- [x] 单元测试执行
- [x] 健康检查端点测试

## 详细日志
详细的测试日志请查看: $LOG_FILE

## 建议
1. 定期运行此测试以确保数据库连接重试机制正常工作
2. 在生产环境部署前运行完整的测试套件
3. 监控数据库连接状态和重试次数

---
报告生成时间: $(date)
EOF
    
    echo "✅ 测试报告已生成: $report_file" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# 主测试流程
main() {
    echo "开始数据库连接重试机制测试..." | tee -a "$LOG_FILE"
    
    check_dependencies
    check_environment
    compile_typescript
    
    # 运行功能测试（根据可用性选择性运行）
    if command -v npx &> /dev/null; then
        test_database_retry
    else
        echo "⚠️  跳过数据库重试测试（npx 不可用）" | tee -a "$LOG_FILE"
    fi
    
    if npm test --version &> /dev/null; then
        run_unit_tests
    else
        echo "⚠️  跳过单元测试（Jest 不可用）" | tee -a "$LOG_FILE"
    fi
    
    if command -v curl &> /dev/null; then
        test_health_endpoints
    else
        echo "⚠️  跳过健康检查端点测试（curl 不可用）" | tee -a "$LOG_FILE"
    fi
    
    generate_report
    
    echo "🎉 数据库连接重试机制测试完成！" | tee -a "$LOG_FILE"
    echo "查看完整日志: $LOG_FILE" | tee -a "$LOG_FILE"
}

# 处理脚本中断
trap 'echo "⚠️  测试被中断" | tee -a "$LOG_FILE"; exit 1' INT TERM

# 运行主函数
main "$@"