#!/usr/bin/env node

/**
 * SeeDream 命名规范验证脚本
 * 用于 CI/CD 集成的独立验证脚本
 */

import { ValidationRunner } from '../tools/naming-scanner/dist/validator/validation-runner.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('🚀 开始 SeeDream 命名规范验证...\n');
  
  try {
    // 创建默认配置
    const config = ValidationRunner.createDefaultConfig();
    
    // 从命令行参数获取选项
    const args = process.argv.slice(2);
    const options = parseArgs(args);
    
    // 应用命令行选项
    if (options.strict) {
      config.general.strictMode = true;
      config.general.failOnWarnings = true;
    }
    
    if (options.envOnly) {
      config.reports.enabled = false;
      config.ci.enabled = false;
    }
    
    if (options.reportsOnly) {
      config.environment.enabled = false;
      config.ci.enabled = false;
    }
    
    if (options.ciOnly) {
      config.environment.enabled = false;
      config.reports.enabled = false;
    }
    
    // 运行验证
    const runner = new ValidationRunner(config);
    const result = await runner.runAll(process.cwd());
    
    // 生成报告
    if (options.output) {
      await runner.generateReport(result, options.output);
    }
    
    // 输出结果
    if (result.isValid) {
      console.log('✅ 所有验证检查通过！');
      process.exit(0);
    } else {
      console.log('❌ 验证检查失败，请查看上述错误信息。');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * 解析命令行参数
 */
function parseArgs(args) {
  const options = {
    strict: false,
    envOnly: false,
    reportsOnly: false,
    ciOnly: false,
    output: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--strict':
        options.strict = true;
        break;
      case '--env-only':
        options.envOnly = true;
        break;
      case '--reports-only':
        options.reportsOnly = true;
        break;
      case '--ci-only':
        options.ciOnly = true;
        break;
      case '--output':
      case '-o':
        if (i + 1 < args.length) {
          options.output = args[i + 1];
          i++; // 跳过下一个参数
        }
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }
  
  return options;
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
SeeDream 命名规范验证脚本

用法:
  node scripts/validate-naming.js [选项]

选项:
  --strict          严格模式，警告也会导致失败
  --env-only        仅验证环境变量
  --reports-only    仅验证测试报告
  --ci-only         仅验证 CI/CD 配置
  -o, --output      输出报告文件路径
  -h, --help        显示帮助信息

示例:
  node scripts/validate-naming.js
  node scripts/validate-naming.js --strict
  node scripts/validate-naming.js --env-only --output validation-report.md
  node scripts/validate-naming.js --reports-only
`);
}

// 运行主函数
main().catch(console.error);