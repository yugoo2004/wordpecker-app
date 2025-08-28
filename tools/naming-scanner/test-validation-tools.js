#!/usr/bin/env node

/**
 * 验证工具功能测试脚本
 */

import { ValidationRunner } from './dist/validator/validation-runner.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testValidationTools() {
  console.log('🧪 开始验证工具功能测试...\n');

  try {
    // 1. 测试验证运行器创建
    console.log('1️⃣ 测试验证运行器创建...');
    const config = ValidationRunner.createDefaultConfig();
    const runner = new ValidationRunner(config);
    console.log('✅ 验证运行器创建成功\n');

    // 2. 测试环境变量验证
    console.log('2️⃣ 测试环境变量验证...');
    
    // 创建测试环境变量文件
    const testEnvContent = `
# 测试环境变量文件
SEEDREAM_API_KEY=test-key
SEEDDREAM_CONFIG=test-config
SEEDRAM_VERSION=1.0.0
NODE_ENV=development
`;
    
    const testEnvPath = './test.env';
    await fs.writeFile(testEnvPath, testEnvContent, 'utf-8');
    
    try {
      const envResult = await runner.runEnvironmentValidation(process.cwd());
      console.log(`✅ 环境变量验证完成: 检查了 ${envResult.checkedFiles.length} 个文件`);
      console.log(`   发现变量: ${envResult.foundVariables.length} 个`);
      console.log(`   不一致项: ${envResult.inconsistencies.length} 个`);
      console.log(`   错误: ${envResult.errors.length} 个\n`);
    } finally {
      // 清理测试文件
      try {
        await fs.unlink(testEnvPath);
      } catch (error) {
        // 忽略清理错误
      }
    }

    // 3. 测试报告验证
    console.log('3️⃣ 测试报告验证...');
    
    // 创建测试报告文件
    const testReportContent = {
      serviceName: "SeedRam 3.0",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      results: [
        {
          name: "API 测试",
          status: "passed",
          duration: 1000
        }
      ],
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
        duration: 1000
      }
    };
    
    const testReportPath = './test-report.json';
    await fs.writeFile(testReportPath, JSON.stringify(testReportContent, null, 2), 'utf-8');
    
    try {
      const reportResult = await runner.runReportValidation(process.cwd());
      console.log(`✅ 测试报告验证完成: 检查了 ${reportResult.checkedReports.length} 个报告`);
      console.log(`   格式错误: ${reportResult.formatErrors.length} 个`);
      console.log(`   架构错误: ${reportResult.schemaErrors.length} 个`);
      console.log(`   命名问题: ${reportResult.namingIssues.length} 个\n`);
    } finally {
      // 清理测试文件
      try {
        await fs.unlink(testReportPath);
      } catch (error) {
        // 忽略清理错误
      }
    }

    // 4. 测试 CI 配置验证
    console.log('4️⃣ 测试 CI 配置验证...');
    const ciResult = await runner.runCIValidation(process.cwd());
    console.log(`✅ CI 配置验证完成: 检查了 ${ciResult.checkedConfigs.length} 个配置`);
    console.log(`   配置问题: ${ciResult.configurationIssues.length} 个`);
    console.log(`   缺失步骤: ${ciResult.missingSteps.length} 个`);
    console.log(`   集成状态: ${ciResult.integrationStatus.isIntegrated ? '已集成' : '未集成'}\n`);

    // 5. 测试完整验证流程
    console.log('5️⃣ 测试完整验证流程...');
    const fullResult = await runner.runAll(process.cwd());
    console.log(`✅ 完整验证完成: ${fullResult.summary.passedChecks}/${fullResult.summary.totalChecks} 通过`);
    console.log(`   错误: ${fullResult.errors.length} 个`);
    console.log(`   警告: ${fullResult.warnings.length} 个`);
    console.log(`   耗时: ${fullResult.summary.duration}ms\n`);

    // 6. 测试报告生成
    console.log('6️⃣ 测试报告生成...');
    const reportPath = './validation-test-report.md';
    await runner.generateReport(fullResult, reportPath);
    console.log(`✅ 验证报告已生成: ${reportPath}\n`);

    console.log('🎉 所有验证工具测试通过！');

  } catch (error) {
    console.error('❌ 验证工具测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testValidationTools().catch(console.error);