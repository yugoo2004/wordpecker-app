#!/bin/bash
# WordPecker 部署前检查脚本
# 功能：环境验证、依赖检查、系统资源评估

set -e

# 配置变量
LOG_FILE="./logs/pre-deploy-check.log"
CHECK_RESULTS_FILE="./logs/check-results.json"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查结果统计
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

# 增加检查计数
increment_check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

# 检查系统环境
check_system_environment() {
    log_info "检查系统环境"
    
    # 操作系统检查
    increment_check
    local os_info=$(uname -a)
    log_info "操作系统: $os_info"
    
    if [[ "$os_info" == *"Linux"* ]]; then
        log_success "操作系统: Linux (支持)"
    else
        log_warning "操作系统: 非Linux系统，可能存在兼容性问题"
    fi
    
    # 用户权限检查
    increment_check
    local current_user=$(whoami)
    if [ "$current_user" = "root" ]; then
        log_warning "当前用户: root (不推荐使用root用户运行应用)"
    else
        log_success "当前用户: $current_user (非root用户)"
    fi
    
    # 工作目录检查
    increment_check
    local current_dir=$(pwd)
    if [[ "$current_dir" == *"wordpecker"* ]] || [ -f "./package.json" ]; then
        log_success "工作目录: 在正确的项目目录中"
    else
        log_error "工作目录: 不在WordPecker项目目录中"
    fi
}

# 检查Node.js环境
check_nodejs_environment() {
    log_info "检查Node.js环境"
    
    # Node.js版本检查
    increment_check
    if command -v node &> /dev/null; then
        local node_version=$(node -v | cut -d'v' -f2)
        log_info "Node.js版本: $node_version"
        
        # 检查版本是否满足要求
        if node -e "
            const semver = require('semver');
            process.exit(semver.gte('$node_version', '16.0.0') ? 0 : 1);
        " 2>/dev/null; then
            log_success "Node.js版本: $node_version (满足要求 >=16.0.0)"
        else
            log_error "Node.js版本: $node_version (不满足要求 >=16.0.0)"
        fi
    else
        log_error "Node.js: 未安装"
    fi
    
    # npm版本检查
    increment_check
    if command -v npm &> /dev/null; then
        local npm_version=$(npm -v)
        log_success "npm版本: $npm_version"
    else
        log_error "npm: 未安装"
    fi
    
    # PM2检查
    increment_check
    if command -v pm2 &> /dev/null; then
        local pm2_version=$(pm2 -v)
        log_success "PM2版本: $pm2_version"
        
        # 检查PM2进程状态
        local pm2_status=$(pm2 list 2>/dev/null | grep -c "wordpecker" || echo "0")
        log_info "当前PM2进程数: $pm2_status"
    else
        log_error "PM2: 未安装"
    fi
}

# 检查项目结构
check_project_structure() {
    log_info "检查项目结构"
    
    # 关键目录检查
    local required_dirs=("backend" "frontend" "scripts")
    for dir in "${required_dirs[@]}"; do
        increment_check
        if [ -d "./$dir" ]; then
            log_success "目录存在: $dir"
        else
            log_error "目录缺失: $dir"
        fi
    done
    
    # 关键文件检查
    local required_files=("package.json" "ecosystem.config.js" "docker-compose.yml")
    for file in "${required_files[@]}"; do
        increment_check
        if [ -f "./$file" ]; then
            log_success "文件存在: $file"
        else
            log_warning "文件缺失: $file (可能不是必需的)"
        fi
    done
    
    # 后端package.json检查
    increment_check
    if [ -f "./backend/package.json" ]; then
        log_success "后端package.json存在"
        
        # 检查关键依赖
        local backend_deps=$(cat "./backend/package.json" | grep -E '"express"|"mongoose"|"openai"' | wc -l)
        if [ "$backend_deps" -ge 3 ]; then
            log_success "后端关键依赖配置正确"
        else
            log_warning "后端关键依赖可能缺失"
        fi
    else
        log_error "后端package.json缺失"
    fi
    
    # 前端package.json检查
    increment_check
    if [ -f "./frontend/package.json" ]; then
        log_success "前端package.json存在"
        
        # 检查构建脚本
        if grep -q '"build"' "./frontend/package.json"; then
            log_success "前端构建脚本配置正确"
        else
            log_warning "前端构建脚本可能缺失"
        fi
    else
        log_error "前端package.json缺失"
    fi
}

