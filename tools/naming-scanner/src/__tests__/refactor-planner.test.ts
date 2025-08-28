/**
 * 重构规划器测试
 */

import { RefactorPlanner } from '../planner/refactor-planner.js';
import { DependencyAnalyzer } from '../planner/dependency-analyzer.js';
import { ConflictDetector } from '../planner/conflict-detector.js';
import { ScanResult, FileMatch, Match } from '../types/index.js';

describe('RefactorPlanner', () => {
  let planner: RefactorPlanner;
  let mockScanResult: ScanResult;

  beforeEach(() => {
    planner = new RefactorPlanner();
    
    // 创建模拟扫描结果
    const mockMatches: Match[] = [
      {
        category: 'environment',
        line: 1,
        column: 7,
        originalText: 'SEEDDREAM_API_KEY',
        suggestedFix: 'SEEDREAM_API_KEY',
        context: 'const SEEDDREAM_API_KEY = process.env.SEEDDREAM_API_KEY;',
        severity: 'high',
        pattern: 'environment-variable'
      },
      {
        category: 'class',
        line: 5,
        column: 7,
        originalText: 'SeedRamImageService',
        suggestedFix: 'SeedreamImageService',
        context: 'class SeedRamImageService {',
        severity: 'high',
        pattern: 'class-name'
      }
    ];

    const mockFileMatch: FileMatch = {
      filePath: 'src/services/seedram-image-service.ts',
      fileType: 'source',
      matches: mockMatches,
      totalMatches: 2
    };

    mockScanResult = {
      files: [mockFileMatch],
      totalMatches: 2,
      categories: {
        environmentVariables: [mockMatches[0]!],
        configKeys: [],
        displayNames: [],
        fileNames: [],
        classNames: [mockMatches[1]!],
        variableNames: []
      },
      summary: {
        totalFiles: 1,
        scannedFiles: 1,
        skippedFiles: 0,
        totalIssues: 2,
        issuesByCategory: {
          environment: 1,
          config: 0,
          display: 0,
          file: 0,
          class: 1,
          variable: 0,
          api: 0,
          database: 0
        },
        issuesBySeverity: {
          high: 2,
          medium: 0,
          low: 0
        }
      }
    };
  });

  describe('createPlan', () => {
    it('应该基于扫描结果创建重构计划', async () => {
      const rootPath = '/test/project';
      
      // 模拟依赖分析器
      jest.spyOn(DependencyAnalyzer.prototype, 'analyzeDependencies').mockResolvedValue({
        nodes: [
          {
            id: 'src/services/seedram-image-service.ts',
            filePath: '/test/project/src/services/seedram-image-service.ts',
            type: 'module',
            references: [],
            referencedBy: []
          }
        ],
        edges: [],
        cycles: []
      });

      jest.spyOn(DependencyAnalyzer.prototype, 'findReferencingFiles').mockResolvedValue([]);

      const plan = await planner.createPlan(mockScanResult, rootPath);

      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/^refactor-plan-\d+-[a-z0-9]+$/);
      expect(plan.metadata.totalActions).toBeGreaterThan(0);
      expect(plan.contentChanges.length).toBeGreaterThan(0);
      expect(plan.executionOrder.length).toBe(plan.metadata.totalActions);
    });

    it('应该正确分类重构动作', async () => {
      const rootPath = '/test/project';
      
      jest.spyOn(DependencyAnalyzer.prototype, 'analyzeDependencies').mockResolvedValue({
        nodes: [],
        edges: [],
        cycles: []
      });

      jest.spyOn(DependencyAnalyzer.prototype, 'findReferencingFiles').mockResolvedValue([]);

      const plan = await planner.createPlan(mockScanResult, rootPath);

      expect(plan.fileRenames).toBeDefined();
      expect(plan.contentChanges).toBeDefined();
      expect(plan.referenceUpdates).toBeDefined();
      expect(plan.dependencies).toBeDefined();
    });
  });

  describe('validatePlan', () => {
    it('应该验证有效的重构计划', async () => {
      const rootPath = '/test/project';
      
      jest.spyOn(DependencyAnalyzer.prototype, 'analyzeDependencies').mockResolvedValue({
        nodes: [],
        edges: [],
        cycles: []
      });

      jest.spyOn(DependencyAnalyzer.prototype, 'findReferencingFiles').mockResolvedValue([]);

      const plan = await planner.createPlan(mockScanResult, rootPath);
      const validation = planner.validatePlan(plan);

      expect(validation).toBeDefined();
      expect(validation.isValid).toBeDefined();
      expect(validation.errors).toBeInstanceOf(Array);
      expect(validation.warnings).toBeInstanceOf(Array);
      expect(validation.suggestions).toBeInstanceOf(Array);
    });

    it('应该检测循环依赖', () => {
      const planWithCycles = {
        id: 'test-plan',
        timestamp: new Date(),
        fileRenames: [],
        contentChanges: [],
        referenceUpdates: [],
        dependencies: [
          {
            actionId: 'action1',
            dependsOn: ['action2'],
            reason: 'test',
            type: 'order-dependency' as const
          },
          {
            actionId: 'action2',
            dependsOn: ['action1'],
            reason: 'test',
            type: 'order-dependency' as const
          }
        ],
        conflicts: [],
        executionOrder: ['action1', 'action2'],
        metadata: {
          totalActions: 2,
          estimatedDuration: 5,
          riskLevel: 'low' as const,
          backupRequired: true,
          testingRequired: false
        }
      };

      const validation = planner.validatePlan(planWithCycles);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.code === 'CIRCULAR_DEPENDENCY')).toBe(true);
    });
  });

  describe('optimizePlan', () => {
    it('应该优化重构计划', async () => {
      const rootPath = '/test/project';
      
      jest.spyOn(DependencyAnalyzer.prototype, 'analyzeDependencies').mockResolvedValue({
        nodes: [],
        edges: [],
        cycles: []
      });

      jest.spyOn(DependencyAnalyzer.prototype, 'findReferencingFiles').mockResolvedValue([]);

      const originalPlan = await planner.createPlan(mockScanResult, rootPath);
      const optimizedPlan = planner.optimizePlan(originalPlan);

      expect(optimizedPlan).toBeDefined();
      expect(optimizedPlan.id).toBe(originalPlan.id);
      expect(optimizedPlan.metadata.totalActions).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
  });

  describe('analyzeDependencies', () => {
    it('应该分析文件依赖关系', async () => {
      const filePaths = ['src/index.ts', 'src/utils.ts'];
      const rootPath = '/test/project';

      // 模拟文件系统
      jest.spyOn(require('fs/promises'), 'readFile').mockImplementation((...args: any[]) => {
        const filePath = args[0] as string;
        if (filePath.includes('index.ts')) {
          return Promise.resolve("import { helper } from './utils.js';");
        }
        if (filePath.includes('utils.ts')) {
          return Promise.resolve("export function helper() {}");
        }
        return Promise.reject(new Error('File not found'));
      });

      const graph = await analyzer.analyzeDependencies(filePaths, rootPath);

      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toBeDefined();
      expect(graph.cycles).toBeDefined();
    });
  });

  describe('findReferencingFiles', () => {
    it('应该找到引用指定文件的所有文件', async () => {
      const targetFile = 'src/utils.ts';
      const rootPath = '/test/project';

      // 模拟文件系统扫描
      jest.spyOn(analyzer as any, 'getAllProjectFiles').mockResolvedValue([
        '/test/project/src/index.ts',
        '/test/project/src/app.ts'
      ]);

      jest.spyOn(require('fs/promises'), 'readFile').mockImplementation((...args: any[]) => {
        const filePath = args[0] as string;
        if (filePath.includes('index.ts')) {
          return Promise.resolve("import { helper } from './utils.js';");
        }
        if (filePath.includes('app.ts')) {
          return Promise.resolve("import React from 'react';");
        }
        return Promise.reject(new Error('File not found'));
      });

      const referencingFiles = await analyzer.findReferencingFiles(targetFile, rootPath);

      expect(referencingFiles).toBeInstanceOf(Array);
    });
  });
});

