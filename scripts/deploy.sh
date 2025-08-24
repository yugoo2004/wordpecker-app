#!/bin/bash

# WordPecker 自动化部署脚本
# 功能：代码更新、依赖安装、备份、回滚机制
# 作者：W

# 配置变量
PROJECT_DIR="/home/devbox/wordpecker-app"
BACKUP_DIR="/home/devbox/backups"
LOG_FILE="./logs/deploy.log"
DEPLOY_LOCK_FILE="/tmp/wordpecker-deploy.lock"
NOTIFICATION_LOG="./logs/deploy-notifications.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# 发送通知
send_notification() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$level] $timestamp - $message" >> "$NOTIFICATION_LOG"
    
    # 可以扩展为发送邮件、Slack等通知
    logger -t wordpecker-deploy "[$level] $message"
}

# 检查部署锁
check_deploy_lock() {
    if [ -f "$DEPLOY_LOCK_FILE" ]; then
        local lock_pid=$(cat "$DEPLOY_LOCK_FILE")
        if kill -0 "$lock_pid" 2>/dev/null; then
            log_error "部署已在进行中 (PID: $lock_pid)"
            exit 1
        else
            log_warning "发现过期的部署锁文件，正在清理"
            rm -f "$DEPLOY_LOCK_FILE"
        fi
    fi
}

# 创建部署锁
create_deploy_lock() {
    echo $$ > "$DEPLOY_LOCK_FILE"
    log_info "创建部署锁 (PID: $$)"
}

# 清理部署锁
cleanup_deploy_lock() {
    rm -f "$DEPLOY_LOCK_FILE"
    log_info "清理部署锁"
}

# 陷阱处理 - 确保锁文件被清理
trap cleanup_deploy_lock EXIT INT TERM

# 创建必要目录
create_directories() {
    log_info "创建必要目录"
    mkdir -p "$BACKUP_DIR" "./logs" "./audio-cache"
    
    # 设置权限
    chmod 755 "$BACKUP_DIR" "./logs"
    chmod 777 "./audio-cache"  # 音频缓存目录需要写权限
}

# 检查系统资源
check_system_resources() {
    log_info "检查系统资源"
    
    # 检查磁盘空间
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 85 ]; then
        log_warning "磁盘使用率较高: ${disk_usage}%"
        
        # 清理旧文件
        log_info "清理旧日志和缓存文件"
        find "./logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
        find "./audio-cache" -type f -mtime +1 -delete 2>/dev/null || true
        
        # 重新检查
        disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
        log_info "清理后磁盘使用率: ${disk_usage}%"
    fi
    
    # 检查内存
    local memory_usage=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    log_info "当前内存使用率: ${memory_usage}%"
    
    if (( $(echo "$memory_usage > 80" | bc -l) )); then
        log_warning "内存使用率较高，建议在低峰期部署"
    fi
}

# 备份当前版本
backup_current_version() {
    local backup_name="wordpecker-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log_info "开始备份当前版本到: $backup_path"
    
    # 创建备份目录
    mkdir -p "$backup_path"
    
    # 备份关键文件和目录
    cp -r "./backend" "$backup_path/" 2>/dev/null || log_warning "备份backend目录失败"
    cp -r "./frontend" "$backup_path/" 2>/dev/null || log_warning "备份frontend目录失败"
    cp -r "./scripts" "$backup_path/" 2>/dev/null || log_warning "备份scripts目录失败"
    cp "./package.json" "$backup_path/" 2>/dev/null || log_warning "备份package.json失败"
    cp "./ecosystem.config.js" "$backup_path/" 2>/dev/null || log_warning "备份ecosystem.config.js失败"
    cp "./docker-compose.yml" "$backup_path/" 2>/dev/null || log_warning "备份docker-compose.yml失败"
    
    # 备份环境配置（不包含敏感信息）
    if [ -f "./.env.example" ]; then
        cp "./.env.example" "$backup_path/"
    fi
    
    # 记录当前Git提交
    if [ -d "./.git" ]; then
        git rev-parse HEAD > "$backup_path/git-commit.txt" 2>/dev/null || true
        git status --porcelain > "$backup_path/git-status.txt" 2>/dev/null || true
    fi
    
    # 记录备份信息
    echo "Backup created at: $(date)" > "$backup_path/backup-info.txt"
    echo "Backup name: $backup_name" >> "$backup_path/backup-info.txt"
    echo "Project directory: $PROJECT_DIR" >> "$backup_path/backup-info.txt"
    
    log_success "备份完成: $backup_name"
    
    # 清理旧备份（保留最近10个）
    cd "$BACKUP_DIR"
    ls -t | grep "^wordpecker-" | tail -n +11 | xargs -r rm -rf
    log_info "清理旧备份，保留最近10个版本"
    
    # 返回备份路径供回滚使用
    echo "$backup_path"
}loyment
        fi
        exit 1
    fi
}

