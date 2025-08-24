#!/bin/bash
# 环境验证脚本 - 验证系统环境和依赖

set -e

LOG_FILE="./logs/environment-verification.log"

# 创建日志目录
mkdir -p ./logs

echo "$(date): 开始环境验证" >> "$LOG_FILE"

# 验证Node.js版本
verify_nodejs() {
    echo "验证Node.js版本..."
    local node_version=$(node -v | cut -d'v' -f2)
    echo "$(date): Node.js版本: $node_version" >> "$LOG_FILE"
    
    # 检查版本是否 >= 16.0.0
    if ! node -e "process.exit(require('semver').gte('$node_version', '16.0.0') ? 0 : 1)" 2>/dev/null; then
        # 如果semver不可用，使用简单的版本比较
        local major_version=$(echo "$node_version" | cut -d'.' -f1)
        if [ "$major_version" -lt 16 ]; then
            echo "错误: Node.js版本必须 >= 16.0.0，当前版本: $node_version"
            echo "$(date): 错误: Node.js版本不兼容" >> "$LOG_FILE"
            exit 1
        fi
    fi
    
    echo "✅ Node.js版本兼容"
    echo "$(date): Node.js版本验证通过" >> "$LOG_FILE"
}

# 验证npm版本
verify_npm() {
    echo "验证npm版本..."
    local npm_version=$(npm -v)
    echo "$(date): npm版本: $npm_version" >> "$LOG_FILE"
    echo "✅ npm已安装"
}

# 验证PM2安装
verify_pm2() {
    echo "验证PM2安装..."
    if ! command -v pm2 &> /dev/null; then
        echo "错误: PM2未安装"
        echo "$(date): 错误: PM2未安装" >> "$LOG_FILE"
        exit 1
    fi
    
    local pm2_version=$(pm2 -v)
    echo "$(date): PM2版本: $pm2_version" >> "$LOG_FILE"
    echo "✅ PM2已安装"
}

# 验证系统工具
verify_system_tools() {
    echo "验证系统工具..."
    local tools=("curl" "jq" "bc")
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            echo "错误: $tool 未安装"
            echo "$(date): 错误: $tool 未安装" >> "$LOG_FILE"
            exit 1
        fi
        echo "$(date): $tool 已安装: $(which $tool)" >> "$LOG_FILE"
    done
    
    echo "✅ 系统工具验证通过"
}

# 验证目录结构
verify_directories() {
    echo "验证目录结构..."
    local required_dirs=("scripts" "logs" "audio-cache")
    
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            echo "错误: 目录 $dir 不存在"
            echo "$(date): 错误: 目录 $dir 不存在" >> "$LOG_FILE"
            exit 1
        fi
        echo "$(date): 目录 $dir 存在" >> "$LOG_FILE"
    done
    
    # 检查备份目录
    if [ ! -d "/home/devbox/backups" ]; then
        echo "错误: 备份目录 /home/devbox/backups 不存在"
        echo "$(date): 错误: 备份目录不存在" >> "$LOG_FILE"
        exit 1
    fi
    
    echo "✅ 目录结构验证通过"
    echo "$(date): 目录结构验证通过" >> "$LOG_FILE"
}

# 验证系统信息
verify_system_info() {
    echo "记录系统信息..."
    echo "$(date): 系统信息:" >> "$LOG_FILE"
    echo "$(date): OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '\"')" >> "$LOG_FILE"
    echo "$(date): 内核: $(uname -r)" >> "$LOG_FILE"
    echo "$(date): 架构: $(uname -m)" >> "$LOG_FILE"
    echo "$(date): 用户: $(whoami)" >> "$LOG_FILE"
    echo "$(date): 工作目录: $(pwd)" >> "$LOG_FILE"
    echo "✅ 系统信息记录完成"
}

# 主验证流程
main() {
    echo "🔍 开始环境验证..."
    echo ""
    
    verify_nodejs
    verify_npm
    verify_pm2
    verify_system_tools
    verify_directories
    verify_system_info
    
    echo ""
    echo "✅ 环境验证完成！所有依赖和配置都正确。"
    echo "$(date): 环境验证成功完成" >> "$LOG_FILE"
    
    echo ""
    echo "📋 环境摘要:"
    echo "- Node.js: $(node -v)"
    echo "- npm: $(npm -v)"
    echo "- PM2: $(pm2 -v)"
    echo "- 操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '\"')"
    echo "- 工作目录: $(pwd)"
    echo ""
    echo "📁 创建的目录:"
    echo "- ./scripts (部署脚本)"
    echo "- ./logs (日志文件)"
    echo "- ./audio-cache (音频缓存)"
    echo "- /home/devbox/backups (备份目录)"
}

main