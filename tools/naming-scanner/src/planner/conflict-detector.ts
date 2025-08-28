/**
 * SeeDream 命名标准化工具 - 冲突检测器
 * 负责检测重构过程中可能出现的冲突
 */

import * as path from 'path';
import { 
  RefactorAction, 
  FileRename, 
  ContentChange, 
  ReferenceUpdate,
  ConflictInfo, 
  DependencyGraph 
} from '../types/index.js';

export class ConflictDetector {
  
  /**
   * 检测重构动作中的冲突
   */
  detectConflicts(actions: RefactorAction[], dependencyGraph: DependencyGraph): ConflictInfo[] {
    console.log('⚠️ 检测重构冲突...');
    
    const conflicts: ConflictInfo[] = [];
    
    // 1. 检测文件重命名冲突
    conflicts.push(...this.detectFileRenameConflicts(actions));
    
    // 2. 检测引用冲突
    conflicts.push(...this.detectReferenceConflicts(actions, dependencyGraph));
    
    // 3. 检测内容变更冲突
    conflicts.push(...this.detectContentConflicts(actions));
    
    // 4. 检测路径冲突
    conflicts.push(...this.detectPathConflicts(actions));
    
    // 5. 检测依赖循环冲突
    conflicts.push(...this.detectDependencyCycleConflicts(dependencyGraph));

    console.log(`🔍 检测到 ${conflicts.length} 个潜在冲突`);
    return conflicts;
  }

