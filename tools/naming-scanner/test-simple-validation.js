#!/usr/bin/env node

/**
 * 简单的验证工具测试
 */

import { EnvironmentValidator } from './dist/validators/environment-validator.js';
import { ReportValidator } from './dist/validators/report-validator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testValidators() {
  console.log('🧪 开始简单验证测试...\n');

  const testDir = './test-temp';
  
  try {
    // 创建测试目录
    await fs.mkdir(testDir, { recursive: true });

    // 测试环境变量验证器
    console.log('1️⃣ 测试环境变量验证器...');
    
    // 创建测试 .env 文件
    const envContent = `
# 正确的环境变量
SEEDREAM_API_KEY=test_key
SEEDREAM_SECRET=test_secret

# 错误的环境变量
SEEDDREAM_TOKEN=wrong_prefix
SEEDRAM_CONFIG=another_wrong

# 非相关变量
DATABASE_URL=postgres://localhost
`;
    
    await fs.writeFile(path.join(testDir, '.env'), envContent);
    
    const envValidator = new EnvironmentValidator();
    const envResult = await envValidator.validateProject(testDir);
    
    console.log(`   结果: ${envResult.isValid ? '✅ 通过' : '❌ 失败'}`);
    console.log(`   发现 ${envResult.errors.length} 个错误`);
    
    if (envResult.errors.length > 0) {
      console.log('   错误详情:');
      envResult.errors.forEach((error, i) => {
        console.log(`     ${i + 1}. ${error.variable}: ${error.issue}`);
      });
    }

    // 测试报告验证器
    console.log('\n2️⃣ 测试报告验证器...');
    
    // 创建测试报告文件
    const reportContent = {
      serviceName: 'SeedRam 3.0', // 错误的服务名
      timestamp: Date.now(),
      testResults: {
        passed: 5,
        failed: 1
      }
    };
    
    await fs.writeFile(
      path.join(testDir, 'test-report.json'),
      JSON.stringify(reportContent, null, 2)
    );
    
    const reportValidator = new ReportValidator();
    const reportResult = await reportValidator.validateProject(testDir);
    
    console.log(`   结果: ${reportResult.isValid ? '✅ 通过' : '❌ 失败'}`);
    console.log(`   发现 ${reportResult.errors.length} 个错误`);
    
    if (reportResult.errors.length > 0) {
      console.log('   错误详情:');
      reportResult.errors.forEach((error, i) => {
        console.log(`     ${i + 1}. ${error.issue}`);
      });
      
      // 测试自动修复
      console.log('\n   🔧 测试自动修复...');
      const reportPath = path.join(testDir, 'test-report.json');
      const fixed = await reportValidator.fixReportNaming(reportPath);
      
      if (fixed) {
        console.log('   ✅ 自动修复成功');
        
        // 验证修复结果
        const fixedContent = await fs.readFile(reportPath, 'utf-8');
        const fixedData = JSON.parse(fixedContent);
        console.log(`   修复后的服务名: ${fixedData.serviceName}`);
      }
    }

    console.log('\n🎉 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    // 清理测试文件
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  }
}

testValidators();