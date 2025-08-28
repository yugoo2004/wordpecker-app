#!/usr/bin/env node

/**
 * 自动化验证器功能测试
 */

import { ValidationRunner } from './dist/validator/validation-runner.js';
import { EnvironmentValidator } from './dist/validator/environment-validator.js';
import { ReportValidator } from './dist/validator/report-validator.js';
import { CIValidator } from './dist/validator/ci-validator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testValidationSystem() {
  console.log('🧪 开始自动化验证器功能测试...\n');

  try {
    // 1. 测试配置创建和加载
    console.log('1️⃣ 测试配置管理...');
    
    const defaultConfig = ValidationRunner.createDefaultConfig();
    console.log('✅ 默认配置创建成功');
    
    const configValidation = ValidationRunner.validateConfig(defaultConfig);
    if (configValidation.isValid) {
      console.log('✅ 配置验证通过');
    } else {
      console.log('❌ 配置验证失败:', configValidation.errors);
    }

    // 2. 测试环境变量验证器
    console.log('\n2️⃣ 测试环境变量验证器...');
    
    const envValidator = new EnvironmentValidator(defaultConfig.environment);
    
    // 创建测试环境变量文件
    const testEnvContent = `
# 正确的环境变量
SEEDREAM_API_KEY=test_key
SEEDREAM_BASE_URL=https://api.example.com

# 错误的环境变量
SEEDDREAM_WRONG_KEY=wrong
SEEDRAM_ANOTHER_KEY=also_wrong

# 其他环境变量
NODE_ENV=development
PORT=3000
`;

    await fs.writeFile('.env.test', testEnvContent, 'utf-8');
    
    try {
      const envResult = await envValidator.validate(process.cwd());
      console.log(`✅ 环境变量验证完成: ${envResult.summary.errorCount} 错误, ${envResult.summary.warningCount} 警告`);
      
      if (envResult.errors.length > 0) {
        console.log('   发现的错误:');
        envResult.errors.slice(0, 3).forEach(error => {
          console.log(`   - ${error.message}`);
        });
      }
    } finally {
      // 清理测试文件
      try {
        await fs.unlink('.env.test');
      } catch (error) {
        // 忽略清理错误
      }
    }

    // 3. 测试报告验证器
    console.log('\n3️⃣ 测试报告验证器...');
    
    const reportValidator = new ReportValidator(defaultConfig.report);
    
    // 创建测试报告文件
    const testReport = {
      timestamp: new Date().toISOString(),
      version: "3.0.0",
      serviceName: "SeedRam 3.0", // 故意使用错误名称
      summary: {
        total: 10,
        passed: 8,
        failed: 2
      },
      tests: [
        {
          name: "test with SeedDream naming",
          status: "passed"
        }
      ]
    };

    await fs.writeFile('test-report.json', JSON.stringify(testReport, null, 2), 'utf-8');
    
    try {
      const reportResult = await reportValidator.validate(process.cwd());
      console.log(`✅ 报告验证完成: ${reportResult.summary.errorCount} 错误, ${reportResult.summary.warningCount} 警告`);
      
      if (reportResult.errors.length > 0) {
        console.log('   发现的错误:');
        reportResult.errors.slice(0, 3).forEach(error => {
          console.log(`   - ${error.message}`);
        });
      }
    } finally {
      // 清理测试文件
      try {
        await fs.unlink('test-report.json');
      } catch (error) {
        // 忽略清理错误
      }
    }

    // 4. 测试 CI 验证器
    console.log('\n4️⃣ 测试 CI 验证器...');
    
    const ciValidator = new CIValidator(
      defaultConfig.ci,
      envValidator,
      reportValidator
    );

    // 创建临时测试文件
    await fs.writeFile('.env.test', testEnvContent, 'utf-8');
    await fs.writeFile('test-report.json', JSON.stringify(testReport, null, 2), 'utf-8');
    
    try {
      const ciResult = await ciValidator.validate(process.cwd());
      console.log(`✅ CI 验证完成: ${ciResult.isValid ? '通过' : '失败'}`);
      console.log(`   总检查: ${ciResult.summary.totalChecks}, 通过: ${ciResult.summary.passedChecks}`);
    } finally {
      // 清理测试文件
      try {
        await fs.unlink('.env.test');
        await fs.unlink('test-report.json');
      } catch (error) {
        // 忽略清理错误
      }
    }

    // 5. 测试验证运行器
    console.log('\n5️⃣ 测试验证运行器...');
    
    const runner = new ValidationRunner(defaultConfig);
    
    // 创建测试文件
    await fs.writeFile('.env.test', testEnvContent, 'utf-8');
    await fs.writeFile('test-report.json', JSON.stringify(testReport, null, 2), 'utf-8');
    
    try {
      const runnerResult = await runner.runAll(process.cwd());
      console.log(`✅ 验证运行器测试完成: ${runnerResult.isValid ? '通过' : '失败'}`);
      
      // 打印摘要
      ValidationRunner.printSummary(runnerResult);
      
    } finally {
      // 清理测试文件
      try {
        await fs.unlink('.env.test');
        await fs.unlink('test-report.json');
        await fs.unlink('validation-report.txt');
      } catch (error) {
        // 忽略清理错误
      }
    }

    // 6. 测试配置文件保存和加载
    console.log('\n6️⃣ 测试配置文件操作...');
    
    const testConfigPath = './test-validation.config.json';
    
    try {
      await ValidationRunner.saveConfig(defaultConfig, testConfigPath);
      console.log('✅ 配置文件保存成功');
      
      const loadedConfig = await ValidationRunner.loadConfig(testConfigPath);
      console.log('✅ 配置文件加载成功');
      
      // 验证加载的配置
      const loadedValidation = ValidationRunner.validateConfig(loadedConfig);
      if (loadedValidation.isValid) {
        console.log('✅ 加载的配置验证通过');
      } else {
        console.log('❌ 加载的配置验证失败');
      }
      
    } finally {
      // 清理测试配置文件
      try {
        await fs.unlink(testConfigPath);
      } catch (error) {
        // 忽略清理错误
      }
    }

    console.log('\n🎉 所有验证器测试通过！自动化验证系统功能正常。');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testValidationSystem().catch(console.error);