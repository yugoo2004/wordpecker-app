#!/usr/bin/env node

/**
 * 简单的验证器测试
 */

import { EnvironmentValidator } from './dist/validator/environment-validator.js';
import * as path from 'path';

async function testSimpleValidator() {
  console.log('🧪 开始简单验证器测试...\n');

  try {
    const projectRoot = path.resolve('../../');
    
    // 测试环境变量验证器
    console.log('1️⃣ 测试环境变量验证器...');
    const envValidator = new EnvironmentValidator({
      requiredPrefix: 'SEEDREAM_',
      excludePatterns: ['node_modules/**', 'dist/**', '.git/**']
    });
    
    const result = await envValidator.validateProject(projectRoot);
    
    console.log(`✅ 验证完成:`);
    console.log(`   - 检查项: ${result.summary.totalChecks}`);
    console.log(`   - 通过: ${result.summary.passedChecks}`);
    console.log(`   - 错误: ${result.summary.errorCount}`);
    console.log(`   - 警告: ${result.summary.warningCount}`);
    console.log(`   - 状态: ${result.isValid ? '✅ 通过' : '❌ 失败'}`);

    if (result.errors.length > 0) {
      console.log('\n🚨 发现的错误:');
      result.errors.slice(0, 5).forEach((error, index) => {
        console.log(`   ${index + 1}. [${error.severity}] ${error.message}`);
        if (error.file) {
          console.log(`      文件: ${error.file}:${error.line || 'N/A'}`);
        }
        if (error.suggestion) {
          console.log(`      建议: ${error.suggestion}`);
        }
      });
      
      if (result.errors.length > 5) {
        console.log(`   ... 还有 ${result.errors.length - 5} 个错误`);
      }
    }

    console.log('\n🎉 验证器测试完成！');
    return result.isValid ? 0 : 1;

  } catch (error) {
    console.error('❌ 测试失败:', error);
    return 1;
  }
}

// 运行测试
testSimpleValidator()
  .then(exitCode => {
    console.log(`\n退出码: ${exitCode}`);
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });