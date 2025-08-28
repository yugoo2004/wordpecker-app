#!/usr/bin/env node

/**
 * 简单的验证工具测试
 */

console.log('🧪 开始简单验证测试...');

try {
  // 测试导入
  const { ValidationRunner } = require('./dist/validator/index.js');
  console.log('✅ ValidationRunner 导入成功');

  // 测试配置创建
  const config = ValidationRunner.createDefaultConfig();
  console.log('✅ 默认配置创建成功');

  // 测试验证运行器创建
  const runner = new ValidationRunner(config);
  console.log('✅ 验证运行器创建成功');

  console.log('🎉 所有基础测试通过！');
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  process.exit(1);
}