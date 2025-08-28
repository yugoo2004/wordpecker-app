#!/usr/bin/env node

/**
 * 冲突检测功能验证测试
 */

import { ConflictDetector } from './dist/planner/conflict-detector.js';

async function testConflictDetection() {
  console.log('🧪 开始冲突检测功能验证测试...\n');

  try {
    const detector = new ConflictDetector();

    // 1. 测试文件重命名冲突
    console.log('1️⃣ 测试文件重命名冲突检测...');
    const conflictingRenames = [
      {
        id: 'rename1',
        type: 'file-rename',
        source: 'file1.ts',
        target: 'same-target.ts',
        oldPath: 'file1.ts',
        newPath: 'same-target.ts',
        updateReferences: true,
        affectedFiles: [],
        dependencies: [],
        rollbackData: {},
        priority: 1,
        estimatedRisk: 'low'
      },
      {
        id: 'rename2',
        type: 'file-rename',
        source: 'file2.ts',
        target: 'same-target.ts', // 同样的目标路径 - 应该检测到冲突
        oldPath: 'file2.ts',
        newPath: 'same-target.ts',
        updateReferences: true,
        affectedFiles: [],
        dependencies: [],
        rollbackData: {},
        priority: 1,
        estimatedRisk: 'low'
      }
    ];

    const emptyGraph = { nodes: [], edges: [], cycles: [] };
    const renameConflicts = detector.detectConflicts(conflictingRenames, emptyGraph);
    
    console.log(`✅ 检测到 ${renameConflicts.length} 个文件重命名冲突`);
    if (renameConflicts.length > 0) {
      renameConflicts.forEach(conflict => {
        console.log(`   - ${conflict.type}: ${conflict.description}`);
      });
    }
    console.log();

    // 2. 测试引用冲突
    console.log('2️⃣ 测试引用冲突检测...');
    const referenceActions = [
      {
        id: 'ref-update1',
        type: 'reference-update',
        source: 'app.ts',
        target: 'app.ts',
        filePath: 'app.ts',
        oldReference: 'old-service.ts',
        newReference: 'nonexistent-service.ts', // 不存在的目标
        referenceType: 'import',
        dependencies: [],
        rollbackData: {},
        priority: 1,
        estimatedRisk: 'medium'
      }
    ];

    const graphWithNodes = {
      nodes: [
        {
          id: 'app.ts',
          filePath: '/project/app.ts',
          type: 'module',
          references: ['old-service.ts'],
          referencedBy: []
        }
      ],
      edges: [],
      cycles: []
    };

    const referenceConflicts = detector.detectConflicts(referenceActions, graphWithNodes);
    
    console.log(`✅ 检测到 ${referenceConflicts.length} 个引用冲突`);
    if (referenceConflicts.length > 0) {
      referenceConflicts.forEach(conflict => {
        console.log(`   - ${conflict.type}: ${conflict.description}`);
      });
    }
    console.log();

    // 3. 测试路径冲突
    console.log('3️⃣ 测试路径冲突检测...');
    const pathActions = [
      {
        id: 'path-rename1',
        type: 'file-rename',
        source: 'normal-file.ts',
        target: 'very-long-path-name-that-exceeds-the-maximum-allowed-length-for-file-paths-in-most-operating-systems-especially-windows-which-has-a-260-character-limit-and-this-path-is-definitely-longer-than-that-limit.ts',
        oldPath: 'normal-file.ts',
        newPath: 'very-long-path-name-that-exceeds-the-maximum-allowed-length-for-file-paths-in-most-operating-systems-especially-windows-which-has-a-260-character-limit-and-this-path-is-definitely-longer-than-that-limit.ts',
        updateReferences: true,
        affectedFiles: [],
        dependencies: [],
        rollbackData: {},
        priority: 1,
        estimatedRisk: 'low'
      },
      {
        id: 'path-rename2',
        type: 'file-rename',
        source: 'another-file.ts',
        target: 'CON.ts', // Windows 保留名称
        oldPath: 'another-file.ts',
        newPath: 'CON.ts',
        updateReferences: true,
        affectedFiles: [],
        dependencies: [],
        rollbackData: {},
        priority: 1,
        estimatedRisk: 'low'
      }
    ];

    const pathConflicts = detector.detectConflicts(pathActions, emptyGraph);
    
    console.log(`✅ 检测到 ${pathConflicts.length} 个路径冲突`);
    if (pathConflicts.length > 0) {
      pathConflicts.forEach(conflict => {
        console.log(`   - ${conflict.type}: ${conflict.description}`);
        console.log(`     严重程度: ${conflict.severity}`);
      });
    }
    console.log();

    // 4. 测试依赖循环冲突
    console.log('4️⃣ 测试依赖循环冲突检测...');
    const graphWithCycles = {
      nodes: [
        { id: 'file1.ts', filePath: '/project/file1.ts', type: 'module', references: ['file2.ts'], referencedBy: ['file3.ts'] },
        { id: 'file2.ts', filePath: '/project/file2.ts', type: 'module', references: ['file3.ts'], referencedBy: ['file1.ts'] },
        { id: 'file3.ts', filePath: '/project/file3.ts', type: 'module', references: ['file1.ts'], referencedBy: ['file2.ts'] }
      ],
      edges: [
        { from: 'file1.ts', to: 'file2.ts', type: 'import', weight: 1 },
        { from: 'file2.ts', to: 'file3.ts', type: 'import', weight: 1 },
        { from: 'file3.ts', to: 'file1.ts', type: 'import', weight: 1 }
      ],
      cycles: [['file1.ts', 'file2.ts', 'file3.ts']] // 预定义的循环
    };

    const cycleConflicts = detector.detectConflicts([], graphWithCycles);
    
    console.log(`✅ 检测到 ${cycleConflicts.length} 个依赖循环冲突`);
    if (cycleConflicts.length > 0) {
      cycleConflicts.forEach(conflict => {
        console.log(`   - ${conflict.type}: ${conflict.description}`);
      });
    }
    console.log();

    console.log('🎉 所有冲突检测测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testConflictDetection().catch(console.error);