# =============================================================================
# 命令行参数处理
# =============================================================================

show_help() {
    cat << EOF
WordPecker 自动化部署脚本

用法: $0 [选项]

选项:
    -h, --help              显示此帮助信息
    -v, --verbose           详细输出模式
    --no-backup            跳过备份创建
    --no-rollback          禁用自动回滚
    --no-notification      禁用通知
    --force                强制部署（忽略锁文件）
    --rollback             执行回滚到最新备份
    --list-backups         列出所有可用备份
    --health-check         仅执行健康检查

示例:
    $0                     # 标准部署
    $0 --verbose           # 详细模式部署
    $0 --rollback          # 回滚到最新备份
    $0 --health-check      # 仅检查服务健康状态

EOF
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            set -x  # 启用详细输出
            shift
            ;;
        --no-backup)
            BACKUP_ENABLED=false
            shift
            ;;
        --no-rollback)
            ROLLBACK_ENABLED=false
            shift
            ;;
        --no-notification)
            NOTIFICATION_ENABLED=false
            shift
            ;;
        --force)
            rm -f "$LOCK_FILE"
            shift
            ;;
        --rollback)
            rollback_deployment
            exit $?
            ;;
        --list-backups)
            echo "可用备份:"
            ls -la "$BACKUP_DIR" | grep "^d" | grep "wordpecker-" | awk '{print $9, $6, $7, $8}'
            exit 0
            ;;
        --health-check)
            health_check
            exit $?
            ;;
        *)
            log "ERROR" "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# ================================================================# 更新代
码
update_code() {
    log_info "开始更新代码"
    
    # 检查Git仓库状态
    if [ ! -d "./.git" ]; then
        log_error "未找到Git仓库，无法更新代码"
        return 1
    fi
    
    # 保存当前更改（如果有）
    if ! git diff --quiet; then
        log_warning "发现未提交的更改，正在暂存"
        git stash push -m "Auto-stash before deploy $(date)"
    fi
    
    # 获取当前分支
    local current_branch=$(git branch --show-current)
    log_info "当前分支: $current_branch"
    
    # 拉取最新代码
    log_info "拉取最新代码"
    if ! git fetch origin; then
        log_error "拉取代码失败"
        return 1
    fi
    
    # 检查是否有更新
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse "origin/$current_branch")
    
    if [ "$local_commit" = "$remote_commit" ]; then
        log_info "代码已是最新版本，无需更新"
        return 0
    fi
    
    log_info "发现新版本，正在更新"
    log_info "本地提交: $local_commit"
    log_info "远程提交: $remote_commit"
    
    # 重置到远程分支
    if ! git reset --hard "origin/$current_branch"; then
        log_error "代码更新失败"
        return 1
    fi
    
    log_success "代码更新完成"
    
    # 显示更新日志
    log_info "更新内容:"
    git log --oneline "$local_commit..$remote_commit" | head -10 | while read line; do
        log_info "  $line"
    done
}

