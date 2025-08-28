#!/usr/bin/env node

/**
 * 重构规划器功能验证测试
 */

import { RefactorPlanner } from './dist/planner/refactor-planner.js';
import { DependencyAnalyzer } from './dist/planner/dependency-analyzer.js';
import { ConflictDetector } from './dist/planner/conflict-detector.js';

async function testRefactorPlanner() {
  console.log('🧪 开始重构规划器功能验证测试...\n');

  try {
    // 1. 测试重构规划器创建
    console.log('1️⃣ 测试重构规划器创建...');
    const planner = new RefactorPlanner();
    console.log('✅ 重构规划器创建成功\n');

    // 2. 测试依赖分析器创建
    console.log('2️⃣ 测试依赖分析器创建...');
    const dependencyAnalyzer = new DependencyAnalyzer();
    console.log('✅ 依赖分析器创建成功\n');

    // 3. 测试冲突检测器创建
    console.log('3️⃣ 测试冲突检测器创建...');
    const conflictDetector = new ConflictDetector();
    console.log('✅ 冲突检测器创建成功\n');

    // 4. 测试创建简单的重构计划
    console.log('4️⃣ 测试创建简单的重构计划...');
    const mockScanResult = {
      files: [
        {
          filePath: 'test-file.ts',
          fileType: 'source',
          matches: [
            {
              category: 'environment',
              line: 1,
              column: 7,
              originalText: 'SEEDDREAM_API_KEY',
              suggestedFix: 'SEEDREAM_API_KEY',
              context: 'const SEEDDREAM_API_KEY = process.env.SEEDDREAM_API_KEY;',
              severity: 'high',
              pattern: 'environment-variable'
            }
          ],
          totalMatches: 1
        }
      ],
      totalMatches: 1,
      categories: {
        environmentVariables: [],
        configKeys: [],
        displayNames: [],
        fileNames: [],
        classNames: [],
        variableNames: []
      },
      summary: {
        totalFiles: 1,
        scannedFiles: 1,
        skippedFiles: 0,
        totalIssues: 1,
        issuesByCategory: {
          environment: 1,
          config: 0,
          display: 0,
          file: 0,
          class: 0,
          variable: 0,
          api: 0,
          database: 0
        },
        issuesBySeverity: {
          high: 1,
          medium: 0,
          low: 0
        }
      }
    };

    // 创建一个临时测试文件
    const fs = await import('fs/promises');
    const testFilePath = './test-file.ts';
    await fs.writeFile(testFilePath, 'const SEEDDREAM_API_KEY = process.env.SEEDDREAM_API_KEY;', 'utf-8');

    try {
      const plan = await planner.createPlan(mockScanResult, process.cwd());
      console.log(`✅ 重构计划创建成功: ${plan.metadata.totalActions} 个动作\n`);

      // 5. 测试计划验证
      console.log('5️⃣ 测试计划验证...');
      const validation = planner.validatePlan(plan);
      console.log(`✅ 计划验证完成: ${validation.isValid ? '有效' : '无效'}, ${validation.errors.length} 个错误\n`);

      // 6. 测试计划优化
      console.log('6️⃣ 测试计划优化...');
      const optimizedPlan = planner.optimizePlan(plan);
      console.log(`✅ 计划优化完成: ${optimizedPlan.metadata.totalActions} 个动作\n`);

    } finally {
      // 清理测试文件
      try {
        await fs.unlink(testFilePath);
      } catch (error) {
        // 忽略清理错误
      }
    }

    // 7. 测试冲突检测
    console.log('7️⃣ 测试冲突检测...');
    const mockActions = [
      {
        id: 'test-action-1',
        type: 'file-rename',
        source: 'old-file.ts',
        target: 'new-file.ts',
        oldPath: 'old-file.ts',
        newPath: 'new-file.ts',
        updateReferences: true,
        affectedFiles: [],
        dependencies: [],
        rollbackData: {},
        priority: 1,
        estimatedRisk: 'low'
      }
    ];

    const mockDependencyGraph = {
      nodes: [],
      edges: [],
      cycles: []
    };

    const conflicts = conflictDetector.detectConflicts(mockActions, mockDependencyGraph);
    console.log(`✅ 冲突检测完成: 发现 ${conflicts.length} 个冲突\n`);

    console.log('🎉 所有测试通过！重构规划器功能正常工作。');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testRefactorPlanner().catch(console.error);