# 检查环境变量
check_environment_variables() {
    log_info "检查环境变量"
    
    # 必需的环境变量
    local required_vars=("OPENAI_API_KEY" "MONGODB_URL")
    for var in "${required_vars[@]}"; do
        increment_check
        if [ -n "${!var}" ]; then
            log_success "环境变量: $var 已设置"
        else
            log_error "环境变量: $var 未设置"
        fi
    done
    
    # 可选的环境变量
    local optional_vars=("ELEVENLABS_API_KEY" "PEXELS_API_KEY" "NODE_ENV" "PORT")
    for var in "${optional_vars[@]}"; do
        increment_check
        if [ -n "${!var}" ]; then
            log_success "环境变量: $var 已设置 (可选)"
        else
            log_warning "环境变量: $var 未设置 (可选)"
        fi
    done
    
    # .env文件检查
    increment_check
    if [ -f "./backend/.env" ]; then
        log_success ".env文件: backend/.env 存在"
    else
        log_warning ".env文件: backend/.env 不存在"
    fi
    
    increment_check
    if [ -f "./frontend/.env" ]; then
        log_success ".env文件: frontend/.env 存在"
    else
        log_warning ".env文件: frontend/.env 不存在"
    fi
}

# 检查系统资源
check_system_resources() {
    log_info "检查系统资源"
    
    # 磁盘空间检查
    increment_check
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    local disk_available=$(df -h / | awk 'NR==2{print $4}')
    
    log_info "磁盘使用率: ${disk_usage}%"
    log_info "可用空间: $disk_available"
    
    if [ "$disk_usage" -lt 70 ]; then
        log_success "磁盘空间: 充足 (${disk_usage}%)"
    elif [ "$disk_usage" -lt 85 ]; then
        log_warning "磁盘空间: 较紧张 (${disk_usage}%)"
    else
        log_error "磁盘空间: 不足 (${disk_usage}%)"
    fi
    
    # 内存检查
    increment_check
    local memory_total=$(free -h | grep Mem | awk '{print $2}')
    local memory_used=$(free -h | grep Mem | awk '{print $3}')
    local memory_usage=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    
    log_info "内存总量: $memory_total"
    log_info "已用内存: $memory_used"
    log_info "内存使用率: ${memory_usage}%"
    
    if (( $(echo "$memory_usage < 70" | bc -l) )); then
        log_success "内存使用: 正常 (${memory_usage}%)"
    elif (( $(echo "$memory_usage < 85" | bc -l) )); then
        log_warning "内存使用: 较高 (${memory_usage}%)"
    else
        log_error "内存使用: 过高 (${memory_usage}%)"
    fi
    
    # CPU负载检查
    increment_check
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    
    log_info "CPU核心数: $cpu_cores"
    log_info "1分钟负载: $load_avg"
    
    if (( $(echo "$load_avg < $cpu_cores" | bc -l) )); then
        log_success "CPU负载: 正常 ($load_avg)"
    else
        log_warning "CPU负载: 较高 ($load_avg)"
    fi
}

# 检查网络连接
check_network_connectivity() {
    log_info "检查网络连接"
    
    # 基本网络连接
    increment_check
    if ping -c 1 8.8.8.8 &> /dev/null; then
        log_success "网络连接: 正常"
    else
        log_error "网络连接: 异常"
    fi
    
    # GitHub连接检查
    increment_check
    if curl -s --connect-timeout 5 https://github.com &> /dev/null; then
        log_success "GitHub连接: 正常"
    else
        log_warning "GitHub连接: 异常 (可能影响代码更新)"
    fi
    
    # npm registry连接检查
    increment_check
    if curl -s --connect-timeout 5 https://registry.npmjs.org &> /dev/null; then
        log_success "npm registry连接: 正常"
    else
        log_warning "npm registry连接: 异常 (可能影响依赖安装)"
    fi
}

# 检查数据库连接
check_database_connectivity() {
    log_info "检查数据库连接"
    
    increment_check
    if [ -z "$MONGODB_URL" ]; then
        log_error "数据库连接: MONGODB_URL未设置"
        return
    fi
    
    # 测试MongoDB连接
    if command -v node &> /dev/null && [ -f "./backend/package.json" ]; then
        # 检查是否有mongoose依赖
        if [ -d "./backend/node_modules/mongoose" ] || grep -q '"mongoose"' "./backend/package.json"; then
            log_info "测试MongoDB连接..."
            
            if timeout 10 node -e "
                const mongoose = require('./backend/node_modules/mongoose');
                mongoose.connect('$MONGODB_URL', { 
                    serverSelectionTimeoutMS: 5000,
                    connectTimeoutMS: 5000 
                })
                .then(() => {
                    console.log('数据库连接成功');
                    process.exit(0);
                })
                .catch(err => {
                    console.error('数据库连接失败:', err.message);
                    process.exit(1);
                });
            " 2>/dev/null; then
                log_success "数据库连接: 正常"
            else
                log_error "数据库连接: 失败"
            fi
        else
            log_warning "数据库连接: 无法测试 (mongoose未安装)"
        fi
    else
        log_warning "数据库连接: 无法测试 (Node.js或项目文件缺失)"
    fi
}