# 安装依赖
install_dependencies() {
    log_info "开始安装依赖"
    
    # 后端依赖
    log_info "安装后端依赖"
    cd "./backend"
    
    # 检查package.json是否存在
    if [ ! -f "package.json" ]; then
        log_error "未找到backend/package.json"
        return 1
    fi
    
    # 清理node_modules（如果需要）
    if [ "$CLEAN_INSTALL" = "true" ]; then
        log_info "执行清理安装"
        rm -rf node_modules package-lock.json
    fi
    
    # 安装依赖
    if ! npm ci --production --silent; then
        log_error "后端依赖安装失败"
        return 1
    fi
    
    # 构建后端（如果有构建脚本）
    if npm run build --silent 2>/dev/null; then
        log_info "后端构建完成"
    else
        log_info "后端无需构建或构建脚本不存在"
    fi
    
    # 前端依赖
    log_info "安装前端依赖"
    cd "../frontend"
    
    if [ ! -f "package.json" ]; then
        log_error "未找到frontend/package.json"
        return 1
    fi
    
    # 清理node_modules（如果需要）
    if [ "$CLEAN_INSTALL" = "true" ]; then
        log_info "执行前端清理安装"
        rm -rf node_modules package-lock.json
    fi
    
    # 安装依赖
    if ! npm ci --silent; then
        log_error "前端依赖安装失败"
        return 1
    fi
    
    # 构建前端
    log_info "构建前端应用"
    if ! npm run build --silent; then
        log_error "前端构建失败"
        return 1
    fi
    
    cd ".."
    log_success "依赖安装和构建完成"
}

# 运行部署前测试
run_pre_deploy_tests() {
    log_info "运行部署前测试"
    
    # 检查环境变量
    if [ -z "$OPENAI_API_KEY" ]; then
        log_error "OPENAI_API_KEY 环境变量未设置"
        return 1
    fi
    
    if [ -z "$MONGODB_URL" ]; then
        log_error "MONGODB_URL 环境变量未设置"
        return 1
    fi
    
    # 检查Node.js版本
    local node_version=$(node -v | cut -d'v' -f2)
    local required_version="16.0.0"
    
    if ! node -e "
        const semver = require('semver');
        process.exit(semver.gte('$node_version', '$required_version') ? 0 : 1);
    " 2>/dev/null; then
        log_error "Node.js版本必须 >= $required_version，当前版本: $node_version"
        return 1
    fi
    
    # 测试数据库连接
    log_info "测试数据库连接"
    if ! node -e "
        const mongoose = require('./backend/node_modules/mongoose');
        mongoose.connect('$MONGODB_URL', { 
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000 
        })
        .then(() => {
            console.log('数据库连接测试成功');
            process.exit(0);
        })
        .catch(err => {
            console.error('数据库连接测试失败:', err.message);
            process.exit(1);
        });
    "; then
        log_success "数据库连接测试通过"
    else
        log_error "数据库连接测试失败"
        return 1
    fi
    
    # 检查PM2
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2未安装"
        return 1
    fi
    
    log_success "部署前测试全部通过"
}

# 重启服务
restart_services() {
    log_info "重启服务"
    
    # 检查PM2进程状态
    if pm2 list | grep -q "wordpecker"; then
        log_info "重新加载现有PM2进程"
        pm2 reload ecosystem.config.js --env production
    else
        log_info "启动新的PM2进程"
        pm2 start ecosystem.config.js --env production
    fi
    
    # 等待服务启动
    log_info "等待服务启动"
    sleep 15
    
    # 保存PM2配置
    pm2 save
    
    log_success "服务重启完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署结果"
    
    local max_attempts=12  # 最多等待60秒
    local attempt=0
    
    # 检查后端服务
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s "http://localhost:3000/api/health" > /dev/null; then
            log_success "后端服务验证通过"
            break
        fi
        
        attempt=$((attempt + 1))
        log_info "等待后端服务启动... ($attempt/$max_attempts)"
        sleep 5
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "后端服务启动超时"
        return 1
    fi
    
    # 检查前端服务
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s "http://localhost:5173" > /dev/null; then
            log_success "前端服务验证通过"
            break
        fi
        
        attempt=$((attempt + 1))
        log_info "等待前端服务启动... ($attempt/$max_attempts)"
        sleep 5
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "前端服务启动超时"
        return 1
    fi
    
    # 功能测试
    log_info "执行功能测试"
    
    # 测试健康检查端点
    local health_response=$(curl -s "http://localhost:3000/api/health")
    if echo "$health_response" | grep -q '"status":"healthy"'; then
        log_success "健康检查端点正常"
    else
        log_error "健康检查端点异常"
        return 1
    fi
    
    # 测试就绪检查端点
    local ready_response=$(curl -s "http://localhost:3000/api/ready")
    if echo "$ready_response" | grep -q '"status":"ready"'; then
        log_success "就绪检查端点正常"
    else
        log_warning "就绪检查端点可能存在问题，但不影响基本功能"
    fi
    
    log_success "部署验证完成"
}# 回滚部署

