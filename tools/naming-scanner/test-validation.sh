#!/bin/bash

# 简单的验证测试脚本

echo "🧪 开始验证器功能测试..."

# 检查构建文件
if [ ! -f "dist/validator/environment-validator.js" ]; then
    echo "❌ 构建文件不存在，请先运行 npm run build"
    exit 1
fi

echo "✅ 构建文件检查通过"

# 测试环境变量验证器
echo "📋 测试环境变量验证器..."

# 创建测试环境变量文件
cat > test.env << 'EOF'
SEEDREAM_API_KEY=test
SEEDDREAM_OLD_KEY=test
SEEDRAM_WRONG_KEY=test
NORMAL_VAR=test
EOF

echo "✅ 测试文件创建完成"

# 运行简单测试
node test-simple-validator.js

# 清理测试文件
rm -f test.env test-config.json

echo "🎉 验证器测试完成！"