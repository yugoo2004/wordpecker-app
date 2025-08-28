#!/usr/bin/env node

/**
 * 重构规划和依赖分析系统综合测试
 */

import { NamingScanner } from './dist/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testComprehensiveSystem() {
  console.log('🧪 开始重构规划和依赖分析系统综合测试...\n');

  const testDir = './test-project';
  
  try {
    // 1. 创建测试项目结构
    console.log('1️⃣ 创建测试项目结构...');
    await createTestProject(testDir);
    console.log('✅ 测试项目创建完成\n');

    // 2. 初始化命名扫描器
    console.log('2️⃣ 初始化命名扫描器...');
    const scanner = new NamingScanner({
      rootPath: testDir,
      includePatterns: ['**/*.ts', '**/*.js', '**/*.json', '**/*.env*'],
      excludePatterns: ['node_modules/**', 'dist/**'],
      fileTypes: ['source', 'config'],
      maxFileSize: 1024 * 1024, // 1MB
      followSymlinks: false
    });
    console.log('✅ 命名扫描器初始化完成\n');

    // 3. 执行项目扫描
    console.log('3️⃣ 执行项目扫描...');
    const scanResult = await scanner.scanProject();
    console.log(`✅ 扫描完成: 发现 ${scanResult.totalMatches} 个命名问题\n`);

    // 4. 创建重构计划
    console.log('4️⃣ 创建重构计划...');
    const refactorPlan = await scanner.createRefactorPlan(scanResult, testDir);
    console.log('✅ 重构计划创建完成\n');

    // 5. 验证重构计划
    console.log('5️⃣ 验证重构计划...');
    const validation = scanner.validateRefactorPlan(refactorPlan);
    console.log('✅ 重构计划验证完成\n');

    // 6. 优化重构计划
    console.log('6️⃣ 优化重构计划...');
    const optimizedPlan = scanner.optimizeRefactorPlan(refactorPlan);
    console.log('✅ 重构计划优化完成\n');

    // 7. 保存报告
    console.log('7️⃣ 保存扫描报告和重构计划...');
    await scanner.saveReport(scanResult, './test-reports');
    await scanner.saveRefactorPlan(optimizedPlan, './test-reports');
    console.log('✅ 报告保存完成\n');

    // 8. 显示测试结果摘要
    console.log('📊 测试结果摘要:');
    console.log('================');
    console.log(`扫描文件数: ${scanResult.summary.scannedFiles}`);
    console.log(`发现问题数: ${scanResult.totalMatches}`);
    console.log(`重构动作数: ${optimizedPlan.metadata.totalActions}`);
    console.log(`检测冲突数: ${optimizedPlan.conflicts.length}`);
    console.log(`计划有效性: ${validation.isValid ? '✅ 有效' : '❌ 无效'}`);
    console.log(`风险级别: ${optimizedPlan.metadata.riskLevel}`);
    console.log(`预计时间: ${optimizedPlan.metadata.estimatedDuration} 分钟`);
    
    if (optimizedPlan.executionOrder.length > 0) {
      console.log(`执行顺序: ${optimizedPlan.executionOrder.join(' -> ')}`);
    }

    console.log('\n🎉 综合测试完成！重构规划和依赖分析系统运行正常。');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  } finally {
    // 清理测试文件
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.rm('./test-reports', { recursive: true, force: true });
      console.log('\n🧹 测试文件清理完成');
    } catch (error) {
      console.warn('⚠️ 清理测试文件时出错:', error.message);
    }
  }
}

/**
 * 创建测试项目
 */
async function createTestProject(testDir) {
  // 创建目录结构
  await fs.mkdir(testDir, { recursive: true });
  await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src/services'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'config'), { recursive: true });

  // 创建包含命名问题的测试文件
  const files = {
    // 主应用文件 - 包含类名和导入问题
    'src/app.ts': `
import { SeedRamImageService } from './services/seedram-image-service';
import { SeedDreamConfig } from '../config/seeddream-config';

class SeedRamApplication {
  private imageService: SeedRamImageService;
  
  constructor() {
    this.imageService = new SeedRamImageService();
    console.log('SeedRam 3.0 应用启动');
  }
}

export default SeedRamApplication;
`,

    // 服务文件 - 包含类名和文件名问题
    'src/services/seedram-image-service.ts': `
export class SeedRamImageService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.SEEDDREAM_API_KEY || '';
  }
  
  async generateImage(prompt: string): Promise<string> {
    console.log('SeedRam 图像服务生成图片:', prompt);
    return 'generated-image-url';
  }
}
`,

    // 配置文件 - 包含键名问题
    'config/seeddream-config.json': `
{
  "app": {
    "name": "SeedRam 3.0",
    "version": "1.0.0"
  },
  "services": {
    "seedram": {
      "enabled": true,
      "apiEndpoint": "https://api.seedram.com"
    }
  }
}
`,

    // 环境变量文件 - 包含变量名问题
    '.env.example': `
# SeedRam 3.0 配置
SEEDDREAM_API_KEY=your-api-key-here
SEEDRAM_DEBUG=true
SEEDDREAM_LOG_LEVEL=info
`,

    // 包配置文件
    'package.json': `
{
  "name": "seedram-test-project",
  "version": "1.0.0",
  "description": "SeedRam 3.0 测试项目",
  "main": "src/app.ts",
  "scripts": {
    "start": "node dist/app.js"
  }
}
`
  };

  // 写入所有测试文件
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(testDir, filePath);
    await fs.writeFile(fullPath, content.trim(), 'utf-8');
  }
}

// 运行测试
testComprehensiveSystem().catch(console.error);