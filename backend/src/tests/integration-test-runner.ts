#!/usr/bin/env ts-node

/**
 * 集成测试运行器
 * 用于运行所有随机图片API相关的集成测试
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

// 加载环境变量
config();

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  error?: string;
}

class IntegrationTestRunner {
  private results: TestResult[] = [];

  /**
   * 运行单个测试文件
   */
  private async runTestFile(testFile: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n🧪 运行测试: ${testFile}`);
      console.log('='.repeat(50));
      
      // 运行Jest测试
      execSync(`npm test -- --testPathPattern="${testFile}" --verbose`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ 测试通过: ${testFile} (${duration}ms)`);
      
      return {
        testFile,
        passed: true,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ 测试失败: ${testFile} (${duration}ms)`);
      console.error(error);
      
      return {
        testFile,
        passed: false,
        duration,
        error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)
      };
    }
  }

  /**
   * 运行所有集成测试
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 开始运行随机图片API集成测试套件');
    console.log('='.repeat(60));
    
    // 检查环境配置
    this.checkEnvironment();
    
    const testFiles = [
      'random-image-integration',
      'session-management-integration', 
      'pexels-api-integration'
    ];
    
    // 运行每个测试文件
    for (const testFile of testFiles) {
      const result = await this.runTestFile(testFile);
      this.results.push(result);
    }
    
    // 输出总结报告
    this.printSummary();
  }

  /**
   * 检查测试环境配置
   */
  private checkEnvironment(): void {
    console.log('🔍 检查测试环境配置...');
    
    const requiredEnvVars = [
      'PEXELS_API_KEY',
      'OPENAI_API_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn(`⚠️ 缺少环境变量: ${missingVars.join(', ')}`);
      console.warn('某些测试可能会使用模拟数据');
    } else {
      console.log('✅ 环境配置检查通过');
    }
    
    // 检查API密钥格式
    if (process.env.PEXELS_API_KEY) {
      const apiKey = process.env.PEXELS_API_KEY;
      if (apiKey.length < 30 || apiKey === 'abcdefghijklmnopqrstuvwxyz1234567890123') {
        console.warn('⚠️ PEXELS_API_KEY 似乎是测试密钥，某些集成测试可能会失败');
      } else {
        console.log('✅ Pexels API密钥格式正确');
      }
    }
    
    console.log('');
  }

  /**
   * 打印测试总结报告
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 集成测试总结报告');
    console.log('='.repeat(60));
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`总测试文件数: ${totalTests}`);
    console.log(`通过: ${passedTests} ✅`);
    console.log(`失败: ${failedTests} ❌`);
    console.log(`总耗时: ${(totalDuration / 1000).toFixed(2)}秒`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ 失败的测试:');
      this.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`  - ${result.testFile}: ${result.error || '未知错误'}`);
        });
    }
    
    console.log('\n📋 详细结果:');
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      console.log(`  ${status} ${result.testFile} (${duration}s)`);
    });
    
    if (passedTests === totalTests) {
      console.log('\n🎉 所有集成测试通过！');
      process.exit(0);
    } else {
      console.log('\n💥 部分测试失败，请检查上述错误信息');
      process.exit(1);
    }
  }

  /**
   * 运行特定的测试类别
   */
  async runTestCategory(category: 'api' | 'session' | 'pexels'): Promise<void> {
    console.log(`🎯 运行 ${category} 相关的集成测试`);
    
    let testFile: string;
    switch (category) {
      case 'api':
        testFile = 'random-image-integration';
        break;
      case 'session':
        testFile = 'session-management-integration';
        break;
      case 'pexels':
        testFile = 'pexels-api-integration';
        break;
      default:
        throw new Error(`未知的测试类别: ${category}`);
    }
    
    const result = await this.runTestFile(testFile);
    this.results.push(result);
    this.printSummary();
  }
}

// 命令行接口
async function main() {
  const runner = new IntegrationTestRunner();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 运行所有测试
    await runner.runAllTests();
  } else if (args[0] === '--category' && args[1]) {
    // 运行特定类别的测试
    const category = args[1] as 'api' | 'session' | 'pexels';
    if (['api', 'session', 'pexels'].includes(category)) {
      await runner.runTestCategory(category);
    } else {
      console.error('❌ 无效的测试类别。支持的类别: api, session, pexels');
      process.exit(1);
    }
  } else {
    console.log('用法:');
    console.log('  ts-node integration-test-runner.ts                    # 运行所有集成测试');
    console.log('  ts-node integration-test-runner.ts --category api     # 运行API测试');
    console.log('  ts-node integration-test-runner.ts --category session # 运行会话测试');
    console.log('  ts-node integration-test-runner.ts --category pexels  # 运行Pexels测试');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 测试运行器发生错误:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner };