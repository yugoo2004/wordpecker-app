#!/bin/bash

# Git Hooks 安装脚本
# 用于在提交前自动运行命名规范验证

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "🔧 安装 Git Hooks 用于命名规范验证..."

# 检查是否在 Git 仓库中
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "❌ 错误: 当前目录不是 Git 仓库"
    exit 1
fi

# 创建 pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash

# Pre-commit hook for naming validation
# 提交前命名规范验证

echo "🔍 运行命名规范验证..."

# 进入命名扫描器目录
cd tools/naming-scanner

# 检查是否已构建
if [ ! -d "dist" ]; then
    echo "📦 构建验证工具..."
    npm run build
fi

# 运行快速验证（只检查环境变量）
echo "🔍 验证环境变量命名..."
if ! npm run validate:env; then
    echo "❌ 环境变量命名验证失败"
    echo "💡 请修复命名问题后重新提交"
    echo "💡 运行 'cd tools/naming-scanner && npm run validate' 查看详细信息"
    exit 1
fi

# 检查暂存的文件是否包含命名问题
echo "🔍 检查暂存文件的命名规范..."
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js|tsx|jsx|json|md|yml|yaml)$' || true)

if [ -n "$STAGED_FILES" ]; then
    # 创建临时文件列表
    TEMP_FILE=$(mktemp)
    echo "$STAGED_FILES" > "$TEMP_FILE"
    
    # 运行针对暂存文件的快速扫描
    if ! npm run scan -- --files-from "$TEMP_FILE" --quick; then
        echo "❌ 暂存文件中发现命名问题"
        echo "💡 请修复后重新添加到暂存区"
        rm -f "$TEMP_FILE"
        exit 1
    fi
    
    rm -f "$TEMP_FILE"
fi

echo "✅ 命名规范验证通过"
EOF

# 创建 pre-push hook
cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash

# Pre-push hook for comprehensive naming validation
# 推送前完整命名规范验证

echo "🚀 运行完整命名规范验证..."

# 进入命名扫描器目录
cd tools/naming-scanner

# 确保工具已构建
if [ ! -d "dist" ]; then
    echo "📦 构建验证工具..."
    npm run build
fi

# 运行完整验证
echo "🔍 运行完整验证..."
if ! npm run validate -- --fail-on-warnings; then
    echo "❌ 命名规范验证失败"
    echo "💡 请修复所有问题后重新推送"
    echo "💡 运行 'cd tools/naming-scanner && npm run validate -- --verbose' 查看详细信息"
    exit 1
fi

echo "✅ 完整命名规范验证通过"
EOF

# 创建 commit-msg hook
cat > "$HOOKS_DIR/commit-msg" << 'EOF'
#!/bin/bash

# Commit message hook for naming validation
# 提交信息中的命名规范验证

COMMIT_MSG_FILE="$1"
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# 检查提交信息中是否包含错误的命名
if echo "$COMMIT_MSG" | grep -qiE "(seeddream|seedram|seed.dream|seed.ram)"; then
    echo "❌ 提交信息中包含不正确的命名"
    echo "💡 请使用正确的命名: SeeDream 或 seedream"
    echo "💡 当前提交信息: $COMMIT_MSG"
    exit 1
fi

echo "✅ 提交信息命名规范检查通过"
EOF

# 设置执行权限
chmod +x "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/commit-msg"

echo "✅ Git Hooks 安装完成！"
echo ""
echo "已安装的 hooks:"
echo "  - pre-commit: 提交前快速命名验证"
echo "  - pre-push: 推送前完整命名验证"
echo "  - commit-msg: 提交信息命名检查"
echo ""
echo "💡 如需跳过验证，可使用 --no-verify 参数"
echo "💡 例如: git commit --no-verify -m \"临时提交\""