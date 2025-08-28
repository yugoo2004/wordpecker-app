#!/usr/bin/env node

/**
 * 依赖排序算法验证测试
 */

import { RefactorPlanner } from './dist/planner/refactor-planner.js';

async function testDependencySorting() {
  console.log('🧪 开始依赖排序算法验证测试...\n');

  try {
    const planner = new RefactorPlanner();

    // 创建一个复杂的重构计划来测试依赖排序
    const complexPlan = {
      id: 'test-complex-plan',
      timestamp: new Date(),
      fileRenames: [
        {
          id: 'rename-service',
          type: 'file-rename',
          source: 'old-service.ts',
          target: 'new-service.ts',
          oldPath: 'old-service.ts',
          newPath: 'new-service.ts',
          updateReferences: true,
          affectedFiles: ['app.ts'],
          dependencies: [],
          rollbackData: {},
          priority: 1,
          estimatedRisk: 'medium'
        }
      ],
      contentChanges: [
        {
          id: 'update-imports',
          type: 'content-replace',
          source: 'app.ts',
          target: 'app.ts',
          filePath: 'app.ts',
          replacements: [
            {
              line: 1,
              column: 20,
              length: 15,
              originalText: './old-service',
              newText: './new-service',
              context: "import { Service } from './old-service';"
            }
          ],
          backupContent: "import { Service } from './old-service';",
          dependencies: ['rename-service'],
          rollbackData: {},
          priority: 2,
          estimatedRisk: 'low'
        }
      ],
      referenceUpdates: [
        {
          id: 'update-config',
          type: 'reference-update',
          source: 'config.json',
          target: 'config.json',
          filePath: 'config.json',
          oldReference: 'old-service.ts',
          newReference: 'new-service.ts',
          referenceType: 'config',
          dependencies: ['rename-service'],
          rollbackData: {},
          priority: 3,
          estimatedRisk: 'low'
        }
      ],
      dependencies: [
        {
          actionId: 'update-imports',
          dependsOn: ['rename-service'],
          reason: '引用更新必须在文件重命名之后执行',
          type: 'order-dependency'
        },
        {
          actionId: 'update-config',
          dependsOn: ['rename-service'],
          reason: '配置更新必须在文件重命名之后执行',
          type: 'order-dependency'
        }
      ],
      conflicts: [],
      executionOrder: [],
      metadata: {
        totalActions: 3,
        estimatedDuration: 5,
        riskLevel: 'medium',
        backupRequired: true,
        testingRequired: true
      }
    };

    console.log('1️⃣ 测试计划验证...');
    const validation = planner.validatePlan(complexPlan);
    console.log(`✅ 验证结果: ${validation.isValid ? '有效' : '无效'}`);
    console.log(`   错误数量: ${validation.errors.length}`);
    console.log(`   警告数量: ${validation.warnings.length}`);
    console.log(`   建议数量: ${validation.suggestions.length}\n`);

    if (validation.errors.length > 0) {
      console.log('❌ 发现的错误:');
      validation.errors.forEach(error => {
        console.log(`   - ${error.message} (${error.code})`);
      });
      console.log();
    }

    console.log('2️⃣ 测试计划优化...');
    const optimizedPlan = planner.optimizePlan(complexPlan);
    console.log(`✅ 优化完成:`);
    console.log(`   执行顺序: ${optimizedPlan.executionOrder.join(' -> ')}`);
    console.log(`   总动作数: ${optimizedPlan.metadata.totalActions}`);
    console.log(`   预计时间: ${optimizedPlan.metadata.estimatedDuration} 分钟\n`);

    // 验证执行顺序的正确性
    console.log('3️⃣ 验证执行顺序的正确性...');
    const executionOrder = optimizedPlan.executionOrder;
    
    // 检查 rename-service 是否在其他动作之前
    const renameIndex = executionOrder.indexOf('rename-service');
    const updateImportsIndex = executionOrder.indexOf('update-imports');
    const updateConfigIndex = executionOrder.indexOf('update-config');

    if (renameIndex < updateImportsIndex && renameIndex < updateConfigIndex) {
      console.log('✅ 依赖排序正确: 文件重命名在引用更新之前执行');
    } else {
      console.log('❌ 依赖排序错误: 执行顺序不符合依赖关系');
    }

    console.log('\n🎉 依赖排序算法验证完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testDependencySorting().catch(console.error);