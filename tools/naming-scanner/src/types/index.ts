/**
 * SeeDream 命名标准化工具 - 类型定义
 */

export interface ScanResult {
  files: FileMatch[];
  totalMatches: number;
  categories: {
    environmentVariables: Match[];
    configKeys: Match[];
    displayNames: Match[];
    fileNames: Match[];
    classNames: Match[];
    variableNames: Match[];
  };
  summary: ScanSummary;
}

export interface FileMatch {
  filePath: string;
  fileType: string;
  matches: Match[];
  totalMatches: number;
}

export interface Match {
  category: MatchCategory;
  line: number;
  column: number;
  originalText: string;
  suggestedFix: string;
  context: string;
  severity: 'high' | 'medium' | 'low';
  pattern: string;
}

export type MatchCategory = 
  | 'environment' 
  | 'config' 
  | 'display' 
  | 'file' 
  | 'class' 
  | 'variable'
  | 'api'
  | 'database';

export interface NamingPattern {
  category: MatchCategory;
  name: string;
  description: string;
  incorrectPatterns: RegExp[];
  correctFormat: string;
  contextRules: ContextRule[];
  severity: 'high' | 'medium' | 'low';
}

export interface ContextRule {
  filePattern: string;
  replacementTemplate: string;
  validationRule: (match: string, context: string) => boolean;
}

export interface ScanSummary {
  totalFiles: number;
  scannedFiles: number;
  skippedFiles: number;
  totalIssues: number;
  issuesByCategory: Record<MatchCategory, number>;
  issuesBySeverity: Record<'high' | 'medium' | 'low', number>;
}

export interface ScanOptions {
  rootPath: string;
  includePatterns: string[];
  excludePatterns: string[];
  fileTypes: string[];
  maxFileSize: number;
  followSymlinks: boolean;
}

export interface ContentMatch {
  matches: Match[];
  content: string;
  filePath: string;
}

// 重构规划相关类型
export interface RefactorPlan {
  id: string;
  timestamp: Date;
  fileRenames: FileRename[];
  contentChanges: ContentChange[];
  referenceUpdates: ReferenceUpdate[];
  dependencies: PlanDependency[];
  conflicts: ConflictInfo[];
  executionOrder: string[];
  metadata: PlanMetadata;
}

export interface RefactorAction {
  id: string;
  type: 'file-rename' | 'content-replace' | 'reference-update';
  source: string;
  target: string;
  dependencies: string[];
  rollbackData: any;
  priority: number;
  estimatedRisk: 'low' | 'medium' | 'high';
}

export interface FileRename extends RefactorAction {
  type: 'file-rename';
  oldPath: string;
  newPath: string;
  updateReferences: boolean;
  affectedFiles: string[];
}

export interface ContentChange extends RefactorAction {
  type: 'content-replace';
  filePath: string;
  replacements: TextReplacement[];
  backupContent: string;
}

export interface ReferenceUpdate extends RefactorAction {
  type: 'reference-update';
  filePath: string;
  oldReference: string;
  newReference: string;
  referenceType: 'import' | 'require' | 'path' | 'config';
}

export interface TextReplacement {
  line: number;
  column: number;
  length: number;
  originalText: string;
  newText: string;
  context: string;
}

export interface PlanDependency {
  actionId: string;
  dependsOn: string[];
  reason: string;
  type: 'file-dependency' | 'reference-dependency' | 'order-dependency';
}

export interface ConflictInfo {
  type: 'file-conflict' | 'reference-conflict' | 'content-conflict';
  description: string;
  affectedActions: string[];
  severity: 'low' | 'medium' | 'high';
  resolution: string;
}

export interface PlanMetadata {
  totalActions: number;
  estimatedDuration: number; // minutes
  riskLevel: 'low' | 'medium' | 'high';
  backupRequired: boolean;
  testingRequired: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  actionId: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

export interface ValidationWarning {
  actionId: string;
  message: string;
  suggestion: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: string[][];
}

export interface DependencyNode {
  id: string;
  filePath: string;
  type: 'file' | 'module' | 'config';
  references: string[];
  referencedBy: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'require' | 'path' | 'config';
  weight: number;
}