rollback_deployment() {
    local backup_path=$1
    
    if [ -z "$backup_path" ] || [ ! -d "$backup_path" ]; then
        log_error "回滚失败：无效的备份路径 $backup_path"
        return 1
    fi
    
    log_warning "开始回滚部署到备份版本: $(basename "$backup_path")"
    send_notification "WARNING" "开始回滚部署"
    
    # 停止当前服务
    log_info "停止当前服务"
    pm2 stop all || true
    
    # 恢复文件
    log_info "恢复文件从备份"
    
    # 恢复后端
    if [ -d "$backup_path/backend" ]; then
        rm -rf "./backend"
        cp -r "$backup_path/backend" "./"
        log_info "后端文件已恢复"
    fi
    
    # 恢复前端
    if [ -d "$backup_path/frontend" ]; then
        rm -rf "./frontend"
        cp -r "$backup_path/frontend" "./"
        log_info "前端文件已恢复"
    fi
    
    # 恢复脚本
    if [ -d "$backup_path/scripts" ]; then
        rm -rf "./scripts"
        cp -r "$backup_path/scripts" "./"
        chmod +x "./scripts/"*.sh
        log_info "脚本文件已恢复"
    fi
    
    # 恢复配置文件
    [ -f "$backup_path/package.json" ] && cp "$backup_path/package.json" "./"
    [ -f "$backup_path/ecosystem.config.js" ] && cp "$backup_path/ecosystem.config.js" "./"
    [ -f "$backup_path/docker-compose.yml" ] && cp "$backup_path/docker-compose.yml" "./"
    
    # 恢复Git状态（如果有）
    if [ -f "$backup_path/git-commit.txt" ]; then
        local backup_commit=$(cat "$backup_path/git-commit.txt")
        log_info "恢复Git提交: $backup_commit"
        git reset --hard "$backup_commit" 2>/dev/null || log_warning "Git状态恢复失败"
    fi
    
    # 重新安装依赖（使用备份版本的package.json）
    log_info "重新安装依赖"
    
    # 后端依赖
    cd "./backend"
    if [ -f "package.json" ]; then
        npm ci --production --silent || log_warning "后端依赖安装失败"
        npm run build --silent 2>/dev/null || true
    fi
    
    # 前端依赖
    cd "../frontend"
    if [ -f "package.json" ]; then
        npm ci --silent || log_warning "前端依赖安装失败"
        npm run build --silent || log_warning "前端构建失败"
    fi
    
    cd ".."
    
    # 重启服务
    log_info "重启服务"
    pm2 start ecosystem.config.js --env production || log_error "服务启动失败"
    
    # 等待服务启动
    sleep 15
    
    # 验证回滚结果
    if curl -f -s "http://localhost:3000/api/health" > /dev/null; then
        log_success "回滚成功，服务已恢复正常"
        send_notification "SUCCESS" "回滚部署成功"
        return 0
    else
        log_error "回滚后服务仍然异常"
        send_notification "ERROR" "回滚部署失败"
        return 1
    fi
}

# 清理部署环境
cleanup_deployment() {
    log_info "清理部署环境"
    
    # 清理临时文件
    find . -name "*.tmp" -delete 2>/dev/null || true
    find . -name ".DS_Store" -delete 2>/dev/null || true
    
    # 清理旧的音频缓存
    find "./audio-cache" -type f -mtime +1 -delete 2>/dev/null || true
    
    # 清理旧日志
    find "./logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # PM2日志清理
    pm2 flush 2>/dev/null || true
    
    log_info "环境清理完成"
}

# 生成部署报告
generate_deploy_report() {
    local status=$1
    local backup_path=$2
    local start_time=$3
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local report_file="./logs/deploy-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "deployment": {
    "status": "$status",
    "start_time": "$(date -d @$start_time '+%Y-%m-%d %H:%M:%S')",
    "end_time": "$(date -d @$end_time '+%Y-%m-%d %H:%M:%S')",
    "duration_seconds": $duration,
    "backup_path": "$backup_path",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "node_version": "$(node -v)",
    "pm2_processes": $(pm2 jlist 2>/dev/null || echo '[]')
  },
  "system": {
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "disk_usage": "$(df -h / | awk 'NR==2{print $5}')",
    "memory_usage": "$(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')",
    "load_average": "$(uptime | awk -F'load average:' '{print $2}' | xargs)"
  }
}
EOF
    
    log_info "部署报告已生成: $report_file"
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 自动化部署脚本

