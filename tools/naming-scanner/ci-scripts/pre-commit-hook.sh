#!/bin/bash

# Pre-commit Hook for SeeDream Naming Standards
# 在提交前自动检查命名规范

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
NAMING_SCANNER_DIR="tools/naming-scanner"
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
TEMP_DIR="/tmp/seedream-naming-check-$$"

echo -e "${BLUE}🔍 SeeDream 命名规范检查${NC}"
echo "=================================================="

# 检查命名扫描工具是否存在
if [ ! -d "$PROJECT_ROOT/$NAMING_SCANNER_DIR" ]; then
    echo -e "${YELLOW}⚠️ 命名扫描工具不存在，跳过检查${NC}"
    exit 0
fi

# 进入工具目录
cd "$PROJECT_ROOT/$NAMING_SCANNER_DIR"

# 检查工具是否已构建
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}📦 构建命名扫描工具...${NC}"
    npm run build
fi

# 创建临时目录
mkdir -p "$TEMP_DIR"

# 获取暂存的文件列表
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✅ 没有暂存的文件需要检查${NC}"
    exit 0
fi

echo -e "${BLUE}📋 检查暂存的文件...${NC}"

# 检查暂存的文件是否包含命名问题
HAS_NAMING_ISSUES=false
ISSUES_FOUND=0

# 检查环境变量文件
ENV_FILES=$(echo "$STAGED_FILES" | grep -E '\.(env|env\..*|environment)$' || true)
if [ -n "$ENV_FILES" ]; then
    echo -e "${BLUE}🌍 检查环境变量文件...${NC}"
    
    for file in $ENV_FILES; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            # 检查文件中的环境变量命名
            if grep -qE 'SEEDDREAM_|SEEDRAM_|seeddream|seedram' "$PROJECT_ROOT/$file"; then
                echo -e "${RED}❌ $file: 发现不规范的环境变量命名${NC}"
                HAS_NAMING_ISSUES=true
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
            fi
        fi
    done
fi

# 检查配置文件
CONFIG_FILES=$(echo "$STAGED_FILES" | grep -E '\.(json|js|ts|yml|yaml)$' || true)
if [ -n "$CONFIG_FILES" ]; then
    echo -e "${BLUE}⚙️ 检查配置文件...${NC}"
    
    for file in $CONFIG_FILES; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            # 检查文件中的命名问题
            if grep -qE 'SeedRam|seeddream|seedram|SEEDDREAM_|SEEDRAM_' "$PROJECT_ROOT/$file"; then
                echo -e "${RED}❌ $file: 发现不规范的命名${NC}"
                HAS_NAMING_ISSUES=true
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
            fi
        fi
    done
fi

# 检查文档文件
DOC_FILES=$(echo "$STAGED_FILES" | grep -E '\.(md|txt|rst)$' || true)
if [ -n "$DOC_FILES" ]; then
    echo -e "${BLUE}📝 检查文档文件...${NC}"
    
    for file in $DOC_FILES; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            # 检查文档中的命名问题
            if grep -qE 'SeedRam(?!\s*3\.0)|SeedDream(?!\s*3\.0)|seeddream|seedram' "$PROJECT_ROOT/$file"; then
                echo -e "${RED}❌ $file: 发现不规范的命名${NC}"
                HAS_NAMING_ISSUES=true
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
            fi
        fi
    done
fi

# 运行完整的命名检查 (仅针对暂存文件)
echo -e "${BLUE}🔍 运行详细的命名规范检查...${NC}"

# 创建临时项目副本，只包含暂存的更改
git checkout-index --prefix="$TEMP_DIR/" -a

# 在临时目录运行检查
VALIDATION_RESULT=0
node validate-naming.js \
    --project-root "$TEMP_DIR" \
    --output-format json \
    --output-file "$TEMP_DIR/validation-result.json" || VALIDATION_RESULT=$?

# 分析检查结果
if [ $VALIDATION_RESULT -ne 0 ]; then
    HAS_NAMING_ISSUES=true
    
    if [ -f "$TEMP_DIR/validation-result.json" ]; then
        # 解析 JSON 结果并显示摘要
        TOTAL_ERRORS=$(jq -r '.summary.errors // 0' "$TEMP_DIR/validation-result.json" 2>/dev/null || echo "0")
        TOTAL_WARNINGS=$(jq -r '.summary.warnings // 0' "$TEMP_DIR/validation-result.json" 2>/dev/null || echo "0")
        
        echo -e "${RED}❌ 详细检查发现 $TOTAL_ERRORS 个错误, $TOTAL_WARNINGS 个警告${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + TOTAL_ERRORS))
    fi
fi

# 清理临时目录
rm -rf "$TEMP_DIR"

# 根据检查结果决定是否允许提交
if [ "$HAS_NAMING_ISSUES" = true ]; then
    echo ""
    echo -e "${RED}🚫 提交被阻止：发现 $ISSUES_FOUND 个命名规范问题${NC}"
    echo ""
    echo -e "${YELLOW}💡 修复建议：${NC}"
    echo "1. 运行自动修复："
    echo "   cd $NAMING_SCANNER_DIR"
    echo "   node validate-naming.js --fix"
    echo ""
    echo "2. 手动检查和修复："
    echo "   cd $NAMING_SCANNER_DIR"
    echo "   node validate-naming.js --project-root ../../"
    echo ""
    echo "3. 跳过此检查 (不推荐)："
    echo "   git commit --no-verify"
    echo ""
    
    exit 1
else
    echo -e "${GREEN}✅ 所有命名规范检查通过${NC}"
    echo ""
fi

# 可选：运行自动修复
if command -v jq >/dev/null 2>&1; then
    echo -e "${BLUE}🔧 检查是否可以自动修复...${NC}"
    
    # 运行自动修复 (仅针对报告格式)
    node validate-naming.js \
        --project-root "$PROJECT_ROOT" \
        --check reports \
        --fix >/dev/null 2>&1 || true
        
    # 检查是否有自动修复的更改
    if ! git diff --quiet; then
        echo -e "${GREEN}🎉 已自动修复一些问题${NC}"
        echo -e "${YELLOW}💡 请检查更改并重新添加到暂存区${NC}"
        git status --porcelain
        echo ""
        echo "运行以下命令添加修复的文件："
        echo "git add -u"
        echo ""
        exit 1
    fi
fi

echo -e "${GREEN}🎉 命名规范检查完成，可以安全提交${NC}"
exit 0