# 检查外部API连接
check_external_apis() {
    log_info "检查外部API连接"
    
    # OpenAI API检查
    increment_check
    if [ -n "$OPENAI_API_KEY" ]; then
        log_info "测试OpenAI API连接..."
        
        local openai_response=$(curl -s -w "%{http_code}" -o /dev/null \
            --connect-timeout 10 \
            -H "Authorization: Bearer $OPENAI_API_KEY" \
            -H "Content-Type: application/json" \
            https://api.openai.com/v1/models)
        
        if [ "$openai_response" = "200" ]; then
            log_success "OpenAI API: 连接正常"
        else
            log_error "OpenAI API: 连接失败 (HTTP $openai_response)"
        fi
    else
        log_error "OpenAI API: API密钥未设置"
    fi
    
    # ElevenLabs API检查 (可选)
    increment_check
    if [ -n "$ELEVENLABS_API_KEY" ]; then
        log_info "测试ElevenLabs API连接..."
        
        local elevenlabs_response=$(curl -s -w "%{http_code}" -o /dev/null \
            --connect-timeout 10 \
            -H "xi-api-key: $ELEVENLABS_API_KEY" \
            https://api.elevenlabs.io/v1/voices)
        
        if [ "$elevenlabs_response" = "200" ]; then
            log_success "ElevenLabs API: 连接正常 (可选)"
        else
            log_warning "ElevenLabs API: 连接失败 (可选服务)"
        fi
    else
        log_warning "ElevenLabs API: API密钥未设置 (可选服务)"
    fi
    
    # Pexels API检查 (可选)
    increment_check
    if [ -n "$PEXELS_API_KEY" ]; then
        log_info "测试Pexels API连接..."
        
        local pexels_response=$(curl -s -w "%{http_code}" -o /dev/null \
            --connect-timeout 10 \
            -H "Authorization: $PEXELS_API_KEY" \
            https://api.pexels.com/v1/search?query=test&per_page=1)
        
        if [ "$pexels_response" = "200" ]; then
            log_success "Pexels API: 连接正常 (可选)"
        else
            log_warning "Pexels API: 连接失败 (可选服务)"
        fi
    else
        log_warning "Pexels API: API密钥未设置 (可选服务)"
    fi
}

# 生成检查报告
generate_check_report() {
    local end_time=$(date +%s)
    local start_time=${1:-$end_time}
    local duration=$((end_time - start_time))
    
    # 计算成功率
    local success_rate=0
    if [ "$TOTAL_CHECKS" -gt 0 ]; then
        success_rate=$(echo "scale=2; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc)
    fi
    
    # 生成JSON报告
    cat > "$CHECK_RESULTS_FILE" << EOF
{
  "check_summary": {
    "timestamp": "$(date -d @$end_time '+%Y-%m-%d %H:%M:%S')",
    "duration_seconds": $duration,
    "total_checks": $TOTAL_CHECKS,
    "passed_checks": $PASSED_CHECKS,
    "failed_checks": $FAILED_CHECKS,
    "warning_checks": $WARNING_CHECKS,
    "success_rate": $success_rate
  },
  "system_info": {
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "os": "$(uname -s)",
    "kernel": "$(uname -r)",
    "architecture": "$(uname -m)"
  },
  "recommendations": []
}
EOF
    
    # 添加建议
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        echo "部署前检查发现 $FAILED_CHECKS 个严重问题，建议修复后再部署" >> "$CHECK_RESULTS_FILE.recommendations"
    fi
    
    if [ "$WARNING_CHECKS" -gt 5 ]; then
        echo "发现较多警告项目，建议检查系统配置" >> "$CHECK_RESULTS_FILE.recommendations"
    fi
    
    log_info "检查报告已生成: $CHECK_RESULTS_FILE"
}

# 显示检查结果摘要
show_summary() {
    echo
    log_info "=========================================="
    log_info "部署前检查完成"
    log_info "=========================================="
    log_info "总检查项目: $TOTAL_CHECKS"
    log_success "通过: $PASSED_CHECKS"
    log_warning "警告: $WARNING_CHECKS"
    log_error "失败: $FAILED_CHECKS"
    
    local success_rate=0
    if [ "$TOTAL_CHECKS" -gt 0 ]; then
        success_rate=$(echo "scale=1; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc)
    fi
    log_info "成功率: ${success_rate}%"
    
    echo
    if [ "$FAILED_CHECKS" -eq 0 ]; then
        log_success "✅ 系统已准备好进行部署"
        return 0
    else
        log_error "❌ 发现严重问题，不建议进行部署"
        log_error "请修复失败的检查项目后重新运行检查"
        return 1
    fi
}

# 主检查流程
main() {
    local start_time=$(date +%s)
    
    # 创建日志目录
    mkdir -p "./logs"
    
    log_info "=========================================="
    log_info "WordPecker 部署前检查开始"
    log_info "时间: $(date)"
    log_info "=========================================="
    
    # 执行各项检查
    check_system_environment
    check_nodejs_environment
    check_project_structure
    check_environment_variables
    check_system_resources
    check_network_connectivity
    check_database_connectivity
    check_external_apis
    
    # 生成报告
    generate_check_report "$start_time"
    
    # 显示摘要
    show_summary
}

# 脚本入口点
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi