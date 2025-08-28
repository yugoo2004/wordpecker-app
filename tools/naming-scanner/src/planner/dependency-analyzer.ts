/**
 * SeeDream 命名标准化工具 - 依赖分析器
 * 负责分析文件间的依赖关系
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DependencyGraph, DependencyNode, DependencyEdge } from '../types/index.js';

export class DependencyAnalyzer {
  private importPatterns = {
    // ES6 imports
    es6Import: /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g,
    
    // CommonJS require
    commonjsRequire: /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    
    // Dynamic imports
    dynamicImport: /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    
    // TypeScript triple-slash references
    tripleSlash: /\/\/\/\s*<reference\s+path\s*=\s*['"`]([^'"`]+)['"`]/g,
    
    // JSON/YAML file references
    configReference: /['"`]([^'"`]*\.(?:json|yaml|yml|env))['"`]/g,
    
    // Relative path references
    pathReference: /['"`](\.[^'"`]*?)['"`]/g
  };

  /**
   * 分析项目文件的依赖关系
   */
  async analyzeDependencies(filePaths: string[], rootPath: string): Promise<DependencyGraph> {
    console.log(`🔍 分析 ${filePaths.length} 个文件的依赖关系...`);
    
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const nodeMap = new Map<string, DependencyNode>();

    // 1. 创建节点
    for (const filePath of filePaths) {
      const absolutePath = path.resolve(rootPath, filePath);
      const node: DependencyNode = {
        id: filePath,
        filePath: absolutePath,
        type: this.determineNodeType(filePath),
        references: [],
        referencedBy: []
      };
      
      nodes.push(node);
      nodeMap.set(filePath, node);
    }

    // 2. 分析每个文件的依赖
    for (const node of nodes) {
      try {
        const dependencies = await this.analyzeFileDependencies(node.filePath, rootPath);
        node.references = dependencies;

        // 创建边
        for (const dep of dependencies) {
          const targetNode = nodeMap.get(dep);
          if (targetNode) {
            targetNode.referencedBy.push(node.id);
            
            edges.push({
              from: node.id,
              to: dep,
              type: this.detectDependencyType(node.filePath, dep),
              weight: 1
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️ 无法分析文件依赖 ${node.filePath}:`, error);
      }
    }

    // 3. 检测循环依赖
    const cycles = this.detectDependencyCycles(nodes, edges);

    const graph: DependencyGraph = {
      nodes,
      edges,
      cycles
    };

    console.log(`✅ 依赖分析完成: ${nodes.length} 个节点, ${edges.length} 条边, ${cycles.length} 个循环`);
    return graph;
  }

  /**
   * 查找引用了指定文件的所有文件
   */
  async findReferencingFiles(targetFile: string, rootPath: string): Promise<string[]> {
    const referencingFiles: string[] = [];
    
    try {
      // 递归扫描所有文件
      const allFiles = await this.getAllProjectFiles(rootPath);
      
      for (const filePath of allFiles) {
        if (filePath === targetFile) continue;
        
        try {
          const references = await this.analyzeFileDependencies(filePath, rootPath);
          if (references.includes(targetFile)) {
            referencingFiles.push(filePath);
          }
        } catch (error) {
          // 忽略无法读取的文件
          continue;
        }
      }
    } catch (error) {
      console.warn(`查找引用文件时出错:`, error);
    }

    return referencingFiles;
  }

  /**
   * 分析单个文件的依赖关系
   */
  private async analyzeFileDependencies(filePath: string, rootPath: string): Promise<string[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const dependencies = new Set<string>();

    // 分析不同类型的依赖
    this.extractImportDependencies(content, filePath, rootPath, dependencies);
    this.extractConfigDependencies(content, filePath, rootPath, dependencies);
    this.extractPathDependencies(content, filePath, rootPath, dependencies);

    return Array.from(dependencies);
  }

  /**
   * 提取 import/require 依赖
   */
  private extractImportDependencies(
    content: string, 
    filePath: string, 
    rootPath: string, 
    dependencies: Set<string>
  ): void {
    const patterns = [
      this.importPatterns.es6Import,
      this.importPatterns.commonjsRequire,
      this.importPatterns.dynamicImport,
      this.importPatterns.tripleSlash
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];
        if (!importPath) continue;
        const resolvedPath = this.resolveImportPath(importPath, filePath, rootPath);
        
        if (resolvedPath && this.isProjectFile(resolvedPath, rootPath)) {
          dependencies.add(path.relative(rootPath, resolvedPath));
        }
      }
    }
  }

  /**
   * 提取配置文件依赖
   */
  private extractConfigDependencies(
    content: string, 
    filePath: string, 
    rootPath: string, 
    dependencies: Set<string>
  ): void {
    let match;
    while ((match = this.importPatterns.configReference.exec(content)) !== null) {
      const configPath = match[1];
      if (!configPath) continue;
      const resolvedPath = this.resolveConfigPath(configPath, filePath, rootPath);
      
      if (resolvedPath && this.isProjectFile(resolvedPath, rootPath)) {
        dependencies.add(path.relative(rootPath, resolvedPath));
      }
    }
  }

  /**
   * 提取路径依赖
   */
  private extractPathDependencies(
    content: string, 
    filePath: string, 
    rootPath: string, 
    dependencies: Set<string>
  ): void {
    let match;
    while ((match = this.importPatterns.pathReference.exec(content)) !== null) {
      const pathRef = match[1];
      if (!pathRef) continue;
      
      // 只处理相对路径
      if (pathRef.startsWith('./') || pathRef.startsWith('../')) {
        const resolvedPath = this.resolveRelativePath(pathRef, filePath, rootPath);
        
        if (resolvedPath && this.isProjectFile(resolvedPath, rootPath)) {
          dependencies.add(path.relative(rootPath, resolvedPath));
        }
      }
    }
  }

  /**
   * 解析 import 路径
   */
  private resolveImportPath(importPath: string, fromFile: string, rootPath: string): string | null {
    try {
      // 相对路径
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        return this.resolveRelativePath(importPath, fromFile, rootPath);
      }

      // 绝对路径（从项目根目录）
      if (importPath.startsWith('/')) {
        return path.resolve(rootPath, importPath.substring(1));
      }

      // 模块路径（node_modules）- 通常不需要处理
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 解析配置文件路径
   */
  private resolveConfigPath(configPath: string, fromFile: string, _rootPath: string): string | null {
    try {
      if (path.isAbsolute(configPath)) {
        return configPath;
      }

      // 相对于当前文件
      const relativePath = path.resolve(path.dirname(fromFile), configPath);
      if (this.fileExists(relativePath)) {
        return relativePath;
      }

      // 相对于项目根目录
      const rootRelativePath = path.resolve(_rootPath, configPath);
      if (this.fileExists(rootRelativePath)) {
        return rootRelativePath;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 解析相对路径
   */
  private resolveRelativePath(relativePath: string, fromFile: string, _rootPath: string): string | null {
    try {
      const basePath = path.dirname(fromFile);
      let resolvedPath = path.resolve(basePath, relativePath);

      // 尝试不同的文件扩展名
      const extensions = ['', '.ts', '.js', '.tsx', '.jsx', '.json', '.yaml', '.yml'];
      
      for (const ext of extensions) {
        const testPath = resolvedPath + ext;
        if (this.fileExists(testPath)) {
          return testPath;
        }
      }

      // 尝试 index 文件
      const indexExtensions = ['/index.ts', '/index.js', '/index.tsx', '/index.jsx'];
      for (const indexExt of indexExtensions) {
        const testPath = resolvedPath + indexExt;
        if (this.fileExists(testPath)) {
          return testPath;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查文件是否存在
   */
  private fileExists(filePath: string): boolean {
    try {
      return require('fs').existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * 检查是否为项目文件
   */
  private isProjectFile(filePath: string, rootPath: string): boolean {
    const relativePath = path.relative(rootPath, filePath);
    
    // 排除 node_modules 和其他外部依赖
    if (relativePath.startsWith('node_modules/') || 
        relativePath.startsWith('../') ||
        path.isAbsolute(relativePath)) {
      return false;
    }

    return true;
  }

  /**
   * 获取所有项目文件
   */
  private async getAllProjectFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            // 跳过常见的忽略目录
            if (!this.shouldSkipDirectory(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            if (this.shouldIncludeFile(entry.name)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // 忽略无法访问的目录
      }
    };

    await scanDirectory(rootPath);
    return files;
  }

  /**
   * 判断是否应该跳过目录
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      'logs',
      'tmp',
      'temp'
    ];
    
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * 判断是否应该包含文件
   */
  private shouldIncludeFile(fileName: string): boolean {
    const includeExtensions = [
      '.ts', '.js', '.tsx', '.jsx',
      '.json', '.yaml', '.yml',
      '.env', '.config.js', '.config.ts'
    ];
    
    return includeExtensions.some(ext => fileName.endsWith(ext));
  }

  /**
   * 确定节点类型
   */
  private determineNodeType(filePath: string): 'file' | 'module' | 'config' {
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.json', '.yaml', '.yml', '.env'].includes(ext)) {
      return 'config';
    }
    
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      return 'module';
    }
    
    return 'file';
  }

  /**
   * 检测依赖类型
   */
  private detectDependencyType(fromFile: string, toFile: string): 'import' | 'require' | 'path' | 'config' {
    const fromExt = path.extname(fromFile).toLowerCase();
    const toExt = path.extname(toFile).toLowerCase();
    
    if (['.json', '.yaml', '.yml', '.env'].includes(toExt)) {
      return 'config';
    }
    
    if (['.ts', '.tsx'].includes(fromExt)) {
      return 'import';
    }
    
    if (['.js', '.jsx'].includes(fromExt)) {
      return 'require';
    }
    
    return 'path';
  }

  /**
   * 检测依赖循环
   */
  private detectDependencyCycles(nodes: DependencyNode[], edges: DependencyEdge[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const edgeMap = new Map<string, string[]>();

    // 构建邻接表
    for (const edge of edges) {
      if (!edgeMap.has(edge.from)) {
        edgeMap.set(edge.from, []);
      }
      edgeMap.get(edge.from)!.push(edge.to);
    }

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // 找到循环
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = edgeMap.get(nodeId) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }

      recursionStack.delete(nodeId);
    };

    // 对每个节点执行 DFS
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }
}