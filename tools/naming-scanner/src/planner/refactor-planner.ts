/**
 * SeeDream 命名标准化工具 - 重构规划器
 * 负责分析扫描结果并生成重构计划
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  ScanResult, 
  RefactorPlan, 
  RefactorAction,
  FileRename, 
  ContentChange, 
  ReferenceUpdate,
  PlanDependency,
  ConflictInfo,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DependencyGraph,
  FileMatch
} from '../types/index.js';
import { DependencyAnalyzer } from './dependency-analyzer.js';
import { ConflictDetector } from './conflict-detector.js';

export class RefactorPlanner {
  private dependencyAnalyzer: DependencyAnalyzer;
  private conflictDetector: ConflictDetector;

  constructor() {
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.conflictDetector = new ConflictDetector();
  }

  /**
   * 基于扫描结果创建重构计划
   */
  async createPlan(scanResult: ScanResult, rootPath: string): Promise<RefactorPlan> {
    console.log('📋 开始创建重构计划...');

    const planId = this.generatePlanId();
    
    // 1. 分析文件依赖关系
    console.log('🔍 分析文件依赖关系...');
    const dependencyGraph = await this.dependencyAnalyzer.analyzeDependencies(
      scanResult.files.map(f => f.filePath),
      rootPath
    );

    // 2. 生成重构动作
    console.log('⚙️ 生成重构动作...');
    const actions = await this.generateRefactorActions(scanResult, rootPath);

    // 3. 建立动作依赖关系
    console.log('🔗 建立动作依赖关系...');
    const dependencies = this.buildActionDependencies(actions, dependencyGraph);
    
    // 添加内容变更对文件重命名的依赖
    const actionContentChanges = actions.filter(a => a.type === 'content-replace') as ContentChange[];
    for (const contentChange of actionContentChanges) {
      if (contentChange.dependencies.length > 0) {
        dependencies.push({
          actionId: contentChange.id,
          dependsOn: contentChange.dependencies,
          reason: '内容变更依赖于其他动作',
          type: 'order-dependency'
        });
      }
    }

    // 4. 检测冲突
    console.log('⚠️ 检测潜在冲突...');
    const conflicts = this.conflictDetector.detectConflicts(actions, dependencyGraph);

    // 5. 计算执行顺序
    console.log('📊 计算执行顺序...');
    const executionOrder = this.calculateExecutionOrder(actions, dependencies);

    // 6. 分类动作
    const fileRenames = actions.filter(a => a.type === 'file-rename') as FileRename[];
    const contentChanges = actions.filter(a => a.type === 'content-replace') as ContentChange[];
    const referenceUpdates = actions.filter(a => a.type === 'reference-update') as ReferenceUpdate[];

    const plan: RefactorPlan = {
      id: planId,
      timestamp: new Date(),
      fileRenames,
      contentChanges,
      referenceUpdates,
      dependencies,
      conflicts,
      executionOrder,
      metadata: {
        totalActions: actions.length,
        estimatedDuration: this.estimateDuration(actions),
        riskLevel: this.assessRiskLevel(conflicts, actions),
        backupRequired: true,
        testingRequired: actions.length > 10
      }
    };

    console.log(`✅ 重构计划创建完成: ${actions.length} 个动作, ${conflicts.length} 个冲突`);
    return plan;
  }

  /**
   * 验证重构计划
   */
  validatePlan(plan: RefactorPlan): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // 检查循环依赖
    const cycles = this.detectCycles(plan.dependencies);
    if (cycles.length > 0) {
      errors.push({
        actionId: 'plan',
        message: `检测到 ${cycles.length} 个循环依赖`,
        severity: 'error',
        code: 'CIRCULAR_DEPENDENCY'
      });
    }

    // 检查高风险冲突
    const highRiskConflicts = plan.conflicts.filter(c => c.severity === 'high');
    if (highRiskConflicts.length > 0) {
      warnings.push({
        actionId: 'plan',
        message: `发现 ${highRiskConflicts.length} 个高风险冲突`,
        suggestion: '建议在执行前手动解决这些冲突'
      });
    }

    // 检查文件重命名冲突
    const renameConflicts = this.checkRenameConflicts(plan.fileRenames);
    errors.push(...renameConflicts);

    // 提供优化建议
    if (plan.metadata.totalActions > 50) {
      suggestions.push('考虑分批执行重构，每批不超过50个动作');
    }

    if (plan.metadata.riskLevel === 'high') {
      suggestions.push('建议在测试环境中先执行完整的重构流程');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * 优化重构计划
   */
  optimizePlan(plan: RefactorPlan): RefactorPlan {
    console.log('🔧 优化重构计划...');

    // 1. 合并相似的内容变更
    const optimizedContentChanges = this.mergeContentChanges(plan.contentChanges);

    // 2. 调整优先级
    const optimizedActions = this.adjustPriorities([
      ...plan.fileRenames,
      ...optimizedContentChanges,
      ...plan.referenceUpdates
    ]);

    // 3. 重新计算执行顺序
    const optimizedOrder = this.calculateExecutionOrder(optimizedActions, plan.dependencies);

    return {
      ...plan,
      contentChanges: optimizedContentChanges,
      executionOrder: optimizedOrder,
      fileRenames: optimizedActions.filter(a => a.type === 'file-rename') as FileRename[],
      referenceUpdates: optimizedActions.filter(a => a.type === 'reference-update') as ReferenceUpdate[],
      metadata: {
        ...plan.metadata,
        totalActions: optimizedActions.length,
        estimatedDuration: this.estimateDuration(optimizedActions)
      }
    };
  }

  /**
   * 生成重构动作
   */
  private async generateRefactorActions(scanResult: ScanResult, rootPath: string): Promise<RefactorAction[]> {
    const actions: RefactorAction[] = [];
    let actionCounter = 0;

    for (const fileMatch of scanResult.files) {
      const filePath = path.resolve(rootPath, fileMatch.filePath);
      
      // 检查是否需要文件重命名
      const fileRenameAction = this.createFileRenameAction(fileMatch, actionCounter++);
      if (fileRenameAction) {
        actions.push(fileRenameAction);
      }

      // 创建内容变更动作
      if (fileMatch.matches.length > 0) {
        const contentAction = await this.createContentChangeAction(fileMatch, filePath, actionCounter++);
        if (contentAction) {
          actions.push(contentAction);
        }
      }
    }

    // 生成引用更新动作
    const referenceActions = await this.generateReferenceUpdateActions(actions, rootPath, actionCounter);
    actions.push(...referenceActions);

    return actions;
  }

  /**
   * 创建文件重命名动作
   */
  private createFileRenameAction(fileMatch: FileMatch, actionId: number): FileRename | null {
    const hasFileNamingIssues = fileMatch.matches.some(m => m.category === 'file');
    if (!hasFileNamingIssues) return null;

    const oldPath = fileMatch.filePath;
    const newPath = this.generateNewFileName(oldPath);
    
    if (oldPath === newPath) return null;

    return {
      id: `file-rename-${actionId}`,
      type: 'file-rename',
      source: oldPath,
      target: newPath,
      oldPath,
      newPath,
      updateReferences: true,
      affectedFiles: [], // 将在依赖分析中填充
      dependencies: [],
      rollbackData: { originalPath: oldPath },
      priority: 1,
      estimatedRisk: 'medium'
    };
  }

  /**
   * 创建内容变更动作
   */
  private async createContentChangeAction(
    fileMatch: FileMatch, 
    filePath: string, 
    actionId: number
  ): Promise<ContentChange | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const replacements = fileMatch.matches
        .filter(m => m.category !== 'file') // 文件名问题由重命名动作处理
        .map(match => ({
          line: match.line,
          column: match.column,
          length: match.originalText.length,
          originalText: match.originalText,
          newText: match.suggestedFix,
          context: match.context
        }));

      if (replacements.length === 0) return null;

      return {
        id: `content-change-${actionId}`,
        type: 'content-replace',
        source: fileMatch.filePath,
        target: fileMatch.filePath,
        filePath: fileMatch.filePath,
        replacements,
        backupContent: content,
        dependencies: [],
        rollbackData: { originalContent: content },
        priority: 2,
        estimatedRisk: 'low'
      };
    } catch (error) {
      console.warn(`无法读取文件 ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 生成引用更新动作
   */
  private async generateReferenceUpdateActions(
    actions: RefactorAction[], 
    rootPath: string, 
    startId: number
  ): Promise<ReferenceUpdate[]> {
    const referenceActions: ReferenceUpdate[] = [];
    let actionId = startId;

    const fileRenames = actions.filter(a => a.type === 'file-rename') as FileRename[];
    
    for (const rename of fileRenames) {
      // 查找所有引用了这个文件的其他文件
      const referencingFiles = await this.dependencyAnalyzer.findReferencingFiles(
        rename.oldPath, 
        rootPath
      );

      for (const refFile of referencingFiles) {
        referenceActions.push({
          id: `ref-update-${actionId++}`,
          type: 'reference-update',
          source: refFile,
          target: refFile,
          filePath: refFile,
          oldReference: rename.oldPath,
          newReference: rename.newPath,
          referenceType: this.detectReferenceType(refFile, rename.oldPath),
          dependencies: [rename.id],
          rollbackData: { originalReference: rename.oldPath },
          priority: 3,
          estimatedRisk: 'medium'
        });
      }
    }

    return referenceActions;
  }

  /**
   * 建立动作依赖关系
   */
  private buildActionDependencies(actions: RefactorAction[], dependencyGraph: DependencyGraph): PlanDependency[] {
    const dependencies: PlanDependency[] = [];

    // 文件重命名必须在引用更新之前
    const fileRenames = actions.filter(a => a.type === 'file-rename');
    const referenceUpdates = actions.filter(a => a.type === 'reference-update');

    for (const refUpdate of referenceUpdates) {
      const relatedRename = fileRenames.find(r => 
        refUpdate.dependencies.includes(r.id)
      );
      
      if (relatedRename) {
        dependencies.push({
          actionId: refUpdate.id,
          dependsOn: [relatedRename.id],
          reason: '引用更新必须在文件重命名之后执行',
          type: 'order-dependency'
        });
      }
    }

    // 基于文件依赖关系建立动作依赖
    for (const edge of dependencyGraph.edges) {
      const sourceActions = actions.filter(a => a.source === edge.from);
      const targetActions = actions.filter(a => a.source === edge.to);

      for (const sourceAction of sourceActions) {
        for (const targetAction of targetActions) {
          if (sourceAction.id !== targetAction.id) {
            dependencies.push({
              actionId: targetAction.id,
              dependsOn: [sourceAction.id],
              reason: `文件依赖: ${edge.from} -> ${edge.to}`,
              type: 'file-dependency'
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * 计算执行顺序（拓扑排序）
   */
  private calculateExecutionOrder(actions: RefactorAction[], dependencies: PlanDependency[]): string[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // 初始化图
    for (const action of actions) {
      graph.set(action.id, []);
      inDegree.set(action.id, 0);
    }

    // 构建依赖图
    for (const dep of dependencies) {
      for (const dependsOn of dep.dependsOn) {
        if (graph.has(dependsOn)) {
          graph.get(dependsOn)!.push(dep.actionId);
          inDegree.set(dep.actionId, (inDegree.get(dep.actionId) || 0) + 1);
        }
      }
    }

    // 拓扑排序
    const queue: string[] = [];
    const result: string[] = [];

    // 找到所有入度为0的节点
    for (const [actionId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(actionId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // 更新邻接节点的入度
      for (const neighbor of graph.get(current) || []) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);
        
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 检查是否有循环依赖
    if (result.length !== actions.length) {
      console.warn('⚠️ 检测到循环依赖，使用优先级排序');
      return actions
        .sort((a, b) => a.priority - b.priority)
        .map(a => a.id);
    }

    return result;
  }

  /**
   * 生成新的文件名
   */
  private generateNewFileName(oldPath: string): string {
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    const basename = path.basename(oldPath, ext);

    // 应用命名规则
    let newBasename = basename
      .replace(/seedram/gi, 'seedream')
      .replace(/seeddream/gi, 'seedream')
      .replace(/seed-ram/gi, 'seedream')
      .replace(/seed-dream/gi, 'seedream');

    return path.join(dir, newBasename + ext);
  }

  /**
   * 检测引用类型
   */
  private detectReferenceType(filePath: string, _referencePath: string): 'import' | 'require' | 'path' | 'config' {
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      return 'import';
    }
    
    if (['.json', '.yaml', '.yml'].includes(ext)) {
      return 'config';
    }
    
    return 'path';
  }

  /**
   * 检测循环依赖
   */
  private detectCycles(dependencies: PlanDependency[]): string[][] {
    // 简化的循环检测实现
    const graph = new Map<string, string[]>();
    
    for (const dep of dependencies) {
      if (!graph.has(dep.actionId)) {
        graph.set(dep.actionId, []);
      }
      graph.get(dep.actionId)!.push(...dep.dependsOn);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      for (const neighbor of graph.get(node) || []) {
        dfs(neighbor, [...path]);
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * 检查文件重命名冲突
   */
  private checkRenameConflicts(fileRenames: FileRename[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const targetPaths = new Set<string>();

    for (const rename of fileRenames) {
      if (targetPaths.has(rename.newPath)) {
        errors.push({
          actionId: rename.id,
          message: `文件重命名冲突: 多个文件尝试重命名为 ${rename.newPath}`,
          severity: 'error',
          code: 'RENAME_CONFLICT'
        });
      }
      targetPaths.add(rename.newPath);
    }

    return errors;
  }

  /**
   * 合并内容变更
   */
  private mergeContentChanges(contentChanges: ContentChange[]): ContentChange[] {
    const fileGroups = new Map<string, ContentChange[]>();
    
    // 按文件分组
    for (const change of contentChanges) {
      if (!fileGroups.has(change.filePath)) {
        fileGroups.set(change.filePath, []);
      }
      fileGroups.get(change.filePath)!.push(change);
    }

    const merged: ContentChange[] = [];
    
    // 合并同一文件的多个变更
    for (const [filePath, changes] of fileGroups) {
      if (changes.length === 1 && changes[0]) {
        merged.push(changes[0]);
      } else if (changes.length > 1 && changes[0]) {
        const mergedChange: ContentChange = {
          ...changes[0],
          id: `merged-${changes.map(c => c.id).join('-')}`,
          type: 'content-replace',
          replacements: changes.flatMap(c => c.replacements),
          dependencies: Array.from(new Set(changes.flatMap(c => c.dependencies)))
        };
        merged.push(mergedChange);
      }
    }

    return merged;
  }

  /**
   * 优化执行顺序
   */
  private optimizeExecutionOrder(order: string[], _dependencies: PlanDependency[]): string[] {
    // 简单的优化：将低风险操作提前
    return order; // 暂时返回原顺序，可以后续优化
  }

  /**
   * 调整优先级
   */
  private adjustPriorities(actions: RefactorAction[]): RefactorAction[] {
    return actions.map(action => ({
      ...action,
      priority: this.calculatePriority(action)
    }));
  }

  /**
   * 计算动作优先级
   */
  private calculatePriority(action: RefactorAction): number {
    let priority = action.priority;
    
    // 文件重命名优先级最高
    if (action.type === 'file-rename') priority = 1;
    
    // 内容变更次之
    if (action.type === 'content-replace') priority = 2;
    
    // 引用更新最后
    if (action.type === 'reference-update') priority = 3;
    
    // 根据风险调整
    if (action.estimatedRisk === 'high') priority += 10;
    if (action.estimatedRisk === 'medium') priority += 5;
    
    return priority;
  }

  /**
   * 估算执行时间
   */
  private estimateDuration(actions: RefactorAction[]): number {
    let totalMinutes = 0;
    
    for (const action of actions) {
      switch (action.type) {
        case 'file-rename':
          totalMinutes += 2; // 2分钟每个文件重命名
          break;
        case 'content-replace':
          const contentAction = action as ContentChange;
          totalMinutes += Math.max(1, contentAction.replacements.length * 0.5);
          break;
        case 'reference-update':
          totalMinutes += 1; // 1分钟每个引用更新
          break;
      }
    }
    
    return Math.ceil(totalMinutes);
  }

  /**
   * 评估风险级别
   */
  private assessRiskLevel(conflicts: ConflictInfo[], actions: RefactorAction[]): 'low' | 'medium' | 'high' {
    const highRiskConflicts = conflicts.filter(c => c.severity === 'high').length;
    const highRiskActions = actions.filter(a => a.estimatedRisk === 'high').length;
    
    if (highRiskConflicts > 0 || highRiskActions > 5) return 'high';
    if (conflicts.length > 3 || actions.length > 20) return 'medium';
    return 'low';
  }

  /**
   * 生成计划ID
   */
  private generatePlanId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `refactor-plan-${timestamp}-${random}`;
  }
}