describe('ConflictDetector', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  describe('detectConflicts', () => {
    it('应该检测文件重命名冲突', () => {
      const actions = [
        {
          id: 'rename1',
          type: 'file-rename' as const,
          source: 'file1.ts',
          target: 'newfile.ts',
          oldPath: 'file1.ts',
          newPath: 'newfile.ts',
          updateReferences: true,
          affectedFiles: [],
          dependencies: [],
          rollbackData: {},
          priority: 1,
          estimatedRisk: 'low' as const
        },
        {
          id: 'rename2',
          type: 'file-rename' as const,
          source: 'file2.ts',
          target: 'newfile.ts',
          oldPath: 'file2.ts',
          newPath: 'newfile.ts', // 同样的目标路径
          updateReferences: true,
          affectedFiles: [],
          dependencies: [],
          rollbackData: {},
          priority: 1,
          estimatedRisk: 'low' as const
        }
      ];

      const dependencyGraph = {
        nodes: [],
        edges: [],
        cycles: []
      };

      const conflicts = detector.detectConflicts(actions, dependencyGraph);

      expect(conflicts).toBeInstanceOf(Array);
      expect(conflicts.some(c => c.type === 'file-conflict')).toBe(true);
    });

    it('应该检测引用冲突', () => {
      const actions = [
        {
          id: 'ref-update1',
          type: 'reference-update' as const,
          source: 'app.ts',
          target: 'app.ts',
          filePath: 'app.ts',
          oldReference: 'old-service.ts',
          newReference: 'nonexistent-service.ts',
          referenceType: 'import' as const,
          dependencies: [],
          rollbackData: {},
          priority: 1,
          estimatedRisk: 'medium' as const
        }
      ];

      const dependencyGraph = {
        nodes: [
          {
            id: 'app.ts',
            filePath: '/project/app.ts',
            type: 'module' as const,
            references: ['old-service.ts'],
            referencedBy: []
          }
        ],
        edges: [],
        cycles: []
      };

      const conflicts = detector.detectConflicts(actions, dependencyGraph);

      expect(conflicts).toBeInstanceOf(Array);
      expect(conflicts.some(c => c.type === 'reference-conflict')).toBe(true);
    });
  });
});