  /**
   * 检测文件重命名冲突
   */
  private detectFileRenameConflicts(actions: RefactorAction[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const fileRenames = actions.filter(a => a.type === 'file-rename') as FileRename[];
    
    // 1. 检测目标路径冲突
    const targetPaths = new Map<string, string[]>();
    
    for (const rename of fileRenames) {
      const normalizedPath = path.normalize(rename.newPath);
      
      if (!targetPaths.has(normalizedPath)) {
        targetPaths.set(normalizedPath, []);
      }
      targetPaths.get(normalizedPath)!.push(rename.id);
    }

    // 找出冲突的目标路径
    for (const [targetPath, actionIds] of targetPaths) {
      if (actionIds.length > 1) {
        conflicts.push({
          type: 'file-conflict',
          description: `多个文件尝试重命名为同一路径: ${targetPath}`,
          affectedActions: actionIds,
          severity: 'high',
          resolution: '需要为冲突的文件生成唯一的目标路径'
        });
      }
    }

    // 2. 检测大小写敏感冲突（在不区分大小写的文件系统中）
    const caseInsensitivePaths = new Map<string, string[]>();
    
    for (const rename of fileRenames) {
      const lowerPath = rename.newPath.toLowerCase();
      
      if (!caseInsensitivePaths.has(lowerPath)) {
        caseInsensitivePaths.set(lowerPath, []);
      }
      caseInsensitivePaths.get(lowerPath)!.push(rename.id);
    }

    for (const [_lowerPath, actionIds] of caseInsensitivePaths) {
      if (actionIds.length > 1) {
        conflicts.push({
          type: 'file-conflict',
          description: `大小写冲突: 多个文件在不区分大小写的系统中会冲突`,
          affectedActions: actionIds,
          severity: 'medium',
          resolution: '确保文件名在不区分大小写的系统中也是唯一的'
        });
      }
    }

    // 3. 检测循环重命名
    const renameChains = this.detectRenameChains(fileRenames);
    for (const chain of renameChains) {
      if (chain.length > 1 && chain[0] === chain[chain.length - 1]) {
        conflicts.push({
          type: 'file-conflict',
          description: `检测到循环重命名: ${chain.join(' -> ')}`,
          affectedActions: chain.slice(0, -1), // 移除重复的最后一个元素
          severity: 'high',
          resolution: '需要使用临时文件名打破循环'
        });
      }
    }

    return conflicts;
  }

  /**
   * 检测引用冲突
   */
  private detectReferenceConflicts(actions: RefactorAction[], dependencyGraph: DependencyGraph): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const referenceUpdates = actions.filter(a => a.type === 'reference-update') as ReferenceUpdate[];
    const fileRenames = actions.filter(a => a.type === 'file-rename') as FileRename[];

    // 1. 检测缺失的引用更新
    for (const rename of fileRenames) {
      const referencingNodes = dependencyGraph.nodes.filter(node => 
        node.references.includes(rename.oldPath)
      );

      for (const node of referencingNodes) {
        const hasUpdate = referenceUpdates.some(update => 
          update.filePath === node.id && update.oldReference === rename.oldPath
        );

        if (!hasUpdate) {
          conflicts.push({
            type: 'reference-conflict',
            description: `缺失引用更新: ${node.id} 引用了 ${rename.oldPath} 但没有相应的更新动作`,
            affectedActions: [rename.id],
            severity: 'high',
            resolution: `需要为 ${node.id} 添加引用更新动作`
          });
        }
      }
    }

    // 2. 检测重复的引用更新
    const referenceMap = new Map<string, ReferenceUpdate[]>();
    
    for (const update of referenceUpdates) {
      const key = `${update.filePath}:${update.oldReference}`;
      
      if (!referenceMap.has(key)) {
        referenceMap.set(key, []);
      }
      referenceMap.get(key)!.push(update);
    }

    for (const [key, updates] of referenceMap) {
      if (updates.length > 1) {
        conflicts.push({
          type: 'reference-conflict',
          description: `重复的引用更新: ${key}`,
          affectedActions: updates.map(u => u.id),
          severity: 'medium',
          resolution: '合并重复的引用更新动作'
        });
      }
    }

    // 3. 检测引用链断裂
    for (const update of referenceUpdates) {
      const targetExists = actions.some(action => 
        action.source === update.newReference || action.target === update.newReference
      );

      if (!targetExists) {
        // 检查目标文件是否真实存在
        const targetInGraph = dependencyGraph.nodes.some(node => 
          node.id === update.newReference
        );

        if (!targetInGraph) {
          conflicts.push({
            type: 'reference-conflict',
            description: `引用目标不存在: ${update.newReference}`,
            affectedActions: [update.id],
            severity: 'high',
            resolution: `确保引用目标 ${update.newReference} 存在或创建相应的文件`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * 检测内容变更冲突
   */
  private detectContentConflicts(actions: RefactorAction[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const contentChanges = actions.filter(a => a.type === 'content-replace') as ContentChange[];

    // 1. 检测同一文件的重叠变更
    const fileChanges = new Map<string, ContentChange[]>();
    
    for (const change of contentChanges) {
      if (!fileChanges.has(change.filePath)) {
        fileChanges.set(change.filePath, []);
      }
      fileChanges.get(change.filePath)!.push(change);
    }

    for (const [filePath, changes] of fileChanges) {
      if (changes.length > 1) {
        // 检测重叠的文本替换
        const overlaps = this.detectTextReplacementOverlaps(changes);
        
        if (overlaps.length > 0) {
          conflicts.push({
            type: 'content-conflict',
            description: `文件 ${filePath} 中存在重叠的内容变更`,
            affectedActions: changes.map(c => c.id),
            severity: 'high',
            resolution: '合并或重新排序重叠的内容变更'
          });
        }
      }
    }

    // 2. 检测语法破坏风险
    for (const change of contentChanges) {
      const riskLevel = this.assessSyntaxRisk(change);
      
      if (riskLevel === 'high') {
        conflicts.push({
          type: 'content-conflict',
          description: `高语法破坏风险: ${change.filePath}`,
          affectedActions: [change.id],
          severity: 'medium',
          resolution: '建议在变更后进行语法验证'
        });
      }
    }

    return conflicts;
  }

  /**
   * 检测路径冲突
   */
  private detectPathConflicts(actions: RefactorAction[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const fileRenames = actions.filter(a => a.type === 'file-rename') as FileRename[];

    // 1. 检测路径长度限制
    for (const rename of fileRenames) {
      if (rename.newPath.length > 260) { // Windows 路径长度限制
        conflicts.push({
          type: 'file-conflict',
          description: `路径过长: ${rename.newPath} (${rename.newPath.length} 字符)`,
          affectedActions: [rename.id],
          severity: 'medium',
          resolution: '缩短文件路径或目录结构'
        });
      }
    }

    // 2. 检测非法字符
    const illegalChars = /[<>:"|?*\x00-\x1f]/;
    
    for (const rename of fileRenames) {
      if (illegalChars.test(rename.newPath)) {
        conflicts.push({
          type: 'file-conflict',
          description: `路径包含非法字符: ${rename.newPath}`,
          affectedActions: [rename.id],
          severity: 'high',
          resolution: '移除或替换路径中的非法字符'
        });
      }
    }

    // 3. 检测保留名称冲突
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    
    for (const rename of fileRenames) {
      const basename = path.basename(rename.newPath, path.extname(rename.newPath)).toUpperCase();
      
      if (reservedNames.includes(basename)) {
        conflicts.push({
          type: 'file-conflict',
          description: `使用了系统保留名称: ${basename}`,
          affectedActions: [rename.id],
          severity: 'high',
          resolution: '使用不同的文件名'
        });
      }
    }

    return conflicts;
  }

  /**
   * 检测依赖循环冲突
   */
  private detectDependencyCycleConflicts(dependencyGraph: DependencyGraph): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    for (const cycle of dependencyGraph.cycles) {
      if (cycle.length > 1) {
        conflicts.push({
          type: 'reference-conflict',
          description: `检测到依赖循环: ${cycle.join(' -> ')}`,
          affectedActions: cycle,
          severity: 'medium',
          resolution: '重构代码以打破循环依赖'
        });
      }
    }

    return conflicts;
  }

  /**
   * 检测重命名链
   */
  private detectRenameChains(fileRenames: FileRename[]): string[][] {
    const chains: string[][] = [];
    const renameMap = new Map<string, string>();
    
    // 构建重命名映射
    for (const rename of fileRenames) {
      renameMap.set(rename.oldPath, rename.newPath);
    }

    const visited = new Set<string>();
    
    // 查找每个重命名链
    for (const rename of fileRenames) {
      if (visited.has(rename.oldPath)) continue;
      
      const chain: string[] = [];
      let current = rename.oldPath;
      
      while (current && !visited.has(current)) {
        chain.push(current);
        visited.add(current);
        current = renameMap.get(current) || '';
      }
      
      // 如果找到了循环
      if (current && chain.includes(current)) {
        chain.push(current);
      }
      
      if (chain.length > 1) {
        chains.push(chain);
      }
    }

    return chains;
  }

  /**
   * 检测文本替换重叠
   */
  private detectTextReplacementOverlaps(changes: ContentChange[]): Array<{change1: string, change2: string}> {
    const overlaps: Array<{change1: string, change2: string}> = [];

    for (let i = 0; i < changes.length; i++) {
      for (let j = i + 1; j < changes.length; j++) {
        const change1 = changes[i];
        const change2 = changes[j];

        if (!change1 || !change2) continue;

        // 检查每个替换是否重叠
        for (const replacement1 of change1.replacements) {
          for (const replacement2 of change2.replacements) {
            if (this.isTextRangeOverlapping(replacement1, replacement2)) {
              overlaps.push({
                change1: change1.id,
                change2: change2.id
              });
            }
          }
        }
      }
    }

    return overlaps;
  }

  /**
   * 检查文本范围是否重叠
   */
  private isTextRangeOverlapping(
    replacement1: { line: number; column: number; length: number },
    replacement2: { line: number; column: number; length: number }
  ): boolean {
    // 如果不在同一行，不会重叠
    if (replacement1.line !== replacement2.line) {
      return false;
    }

    const start1 = replacement1.column;
    const end1 = replacement1.column + replacement1.length;
    const start2 = replacement2.column;
    const end2 = replacement2.column + replacement2.length;

    // 检查范围重叠
    return !(end1 <= start2 || end2 <= start1);
  }

  /**
   * 评估语法破坏风险
   */
  private assessSyntaxRisk(change: ContentChange): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    for (const replacement of change.replacements) {
      // 检查是否修改了关键语法元素
      const syntaxPatterns = [
        /\bclass\s+\w+/,      // 类定义
        /\bfunction\s+\w+/,   // 函数定义
        /\binterface\s+\w+/,  // 接口定义
        /\btype\s+\w+/,       // 类型定义
        /\bimport\s+/,        // 导入语句
        /\bexport\s+/,        // 导出语句
      ];

      for (const pattern of syntaxPatterns) {
        if (pattern.test(replacement.originalText) || pattern.test(replacement.newText)) {
          riskScore += 2;
        }
      }

      // 检查是否修改了字符串字面量
      if (replacement.originalText.includes('"') || replacement.originalText.includes("'")) {
        riskScore += 1;
      }

      // 检查替换长度差异
      const lengthDiff = Math.abs(replacement.newText.length - replacement.originalText.length);
      if (lengthDiff > 10) {
        riskScore += 1;
      }
    }

    if (riskScore >= 5) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }
}