用法: $0 [选项]

选项:
  -h, --help          显示此帮助信息
  -c, --clean         执行清理安装（删除node_modules）
  -f, --force         强制部署（跳过某些检查）
  -t, --test-only     仅运行测试，不执行部署
  -r, --rollback PATH 回滚到指定备份路径
  -v, --verbose       详细输出模式

环境变量:
  CLEAN_INSTALL=true  执行清理安装
  FORCE_DEPLOY=true   强制部署
  TEST_ONLY=true      仅测试模式

示例:
  $0                  # 标准部署
  $0 --clean          # 清理安装后部署
  $0 --test-only      # 仅运行测试
  $0 --rollback /home/devbox/backups/wordpecker-20240101-120000
EOF
}

# 主部署流程
main() {
    local start_time=$(date +%s)
    local backup_path=""
    local deploy_status="FAILED"
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--clean)
                export CLEAN_INSTALL=true
                shift
                ;;
            -f|--force)
                export FORCE_DEPLOY=true
                shift
                ;;
            -t|--test-only)
                export TEST_ONLY=true
                shift
                ;;
            -r|--rollback)
                if [ -n "$2" ]; then
                    rollback_deployment "$2"
                    exit $?
                else
                    log_error "回滚选项需要指定备份路径"
                    exit 1
                fi
                ;;
            -v|--verbose)
                set -x
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log_info "=========================================="
    log_info "WordPecker 自动化部署开始"
    log_info "时间: $(date)"
    log_info "用户: $(whoami)"
    log_info "主机: $(hostname)"
    log_info "=========================================="
    
    send_notification "INFO" "开始自动化部署"
    
    # 检查部署锁
    check_deploy_lock
    create_deploy_lock
    
    # 创建必要目录
    create_directories
    
    # 检查系统资源
    check_system_resources
    
    # 如果是仅测试模式
    if [ "$TEST_ONLY" = "true" ]; then
        log_info "运行测试模式"
        if run_pre_deploy_tests; then
            log_success "所有测试通过"
            send_notification "SUCCESS" "部署前测试通过"
            exit 0
        else
            log_error "测试失败"
            send_notification "ERROR" "部署前测试失败"
            exit 1
        fi
    fi
    
    # 执行部署流程
    {
        # 1. 备份当前版本
        backup_path=$(backup_current_version)
        
        # 2. 运行部署前测试
        if [ "$FORCE_DEPLOY" != "true" ]; then
            run_pre_deploy_tests
        else
            log_warning "强制部署模式，跳过部分检查"
        fi
        
        # 3. 更新代码
        update_code
        
        # 4. 安装依赖
        install_dependencies
        
        # 5. 重启服务
        restart_services
        
        # 6. 验证部署
        verify_deployment
        
        # 7. 清理环境
        cleanup_deployment
        
        deploy_status="SUCCESS"
        log_success "=========================================="
        log_success "部署成功完成！"
        log_success "备份位置: $backup_path"
        log_success "部署时间: $(($(date +%s) - start_time)) 秒"
        log_success "=========================================="
        
        send_notification "SUCCESS" "自动化部署成功完成"
        
    } || {
        # 部署失败，执行回滚
        log_error "部署过程中发生错误"
        send_notification "ERROR" "部署失败，开始回滚"
        
        if [ -n "$backup_path" ] && [ -d "$backup_path" ]; then
            log_warning "执行自动回滚"
            if rollback_deployment "$backup_path"; then
                deploy_status="ROLLED_BACK"
                log_warning "已回滚到备份版本: $(basename "$backup_path")"
            else
                deploy_status="ROLLBACK_FAILED"
                log_error "回滚失败，需要手动干预"
                send_notification "CRITICAL" "自动回滚失败，需要手动干预"
            fi
        else
            log_error "无法回滚：备份不可用"
            send_notification "CRITICAL" "部署失败且无法回滚"
        fi
        
        exit 1
    }
    
    # 生成部署报告
    generate_deploy_report "$deploy_status" "$backup_path" "$start_time"
}

# 脚本入口点
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi